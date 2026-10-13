/**
 * CareerOS Feed Ranking Engine
 *
 * Modern Stream Composite Ranking:
 * Prioritizes: HIGH RELEVANCE + NEW over HIGH RELEVANCE + OLD.
 *
 * Example:
 * 95% match posted today MUST appear above 96% match posted 6 days ago.
 * Never allows an old job to dominate simply because its match score is slightly higher.
 */

import { JobOpportunity } from '../types';
import { JobMatchAnalysis } from '../../intelligence';
import { preferenceLearningEngine } from './preferenceLearningEngine';

export type FeedSortOption =
  | 'best_match'
  | 'newest'
  | 'recently_updated'
  | 'highest_match'
  | 'salary_high_low'
  | 'salary_low_high'
  | 'target_companies'
  | 'closing_soon'
  // Legacy aliases
  | 'match'
  | 'freshness'
  | 'salary'
  | 'company'
  | 'match_percent';

export class FeedRankingEngine {
  /**
   * Computes age in hours from originalPostedAt (strictly calendar posting date).
   */
  public getPostAgeHours(job: JobOpportunity): number {
    const postCandidate = job.originalPostedAt || job.datePosted || job.postingDate;
    if (!postCandidate || postCandidate === 'not_disclosed' || postCandidate === 'unknown') {
      return 168; // 7 days fallback for unknown
    }
    const parsed = new Date(postCandidate).getTime();
    if (isNaN(parsed)) return 168;
    return Math.max(0, (Date.now() - parsed) / (1000 * 3600));
  }

  /**
   * Identifies if a job was posted or discovered within the last 24 hours.
   */
  public isJobNew(job: JobOpportunity): boolean {
    const ageHours = this.getPostAgeHours(job);
    if (ageHours <= 24) return true;

    // Discovered within last 24h as secondary signal
    if (job.discoveredAt || job.dateDiscovered) {
      const disc = new Date(job.discoveredAt || job.dateDiscovered).getTime();
      if (!isNaN(disc) && (Date.now() - disc) / (1000 * 3600) <= 24) {
        return true;
      }
    }
    return false;
  }

  /**
   * Computes the composite stream ranking score for a job.
   */
  public computeRankScore(
    job: JobOpportunity,
    baseMatchScore: number
  ): { rankScore: number; components: Record<string, number> } {
    const match = Math.max(0, Math.min(100, baseMatchScore));
    const ageHours = this.getPostAgeHours(job);
    const ageDays = ageHours / 24;

    // 1. Freshness Tiering (Section 2: High Relevance + New strongly prioritized)
    let freshnessTierBonus = 0;
    if (ageHours <= 24) {
      freshnessTierBonus = 25;
    } else if (ageDays <= 2) {
      freshnessTierBonus = 12;
    } else if (ageDays <= 4) {
      freshnessTierBonus = 0;
    } else if (ageDays <= 6) {
      freshnessTierBonus = -15;
    } else {
      freshnessTierBonus = -25;
    }

    // 2. Behavioral Preference Adjustment (-20 to +15) -> normalized
    const prefResult = preferenceLearningEngine.calculateAdjustment(job);
    const prefScore = Math.max(0, Math.min(100, 50 + prefResult.scoreAdjustment * 2.5));

    // 3. Target Company Priority (+8 pts)
    const targetBonus = (job.isTargetCompany || job.target_company || (job as any).is_target_company) ? 8 : 0;

    // 4. Verified Live Authenticity (+4 pts)
    const isLive = Boolean(
      job.isVerifiedLive &&
      (job.verificationStatus === 'LIVE_VERIFIED' || job.verificationStatus === 'verified_live')
    );
    const verifiedBonus = isLive ? 4 : 0;

    const weighted =
      match * 0.50 +
      prefScore * 0.15 +
      freshnessTierBonus +
      targetBonus +
      verifiedBonus;

    const rankScore = Math.round(Math.max(0, weighted) * 10) / 10;

    return {
      rankScore,
      components: {
        match,
        freshnessTierBonus,
        prefScore,
        targetBonus,
        verifiedBonus,
      },
    };
  }

