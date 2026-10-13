/**
 * CareerOs User Job State Manager
 *
 * Dedicated persistent store for user-specific job read/unread ("NEW"),
 * interaction, and tracking state.
 *
 * Core Principles:
 * 1. A job is "NEW" if and only if the user has NOT seen it yet (isNew === true && viewedAt == null).
 * 2. Once a job is viewed (viewedAt != null), it is PERMANENTLY marked as read.
 * 3. Subsequent discovery runs, page refreshes, or source syncs MUST NOT reset read state.
 * 4. User read/unread state is isolated and persisted to localStorage.
 */

export interface UserJobRecord {
  jobId: string;
  viewedAt: string | null;
  isNew: boolean;
  savedAt?: string | null;
  rejectedAt?: string | null;
  lastInteractedAt?: string | null;
}

const STORAGE_KEY = 'careeros_user_job_state_v1';

export class UserJobStateManager {
  private states: Map<string, UserJobRecord> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((r: UserJobRecord) => {
              if (r && r.jobId) {
                this.states.set(r.jobId, {
                  jobId: r.jobId,
                  viewedAt: r.viewedAt || null,
                  isNew: r.viewedAt ? false : Boolean(r.isNew),
                  savedAt: r.savedAt,
                  rejectedAt: r.rejectedAt,
                  lastInteractedAt: r.lastInteractedAt,
                });
              }
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load user job state:', e);
    }
  }

  public persist(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const arr = Array.from(this.states.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      }
    } catch (e) {
      console.warn('Failed to persist user job state:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }

  public getState(jobId: string): UserJobRecord | undefined {
    return this.states.get(jobId);
  }

  /**
   * Returns true if the job is unread ("NEW") for the user.
   * If viewedAt != null, it is guaranteed to return false.
   */
  public isJobUnread(jobId: string, fallbackIsNew?: boolean): boolean {
    const s = this.states.get(jobId);
    if (s) {
      if (s.viewedAt) return false;
      return Boolean(s.isNew);
    }
    return Boolean(fallbackIsNew);
  }

  /**
   * Returns viewedAt timestamp if viewed, or null
   */
  public getViewedAt(jobId: string): string | null {
    return this.states.get(jobId)?.viewedAt || null;
  }

  /**
   * Marks a job as viewed / read immediately.
   * Sets isNew = false and viewedAt = current timestamp.
   * Persists permanently.
   */
  public markViewed(jobId: string): UserJobRecord {
    const existing = this.states.get(jobId);
    const now = new Date().toISOString();
    const updated: UserJobRecord = {
      jobId,
      viewedAt: existing?.viewedAt || now,
      isNew: false,
      savedAt: existing?.savedAt,
      rejectedAt: existing?.rejectedAt,
      lastInteractedAt: now,
    };
    this.states.set(jobId, updated);
    this.persist();
    this.notify();
    return updated;
  }

  /**
   * Registers a discovered job.
   * If the job was already seen/viewed, its read state is strictly preserved.
   * If genuinely new, it starts with isNew = true and viewedAt = null.
   */
  public registerDiscoveredJob(jobId: string, isGenuinelyNew: boolean): UserJobRecord {
    const existing = this.states.get(jobId);
    if (existing) {
      // If previously viewed, NEVER reset to new
      if (existing.viewedAt) {
        existing.isNew = false;
        return existing;
      }
      return existing;
    }

    const newRecord: UserJobRecord = {
      jobId,
      viewedAt: null,
      isNew: isGenuinelyNew,
      lastInteractedAt: new Date().toISOString(),
    };
    this.states.set(jobId, newRecord);
    this.persist();
    return newRecord;
  }

  /**
   * Marks job as saved without marking it as viewed (unless already viewed)
   */
  public markSaved(jobId: string): UserJobRecord {
    const existing = this.states.get(jobId);
    const now = new Date().toISOString();
    const updated: UserJobRecord = {
      jobId,
      viewedAt: existing?.viewedAt || null,
      isNew: existing ? existing.isNew : true,
      savedAt: now,
      rejectedAt: existing?.rejectedAt,
      lastInteractedAt: now,
    };
    this.states.set(jobId, updated);
    this.persist();
    this.notify();
    return updated;
  }

  /**
   * Unmarks job as saved
   */
  public unmarkSaved(jobId: string): UserJobRecord | undefined {
    const existing = this.states.get(jobId);
    if (!existing) return undefined;
    existing.savedAt = null;
    this.persist();
    this.notify();
    return existing;
  }

  /**
   * Marks job as rejected
   */
  public markRejected(jobId: string): UserJobRecord {
    const existing = this.states.get(jobId);
    const now = new Date().toISOString();
    const updated: UserJobRecord = {
      jobId,
      viewedAt: existing?.viewedAt || now,
      isNew: false,
      savedAt: existing?.savedAt,
      rejectedAt: now,
      lastInteractedAt: now,
    };
    this.states.set(jobId, updated);
    this.persist();
    this.notify();
    return updated;
  }

  public isJobRejected(jobId: string): boolean {
    const record = this.states.get(jobId);
    return Boolean(record?.rejectedAt);
  }

  public getRejectedCount(): number {
    let count = 0;
    this.states.forEach((s) => {
      if (s.rejectedAt) count++;
    });
    return count;
  }

  public unreject(jobId: string): void {
    const existing = this.states.get(jobId);
    if (existing) {
      existing.rejectedAt = null;
      this.persist();
      this.notify();
    }
  }

  public clear(): void {
    this.states.clear();
    this.persist();
    this.notify();
  }
}

export const userJobStateManager = new UserJobStateManager();
