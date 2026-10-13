/**
 * HiresWay Interview Preparation & STAR Intelligence Engine
 *
 * Manages tailored interview preparation sessions, behavioral STAR narratives,
 * technical deep-dive briefs, and practice responses:
 * 1. Deterministic generation of STAR briefs mapped to candidate genuine achievements.
 * 2. Multi-tier persistence (IndexedDB 'interview_sessions' store + localStorage fallback).
 * 3. Scoped per job opportunity, company, or application record.
 * 4. User isolation and zero fake facts/integrity enforcement.
 */

import { persistentStorageEngine } from '../storage/persistentStorageEngine';
import { userContextService } from '../auth/userContext';
import { notificationEngine } from '../notifications/notificationEngine';
import { UserProfile } from '../profile/types';
import { JobPosting, generateInterviewBrief, InterviewBrief } from '../intelligence';

export interface PracticeAnswer {
  questionId: string;
  question: string;
  userAnswer: string;
  feedback?: string;
  updatedAt: string;
}

export interface InterviewSessionRecord {
  id: string;
  userId: string;
  jobId: string;
  applicationId?: string;
  roleTitle: string;
  company: string;
  briefData: InterviewBrief;
  notes: string;
  practiceAnswers?: PracticeAnswer[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'careeros_interview_prep_v1';

class InterviewPrepEngine {
  private sessions: Map<string, InterviewSessionRecord> = new Map();
  private listeners: Set<(sessions: InterviewSessionRecord[]) => void> = new Set();
  private isLoaded = false;

  constructor() {
    this.hydrate();
  }

  private async hydrate(): Promise<void> {
    try {
      const items = await persistentStorageEngine.getAll<InterviewSessionRecord>('interview_sessions');
      const userId = userContextService.getUserId();

      if (items && items.length > 0) {
        for (const item of items) {
          if (!item.userId || item.userId === userId) {
            this.sessions.set(item.id, { ...item, userId });
          }
        }
      } else {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                const record: InterviewSessionRecord = {
                  ...item,
                  userId,
                  id: item.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                };
                this.sessions.set(record.id, record);
                await persistentStorageEngine.set('interview_sessions', record);
              }
            }
          }
        }
      }

      this.isLoaded = true;
      this.notify();
    } catch (err) {
      console.warn('Failed to hydrate interview sessions:', err);
      this.isLoaded = true;
    }
  }

  public async getSessions(): Promise<InterviewSessionRecord[]> {
    if (!this.isLoaded) {
      await this.hydrate();
    }
    const userId = userContextService.getUserId();
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  public getSessionsSync(): InterviewSessionRecord[] {
    const userId = userContextService.getUserId();
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  public async getSessionByJobId(jobId: string): Promise<InterviewSessionRecord | undefined> {
    const sessions = await this.getSessions();
    return sessions.find((s) => s.jobId === jobId);
  }

  public async saveSession(
    data: Omit<InterviewSessionRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<InterviewSessionRecord> {
    const userId = userContextService.getUserId();
    // Check if session for this job already exists
    const existing = Array.from(this.sessions.values()).find(
      (s) => s.userId === userId && s.jobId === data.jobId
    );

    const now = new Date().toISOString();
    const id = existing ? existing.id : `intv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const record: InterviewSessionRecord = {
      ...data,
      id,
      userId,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    this.sessions.set(id, record);
    await persistentStorageEngine.set('interview_sessions', record);
    this.persistLocalMirror();

    await notificationEngine.send({
      title: 'Interview Brief Prepared',
      message: `Saved prep notes & STAR briefs for ${record.roleTitle} at ${record.company}`,
      type: 'system',
      priority: 'low',
      actionUrl: `/interviews?jobId=${record.jobId}`,
    });

    this.notify();
    return record;
  }

  public generateBrief(profile: UserProfile, job: JobPosting): InterviewBrief {
    return generateInterviewBrief(profile, job);
  }

  public subscribe(callback: (sessions: InterviewSessionRecord[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getSessionsSync());
    return () => this.listeners.delete(callback);
  }

  private persistLocalMirror(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const all = Array.from(this.sessions.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch (e) {
        console.warn('Failed to mirror interview sessions to localStorage', e);
      }
    }
  }

  private notify(): void {
    const items = this.getSessionsSync();
    this.listeners.forEach((cb) => {
      try {
        cb(items);
      } catch (err) {
        console.error('InterviewPrepEngine listener error:', err);
      }
    });
  }
}

export const interviewPrepEngine = new InterviewPrepEngine();
