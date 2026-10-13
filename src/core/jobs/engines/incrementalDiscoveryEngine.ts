/**
 * CareerOS Incremental & Continuous Discovery Engine
 *
 * Principles:
 * 1. SOURCE VALUE: Prioritizes Tier 1 (High Value ATS/Direct) → Tier 2 (Useful Boards),
 *    deprioritizes Tier 3, and quarantines Tier 4.
 * 2. PARALLEL WORKERS: Bounded concurrent workers (concurrency = 4).
 * 3. EARLY REJECTION: Fast checks for 404, dead signatures, missing schema, and quarantined URLs.
 * 4. CONTINUOUS LOOP: Continuously processes prioritized queue with 2-minute cycle without
 *    resetting or wiping the feed.
 * 5. STREAMING INSERTION: Verified jobs are ingested into the feed immediately as workers finish.
 * 6. USER CONTROL: Exactly 4 button states: DISCOVER, DISCOVERING, PAUSED, ERROR.
 */

import { JobSourceRegistryEntry } from '../types';
import { UserProfile } from '../../profile/types';
import { sourceValueEngine } from './sourceValueEngine';
import { sourceHealthEngine } from './sourceHealthEngine';
import { discoveryLedgerEngine } from './discoveryLedgerEngine';
import { discoveryEngine } from '../discoveryEngine';

export type ContinuousDiscoveryState = 'DISCOVER' | 'DISCOVERING' | 'PAUSED' | 'ERROR';

export interface IncrementalDiscoveryResult {
  runId: string;
  sourcesEvaluated: number;
  sourcesQueried: number;
  sourcesSkipped: number;
  newJobsAdded: number;
  duplicatesConsolidated: number;
  durationMs: number;
}

export interface SourceCursorMetadata {
  lastChecked?: number;
  lastSuccess?: number;
  lastJobSeen?: number;
  eTag?: string;
  lastModified?: string;
  consecutiveFailures: number;
}

export type ContinuousBatchCallback = (newJobsCount: number, source: JobSourceRegistryEntry) => void;

export class IncrementalDiscoveryEngine {
  private cursorMap: Map<string, SourceCursorMetadata> = new Map();
  private catalogCursor = 0; // Incremental slice pointer across prioritized sources

  public getState(): ContinuousDiscoveryState {
    return discoveryEngine.getState();
  }

  public getErrorMessage(): string | null {
    return discoveryEngine.getErrorMessage();
  }

  public isDiscoveryRunning(): boolean {
    return discoveryEngine.isDiscoveryRunning();
  }

  public subscribeBatch(callback: ContinuousBatchCallback): () => void {
    return discoveryEngine.subscribeBatch((count) => {
      callback(count, {} as any);
    });
  }

  public subscribeState(callback: (state: ContinuousDiscoveryState) => void): () => void {
    return discoveryEngine.subscribeState(callback);
  }

