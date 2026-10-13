/**
 * HiresWay Application Pipeline Engine
 *
 * Central canonical engine managing the candidate application lifecycle:
 * saved -> applied -> screening -> interviewing -> offer -> rejected.
 *
 * Guarantees:
 * 1. Bidirectional sync with JobRepository (marking applied updates JobOpportunity.lifecycleState).
 * 2. Multi-tier persistence (IndexedDB 'applications' store + localStorage fallback).
 * 3. User isolation via UserContextService.
 * 4. Reactive event subscription for dashboard metrics and analytics.
 */

import { persistentStorageEngine } from '../storage/persistentStorageEngine';
import { userContextService } from '../auth/userContext';
import { jobRepository } from '../jobs/jobRepository';
import { notificationEngine } from '../notifications/notificationEngine';

export type ApplicationStage =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected';

export interface ApplicationContact {
  id: string;
  name: string;
  role: string;
  email?: string;
  linkedinUrl?: string;
  notes?: string;
}

export interface ApplicationRecord {
  id: string;
  userId: string;
  jobId: string;
  roleTitle: string;
  company: string;
  companyDomain?: string;
  location: string;
  salary: string;
  stage: ApplicationStage;
  appliedDate: string;
  lastUpdated: string;
  nextStep: string;
  matchScore: number;
  notes?: string;
  contacts?: ApplicationContact[];
  followUpDate?: string;
}

const STORAGE_KEY = 'careeros_applications_v2';
const LEGACY_STORAGE_KEY = 'careeros_applications_v1';

class ApplicationEngine {
  private applications: Map<string, ApplicationRecord> = new Map();
  private listeners: Set<(apps: ApplicationRecord[]) => void> = new Set();
  private isLoaded = false;

  constructor() {
    this.hydrate();
  }

  private async hydrate(): Promise<void> {
    try {
      const idbItems = await persistentStorageEngine.getAll<ApplicationRecord>('applications');
      const userId = userContextService.getUserId();

      if (idbItems && idbItems.length > 0) {
        for (const item of idbItems) {
          if (!item.userId || item.userId === userId) {
            this.applications.set(item.id, { ...item, userId });
          }
        }
      } else {
        // Fallback or migration from local storage
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                const record: ApplicationRecord = {
                  ...item,
                  userId,
                  id: item.id || `app-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                };
                this.applications.set(record.id, record);
                await persistentStorageEngine.set('applications', record);
              }
            }
          }
        }
      }

      this.isLoaded = true;
      this.notify();
    } catch (err) {
      console.warn('Failed to hydrate applications:', err);
      this.isLoaded = true;
    }
  }

  public async getApplications(): Promise<ApplicationRecord[]> {
    if (!this.isLoaded) {
      await this.hydrate();
    }
    const userId = userContextService.getUserId();
    return Array.from(this.applications.values()).filter((a) => a.userId === userId);
  }

  public getApplicationsSync(): ApplicationRecord[] {
    const userId = userContextService.getUserId();
    return Array.from(this.applications.values()).filter((a) => a.userId === userId);
  }

  public async getApplicationById(id: string): Promise<ApplicationRecord | undefined> {
    if (!this.isLoaded) {
      await this.hydrate();
    }
    return this.applications.get(id);
  }

  public async getApplicationByJobId(jobId: string): Promise<ApplicationRecord | undefined> {
    const apps = await this.getApplications();
    return apps.find((a) => a.jobId === jobId);
  }

  public async createApplication(
    data: Omit<ApplicationRecord, 'id' | 'userId' | 'lastUpdated'>
  ): Promise<ApplicationRecord> {
    const userId = userContextService.getUserId();
    const id = `app-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    const record: ApplicationRecord = {
      ...data,
      id,
      userId,
      lastUpdated: now,
    };

    this.applications.set(id, record);
    await persistentStorageEngine.set('applications', record);

    // Bidirectional sync with JobRepository
    if (record.jobId) {
      if (record.stage === 'applied') {
        jobRepository.markApplied(record.jobId, record.notes);
      } else if (record.stage === 'saved') {
        jobRepository.markSaved(record.jobId);
      }
    }

    // Mirror to LocalStorage
    this.persistLocalMirror();

    // Notify user
    await notificationEngine.send({
      title: 'Application Tracked',
      message: `Started tracking ${record.roleTitle} at ${record.company} (${record.stage.toUpperCase()})`,
      type: 'application_update',
      priority: 'normal',
      actionUrl: '/applications',
    });

    this.notify();
    return record;
  }

  public async updateStage(id: string, stage: ApplicationStage): Promise<ApplicationRecord | undefined> {
    const record = this.applications.get(id);
    if (!record) return undefined;

    record.stage = stage;
    record.lastUpdated = new Date().toISOString();

    if (stage === 'applied' && !record.appliedDate) {
      record.appliedDate = new Date().toISOString().split('T')[0];
    }

    await persistentStorageEngine.set('applications', record);

    // Bidirectional sync with JobRepository
    if (record.jobId) {
      if (stage === 'applied') {
        jobRepository.markApplied(record.jobId, record.notes);
      } else if (stage === 'saved') {
        jobRepository.markSaved(record.jobId);
      }
    }

    this.persistLocalMirror();
    this.notify();
    return record;
  }

  public async updateApplication(
    id: string,
    updates: Partial<Omit<ApplicationRecord, 'id' | 'userId'>>
  ): Promise<ApplicationRecord | undefined> {
    const record = this.applications.get(id);
    if (!record) return undefined;

    Object.assign(record, updates, { lastUpdated: new Date().toISOString() });
    await persistentStorageEngine.set('applications', record);

    if (updates.stage && record.jobId) {
      if (updates.stage === 'applied') {
        jobRepository.markApplied(record.jobId, record.notes);
      } else if (updates.stage === 'saved') {
        jobRepository.markSaved(record.jobId);
      }
    }

    this.persistLocalMirror();
    this.notify();
    return record;
  }

  public async deleteApplication(id: string): Promise<void> {
    this.applications.delete(id);
    await persistentStorageEngine.delete('applications', id);
    this.persistLocalMirror();
    this.notify();
  }

  public subscribe(callback: (apps: ApplicationRecord[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getApplicationsSync());
    return () => this.listeners.delete(callback);
  }

  private persistLocalMirror(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const all = Array.from(this.applications.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch (e) {
        console.warn('Failed to mirror applications to localStorage', e);
      }
    }
  }

  private notify(): void {
    const apps = this.getApplicationsSync();
    this.listeners.forEach((cb) => {
      try {
        cb(apps);
      } catch (err) {
        console.error('ApplicationEngine listener error:', err);
      }
    });
  }
}

export const applicationEngine = new ApplicationEngine();
