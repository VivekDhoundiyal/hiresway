/**
 * CareerOS Social Feed Engine
 *
 * Fresh Social-Feed Model for Jobs:
 * - NEW jobs enter at the top of the stream.
 * - Prevents chaotic reordering of the feed on background refreshes.
 * - Categorizes opportunities into temporal social-feed cohorts:
 *   1. NEW: Freshly discovered and unviewed opportunities
 *   2. JUST IN: Discovered within the past 6 hours
 *   3. TODAY: Discovered within the past 24 hours
 *   4. EARLIER: Earlier verified opportunities
 * - Strict timestamp tracking: first_seen_at, published_at, last_verified_at, last_seen_at.
 * - Automatically evicts expired or closed postings.
 */

import { JobOpportunity } from '../types';

export type FeedCohort = 'NEW' | 'JUST_IN' | 'TODAY' | 'EARLIER';

export interface SocialFeedGroup<T extends JobOpportunity = JobOpportunity> {
  cohort: FeedCohort;
  label: string;
  count: number;
  jobs: T[];
}

export class SocialFeedEngine {
  /**
   * Evaluates the social-feed cohort for a job opportunity.
   */
  public getJobCohort(job: JobOpportunity): FeedCohort {
    const isUnread = Boolean((job.is_new || job.isNew) && !job.viewed_at && !job.viewedAt);
    if (isUnread) return 'NEW';

    const timestampStr = job.first_seen_at || job.dateDiscovered || job.datePosted;
    if (!timestampStr) return 'EARLIER';

    const ageMs = Date.now() - new Date(timestampStr).getTime();
    if (ageMs < 0) return 'JUST_IN';

    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    if (ageMs <= SIX_HOURS_MS) return 'JUST_IN';
    if (ageMs <= TWENTY_FOUR_HOURS_MS) return 'TODAY';
    return 'EARLIER';
  }

  /**
   * Filters out closed/expired/dead postings.
   */
  public isJobActiveAndLive(job: JobOpportunity): boolean {
    if (
      job.lifecycleState === 'CLOSED' ||
      job.lifecycleState === 'EXPIRED' ||
      job.lifecycleState === 'ARCHIVED' ||
      job.lifecycleState === 'REJECTED'
    ) {
      return false;
    }

    if (job.verificationStatus === 'failed') {
      return false;
    }

    return true;
  }

  /**
   * Sorts jobs using stable social-feed cohort priority:
   * NEW -> JUST IN -> TODAY -> EARLIER.
   * Within cohorts, preserves stable ordering by match score and timestamp.
   */
  public rankSocialFeed<T extends JobOpportunity>(jobs: T[]): T[] {
    const active = jobs.filter((j) => this.isJobActiveAndLive(j));

    const COHORT_WEIGHTS: Record<FeedCohort, number> = {
      NEW: 0,
      JUST_IN: 1,
      TODAY: 2,
      EARLIER: 3,
    };

    return [...active].sort((a, b) => {
      const cohortA = this.getJobCohort(a);
      const cohortB = this.getJobCohort(b);

      if (COHORT_WEIGHTS[cohortA] !== COHORT_WEIGHTS[cohortB]) {
        return COHORT_WEIGHTS[cohortA] - COHORT_WEIGHTS[cohortB];
      }

      // Within cohort: Verified Live gets preference
      const aVerified = a.isVerifiedLive ? 1 : 0;
      const bVerified = b.isVerifiedLive ? 1 : 0;
      if (aVerified !== bVerified) return bVerified - aVerified;

      // Then by first_seen_at or published_at
      const timeA = new Date(a.first_seen_at || a.dateDiscovered || a.datePosted || 0).getTime();
      const timeB = new Date(b.first_seen_at || b.dateDiscovered || b.datePosted || 0).getTime();
      if (timeA !== timeB) return timeB - timeA;

      // Stable secondary tie-breaker by ID
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Partitions opportunities into grouped social-feed blocks.
   */
  public groupSocialFeed<T extends JobOpportunity>(jobs: T[]): SocialFeedGroup<T>[] {
    const ranked = this.rankSocialFeed(jobs);
    const groups: Record<FeedCohort, T[]> = {
      NEW: [],
      JUST_IN: [],
      TODAY: [],
      EARLIER: [],
    };

    ranked.forEach((job) => {
      const cohort = this.getJobCohort(job);
      groups[cohort].push(job);
    });

    const result: SocialFeedGroup<T>[] = [];

    if (groups.NEW.length > 0) {
      result.push({
        cohort: 'NEW',
        label: 'New Opportunities',
        count: groups.NEW.length,
        jobs: groups.NEW,
      });
    }

    if (groups.JUST_IN.length > 0) {
      result.push({
        cohort: 'JUST_IN',
        label: 'Just In (Past 6 Hours)',
        count: groups.JUST_IN.length,
        jobs: groups.JUST_IN,
      });
    }

    if (groups.TODAY.length > 0) {
      result.push({
        cohort: 'TODAY',
        label: 'Discovered Today',
        count: groups.TODAY.length,
        jobs: groups.TODAY,
      });
    }

    if (groups.EARLIER.length > 0) {
      result.push({
        cohort: 'EARLIER',
        label: 'Earlier Opportunities',
        count: groups.EARLIER.length,
        jobs: groups.EARLIER,
      });
    }

    return result;
  }
}

export const socialFeedEngine = new SocialFeedEngine();
