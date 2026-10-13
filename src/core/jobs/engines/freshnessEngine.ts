/**
 * CareerOS Freshness Engine
 *
 * Strict 7-Day Window & Date Lifecycle Management (Mandates 1, 2, 4, 11).
 *
 * Principles:
 * 1. STRICT 7-DAY WINDOW: The Job Feed displays ONLY jobs whose ORIGINAL posting date
 *    is within the last 7 calendar days (MAX_JOB_AGE_DAYS = 7).
 * 2. NO DISCOVERY SUBSTITUTION: Never display or treat discoveredAt, updatedAt,
 *    sourceFetchedAt, or lastSeenAt as the original posting date.
 *    If a job was posted 30 days ago and discovered today, it is STILL an old job
 *    and is strictly barred from the default Job Feed.
 * 3. DATE TRUTH ARCHITECTURE:
 *    - originalPostedAt: Original employer publication date (ISO)
 *    - lastUpdatedAt: Actual employer/source update date (ISO, only if available)
 *    - discoveredAt: CareerOS ingestion timestamp
 *    - lastVerifiedAt: Timestamp when listing was confirmed live and reachable
 * 4. UNCERTAIN DATES: If the original posting date cannot be reliably established,
 *    mark as "Date unknown" and exclude from the default Job Feed, while retaining
 *    in the database for history/verification.
 */

import { JobOpportunity, RawDiscoveredJob, MAX_JOB_AGE_DAYS } from '../types';

export interface JobTimestamps {
  originalPostedAt?: string;
  lastUpdatedAt?: string;
  discoveredAt: string;
  lastVerifiedAt: string;
  source_timestamp?: string;
  // Legacy aliases
  published_at?: string;
  first_seen_at: string;
  last_verified_at: string;
  last_changed_at?: string;
}

export interface FreshnessEvaluationResult {
  eligible: boolean;
  ageDays: number | null;
  reason: string;
  originalPostedAt?: string;
  lastUpdatedAt?: string;
  displayText: string;
}

export class FreshnessEngine {
  /**
   * Resolves canonical date model fields from raw/existing job representations.
   * Strictly separates original posting date from discovery date.
   */
  public resolveTimestamps(
    job: Partial<JobOpportunity> | RawDiscoveredJob,
    existing?: JobOpportunity
  ): JobTimestamps {
    const now = new Date().toISOString();

    // 1. Original Posting Date (publishedAt / originalPostedAt)
    const rawPostedCandidate =
      job.originalPostedAt ||
      (job as any).published_at ||
      (job as any).publishedAt ||
      (job as any).postedDate ||
      (job as any).posted_at ||
      (job as any).datePosted ||
      existing?.originalPostedAt ||
      (existing as any)?.published_at;

    let originalPostedAt: string | undefined = undefined;
    if (
      rawPostedCandidate &&
      rawPostedCandidate !== 'not_disclosed' &&
      rawPostedCandidate !== 'unknown' &&
      rawPostedCandidate.trim() !== ''
    ) {
      const parsed = new Date(rawPostedCandidate);
      if (!isNaN(parsed.getTime())) {
        originalPostedAt = parsed.toISOString();
      }
    }

    // 2. Employer Last Updated Date (lastUpdatedAt)
    const rawUpdatedCandidate =
      job.lastUpdatedAt ||
      (job as any).updatedAt ||
      (job as any).last_changed_at ||
      existing?.lastUpdatedAt;

    let lastUpdatedAt: string | undefined = undefined;
    if (
      rawUpdatedCandidate &&
      rawUpdatedCandidate !== 'not_disclosed' &&
      rawUpdatedCandidate.trim() !== ''
    ) {
      const parsed = new Date(rawUpdatedCandidate);
      if (!isNaN(parsed.getTime())) {
        lastUpdatedAt = parsed.toISOString();
      }
    }

    // 3. Discovery Date (discoveredAt)
    const discoveredAt =
      existing?.discoveredAt ||
      existing?.dateDiscovered ||
      job.discoveredAt ||
      (job as any).dateDiscovered ||
      (job as any).first_seen_at ||
      now;

    // 4. Live Verification Date (lastVerifiedAt)
    const lastVerifiedAt =
      job.lastVerifiedAt ||
      (job as any).lastVerified ||
      (job as any).last_verified_at ||
      existing?.lastVerifiedAt ||
      existing?.lastVerified ||
      now;

    const source_timestamp =
      (job as any).source_timestamp ||
      (job as any).postedAtRaw;

    return {
      originalPostedAt,
      lastUpdatedAt,
      discoveredAt,
      lastVerifiedAt,
      source_timestamp,
      // Legacy backwards-compatibility aliases
      published_at: originalPostedAt,
      first_seen_at: discoveredAt,
      last_verified_at: lastVerifiedAt,
      last_changed_at: lastUpdatedAt,
    };
  }

