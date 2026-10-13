/**
 * CareerOs Source Orchestrator & Health Monitoring Engine
 * 
 * Responsibilities:
 * 1. Maintain precise operational state for every source in the 1,248+ catalog.
 * 2. Prioritize sources:
 *    Priority 1: Target Company career pages & ATS
 *    Priority 2: Verified company ATS (Greenhouse, Ashby, Lever, Workable)
 *    Priority 3: High-quality curated remote platforms (Remotive, Jobicy)
 *    Priority 4: Regional & Startup portals
 *    Priority 5: Remaining directory sources
 * 3. Concurrency worker dispatch with domain rate limits & exponential backoff.
 * 4. Truthful telemetry: NEVER claims 1,248 sources were queried if only a subset ran.
 * 5. Adaptive scheduling: stale sources, active target monitoring, failure cooldowns.
 */

import type {
  JobSourceRegistryEntry,
  SourceOperationalState,
  SourceCategory,
  ATSType,
} from './types';

export interface SourceRuntimeHealth {
  sourceId: string;
  sourceName: string;
  domain: string;
  url: string;
  category: SourceCategory;
  atsType: ATSType;
  operationalStatus: SourceOperationalState;
  connectorAvailable: boolean;
  active: boolean;
  priority: number; // 1 (highest) to 5 (lowest)
  lastCheckedAt?: string;
  nextScheduledCheck?: string;
  responseTimeMs?: number;
  jobsDiscovered: number;
  jobsAccepted: number;
  jobsRejected: number;
  jobsCurrentlyLive: number;
  errorCount: number;
  consecutiveFailures: number;
  lastError?: string;
  backoffUntil?: number;
}

export interface OrchestratorProgress {
  totalSources: number;
  queuedCount: number;
  checkingCount: number;
  completedCount: number;
  failedCount: number;
  currentSourceName?: string;
  jobsDiscovered: number;
  jobsAccepted: number;
  jobsRejected: number;
  duplicatesRemoved: number;
  isComplete: boolean;
}

export interface SourceOrchestratorStats {
  totalRegistered: number;
  connectorsAvailable: number;
  currentlyActive: number;
  eligibleCount?: number;
  queuedCount: number;
  checkingCount: number;
  successfullyQueried: number;
  noResultsCount: number;
  failedCount: number;
  timedOutCount: number;
  rateLimitedCount: number;
  staleCount: number;
  totalJobsDiscovered: number;
  totalJobsAccepted: number;
}

export class SourceOrchestrator {
  private runtimeMap: Map<string, SourceRuntimeHealth> = new Map();
  private isProcessing = false;
  private subscribers: Set<(progress: OrchestratorProgress) => void> = new Set();
  private lastProgress: OrchestratorProgress = {
    totalSources: 0,
    queuedCount: 0,
    checkingCount: 0,
    completedCount: 0,
    failedCount: 0,
    jobsDiscovered: 0,
    jobsAccepted: 0,
    jobsRejected: 0,
    duplicatesRemoved: 0,
    isComplete: true,
  };

  /**
   * Initializes or refreshes runtime states from source registry entries.
   */
  public initializeSources(sources: JobSourceRegistryEntry[]): void {
    sources.forEach((s) => {
      const existing = this.runtimeMap.get(s.id);
      const isTarget = s.category === 'target_company' || s.sourceType === 'company_career_portal';
      const isATS =
        s.atsType === 'ashby' ||
        s.atsType === 'greenhouse' ||
        s.atsType === 'lever' ||
        s.atsType === 'workable' ||
        s.atsType === 'smartrecruiters';
      const isCuratedRemote = s.category === 'remote_first';

      let priority = 5;
      if (isTarget) priority = 1;
      else if (isATS) priority = 2;
      else if (isCuratedRemote) priority = 3;
      else if (s.category === 'startup_vc') priority = 4;

      const hasConnector = isTarget || isATS || isCuratedRemote || s.domain.includes('jobicy') || s.domain.includes('remotive');

      this.runtimeMap.set(s.id, {
        sourceId: s.id,
        sourceName: s.name,
        domain: s.domain,
        url: s.endpointUrl || `https://${s.domain}`,
        category: s.category || 'company_ats',
        atsType: s.atsType,
        operationalStatus: existing?.operationalStatus || (s.activeStatus ? 'ACTIVE' : 'REGISTERED'),
        connectorAvailable: hasConnector,
        active: s.activeStatus,
        priority,
        lastCheckedAt: existing?.lastCheckedAt || s.lastCheckedAt,
        nextScheduledCheck: existing?.nextScheduledCheck,
        responseTimeMs: existing?.responseTimeMs,
        jobsDiscovered: existing?.jobsDiscovered || s.jobs_found || 0,
        jobsAccepted: existing?.jobsAccepted || s.jobs_verified || 0,
        jobsRejected: existing?.jobsRejected || s.jobs_rejected || 0,
        jobsCurrentlyLive: existing?.jobsCurrentlyLive || 0,
        errorCount: existing?.errorCount || 0,
        consecutiveFailures: existing?.consecutiveFailures || 0,
        lastError: existing?.lastError || s.last_error,
      });
    });
  }