  /**
   * Sorts opportunities across all 8 canonical sorting options:
   * 1. best_match: composite stream score (relevance x freshness)
   * 2. newest: posted within last 24h on top, strict descending postedAt
   * 3. recently_updated: latest lastUpdatedAt descending
   * 4. highest_match: highest profile match % descending
   * 5. salary_high_low: highest disclosed max salary descending (unspecified at bottom)
   * 6. salary_low_high: lowest disclosed min salary ascending (unspecified at bottom)
   * 7. target_companies: jobs from target companies first, then Best Match
   * 8. closing_soon: earliest expiresAt ascending (unspecified at bottom)
   */
  public sortOpportunities(
    opportunities: (JobOpportunity & { match: JobMatchAnalysis })[],
    sortBy: FeedSortOption = 'best_match'
  ): (JobOpportunity & { match: JobMatchAnalysis })[] {
    const list = [...opportunities];

    switch (sortBy) {
      case 'newest':
      case 'freshness':
        return list.sort((a, b) => {
          const timeA = new Date(a.originalPostedAt || a.datePosted || a.dateDiscovered || 0).getTime();
          const timeB = new Date(b.originalPostedAt || b.datePosted || b.dateDiscovered || 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return (b.match?.overallScore || 0) - (a.match?.overallScore || 0);
        });

      case 'recently_updated':
        return list.sort((a, b) => {
          const timeA = new Date(a.lastUpdatedAt || a.updatedAt || a.originalPostedAt || a.datePosted || 0).getTime();
          const timeB = new Date(b.lastUpdatedAt || b.updatedAt || b.originalPostedAt || b.datePosted || 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return (b.match?.overallScore || 0) - (a.match?.overallScore || 0);
        });

      case 'highest_match':
      case 'match':
      case 'match_percent':
        return list.sort((a, b) => {
          const scoreA = a.match?.overallScore ?? a.match_score ?? a.profile_match_score ?? 0;
          const scoreB = b.match?.overallScore ?? b.match_score ?? b.profile_match_score ?? 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          const timeA = new Date(a.originalPostedAt || a.datePosted || 0).getTime();
          const timeB = new Date(b.originalPostedAt || b.datePosted || 0).getTime();
          return timeB - timeA;
        });

      case 'salary_high_low':
      case 'salary':
        return list.sort((a, b) => {
          const salA = a.salary?.max || a.salary_truth?.max || a.salary?.min || a.salaryMin || 0;
          const salB = b.salary?.max || b.salary_truth?.max || b.salary?.min || b.salaryMin || 0;
          // Unspecified salaries ($0) must be placed at the bottom
          if (salA > 0 && salB === 0) return -1;
          if (salB > 0 && salA === 0) return 1;
          if (salB !== salA) return salB - salA;
          return (b.match?.overallScore || 0) - (a.match?.overallScore || 0);
        });

      case 'salary_low_high':
        return list.sort((a, b) => {
          const salA = a.salary?.min || a.salary_truth?.min || a.salary?.max || a.salaryMin || 0;
          const salB = b.salary?.min || b.salary_truth?.min || b.salary?.max || b.salaryMin || 0;
          // Unspecified salaries ($0) at the bottom
          if (salA > 0 && salB === 0) return -1;
          if (salB > 0 && salA === 0) return 1;
          if (salA !== salB) return salA - salB;
          return (b.match?.overallScore || 0) - (a.match?.overallScore || 0);
        });

      case 'target_companies':
      case 'company':
        return list.sort((a, b) => {
          const isTargetA = Boolean(a.isTargetCompany || a.target_company || (a as any).is_target_company);
          const isTargetB = Boolean(b.isTargetCompany || b.target_company || (b as any).is_target_company);
          if (isTargetA && !isTargetB) return -1;
          if (!isTargetA && isTargetB) return 1;
          const rankA = this.computeRankScore(a, a.match?.overallScore || 0).rankScore;
          const rankB = this.computeRankScore(b, b.match?.overallScore || 0).rankScore;
          return rankB - rankA;
        });

      case 'closing_soon':
        return list.sort((a, b) => {
          const expA = a.expires_at || (a as any).expiresAt ? new Date(a.expires_at || (a as any).expiresAt!).getTime() : 0;
          const expB = b.expires_at || (b as any).expiresAt ? new Date(b.expires_at || (b as any).expiresAt!).getTime() : 0;
          if (expA > 0 && expB === 0) return -1;
          if (expB > 0 && expA === 0) return 1;
          if (expA > 0 && expB > 0 && expA !== expB) return expA - expB;
          const rankA = this.computeRankScore(a, a.match?.overallScore || 0).rankScore;
          const rankB = this.computeRankScore(b, b.match?.overallScore || 0).rankScore;
          return rankB - rankA;
        });

      case 'best_match':
      default:
        return this.rankFeed(list);
    }
  }

  /**
   * Ranks feed opportunities strictly according to:
   * 1. Newest published/discovered matching jobs
   * 2. Highest relevance score as secondary tie-breaker
   * Never shows stale jobs above new jobs just because score is high.
   */
  public rankFeed(
    opportunities: (JobOpportunity & { match: JobMatchAnalysis })[]
  ): (JobOpportunity & { match: JobMatchAnalysis })[] {
    return [...opportunities].sort((a, b) => {
      // 1. Newest published / posted matching jobs first
      const timeA = new Date(
        (a as any).published_to_feed_at ||
        a.originalPostedAt ||
        a.datePosted ||
        a.discoveredAt ||
        a.dateDiscovered ||
        0
      ).getTime();
      const timeB = new Date(
        (b as any).published_to_feed_at ||
        b.originalPostedAt ||
        b.datePosted ||
        b.discoveredAt ||
        b.dateDiscovered ||
        0
      ).getTime();

      // If one job is newer by 2+ hours, newer job strictly comes first
      const diffHours = (timeB - timeA) / (1000 * 3600);
      if (Math.abs(diffHours) >= 2) {
        return timeB - timeA;
      }

      // 2. Highest relevance score as secondary tie-breaker
      const scoreA = a.match?.overallScore ?? a.match_score ?? a.profile_match_score ?? 0;
      const scoreB = b.match?.overallScore ?? b.match_score ?? b.profile_match_score ?? 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // 3. Fallback to finer timestamp resolution
      if (timeB !== timeA) {
        return timeB - timeA;
      }

      return a.id.localeCompare(b.id);
    });
  }
}

export const feedRankingEngine = new FeedRankingEngine();