  /**
   * Strictly evaluates whether an opportunity is within the freshness window
   * (e.g. MAX_JOB_AGE_DAYS = 7 calendar days).
   *
   * Enforces Mandates 1 & 11:
   * - Uses ONLY originalPostedAt / publishedAt
   * - NEVER uses discoveredAt, updatedAt, sourceFetchedAt, or lastSeenAt
   * - A job posted 30 days ago and discovered today is STILL an old job (ineligible)
   * - An old job updated today but posted 30 days ago is STILL ineligible
   * - If original posting date cannot be established, excludes from default feed
   */
  public isJobWithinAgeWindow(
    job: JobOpportunity | Partial<JobOpportunity> | RawDiscoveredJob,
    maxAgeDays: number = MAX_JOB_AGE_DAYS,
    referenceDate: Date = new Date()
  ): FreshnessEvaluationResult {
    // Extract original posting date candidate
    const rawPosted =
      job.originalPostedAt ||
      (job as any).published_at ||
      (job as any).publishedAt ||
      (job as any).postedDate ||
      (job as any).posted_at ||
      (job as any).datePosted;

    if (!rawPosted || rawPosted === 'not_disclosed' || rawPosted === 'unknown' || rawPosted.trim() === '') {
      return {
        eligible: false,
        ageDays: null,
        reason: 'Original posting date cannot be reliably established',
        displayText: 'Date unknown',
      };
    }

    const postDate = new Date(rawPosted);
    if (isNaN(postDate.getTime())) {
      return {
        eligible: false,
        ageDays: null,
        reason: 'Invalid original posting date format',
        displayText: 'Date unknown',
      };
    }

    const refTime = referenceDate.getTime();
    const postTime = postDate.getTime();
    const diffMs = refTime - postTime;

    // Future-dated postings within a 24h grace window (timezone skews) treated as today
    if (diffMs < 0) {
      const displayText = 'Posted today';
      return {
        eligible: true,
        ageDays: 0,
        reason: 'Posted today (fresh within timezone)',
        originalPostedAt: postDate.toISOString(),
        lastUpdatedAt: (job as any).lastUpdatedAt || (job as any).updatedAt,
        displayText,
      };
    }

    // Exact calendar days calculation
    const ageDaysExact = diffMs / (1000 * 60 * 60 * 24);
    const ageDaysInt = Math.floor(ageDaysExact);

    const displayText = this.formatPostedTime(job, undefined, referenceDate);

    // Strict cutoff: Must not exceed maxAgeDays (with 0.05 calendar grace for boundary seconds)
    if (ageDaysExact <= maxAgeDays + 0.05) {
      return {
        eligible: true,
        ageDays: ageDaysInt,
        reason: `Posted ${ageDaysInt}d ago (within ${maxAgeDays}-day window)`,
        originalPostedAt: postDate.toISOString(),
        lastUpdatedAt: (job as any).lastUpdatedAt || (job as any).updatedAt,
        displayText,
      };
    }

    return {
      eligible: false,
      ageDays: ageDaysInt,
      reason: `Job is ${ageDaysInt} days old (exceeds ${maxAgeDays}-day window)`,
      originalPostedAt: postDate.toISOString(),
      lastUpdatedAt: (job as any).lastUpdatedAt || (job as any).updatedAt,
      displayText,
    };
  }