  /**
   * Dynamically registers or updates a source in the orchestrator runtime map.
   */
  public registerDynamicSource(entry: Partial<SourceRuntimeHealth> & { sourceId: string; sourceName: string; domain: string }): void {
    const existing = this.runtimeMap.get(entry.sourceId);
    this.runtimeMap.set(entry.sourceId, {
      sourceId: entry.sourceId,
      sourceName: entry.sourceName,
      domain: entry.domain,
      url: entry.url || `https://${entry.domain}`,
      category: entry.category || 'target_company',
      atsType: entry.atsType || 'custom',
      operationalStatus: entry.operationalStatus || 'ACTIVE',
      connectorAvailable: entry.connectorAvailable ?? true,
      active: entry.active ?? true,
      priority: entry.priority ?? 1,
      lastCheckedAt: entry.lastCheckedAt || new Date().toISOString(),
      responseTimeMs: entry.responseTimeMs || existing?.responseTimeMs,
      jobsDiscovered: entry.jobsDiscovered || existing?.jobsDiscovered || 0,
      jobsAccepted: entry.jobsAccepted || existing?.jobsAccepted || 0,
      jobsRejected: entry.jobsRejected || existing?.jobsRejected || 0,
      jobsCurrentlyLive: entry.jobsCurrentlyLive || existing?.jobsCurrentlyLive || 0,
      errorCount: entry.errorCount || existing?.errorCount || 0,
      consecutiveFailures: entry.consecutiveFailures || existing?.consecutiveFailures || 0,
      lastError: entry.lastError || existing?.lastError,
    });
  }

  /**
   * Deactivates a source so it will not run in future discovery runs.
   */
  public deactivateSource(sourceId: string): void {
    const s = this.runtimeMap.get(sourceId);
    if (s) {
      s.active = false;
      s.operationalStatus = 'REGISTERED';
    }
  }

  /**
   * Returns current statistics across the source inventory.
   */
  public getStats(): SourceOrchestratorStats {
    let connectorsAvailable = 0;
    let currentlyActive = 0;
    let queuedCount = 0;
    let checkingCount = 0;
    let successfullyQueried = 0;
    let noResultsCount = 0;
    let failedCount = 0;
    let timedOutCount = 0;
    let rateLimitedCount = 0;
    let staleCount = 0;
    let totalJobsDiscovered = 0;
    let totalJobsAccepted = 0;

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    this.runtimeMap.forEach((s) => {
      if (s.connectorAvailable) connectorsAvailable++;
      if (s.active) currentlyActive++;

      if (s.operationalStatus === 'QUEUED') queuedCount++;
      else if (s.operationalStatus === 'CHECKING') checkingCount++;
      else if (s.operationalStatus === 'SUCCESS') successfullyQueried++;
      else if (s.operationalStatus === 'NO_RESULTS') noResultsCount++;
      else if (s.operationalStatus === 'TIMEOUT') timedOutCount++;
      else if (s.operationalStatus === 'FAILED' || s.operationalStatus === 'BLOCKED') failedCount++;
      else if (s.operationalStatus === 'RATE_LIMITED') rateLimitedCount++;

      if (!s.lastCheckedAt || new Date(s.lastCheckedAt).getTime() < oneDayAgo) {
        staleCount++;
      }

      totalJobsDiscovered += s.jobsDiscovered;
      totalJobsAccepted += s.jobsAccepted;
    });

    return {
      totalRegistered: this.runtimeMap.size,
      connectorsAvailable,
      currentlyActive,
      queuedCount,
      checkingCount,
      successfullyQueried,
      noResultsCount,
      failedCount,
      timedOutCount,
      rateLimitedCount,
      staleCount,
      totalJobsDiscovered,
      totalJobsAccepted,
    };
  }