  /**
   * Selects eligible sources for an incremental cycle using SourceValueEngine and cursors.
   */
  public selectEligibleSources(
    allSources: JobSourceRegistryEntry[],
    batchSizeOrProfile?:
      | number
      | { targetCompanies?: string[]; workPreferences?: { targetLocations?: string[] } }
      | { maxCatalogBatch?: number; maxBatchSize?: number; targetCompanies?: string[]; forceAll?: boolean },
    targetCompaniesOrOptions?:
      | string[]
      | { maxCatalogBatch?: number; maxBatchSize?: number; forceAll?: boolean }
  ): {
    eligible: JobSourceRegistryEntry[];
    skipped: { source: JobSourceRegistryEntry; reason: string }[];
  } {
    let maxBatchSize = 25;
    let targetCompanies: string[] = [];

    if (typeof batchSizeOrProfile === 'number') {
      maxBatchSize = batchSizeOrProfile;
      if (Array.isArray(targetCompaniesOrOptions)) {
        targetCompanies = targetCompaniesOrOptions;
      } else if (targetCompaniesOrOptions && typeof targetCompaniesOrOptions === 'object') {
        if ('targetCompanies' in targetCompaniesOrOptions && Array.isArray((targetCompaniesOrOptions as any).targetCompanies)) {
          targetCompanies = (targetCompaniesOrOptions as any).targetCompanies;
        }
      }
    } else if (batchSizeOrProfile && typeof batchSizeOrProfile === 'object') {
      if ('targetCompanies' in batchSizeOrProfile && Array.isArray((batchSizeOrProfile as any).targetCompanies)) {
        targetCompanies = (batchSizeOrProfile as any).targetCompanies || [];
        if (targetCompaniesOrOptions && typeof targetCompaniesOrOptions === 'object') {
          maxBatchSize = (targetCompaniesOrOptions as any).maxCatalogBatch ?? (targetCompaniesOrOptions as any).maxBatchSize ?? 25;
        }
      } else {
        maxBatchSize = (batchSizeOrProfile as any).maxCatalogBatch ?? (batchSizeOrProfile as any).maxBatchSize ?? 25;
        targetCompanies = (batchSizeOrProfile as any).targetCompanies || [];
      }
    }

    const skipped: { source: JobSourceRegistryEntry; reason: string }[] = [];
    const now = Date.now();

    // 1. Filter out quarantined and disabled sources
    const candidates = allSources.filter((s) => {
      const isSourceActive = s.activeStatus !== undefined ? s.activeStatus : ((s as any).enabled !== undefined ? (s as any).enabled : true);
      if (!isSourceActive) {
        skipped.push({ source: s, reason: 'Source disabled by user preference' });
        return false;
      }

      const evalResult = sourceValueEngine.evaluateSource(s);
      if (evalResult.tier === 'TIER_4_DEAD' || sourceHealthEngine.isSourceQuarantined(s.id)) {
        skipped.push({ source: s, reason: evalResult.reason });
        discoveryLedgerEngine.markQuarantined({
          sourceId: s.id,
          sourceName: s.name,
          domain: s.domain,
          reason: evalResult.reason,
        });
        return false;
      }

      const backoffMs = sourceHealthEngine.getBackoffMs(s.id);
      const cursor = this.cursorMap.get(s.id);
      const lastCheck = cursor?.lastChecked || 0;
      if (backoffMs > 0 && now - lastCheck < backoffMs) {
        const remainingSec = Math.round((backoffMs - (now - lastCheck)) / 1000);
        skipped.push({
          source: s,
          reason: `Exponential backoff active (${remainingSec}s cooldown remaining)`,
        });
        discoveryLedgerEngine.markBackoff({
          sourceId: s.id,
          sourceName: s.name,
          domain: s.domain,
          remainingSeconds: remainingSec,
        });
        return false;
      }

      return true;
    });

    // 2. Prioritize candidates using Source Intelligence Score
    const prioritized = sourceValueEngine.prioritizeSources(candidates, targetCompanies);

    if (prioritized.length === 0) {
      return { eligible: [], skipped };
    }

    // Target Companies are ALWAYS first-class sources and continuously monitored in every cycle
    const targetSet = new Set(targetCompanies.map((t) => t.toLowerCase().trim()));
    const isTargetSource = (s: JobSourceRegistryEntry) => {
      const sName = s.name.toLowerCase().trim();
      const sComp = ((s as any).targetCompany || s.companyName || '').toLowerCase().trim();
      return (
        s.category === 'target_company' ||
        targetSet.has(sName) ||
        (sComp && targetSet.has(sComp)) ||
        Array.from(targetSet).some((t) => t.length > 2 && sName.includes(t))
      );
    };

    const targetSources = prioritized.filter(isTargetSource);
    const nonTargetSources = prioritized.filter((s) => !isTargetSource(s));

    // Guaranteed inclusion of all active target company pipelines
    const eligibleMap = new Map<string, JobSourceRegistryEntry>();
    targetSources.forEach((ts) => {
      eligibleMap.set(ts.id, ts);
      discoveryLedgerEngine.markQueued(ts.id, ts.name, ts.domain);
    });

    // Fill remaining batch capacity with prioritized high-yield catalog sources
    const remainingSlots = Math.max(5, maxBatchSize - targetSources.length);
    if (nonTargetSources.length > 0) {
      if (this.catalogCursor >= nonTargetSources.length) {
        this.catalogCursor = 0;
      }
      const slice = nonTargetSources.slice(this.catalogCursor, this.catalogCursor + remainingSlots);
      this.catalogCursor = (this.catalogCursor + slice.length) % nonTargetSources.length;
      slice.forEach((s) => {
        eligibleMap.set(s.id, s);
        discoveryLedgerEngine.markQueued(s.id, s.name, s.domain);
      });
    }

    return { eligible: Array.from(eligibleMap.values()), skipped };
  }

  /**
   * Runs a single incremental discovery cycle across prioritized sources.
   */
  public async runIncrementalCycle(
    profile?: UserProfile,
    maxSources: number = 20
  ): Promise<IncrementalDiscoveryResult> {
    const startTime = Date.now();
    const run = await discoveryEngine.startDiscoveryRun(profile || ({} as any), { maxSources });
    return {
      runId: run.id,
      sourcesEvaluated: run.eligibleSourceCount,
      sourcesQueried: run.queriedSourceCount,
      sourcesSkipped: run.skippedSourceCount || 0,
      newJobsAdded: run.newJobsAdded,
      duplicatesConsolidated: run.duplicateJobsRemoved,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Starts or resumes the Continuous Discovery Loop.
   * Delegates directly to unified discoveryEngine.
   */
  public async startContinuousLoop(profile?: UserProfile): Promise<void> {
    return discoveryEngine.startContinuousLoop(profile);
  }

  /**
   * Pauses continuous discovery without deleting existing jobs or resetting the feed.
   */
  public pauseLoop(): void {
    discoveryEngine.pauseLoop();
  }

  /**
   * Resumes continuous discovery.
   */
  public resumeLoop(profile?: UserProfile): void {
    discoveryEngine.resumeLoop(profile);
  }

  /**
   * Completely stops continuous discovery.
   */
  public stopLoop(): void {
    discoveryEngine.stopLoop();
  }
}

export const incrementalDiscoveryEngine = new IncrementalDiscoveryEngine();
