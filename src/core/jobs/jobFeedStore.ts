/**
 * CareerOS Job Feed Store & Lifecycle Engine
 *
 * Dedicated state and persistence layer for the personalized Job Feed.
 *
 * Architecture Separation:
 * Discovery Engine -> Verification -> Profile Relevance & Filter Validation
 * -> Publish to JOB FEED STORE -> (Optional Explicit User Save) -> JOB DATABASE
 *
 * Retention Rules:
 * 1. Unopened jobs remain in active feed for 7 days from published_to_feed_at.
 * 2. Opened/viewed jobs remain in active feed for 14 days from first_viewed_at
 *    (never removed before 14 days).
 * 3. Expiration archives from active feed while strictly preserving any
 *    saved/applied/imported records in the permanent Job Database.
 * 4. Viewing a job NEVER auto-saves it to the Job Database.
 */

import {
  JobOpportunity,
  FeedItem,
  MAX_JOB_AGE_DAYS,
} from './types';
import { jobRepository } from './jobRepository';
import { jobVerificationEngine } from './jobVerificationEngine';
import { normalizeString } from './jobPipeline';
import { persistentStorageEngine } from '../storage/persistentStorageEngine';

const FEED_STORAGE_KEY = 'careeros_job_feed_v2';
export const FEED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days active retention in Feed
const VIEWED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days active retention from viewing