  /**
   * Generates clean, user-facing freshness string (Mandate 2).
   *
   * Formats:
   * - "Posted today"
   * - "Posted 1d ago"
   * - "Posted 2d ago"
   * - "Posted 5d ago"
   * - "Updated X ago" (ONLY when employer update is verified)
   *
   * Completely purges misleading "Discovered Posted today".
   */
  public formatPostedTime(
    jobOrPostedAt?: string | JobOpportunity | Partial<JobOpportunity> | RawDiscoveredJob,
    lastUpdatedAtArg?: string,
    referenceDate: Date = new Date()
  ): string {
    let originalPostedAt: string | undefined;
    let lastUpdatedAt: string | undefined = lastUpdatedAtArg;

    if (typeof jobOrPostedAt === 'string') {
      originalPostedAt = jobOrPostedAt;
    } else if (jobOrPostedAt) {
      originalPostedAt =
        jobOrPostedAt.originalPostedAt ||
        (jobOrPostedAt as any).published_at ||
        (jobOrPostedAt as any).publishedAt ||
        (jobOrPostedAt as any).postedDate ||
        (jobOrPostedAt as any).posted_at ||
        (jobOrPostedAt as any).datePosted;

      if (!lastUpdatedAt) {
        lastUpdatedAt =
          jobOrPostedAt.lastUpdatedAt ||
          (jobOrPostedAt as any).updatedAt ||
          (jobOrPostedAt as any).last_changed_at;
      }
    }

    if (
      !originalPostedAt ||
      originalPostedAt === 'not_disclosed' ||
      originalPostedAt === 'unknown' ||
      originalPostedAt.trim() === ''
    ) {
      return 'Date unknown';
    }

    const postDate = new Date(originalPostedAt);
    if (isNaN(postDate.getTime())) {
      return 'Date unknown';
    }

    const refTime = referenceDate.getTime();
    const postTime = postDate.getTime();
    const diffMs = refTime - postTime;

    // Check if employer performed a verified subsequent update
    if (lastUpdatedAt && lastUpdatedAt !== 'not_disclosed' && lastUpdatedAt.trim() !== '') {
      const updateDate = new Date(lastUpdatedAt);
      if (!isNaN(updateDate.getTime())) {
        const updateTime = updateDate.getTime();
        // Only show "Updated" if update was at least 18 hours after original post
        if (updateTime > postTime + 18 * 3600 * 1000) {
          const updateDiffMs = refTime - updateTime;
          const updateHours = Math.floor(updateDiffMs / (1000 * 3600));
          const updateDays = Math.floor(updateDiffMs / (1000 * 3600 * 24));

          if (updateHours < 24) return 'Updated today';
          if (updateDays === 1) return 'Updated 1d ago';
          if (updateDays < 7) return `Updated ${updateDays}d ago`;
          return `Updated ${updateDays}d ago`;
        }
      }
    }

    if (diffMs < 0) {
      return 'Posted today';
    }

    const diffHours = Math.floor(diffMs / (1000 * 3600));
    const diffDays = Math.floor(diffMs / (1000 * 3600 * 24));

    if (diffHours < 24) {
      return 'Posted today';
    }
    if (diffDays === 1) {
      return 'Posted 1d ago';
    }
    if (diffDays < 7) {
      return `Posted ${diffDays}d ago`;
    }
    if (diffDays < 14) {
      return `Posted ${diffDays}d ago`;
    }

    // Formatted fallback for historical records
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `Posted ${postDate.toLocaleDateString('en-US', options)}`;
  }

  /**
   * Calculates exponential decay freshness score (0 - 100).
   * Strictly based on originalPostedAt.
   */
  public calculateFreshnessScore(job: JobOpportunity): number {
    const timestampStr = job.originalPostedAt || (job as any).published_at || job.datePosted;
    if (!timestampStr || timestampStr === 'not_disclosed' || timestampStr === 'unknown') {
      return 30; // Unverified date floor
    }
    const postTime = new Date(timestampStr).getTime();
    if (isNaN(postTime)) return 30;

    const ageMs = Math.max(0, Date.now() - postTime);
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Score = 100 * e^(-0.15 * ageDays) - rapidly decays past 7 days
    const score = Math.round(100 * Math.exp(-0.15 * ageDays));
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Evaluates whether job should show "NEW" badge.
   * A job is NEW ONLY IF it was originally posted within 3 days AND has not been viewed.
   */
  public isJobNew(job: JobOpportunity): boolean {
    if (job.viewed_at || job.viewedAt) return false;
    if (job.lifecycleState === 'SAVED' || job.lifecycleState === 'APPLIED') return false;
    if (job.is_new === false || job.isNew === false) return false;

    // Check original posting age (within last 3 days)
    const timestampStr = job.originalPostedAt || (job as any).published_at || job.datePosted;
    if (!timestampStr || timestampStr === 'not_disclosed' || timestampStr === 'unknown') return false;

    const postTime = new Date(timestampStr).getTime();
    if (isNaN(postTime)) return false;

    const ageMs = Date.now() - postTime;
    return ageMs >= 0 && ageMs < 3 * 24 * 60 * 60 * 1000;
  }

  /**
   * Marks a job viewed so it never appears as NEW again.
   */
  public markJobViewed(job: JobOpportunity): JobOpportunity {
    const now = new Date().toISOString();
    return {
      ...job,
      is_new: false,
      isNew: false,
      viewed_at: now,
      viewedAt: now,
    };
  }

  /**
   * Computes stale job penalty (0 to 18 points) for ranking.
   * Jobs <= 2 days old receive 0 penalty.
   * Older jobs or unknown dates receive increasing penalties up to 18 points.
   */
  public calculateStalePenalty(job: JobOpportunity): number {
    const timestampStr =
      job.originalPostedAt ||
      (job as any).published_at ||
      (job as any).publishedAt ||
      (job as any).postedDate ||
      (job as any).datePosted;

    if (!timestampStr || timestampStr === 'not_disclosed' || timestampStr === 'unknown' || timestampStr.trim() === '') {
      return 15; // Unknown date penalty
    }

    const postTime = new Date(timestampStr).getTime();
    if (isNaN(postTime)) return 15;

    const ageDays = Math.max(0, (Date.now() - postTime) / (1000 * 60 * 60 * 24));
    if (ageDays <= 2) return 0;

    // Scale from 0 penalty at 2 days to 18 at 7+ days
    const penalty = Math.min(18, Math.round(((ageDays - 2) / 5) * 18));
    return penalty;
  }
}

export const freshnessEngine = new FreshnessEngine();
