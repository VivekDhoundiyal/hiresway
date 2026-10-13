import { JobMatchAnalysis } from './types';
import { UserProfile } from '../profile/types';
import { perfMonitor } from '../perf/performanceMonitor';

/**
 * LRU In-Memory Match Cache
 * Prevents repeated NLP multi-factor calculations across thousands of opportunities.
 * Cached by (jobId, profile_version, match_algorithm_version, isTarget).
 */
export const MATCH_ALGORITHM_VERSION = 'v2.1.0';

class MatchScoreCache {
  private cache: Map<string, JobMatchAnalysis> = new Map();
  private maxEntries = 10000;
  public readonly algorithmVersion = MATCH_ALGORITHM_VERSION;
  private lastKnownProfileVersionKey: string = '';

  /**
   * Generates a stable compact profile hash to detect when user profile preferences change.
   * Incorporates version, lastUpdated, technical skills, role preferences, target companies, and locations.
   */
  public getProfileVersionKey(profile: UserProfile): string {
    const v = profile.version || '1.0';
    const updated = profile.lastUpdated || '';
    const headline = profile.personalInfo?.headline || '';
    const techSkills = (profile.skills?.technicalSkills || []).join(',');
    const tools = (profile.skills?.toolsAndPlatforms || []).join(',');
    const role = profile.rolePreferences?.targetPrimaryTitle || '';
    const years = profile.rolePreferences?.totalYearsExperience || 0;
    const country = profile.locationAndAuth?.currentCountry || '';
    const targets = (profile.targetMarkets?.targetCompanies || []).sort().join(',');
    const locs = (profile.workPreferences?.targetLocations || []).sort().join(',');

    // Simple deterministic hash
    const raw = `${v}_${updated}_${headline}_${role}_${years}_${country}_${techSkills}_${tools}_${targets}_${locs}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }

    const key = `p_${Math.abs(hash).toString(36)}_${v}`;

    // Auto-detect profile changes and invalidate old profile cache
    if (this.lastKnownProfileVersionKey && this.lastKnownProfileVersionKey !== key) {
      this.invalidateProfile(this.lastKnownProfileVersionKey);
    }
    this.lastKnownProfileVersionKey = key;

    return key;
  }

  public get(jobId: string, profileKey: string, isTarget: boolean): JobMatchAnalysis | undefined {
    const key = `${jobId}::${profileKey}::${this.algorithmVersion}::${isTarget ? '1' : '0'}`;
    const hit = this.cache.get(key);
    if (hit) {
      perfMonitor.recordCacheHit('match');
      // Refresh LRU order
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }
    perfMonitor.recordCacheMiss('match');
    return undefined;
  }

  public set(jobId: string, profileKey: string, isTarget: boolean, match: JobMatchAnalysis): void {
    const key = `${jobId}::${profileKey}::${this.algorithmVersion}::${isTarget ? '1' : '0'}`;
    if (this.cache.size >= this.maxEntries) {
      // Remove oldest
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, match);
  }

  public invalidateProfile(profileKey: string): void {
    const prefix = `::${profileKey}::`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  public invalidateJob(jobId: string): void {
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(`${jobId}::`)) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const matchScoreCache = new MatchScoreCache();