function cleanCompanyName(company: string): string {
  return normalizeString(company || '')
    .replace(/\b(inc|incorporated|llc|corp|corporation|ltd|limited|pvt|private|technologies|technology|tech|solutions)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeCompanyTitleLocKey(company: string, title: string, location?: string): string {
  const normComp = cleanCompanyName(company);
  const normTitle = normalizeString(title || '')
    .replace(/\b(india|worldwide|remote|us|usa|emea|apac|uk|singapore|bangalore|bengaluru|sf|san francisco|london|berlin)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const normLoc = location
    ? (location.toLowerCase().includes('remote') ? 'remote' : normalizeString(location).replace(/\s+/g, ' ').trim())
    : '';
  return `${normComp}::${normTitle}::${normLoc}`;
}

export class JobFeedStore {
  private feedItems: Map<string, FeedItem> = new Map();
  private listeners: Set<() => void> = new Set();
  private persistTimer: any = null;

  // Hydration & Persistence State Observability
  private isHydrated = false;
  private isHydrating = false;
  private hydrationPromise: Promise<void> | null = null;
  private lastPersistTimestamp: string | null = null;
  private lastPersistError: string | null = null;
  private dirtyItemIds: Set<string> = new Set();

  // Secondary indexes for deduplication
  private urlIndex: Map<string, string> = new Map();
  private externalIdIndex: Map<string, string> = new Map();
  private companyTitleLocIndex: Map<string, string> = new Map();
  private fingerprintIndex: Map<string, string> = new Map();

  constructor() {
    this.loadFromStorage();
    this.hydrationPromise = this.hydrateFromIndexedDb().catch((err) => {
      this.lastPersistError = err instanceof Error ? err.message : 'Hydration failed';
    });
  }

  private getStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage;
      }
    } catch {
      // Storage unavailable
    }
    return null;
  }

  private indexItem(item: FeedItem): void {
    const job = item.job;
    const urls = [
      job.canonicalUrl,
      job.canonical_job_url,
      job.official_job_url,
      job.jobUrl,
      job.applyUrl,
    ];
    for (const u of urls) {
      if (u && u !== '#') {
        const canonical = jobVerificationEngine.getCanonicalUrl(u);
        if (canonical && canonical !== '#') {
          this.urlIndex.set(canonical, item.id);
        }
        this.urlIndex.set(u, item.id);
      }
    }

    const sourceId = job.sourceId || job.source?.id;
    if (job.externalId) {
      this.externalIdIndex.set(job.externalId, item.id);
      if (sourceId) {
        this.externalIdIndex.set(`${sourceId}::${job.externalId}`, item.id);
      }
    }
    if (job.sourceJobId) {
      this.externalIdIndex.set(job.sourceJobId, item.id);
      if (sourceId) {
        this.externalIdIndex.set(`${sourceId}::${job.sourceJobId}`, item.id);
      }
    }

    if (job.company && job.title) {
      const ctLocKey = makeCompanyTitleLocKey(job.company, job.title, job.location);
      this.companyTitleLocIndex.set(ctLocKey, item.id);
    }

    if (job.fingerprint) {
      this.fingerprintIndex.set(job.fingerprint, item.id);
    }
  }

  private rebuildIndexes(): void {
    this.urlIndex.clear();
    this.externalIdIndex.clear();
    this.companyTitleLocIndex.clear();
    this.fingerprintIndex.clear();

    for (const item of this.feedItems.values()) {
      this.indexItem(item);
    }
  }

  private loadFromStorage(): void {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(FEED_STORAGE_KEY);
      if (raw) {
        const parsed: FeedItem[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.feedItems.clear();
          for (const item of parsed) {
            if (item && item.id && item.job) {
              this.feedItems.set(item.id, item);
            }
          }
          this.rebuildIndexes();
          return;
        }
      }

      // Initial migration: If feed store is empty, migrate existing active opportunities
      this.migrateFromRepository();
    } catch (e) {
      console.warn('Failed to load JobFeedStore from storage:', e);
      this.migrateFromRepository();
    }
  }

  private migrateFromRepository(): void {
    try {
      const initialJobs = jobRepository.getActiveOpportunities(MAX_JOB_AGE_DAYS);
      const now = new Date();
      const nowIso = now.toISOString();

      for (const job of initialJobs) {
        const publishedAt = job.originalPostedAt || job.datePosted || nowIso;
        const viewedAt = job.viewed_at || job.viewedAt;
        const isSaved = job.lifecycleState === 'SAVED' || job.is_saved;
        const pubTime = new Date(publishedAt).getTime();
        const baseTime = isNaN(pubTime) ? now.getTime() : pubTime;

        const expiresAt = viewedAt
          ? new Date(new Date(viewedAt).getTime() + VIEWED_RETENTION_MS).toISOString()
          : new Date(baseTime + FEED_RETENTION_MS).toISOString();

        const feedItem: FeedItem = {
          id: job.id,
          job: {
            ...job,
            is_new: !viewedAt,
            isNew: !viewedAt,
          },
          discovered_at: job.dateDiscovered || publishedAt,
          published_to_feed_at: publishedAt,
          first_viewed_at: viewedAt || undefined,
          feed_expires_at: expiresAt,
          saved_to_database_at: isSaved ? nowIso : undefined,
          is_pending: false,
        };

        this.feedItems.set(feedItem.id, feedItem);
      }

      this.rebuildIndexes();
      this.persist();
    } catch (e) {
      console.warn('Migration to JobFeedStore failed:', e);
    }
  }

  private async hydrateFromIndexedDb(): Promise<void> {
    this.isHydrating = true;
    try {
      const persisted = await persistentStorageEngine.getAll<FeedItem>('job_feed_items');
      if (persisted && persisted.length > 0) {
        let changed = false;
        for (const item of persisted) {
          if (item && item.id && item.job) {
            const existing = this.feedItems.get(item.id);
            if (!existing) {
              this.feedItems.set(item.id, item);
              this.indexItem(item);
              changed = true;
            } else {
              // Authoritative IndexedDB merge: restore full rich fields without losing in-flight user actions
              const merged: FeedItem = {
                ...item,
                first_viewed_at: existing.first_viewed_at || item.first_viewed_at,
                saved_to_database_at: existing.saved_to_database_at || item.saved_to_database_at,
                dismissed_at: existing.dismissed_at || item.dismissed_at,
                is_pending: existing.is_pending !== undefined ? existing.is_pending : item.is_pending,
                job: {
                  ...item.job,
                  ...existing.job,
                  description: item.job.description || existing.job.description,
                  is_viewed: existing.job.is_viewed || item.job.is_viewed,
                  is_saved: existing.job.is_saved || item.job.is_saved,
                  lifecycleState: existing.job.lifecycleState || item.job.lifecycleState,
                },
              };
              this.feedItems.set(item.id, merged);
              this.indexItem(merged);
              changed = true;
            }
          }
        }
        if (changed) {
          this.notify();
        }
      }
      this.isHydrated = true;
      this.lastPersistError = null;
    } catch (e: any) {
      this.lastPersistError = e instanceof Error ? e.message : 'IndexedDB hydration failed';
      console.warn('JobFeedStore: failed to hydrate from IndexedDB:', e);
    } finally {
      this.isHydrating = false;
    }
  }

  private persist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.executePersist();
    }, 250);
  }

  private executePersist(): void {
    // If initial hydration is still in flight, defer full persist to prevent overwriting with partial in-memory data
    if (!this.isHydrated && this.isHydrating) {
      this.whenHydrated().then(() => this.executePersist());
      return;
    }

    // Targeted dirty update when only a small number of items mutated
    if (this.dirtyItemIds.size > 0 && this.dirtyItemIds.size < 20) {
      const dirtyItems: FeedItem[] = [];
      for (const id of this.dirtyItemIds) {
        const item = this.feedItems.get(id);
        if (item) dirtyItems.push(item);
      }
      this.dirtyItemIds.clear();

      persistentStorageEngine.bulkPut('job_feed_items', dirtyItems)
        .then(() => {
          this.lastPersistTimestamp = new Date().toISOString();
          this.lastPersistError = null;
        })
        .catch((err) => {
          this.lastPersistError = err instanceof Error ? err.message : 'Targeted persist failed';
          console.error('JobFeedStore: Failed to persist dirty items:', err);
        });
      return;
    }

    this.dirtyItemIds.clear();
    const items = Array.from(this.feedItems.values());

    // 1. Authoritative persistent storage in native IndexedDB (no 5MB quota limit)
    persistentStorageEngine.bulkPut('job_feed_items', items)
      .then(() => {
        this.lastPersistTimestamp = new Date().toISOString();
        this.lastPersistError = null;
      })
      .catch((err) => {
        this.lastPersistError = err instanceof Error ? err.message : 'Full persist failed';
        console.error('JobFeedStore: Failed to persist to IndexedDB:', err);
      });

    // 2. Compact mirror in LocalStorage (keep top 100 items with stripped heavy raw text to prevent QuotaExceededError)
    const storage = this.getStorage();
    if (storage) {
      try {
        const compact = items.slice(0, 100).map((it) => ({
          ...it,
          job: {
            ...it.job,
            description: it.job.description ? it.job.description.slice(0, 300) : '',
            rawText: '',
          },
        }));
        storage.setItem(FEED_STORAGE_KEY, JSON.stringify(compact));
      } catch {
        // Quota exceeded safely ignored as IndexedDB is the authoritative store
      }
    }
  }

  public flushSync(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.executePersist();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Feed store listener error:', err);
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Finds an existing FeedItem matching an incoming JobOpportunity using 4-tier deduplication.
   */
  public findDuplicateItem(job: JobOpportunity): FeedItem | undefined {
    if (this.feedItems.has(job.id)) {
      return this.feedItems.get(job.id);
    }

    // 1. Canonical URLs
    const rawUrls = [
      job.canonicalUrl,
      job.canonical_job_url,
      job.official_job_url,
      job.jobUrl,
      job.applyUrl,
    ];
    for (const raw of rawUrls) {
      if (raw && raw !== '#') {
        const canonical = jobVerificationEngine.getCanonicalUrl(raw);
        if (canonical && canonical !== '#') {
          const matchId = this.urlIndex.get(canonical);
          if (matchId && this.feedItems.has(matchId)) {
            return this.feedItems.get(matchId);
          }
        }
        const matchDirect = this.urlIndex.get(raw);
        if (matchDirect && this.feedItems.has(matchDirect)) {
          return this.feedItems.get(matchDirect);
        }
      }
    }

    // 2. Source + External ID
    const sourceId = job.sourceId || job.source?.id;
    const extIds = [job.externalId, job.sourceJobId].filter(Boolean) as string[];
    for (const eid of extIds) {
      if (sourceId) {
        const scopedMatch = this.externalIdIndex.get(`${sourceId}::${eid}`);
        if (scopedMatch && this.feedItems.has(scopedMatch)) {
          return this.feedItems.get(scopedMatch);
        }
      }
      const matchId = this.externalIdIndex.get(eid);
      if (matchId && this.feedItems.has(matchId)) {
        return this.feedItems.get(matchId);
      }
    }

    // 3. Normalized Company + Title + Location
    if (job.company && job.title) {
      const ctLocKey = makeCompanyTitleLocKey(job.company, job.title, job.location);
      const matchId = this.companyTitleLocIndex.get(ctLocKey);
      if (matchId && this.feedItems.has(matchId)) {
        return this.feedItems.get(matchId);
      }
    }

    // 4. Fingerprint
    if (job.fingerprint) {
      const matchId = this.fingerprintIndex.get(job.fingerprint);
      if (matchId && this.feedItems.has(matchId)) {
        return this.feedItems.get(matchId);
      }
    }

    return undefined;
  }

  /**
   * Ingests a batch of discovered jobs that have passed hard eligibility and relevance rules.
   * If feed has <= 5 jobs or autoPublish is true, jobs enter visible feed immediately.
   * Otherwise, jobs enter the pending queue and increment pendingNewJobsCount.
   */
  public ingestDiscoveredBatch(
    jobs: JobOpportunity[],
    autoPublishOrOptions: boolean | { autoPublish?: boolean } = true
  ): {
    newMatchingCount: number;
    publishedCount: number;
    pendingCount: number;
    mergedCount: number;
    duplicateCount: number;
  } {
    let newMatchingCount = 0;
    let publishedCount = 0;
    let pendingCount = 0;
    let mergedCount = 0;
    let duplicateCount = 0;

    const now = new Date();
    const nowIso = now.toISOString();
    const shouldAutoPublish =
      typeof autoPublishOrOptions === 'boolean'
        ? autoPublishOrOptions
        : Boolean(autoPublishOrOptions?.autoPublish);

    for (const incomingJob of jobs) {
      if (!incomingJob || !incomingJob.id || !incomingJob.title || !incomingJob.company) {
        continue;
      }

      const existing = this.findDuplicateItem(incomingJob);
      if (existing) {
        duplicateCount++;
        mergedCount++;
        // Refresh timestamps if newer source
        const originalFirstSeen =
          existing.job.first_seen_at ||
          existing.job.firstSeenAt ||
          existing.discovered_at ||
          existing.published_to_feed_at;

        existing.job = {
          ...existing.job,
          ...incomingJob,
          first_seen_at: originalFirstSeen,
          firstSeenAt: originalFirstSeen,
          last_seen_at: nowIso,
          lastSeenAt: nowIso,
          // Preserve critical feed state
          viewed_at: existing.job.viewed_at || existing.first_viewed_at,
          viewedAt: existing.job.viewedAt || existing.first_viewed_at,
          is_viewed: existing.job.is_viewed || Boolean(existing.first_viewed_at),
          is_saved: existing.job.is_saved || Boolean(existing.saved_to_database_at),
        };
        continue;
      }

      const isPending = !shouldAutoPublish;
      const firstSeen =
        incomingJob.first_seen_at ||
        incomingJob.firstSeenAt ||
        incomingJob.dateDiscovered ||
        nowIso;
      const discTime = new Date(firstSeen).getTime();
      const baseTime = isNaN(discTime) ? now.getTime() : discTime;
      const expiresAt = new Date(baseTime + FEED_RETENTION_MS).toISOString();
      const publishedAt = isPending ? nowIso : firstSeen;

      const newItem: FeedItem = {
        id: incomingJob.id,
        job: {
          ...incomingJob,
          first_seen_at: firstSeen,
          firstSeenAt: firstSeen,
          last_seen_at: nowIso,
          lastSeenAt: nowIso,
          is_new: incomingJob.is_new !== undefined ? incomingJob.is_new : true,
          isNew: incomingJob.isNew !== undefined ? incomingJob.isNew : true,
          is_viewed: Boolean(incomingJob.is_viewed || incomingJob.viewed_at || incomingJob.viewedAt),
          lifecycleState: incomingJob.lifecycleState || 'IN_FEED',
        },
        discovered_at: firstSeen,
        published_to_feed_at: publishedAt,
        first_viewed_at: incomingJob.viewed_at || incomingJob.viewedAt || undefined,
        feed_expires_at: expiresAt,
        saved_to_database_at: incomingJob.is_saved || incomingJob.lifecycleState === 'SAVED' ? nowIso : undefined,
        is_pending: isPending,
      };

      this.feedItems.set(newItem.id, newItem);
      this.indexItem(newItem);
      newMatchingCount++;

      if (isPending) {
        pendingCount++;
      } else {
        publishedCount++;
      }
    }

    if (newMatchingCount > 0 || mergedCount > 0) {
      try {
        jobRepository.ingestBatch(jobs);
      } catch (err) {
        console.warn('Sync to jobRepository failed:', err);
      }
      this.persist();
      this.notify();
    }

    return {
      newMatchingCount,
      publishedCount,
      pendingCount,
      mergedCount,
      duplicateCount,
    };
  }

  /**
   * Returns all active published feed items (not pending, not dismissed, not expired).
   * Sorted primarily by newest published/discovered matching jobs first,
   * tie-broken by match score.
   */
  public getPublishedFeedItems(): FeedItem[] {
    const nowMs = Date.now();
    const result: FeedItem[] = [];

    for (const item of this.feedItems.values()) {
      if (item.is_pending) continue;
      if (item.dismissed_at) continue;

      // Retention expiration rule:
      // Never delete a discovered job before 14 days from discovery.
      // After 14 days, auto-remove ONLY if the user has taken no action.
      // Any user action (Save, View, Apply, database save, etc.) preserves the job indefinitely.
      const hasUserAction = Boolean(
        item.first_viewed_at ||
        item.job.is_viewed ||
        item.job.viewed_at ||
        item.job.viewedAt ||
        item.saved_to_database_at ||
        item.job.is_saved ||
        item.job.lifecycleState === 'SAVED' ||
        item.job.lifecycleState === 'APPLIED' ||
        item.application_status ||
        item.job.applicationStatus ||
        item.job.notes
      );

      if (!hasUserAction) {
        const discTime = new Date(item.discovered_at || item.published_to_feed_at).getTime();
        const expireMs = !isNaN(discTime) ? discTime + FEED_RETENTION_MS : new Date(item.feed_expires_at).getTime();
        if (!isNaN(expireMs) && expireMs < nowMs) {
          continue; // Expired from active feed only if user took zero action
        }
      }

      result.push(item);
    }

    // Sort: 1. Newest published/discovered first; 2. Match score as tie-breaker
    result.sort((a, b) => {
      const timeA = new Date(a.published_to_feed_at || a.discovered_at || 0).getTime();
      const timeB = new Date(b.published_to_feed_at || b.discovered_at || 0).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      const scoreA = a.job.match_score ?? a.job.profile_match_score ?? 0;
      const scoreB = b.job.match_score ?? b.job.profile_match_score ?? 0;
      return scoreB - scoreA;
    });

    return result;
  }

  /**
   * Returns all pending feed items waiting to be revealed via [ Show New Jobs ].
   */
  public getPendingFeedItems(): FeedItem[] {
    const result: FeedItem[] = [];
    for (const item of this.feedItems.values()) {
      if (item.is_pending && !item.dismissed_at) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Returns current count of pending new matching jobs.
   */
  public getPendingCount(): number {
    let count = 0;
    for (const item of this.feedItems.values()) {
      if (item.is_pending && !item.dismissed_at) {
        count++;
      }
    }
    return count;
  }

  /**
   * Immediately publishes all pending jobs to the visible feed stream.
   * Flips is_pending to false, sets published_to_feed_at = now,
   * recalculates feed_expires_at = now + 7 days, and notifies subscribers.
   */
  public publishPendingJobs(): number {
    let count = 0;
    const now = new Date();
    const nowIso = now.toISOString();
    const newExpiresAt = new Date(now.getTime() + FEED_RETENTION_MS).toISOString();

    for (const item of this.feedItems.values()) {
      if (item.is_pending && !item.dismissed_at) {
        item.is_pending = false;
        item.published_to_feed_at = nowIso;
        item.feed_expires_at = newExpiresAt;
        item.job.is_new = true;
        item.job.isNew = true;
        count++;
      }
    }

    if (count > 0) {
      this.persist();
      this.notify();
    }

    return count;
  }

  /**
   * Marks a job as viewed by the user.
   * - Sets first_viewed_at = now (if not already set).
   * - Extends feed_expires_at to first_viewed_at + 14 days (never removed before 14 days).
   * - Updates is_viewed = true, is_new = false.
   * - CRITICAL: Viewing NEVER auto-saves to Job Database!
   */
  public markViewed(jobId: string, matchScore?: number): FeedItem | undefined {
    const item = this.feedItems.get(jobId);
    if (!item) return undefined;

    const now = new Date();
    const nowIso = now.toISOString();

    if (!item.first_viewed_at) {
      item.first_viewed_at = nowIso;
    }

    item.job.is_viewed = true;
    item.job.is_new = false;
    item.job.isNew = false;
    item.job.viewed_at = item.first_viewed_at;
    item.job.viewedAt = item.first_viewed_at;
    if (matchScore !== undefined) {
      item.job.match_score = matchScore;
    }

    this.dirtyItemIds.add(jobId);
    this.persist();
    this.notify();
    return item;
  }

  /**
   * Explicitly saves a job from the Feed into the Job Database.
   * - Marks saved_to_database_at = now on the FeedItem.
   * - Updates job.is_saved = true, job.lifecycleState = 'SAVED'.
   * - Persists canonical job to jobRepository (the permanent Job Database).
   * - Retains job in the active Feed in a saved state.
   */
  public saveJobToDatabase(jobId: string, notes?: string): FeedItem | undefined {
    const item = this.feedItems.get(jobId);
    if (!item) return undefined;

    const nowIso = new Date().toISOString();
    item.saved_to_database_at = nowIso;
    item.job.is_saved = true;
    item.job.lifecycleState = 'SAVED';
    if (notes) {
      item.job.notes = notes;
    }

    // Persist canonical job to permanent Job Database
    jobRepository.saveOpportunity({
      ...item.job,
      is_saved: true,
      lifecycleState: 'SAVED',
      notes,
    });

    this.dirtyItemIds.add(jobId);
    this.persist();
    this.notify();
    return item;
  }

  /**
   * Removes a job from the permanent Job Database while keeping it in the Feed.
   */
  public removeFromDatabase(jobId: string): FeedItem | undefined {
    const item = this.feedItems.get(jobId);
    if (!item) return undefined;

    item.saved_to_database_at = undefined;
    item.job.is_saved = false;
    item.job.lifecycleState = 'IN_FEED';

    jobRepository.unmarkSaved(jobId);

    this.dirtyItemIds.add(jobId);
    this.persist();
    this.notify();
    return item;
  }

  /**
   * Dismisses a job from the active feed (e.g. user reject / dismiss action).
   */
  public dismissJob(jobId: string, reason?: string): FeedItem | undefined {
    const item = this.feedItems.get(jobId);
    if (!item) return undefined;

    item.dismissed_at = new Date().toISOString();
    item.job.lifecycleState = 'REJECTED';
    if (reason) {
      (item.job as any).rejectionReason = reason as any;
    }

    this.dirtyItemIds.add(jobId);
    this.persist();
    this.notify();
    return item;
  }

  /**
   * Restores a dismissed or hidden job back into active feed.
   * Does NOT reset the original discovery timestamp or the 14-day retention cycle.
   */
  public undismissJob(jobId: string): FeedItem | undefined {
    const item = this.feedItems.get(jobId);
    if (!item) return undefined;

    item.dismissed_at = undefined;
    if (item.job.lifecycleState === 'REJECTED' || item.job.lifecycleState === 'EXPIRED') {
      item.job.lifecycleState = item.saved_to_database_at ? 'SAVED' : 'IN_FEED';
    }

    this.dirtyItemIds.add(jobId);
    this.persist();
    this.notify();
    return item;
  }

  /**
   * Marks a job as applied.
   */
  public markApplied(jobId: string, notes?: string): FeedItem | undefined {
    const item = this.feedItems.get(jobId);
    if (!item) return undefined;

    item.application_status = 'Applied';
    item.job.lifecycleState = 'APPLIED';
    item.job.applicationStatus = 'applied';
    if (notes) item.job.notes = notes;

    // Applied jobs belong in the permanent Job Database
    jobRepository.markApplied(jobId, notes);

    this.dirtyItemIds.add(jobId);
    this.persist();
    this.notify();
    return item;
  }

  /**
   * Enforces retention rules:
   * - Discovered jobs remain in the feed for at least 14 days.
   * - After 14 days, auto-remove ONLY if the user has taken no action.
   * - Any user action (Save, View, Apply, database save, notes) preserves the job indefinitely.
   */
  public pruneExpiredJobs(): { expiredCount: number } {
    let expiredCount = 0;
    const nowMs = Date.now();

    for (const item of this.feedItems.values()) {
      const hasUserAction = Boolean(
        item.first_viewed_at ||
        item.job.is_viewed ||
        item.job.viewed_at ||
        item.job.viewedAt ||
        item.saved_to_database_at ||
        item.job.is_saved ||
        item.job.lifecycleState === 'SAVED' ||
        item.job.lifecycleState === 'APPLIED' ||
        item.application_status ||
        item.job.applicationStatus ||
        item.job.notes
      );

      // Any user action preserves the job indefinitely!
      if (hasUserAction) {
        continue;
      }

      const discTime = new Date(item.discovered_at || item.published_to_feed_at).getTime();
      const expireMs = !isNaN(discTime) ? discTime + FEED_RETENTION_MS : new Date(item.feed_expires_at).getTime();
      if (!isNaN(expireMs) && expireMs < nowMs) {
        if (!item.dismissed_at) {
          item.dismissed_at = new Date().toISOString();
          item.job.lifecycleState = 'EXPIRED';
          expiredCount++;
        }
      }
    }

    if (expiredCount > 0) {
      this.persist();
      this.notify();
    }

    return { expiredCount };
  }

  /**
   * Clears the entire feed (for resets/testing).
   */
  public clearAll(): void {
    this.feedItems.clear();
    this.urlIndex.clear();
    this.externalIdIndex.clear();
    this.companyTitleLocIndex.clear();
    this.fingerprintIndex.clear();
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.removeItem(FEED_STORAGE_KEY);
      } catch {}
    }
    persistentStorageEngine.clear('job_feed_items').catch(() => {});
    this.notify();
  }

  public isStoreHydrated(): boolean {
    return this.isHydrated;
  }

  public whenHydrated(): Promise<void> {
    return this.hydrationPromise || Promise.resolve();
  }

  public getPersistenceStatus(): {
    isHydrated: boolean;
    isHydrating: boolean;
    lastPersistTimestamp: string | null;
    lastPersistError: string | null;
    itemCount: number;
  } {
    return {
      isHydrated: this.isHydrated,
      isHydrating: this.isHydrating,
      lastPersistTimestamp: this.lastPersistTimestamp,
      lastPersistError: this.lastPersistError,
      itemCount: this.feedItems.size,
    };
  }

  public getItemById(jobId: string): FeedItem | undefined {
    return this.feedItems.get(jobId);
  }

  public getAllItems(): FeedItem[] {
    return Array.from(this.feedItems.values());
  }
}

export const jobFeedStore = new JobFeedStore();