  public getRuntimeHealth(sourceId: string): SourceRuntimeHealth | undefined {
    return this.runtimeMap.get(sourceId);
  }

  public getAllRuntimeHealth(): SourceRuntimeHealth[] {
    return Array.from(this.runtimeMap.values());
  }

  public isBusy(): boolean {
    return this.isProcessing;
  }

  public setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }

  public getProgress(): OrchestratorProgress {
    return this.lastProgress;
  }

  public subscribeProgress(listener: (p: OrchestratorProgress) => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  public notifyProgress(progress: OrchestratorProgress): void {
    this.lastProgress = progress;
    this.subscribers.forEach((fn) => {
      try {
        fn(progress);
      } catch (err) {
        console.error('Progress notification error:', err);
      }
    });
  }

  /**
   * Sorts candidate sources according to strict priority order:
   * 1. Target Company sources
   * 2. Verified company ATS
   * 3. Curated remote platforms
   * 4. Recently active / stale
   * 5. Lower priority
   */
  public prioritizeSources(sources: JobSourceRegistryEntry[]): JobSourceRegistryEntry[] {
    return [...sources].sort((a, b) => {
      const stateA = this.runtimeMap.get(a.id);
      const stateB = this.runtimeMap.get(b.id);
      const prioA = stateA?.priority || 5;
      const prioB = stateB?.priority || 5;

      if (prioA !== prioB) {
        return prioA - prioB; // Lower number = higher priority
      }

      // Tie breaker: stale sources first
      const timeA = stateA?.lastCheckedAt ? new Date(stateA.lastCheckedAt).getTime() : 0;
      const timeB = stateB?.lastCheckedAt ? new Date(stateB.lastCheckedAt).getTime() : 0;
      return timeA - timeB;
    });
  }

  /**
   * Records execution results for a source.
   */
  public recordSourceResult(params: {
    sourceId: string;
    status: 'SUCCESS' | 'NO_RESULTS' | 'FAILED' | 'RATE_LIMITED' | 'TIMEOUT' | 'BLOCKED';
    durationMs: number;
    discoveredCount: number;
    acceptedCount: number;
    rejectedCount: number;
    errorMessage?: string;
  }): void {
    const s = this.runtimeMap.get(params.sourceId);
    if (!s) return;

    s.lastCheckedAt = new Date().toISOString();
    s.responseTimeMs = params.durationMs;
    s.operationalStatus = params.status;

    if (params.status === 'SUCCESS' || params.status === 'NO_RESULTS') {
      s.consecutiveFailures = 0;
      s.jobsDiscovered += params.discoveredCount;
      s.jobsAccepted += params.acceptedCount;
      s.jobsRejected += params.rejectedCount;
      s.jobsCurrentlyLive = params.acceptedCount;
      s.lastError = undefined;
    } else if (params.status === 'RATE_LIMITED' || params.status === 'BLOCKED') {
      s.consecutiveFailures++;
      s.errorCount++;
      s.lastError = params.errorMessage || 'Rate limit encountered (HTTP 429)';
      s.backoffUntil = Date.now() + 60 * 1000; // 60s cooldown
    } else if (params.status === 'TIMEOUT') {
      s.consecutiveFailures++;
      s.errorCount++;
      s.lastError = params.errorMessage || 'Connection timed out (>5000ms)';
    } else {
      s.consecutiveFailures++;
      s.errorCount++;
      s.lastError = params.errorMessage || 'Upstream fetch failed';
    }
  }

  /**
   * Dynamically marks source as queued.
   */
  public markQueued(sourceId: string): void {
    const s = this.runtimeMap.get(sourceId);
    if (s) {
      s.operationalStatus = 'QUEUED';
    }
  }

  /**
   * Dynamically marks source as checking.
   */
  public markChecking(sourceId: string): void {
    const s = this.runtimeMap.get(sourceId);
    if (s) {
      s.operationalStatus = 'CHECKING';
    }
  }
}

export const sourceOrchestrator = new SourceOrchestrator();
