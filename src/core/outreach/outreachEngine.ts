/**
 * HiresWay Outreach & Networking Engine
 *
 * Manages outreach drafting, personalized communication templates, and sent contact logs:
 * 1. Generates context-aware messages referencing verified achievements without hallucinations.
 * 2. Multi-tier persistence (IndexedDB 'outreach' store + localStorage fallback).
 * 3. Scoped per job opportunity, company, or target recipient.
 * 4. Automatic follow-up notifications and reminders.
 */

import { persistentStorageEngine } from '../storage/persistentStorageEngine';
import { userContextService } from '../auth/userContext';
import { notificationEngine } from '../notifications/notificationEngine';
import { UserProfile } from '../profile/types';
import { JobPosting, generateOutreachDraft, OutreachBlueprint } from '../intelligence';

export interface OutreachRecord {
  id: string;
  userId: string;
  jobId?: string;
  company: string;
  recipientName: string;
  recipientRole?: string;
  channel: 'Direct Email' | 'LinkedIn InMail' | 'Referral' | 'Other';
  subjectLine: string;
  bodyText: string;
  status: 'draft' | 'sent' | 'replied' | 'declined';
  sentDate: string;
  followUpDue?: string;
  notes?: string;
}

const STORAGE_KEY = 'careeros_outreach_v1';

class OutreachEngine {
  private records: Map<string, OutreachRecord> = new Map();
  private listeners: Set<(records: OutreachRecord[]) => void> = new Set();
  private isLoaded = false;

  constructor() {
    this.hydrate();
  }

  private async hydrate(): Promise<void> {
    try {
      const items = await persistentStorageEngine.getAll<OutreachRecord>('outreach');
      const userId = userContextService.getUserId();

      if (items && items.length > 0) {
        for (const item of items) {
          if (!item.userId || item.userId === userId) {
            this.records.set(item.id, { ...item, userId });
          }
        }
      } else {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                const record: OutreachRecord = {
                  ...item,
                  userId,
                  id: item.id || `outreach-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                };
                this.records.set(record.id, record);
                await persistentStorageEngine.set('outreach', record);
              }
            }
          }
        }
      }

      this.isLoaded = true;
      this.notify();
    } catch (err) {
      console.warn('Failed to hydrate outreach records:', err);
      this.isLoaded = true;
    }
  }

  public async getRecords(): Promise<OutreachRecord[]> {
    if (!this.isLoaded) {
      await this.hydrate();
    }
    const userId = userContextService.getUserId();
    return Array.from(this.records.values()).filter((r) => r.userId === userId);
  }

  public getRecordsSync(): OutreachRecord[] {
    const userId = userContextService.getUserId();
    return Array.from(this.records.values()).filter((r) => r.userId === userId);
  }

  public async logOutreach(
    data: Omit<OutreachRecord, 'id' | 'userId' | 'sentDate'>
  ): Promise<OutreachRecord> {
    const userId = userContextService.getUserId();
    const id = `outreach-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    const record: OutreachRecord = {
      ...data,
      id,
      userId,
      sentDate: now,
    };

    this.records.set(id, record);
    await persistentStorageEngine.set('outreach', record);
    this.persistLocalMirror();

    // Trigger in-app notification
    await notificationEngine.send({
      title: 'Outreach Logged',
      message: `Logged contact with ${record.recipientName} at ${record.company}`,
      type: 'outreach_due',
      priority: 'normal',
      actionUrl: '/outreach',
    });

    this.notify();
    return record;
  }

  public async updateStatus(
    id: string,
    status: OutreachRecord['status'],
    notes?: string
  ): Promise<OutreachRecord | undefined> {
    const record = this.records.get(id);
    if (!record) return undefined;

    record.status = status;
    if (notes) record.notes = notes;
    await persistentStorageEngine.set('outreach', record);
    this.persistLocalMirror();
    this.notify();
    return record;
  }

  public async deleteRecord(id: string): Promise<void> {
    this.records.delete(id);
    await persistentStorageEngine.delete('outreach', id);
    this.persistLocalMirror();
    this.notify();
  }

  public draftMessage(
    profile: UserProfile,
    job: JobPosting,
    recipientName: string
  ): OutreachBlueprint {
    return generateOutreachDraft(profile, job, recipientName);
  }

  public subscribe(callback: (records: OutreachRecord[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getRecordsSync());
    return () => this.listeners.delete(callback);
  }

  private persistLocalMirror(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const all = Array.from(this.records.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch (e) {
        console.warn('Failed to mirror outreach to localStorage', e);
      }
    }
  }

  private notify(): void {
    const items = this.getRecordsSync();
    this.listeners.forEach((cb) => {
      try {
        cb(items);
      } catch (err) {
        console.error('OutreachEngine listener error:', err);
      }
    });
  }
}

export const outreachEngine = new OutreachEngine();
