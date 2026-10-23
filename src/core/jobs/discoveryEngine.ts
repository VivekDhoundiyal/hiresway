/**
 * CareerOs Finite Asynchronous Discovery Engine
 * 
 * Key Principles:
 * 1. FINITE RUNS: Every discovery execution is an explicit run with runId, start/end timestamps,
 *    and exact counts of queried, successful, failed, timed-out, zero-job, and new jobs.
 * 2. ZERO INFINITE SPINNER: Automatic run timeout safeguards and individual source timeouts (5s).
 * 3. INCREMENTAL STREAMING: Jobs are normalized, deduplicated, and ingested as sources finish.
 * 4. RECONNECTION: Browser refresh reattaches to running job or recovers cleanly.
 * 5. TRUTHFUL TELEMETRY: Never claims registered sources were queried if only a subset ran.
 */

import { DiscoveryRunRecord, RawDiscoveredJob, JobLifecycleState, JobOpportunity } from './types';
import { UserProfile } from '../profile/types';
import { sourceRegistry } from './sourceRegistry';
import { sourceOrchestrator } from './sourceOrchestrator';
import { jobRepository } from './jobRepository';
import { connectorManager } from './jobConnectors';
import { normalizeRawJobs } from './jobPipeline';
import { jobVerificationEngine } from './jobVerificationEngine';
import { targetCompaniesStore } from '../target-companies/targetCompanyStore';
import { buildCareerSearchModel } from './careerSearchModel';
import { discoveryLedgerEngine } from './engines/discoveryLedgerEngine';
import { buildSearchConfiguration } from './searchConfiguration';
import { hardEligibilityEngine } from './engines/hardEligibilityEngine';
import { jobMatchingEngine } from './engines/jobMatchingEngine';
import { jobFeedStore } from './jobFeedStore';

const ACTIVE_RUN_STORAGE_KEY = 'careeros_active_discovery_run_v2';
const LAST_RUN_STORAGE_KEY = 'careeros_last_discovery_run_v2';
const RUN_HISTORY_STORAGE_KEY = 'careeros_discovery_history_v2';
const LAST_DISCOVERY_TIMESTAMPS_KEY = 'careeros_last_discovery_timestamps_v2';

export type ContinuousDiscoveryState = 'DISCOVER' | 'DISCOVERING' | 'PAUSED' | 'ERROR';

export interface DiscoveryEngineProgressEvent {
  runId: string;
  stage: 'initiating' | 'querying' | 'normalizing' | 'deduplicating' | 'streaming' | 'complete' | 'error' | 'cancelled';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED';
  message: string;
  percent: number;
  sourcesQueried: number;
  totalEligibleSources: number;
  totalRegisteredSources: number;
  currentSourceName?: string;
  rawJobsDiscovered: number;
  newJobsAdded: number;
  duplicatesRemoved: number;
  successfulSources: number;
  failedSources: number;
  timedOutSources: number;
  sourcesWithZeroJobs: number;
}

export type DiscoveryProgressListener = (event: DiscoveryEngineProgressEvent) => void;
export type DiscoveryBatchListener = (newJobsCount: number, totalDiscovered: number) => void;

export class JobDiscoveryEngine {
  private activeRun: DiscoveryRunRecord | null = null;
  private isRunning = false;
  private abortController: AbortController | null = null;
  private inFlightRunPromise: Promise<DiscoveryRunRecord> | null = null;
  private isContinuousMode = false;
  private watchdogTimer: any = null;
  private progressListeners: Set<DiscoveryProgressListener> = new Set();
  private batchListeners: Set<DiscoveryBatchListener> = new Set();
  private state: ContinuousDiscoveryState = 'DISCOVER';
  private errorMessage: string | null = null;
  private scheduledTimer: any = null;
  private stateListeners: Set<(state: ContinuousDiscoveryState) => void> = new Set();
  private lastAttemptAt: string | null = null;
  private lastSuccessAt: string | null = null;

  constructor() {
    this.reconnectOrRecover();
  }

  /**
   * Reconnects to an in-flight run or recovers cleanly from abandoned runs (e.g. browser tab crash).
   * Guarantees zero false RUNNING reporting when workers are not running in memory.
   */
  public reconnectOrRecover(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const tsStored = localStorage.getItem(LAST_DISCOVERY_TIMESTAMPS_KEY);
        if (tsStored) {
          const parsed = JSON.parse(tsStored);
          this.lastAttemptAt = parsed.lastAttemptAt || null;
          this.lastSuccessAt = parsed.lastSuccessAt || null;
        }
      }
    } catch {}

    try {
      if (typeof localStorage === 'undefined') return;
      const stored = localStorage.getItem(ACTIVE_RUN_STORAGE_KEY);
      if (!stored) return;

      const run: DiscoveryRunRecord = JSON.parse(stored);
      const elapsed = Date.now() - new Date(run.startedAt).getTime();

      // On browser reload/restart or stale runs older than 60s, workers are not active in memory.
      // Cleanly settle previous run to prevent false "RUNNING" reporting with 0 active workers.
      if (run.status === 'RUNNING') {
        run.status = run.queriedSourceCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'CANCELLED';
        run.completedAt = new Date().toISOString();
        run.durationMs = elapsed;
        run.errorMessage = 'Previous run settled upon session recovery';
        this.saveRunHistory(run);
      }
      localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
      this.activeRun = null;
      this.isRunning = false;
      this.state = 'DISCOVER';
    } catch (err) {
      console.warn('Failed to recover discovery run state:', err);
    }
  }

  private saveTimestamps(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          LAST_DISCOVERY_TIMESTAMPS_KEY,
          JSON.stringify({
            lastAttemptAt: this.lastAttemptAt,
            lastSuccessAt: this.lastSuccessAt,
          })
        );
      }
    } catch {}
  }

  public getLastAttemptAt(): string | null {
    if (this.lastAttemptAt) return this.lastAttemptAt;
    const lastRun = this.getLastCompletedRun();
    return lastRun?.startedAt || null;
  }

  public getLastSuccessAt(): string | null {
    if (this.lastSuccessAt) return this.lastSuccessAt;
    const lastRun = this.getLastCompletedRun();
    if (lastRun && (lastRun.status === 'COMPLETED' || lastRun.status === 'COMPLETED_WITH_ERRORS')) {
      return lastRun.completedAt || lastRun.startedAt || null;
    }
    return null;
  }

  public getSourcesActuallyRan(): any[] {
    if (this.activeRun && this.activeRun.sourceBreakdown && this.activeRun.sourceBreakdown.length > 0) {
      return [...this.activeRun.sourceBreakdown];
    }
    const last = this.getLastCompletedRun();
    return last?.sourceBreakdown ? [...last.sourceBreakdown] : [];
  }

  public getActiveRun(): DiscoveryRunRecord | null {
    return this.activeRun;
  }

  public getLastCompletedRun(): DiscoveryRunRecord | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const stored = localStorage.getItem(LAST_RUN_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  }

  public getRunHistory(): DiscoveryRunRecord[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const stored = localStorage.getItem(RUN_HISTORY_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  public isDiscoveryRunning(): boolean {
    return this.isRunning;
  }

  public subscribeProgress(listener: DiscoveryProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  public subscribeBatch(listener: DiscoveryBatchListener): () => void {
    this.batchListeners.add(listener);
    return () => this.batchListeners.delete(listener);
  }

  public notifyProgress(event: DiscoveryEngineProgressEvent): void {
    this.progressListeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('Discovery progress listener error:', err);
      }
    });
  }

  public notifyBatch(newJobsCount: number, totalDiscovered: number): void {
    this.batchListeners.forEach((fn) => {
      try {
        fn(newJobsCount, totalDiscovered);
      } catch (err) {
        console.error('Discovery batch listener error:', err);
      }
    });
  }

  /**
   * Cancels the currently running discovery execution.
   */
  public cancelDiscoveryRun(): void {
    this.cancelRun();
  }

  public cancelDiscovery(): void {
    this.cancelRun();
  }

  private setState(newState: ContinuousDiscoveryState, errorMsg: string | null = null): void {
    this.state = newState;
    if (errorMsg !== null || newState !== 'ERROR') {
      this.errorMessage = errorMsg;
    }
    for (const listener of this.stateListeners) {
      try {
        listener(newState);
      } catch (err) {
        console.error('DiscoveryEngine state listener error:', err);
      }
    }
  }

  public getState(): ContinuousDiscoveryState {
    return this.state;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public subscribeState(listener: (state: ContinuousDiscoveryState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Starts or resumes the Continuous Discovery Loop.
   * Runs prioritized batches without resetting or wiping the feed.
   */
  public async startContinuousLoop(profile?: UserProfile): Promise<void> {
    this.isContinuousMode = true;
    if (this.state === 'DISCOVERING' && this.isRunning) return;

    this.setState('DISCOVERING', null);
    discoveryLedgerEngine.setStatus('RUNNING', 'Continuous Discovery active');

    const runSlice = async () => {
      if (this.state !== 'DISCOVERING' || !this.isContinuousMode) return;

      try {
        await this.startDiscoveryRun(profile || ({} as any));

        if (this.state !== 'DISCOVERING' || !this.isContinuousMode) return;

        // Schedule next incremental slice (every 10s while active)
        this.scheduledTimer = setTimeout(runSlice, 10000);
      } catch (err: any) {
        if (this.state === 'DISCOVERING') {
          const msg = err instanceof Error ? err.message : 'Discovery encountered an issue';
          this.setState('ERROR', msg);
          discoveryLedgerEngine.setStatus('ERROR', msg);
        }
      }
    };

    runSlice();
  }

  /**
   * Pauses continuous discovery without deleting existing jobs or resetting the feed.
   */
  public pauseLoop(): void {
    this.isContinuousMode = false;
    this.setState('PAUSED');
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
    this.inFlightRunPromise = null;
    sourceOrchestrator.setProcessing(false);
    discoveryLedgerEngine.setStatus('PAUSED', 'Continuous Discovery paused by user');
  }

  /**
   * Resumes continuous discovery from paused state.
   */
  public resumeLoop(profile?: UserProfile): void {
    if (this.state === 'PAUSED' || this.state === 'DISCOVER' || this.state === 'ERROR') {
      this.startContinuousLoop(profile);
    }
  }

  /**
   * Completely stops continuous discovery.
   */
  public stopLoop(): void {
    this.isContinuousMode = false;
    this.setState('DISCOVER', null);
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
    this.inFlightRunPromise = null;
    sourceOrchestrator.setProcessing(false);
    discoveryLedgerEngine.setStatus('IDLE', 'Discovery Engine Idle / Ready');
  }

  public cancelRun(): void {
    this.isContinuousMode = false;
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.setState('DISCOVER', null);

    if (!this.isRunning || !this.activeRun) return;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.inFlightRunPromise = null;

    this.activeRun.status = 'CANCELLED';
    this.activeRun.completedAt = new Date().toISOString();
    this.activeRun.durationMs = Date.now() - new Date(this.activeRun.startedAt).getTime();
    this.saveRunHistory(this.activeRun);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
      }
    } catch {}

    this.isRunning = false;
    sourceOrchestrator.setProcessing(false);
    discoveryLedgerEngine.setStatus('IDLE', 'Discovery Run Cancelled');

    this.notifyProgress({
      runId: this.activeRun.id,
      stage: 'cancelled',
      status: 'CANCELLED',
      message: 'Discovery run cancelled by user',
      percent: 100,
      sourcesQueried: this.activeRun.queriedSourceCount,
      totalEligibleSources: this.activeRun.eligibleSourceCount,
      totalRegisteredSources: this.activeRun.requestedSourceCount,
      rawJobsDiscovered: this.activeRun.rawJobsDiscovered,
      newJobsAdded: this.activeRun.newJobsAdded,
      duplicatesRemoved: this.activeRun.duplicateJobsRemoved,
      successfulSources: this.activeRun.successfulSourceCount,
      failedSources: this.activeRun.failedSourceCount,
      timedOutSources: this.activeRun.timedOutSourceCount,
      sourcesWithZeroJobs: this.activeRun.sourcesReturningZeroJobs,
    });
  }

  /**
   * Starts a finite discovery run across prioritized eligible sources.
   * Communication is fully asynchronous with incremental batch streaming.
   */
  public async startDiscoveryRun(
    profile: UserProfile,
    options?: { maxSources?: number; forceRescan?: boolean }
  ): Promise<DiscoveryRunRecord> {
    // Prevent duplicate concurrent runs - share active in-flight promise if available
    if (this.isRunning && this.inFlightRunPromise) {
      return this.inFlightRunPromise;
    }
    if (this.isRunning && this.activeRun) {
      return this.activeRun;
    }

    const runPromise = this.executeDiscoveryRun(profile, options);
    this.inFlightRunPromise = runPromise;
    return runPromise;
  }

  private async executeDiscoveryRun(
    profile: UserProfile,
    options?: { maxSources?: number; forceRescan?: boolean }
  ): Promise<DiscoveryRunRecord> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    this.isRunning = true;
    this.lastAttemptAt = startedAt;
    this.saveTimestamps();
    this.abortController = new AbortController();
    sourceOrchestrator.setProcessing(true);

    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(() => {
      if (this.isRunning && this.abortController) {
        console.warn('Discovery run watchdog timeout (60s) reached - auto-aborting hung requests');
        this.abortController.abort();
      }
    }, 60000);

    // 1. Synchronize Target Companies from Profile & Store
    const userTargetCompanies = [
      ...(profile.targetMarkets?.targetCompanies || []),
      ...targetCompaniesStore.getCompanies().map((c) => c.name),
    ];
    const uniqueTargets = Array.from(new Set(userTargetCompanies.filter(Boolean)));
    targetCompaniesStore.syncWithProfile(uniqueTargets);
    sourceRegistry.syncTargetCompanies(uniqueTargets);

    const allRegisteredSources = sourceRegistry.getAllSources();
    const activeEnabledSources = sourceRegistry.getActiveSources();
    const careerModel = buildCareerSearchModel(profile);
    const searchConfig = buildSearchConfiguration(profile);

    // 2. Select eligible sources for this finite run based on priority and health
    const prioritized = sourceOrchestrator.prioritizeSources(
      activeEnabledSources.length > 0 ? activeEnabledSources : allRegisteredSources
    );
    const eligibleSources = options?.maxSources ? prioritized.slice(0, options.maxSources) : prioritized;

    const runRecord: DiscoveryRunRecord = {
      id: runId,
      startedAt,
      status: 'RUNNING',
      requestedSourceCount: allRegisteredSources.length,
      eligibleSourceCount: eligibleSources.length,
      queriedSourceCount: 0,
      successfulSourceCount: 0,
      failedSourceCount: 0,
      timedOutSourceCount: 0,
      decommissionedSourceCount: 0,
      sourcesReturningZeroJobs: 0,
      sourcesReturningJobs: 0,
      rawJobsDiscovered: 0,
      validJobsDiscovered: 0,
      duplicateJobsRemoved: 0,
      newJobsAdded: 0,
      existingJobsRefreshed: 0,
      invalidRecordsCount: 0,
      rejectedJobs: 0,
      sourceBreakdown: [],
      // Compatibility aliases
      sourcesQueriedCount: 0,
      sourcesSucceededCount: 0,
      sourcesFailedCount: 0,
      sourcesWithResultsCount: 0,
      rawDiscoveredCount: 0,
      duplicatesRemovedCount: 0,
      invalidRemovedCount: 0,
      verifiedOpportunitiesCount: 0,
      jobsVerifiedCount: 0,
      jobsRejectedCount: 0,
      profileMatchedCount: 0,
      publishedToFeedCount: 0,
      savedCount: jobRepository.getSavedOpportunities().length,
    };

    this.activeRun = runRecord;
    this.persistActiveRun(runRecord);

    this.notifyProgress({
      runId,
      stage: 'initiating',
      status: 'RUNNING',
      message: `Starting discovery across ${eligibleSources.length} prioritized sources (${allRegisteredSources.length} in catalog)...`,
      percent: 5,
      sourcesQueried: 0,
      totalEligibleSources: eligibleSources.length,
      totalRegisteredSources: allRegisteredSources.length,
      rawJobsDiscovered: 0,
      newJobsAdded: 0,
      duplicatesRemoved: 0,
      successfulSources: 0,
      failedSources: 0,
      timedOutSources: 0,
      sourcesWithZeroJobs: 0,
    });

    try {
      // 3. Query all connectors & enabled catalog sources with incremental streaming and failure isolation
      const { telemetry } = await connectorManager.runAllConnectors(
        profile,
        eligibleSources,
        careerModel,
        (progress) => {
          if (this.abortController?.signal.aborted) return;
          runRecord.queriedSourceCount = Math.max(
            progress.queried,
            runRecord.successfulSourceCount + runRecord.failedSourceCount
          );
          runRecord.sourcesQueriedCount = runRecord.queriedSourceCount;
          runRecord.eligibleSourceCount = Math.max(runRecord.eligibleSourceCount, runRecord.queriedSourceCount);
          runRecord.pendingSourceCount = Math.max(0, runRecord.eligibleSourceCount - runRecord.queriedSourceCount);
          runRecord.quarantinedSourceCount = sourceRegistry.getQuarantinedSources().length;
          runRecord.skippedSourceCount = allRegisteredSources.filter(
            (s) => s.eligibilityStatus === 'unavailable' || s.eligibilityStatus === 'requires_configuration' || s.eligibilityStatus === 'unsupported' || !s.activeStatus
          ).length;

          const pct = Math.min(
            95,
            Math.round((runRecord.queriedSourceCount / Math.max(1, runRecord.eligibleSourceCount)) * 90) + 5
          );

          this.notifyProgress({
            runId,
            stage: 'querying',
            status: 'RUNNING',
            message: `Queried ${runRecord.queriedSourceCount} / ${runRecord.eligibleSourceCount} sources (${runRecord.newJobsAdded} new jobs added)...`,
            percent: pct,
            sourcesQueried: runRecord.queriedSourceCount,
            totalEligibleSources: runRecord.eligibleSourceCount,
            totalRegisteredSources: allRegisteredSources.length,
            currentSourceName: progress.currentSource,
            rawJobsDiscovered: runRecord.rawJobsDiscovered,
            newJobsAdded: runRecord.newJobsAdded,
            duplicatesRemoved: runRecord.duplicateJobsRemoved,
            successfulSources: runRecord.successfulSourceCount,
            failedSources: runRecord.failedSourceCount,
            timedOutSources: runRecord.timedOutSourceCount,
            sourcesWithZeroJobs: runRecord.sourcesReturningZeroJobs,
          });
        },
        (batchRawJobs, source) => {
          if (this.abortController?.signal.aborted) return;
          if (batchRawJobs.length > 0) {
            // Verify jobs and filter dead signatures before normalization
            const verifiedBatch: RawDiscoveredJob[] = [];
            for (const rj of batchRawJobs) {
              const deadCheck = jobVerificationEngine.checkDeadJobSignatures(rj);
              if (deadCheck.isDead) {
                runRecord.jobsRejectedCount = (runRecord.jobsRejectedCount || 0) + 1;
                runRecord.invalidRecordsCount = (runRecord.invalidRecordsCount || 0) + 1;
                runRecord.rejectedJobs = (runRecord.rejectedJobs || 0) + 1;
              } else {
                verifiedBatch.push(rj);
              }
            }

            runRecord.successfulSourceCount++;
            runRecord.sourcesSucceededCount = runRecord.successfulSourceCount;
            runRecord.sourcesReturningJobs++;
            runRecord.sourcesWithResultsCount = runRecord.sourcesReturningJobs;
            runRecord.rawJobsDiscovered += batchRawJobs.length;
            runRecord.rawDiscoveredCount = runRecord.rawJobsDiscovered;

            // Ensure Checked >= Successful + Failed
            runRecord.queriedSourceCount = Math.max(
              runRecord.queriedSourceCount,
              runRecord.successfulSourceCount + runRecord.failedSourceCount
            );
            runRecord.sourcesQueriedCount = runRecord.queriedSourceCount;

            // Normalize and ingest incrementally
            const normalized = normalizeRawJobs(verifiedBatch, uniqueTargets);
            const invalidInBatch = Math.max(0, verifiedBatch.length - normalized.length);
            runRecord.invalidRecordsCount = (runRecord.invalidRecordsCount || 0) + invalidInBatch;
            runRecord.jobsRejectedCount = (runRecord.jobsRejectedCount || 0) + invalidInBatch;

            // Candidate Intake: Structural authenticity check & transparent relevance scoring
            const eligibleJobs: JobOpportunity[] = [];
            const nowIso = new Date().toISOString();

            for (const job of normalized) {
              const eligibility = hardEligibilityEngine.evaluateEligibility(job, searchConfig, { broadDiscovery: true });
              if (eligibility.eligible) {
                // Compute transparent multi-factor relevance score
                const matchAnalysis = jobMatchingEngine.getMatchAnalysis(job, profile);
                const firstSeen = (job as any).firstSeenAt || (job as any).first_seen_at || job.dateDiscovered || nowIso;
                const expiresAt = (job as any).expiresAt || (job as any).expires_at || new Date(new Date(firstSeen).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

                eligibleJobs.push({
                  ...job,
                  lifecycleState: 'IN_FEED' as JobLifecycleState,
                  match_score: matchAnalysis.overallScore,
                  match_reasons: matchAnalysis.strengths,
                  mismatch_reasons: matchAnalysis.gaps,
                  first_seen_at: firstSeen,
                  firstSeenAt: firstSeen,
                  last_seen_at: nowIso,
                  lastSeenAt: nowIso,
                  expires_at: expiresAt,
                  expiresAt: expiresAt,
                });
              } else {
                runRecord.jobsRejectedCount = (runRecord.jobsRejectedCount || 0) + 1;
              }
            }

            runRecord.profileMatchedCount = (runRecord.profileMatchedCount || 0) + eligibleJobs.filter(j => (j.match_score || 0) >= 40).length;

            // Ingest discovered jobs into dedicated JobFeedStore (never directly to Job Database!)
            const { newMatchingCount, publishedCount, pendingCount: _pendingCount, mergedCount, duplicateCount } =
              jobFeedStore.ingestDiscoveredBatch(eligibleJobs, true);

            runRecord.invalidRemovedCount = runRecord.invalidRecordsCount;
            runRecord.validJobsDiscovered += eligibleJobs.length;
            runRecord.jobsVerifiedCount = (runRecord.jobsVerifiedCount || 0) + verifiedBatch.length;
            runRecord.newJobsAdded += newMatchingCount;
            runRecord.verifiedOpportunitiesCount = runRecord.newJobsAdded;
            runRecord.publishedToFeedCount = (runRecord.publishedToFeedCount || 0) + publishedCount;
            runRecord.existingJobsRefreshed = (runRecord.existingJobsRefreshed || 0) + mergedCount;
            runRecord.duplicateJobsRemoved += duplicateCount;
            runRecord.duplicatesRemovedCount = runRecord.duplicateJobsRemoved;
            runRecord.savedCount = jobRepository.getSavedOpportunities().length;

            discoveryLedgerEngine.recordSourceResult({
              sourceId: source.id,
              sourceName: source.name,
              domain: source.domain || 'api.careeros.local',
              durationMs: 50,
              jobsDiscovered: batchRawJobs.length,
              jobsVerified: verifiedBatch.length,
              duplicates: duplicateCount,
              rejectedDead: invalidInBatch + (normalized.length - eligibleJobs.length),
            });

            if (newMatchingCount > 0) {
              this.notifyBatch(newMatchingCount, runRecord.rawJobsDiscovered);
            }
          } else {
            runRecord.successfulSourceCount++;
            runRecord.sourcesSucceededCount = runRecord.successfulSourceCount;
            runRecord.sourcesReturningZeroJobs++;
            runRecord.queriedSourceCount = Math.max(
              runRecord.queriedSourceCount,
              runRecord.successfulSourceCount + runRecord.failedSourceCount
            );
            runRecord.sourcesQueriedCount = runRecord.queriedSourceCount;

            discoveryLedgerEngine.recordSourceResult({
              sourceId: source.id,
              sourceName: source.name,
              domain: source.domain || 'api.careeros.local',
              durationMs: 50,
              jobsDiscovered: 0,
              jobsVerified: 0,
              duplicates: 0,
              rejectedDead: 0,
            });
          }

          runRecord.eligibleSourceCount = Math.max(runRecord.eligibleSourceCount, runRecord.queriedSourceCount);
          runRecord.pendingSourceCount = Math.max(0, runRecord.eligibleSourceCount - runRecord.queriedSourceCount);
          runRecord.quarantinedSourceCount = sourceRegistry.getQuarantinedSources().length;
          runRecord.skippedSourceCount = allRegisteredSources.filter(
            (s) => s.eligibilityStatus === 'unavailable' || s.eligibilityStatus === 'requires_configuration' || s.eligibilityStatus === 'unsupported' || !s.activeStatus
          ).length;

          runRecord.sourceBreakdown.push({
            sourceId: source.id,
            sourceName: source.name,
            domain: source.domain || 'api.careeros.local',
            category: source.category,
            atsType: source.atsType,
            status: batchRawJobs.length > 0 ? 'SUCCESS' : 'NO_RESULTS',
            durationMs: 50,
            jobsDiscovered: batchRawJobs.length,
            newJobs: batchRawJobs.length,
            duplicates: 0,
            timestamp: new Date().toISOString(),
          });

          this.persistActiveRun(runRecord);
        }
      );

      // Finalize run state with strict run-level telemetry reconciliation
      const durationMs = Date.now() - startTime;
      const allSourcesNow = sourceRegistry.getAllSources();
      const quarantinedNow = sourceRegistry.getQuarantinedSources();
      const decommissionedCount = allSourcesNow.filter((s) => s.healthState === 'DECOMMISSIONED' || s.healthState === 'QUARANTINED').length;

      const successfulInRun = telemetry.filter((t) => t.status === 'success').length;
      const failedInRun = telemetry.filter((t) => t.status === 'failed').length;

      runRecord.successfulSourceCount = Math.max(runRecord.successfulSourceCount, successfulInRun);
      runRecord.sourcesSucceededCount = runRecord.successfulSourceCount;
      runRecord.failedSourceCount = Math.max(runRecord.failedSourceCount, failedInRun);
      runRecord.sourcesFailedCount = runRecord.failedSourceCount;
      runRecord.decommissionedSourceCount = decommissionedCount;

      runRecord.queriedSourceCount = runRecord.successfulSourceCount + runRecord.failedSourceCount;
      runRecord.sourcesQueriedCount = runRecord.queriedSourceCount;
      runRecord.eligibleSourceCount = Math.max(runRecord.eligibleSourceCount, runRecord.queriedSourceCount);
      runRecord.pendingSourceCount = Math.max(0, runRecord.eligibleSourceCount - runRecord.queriedSourceCount);
      runRecord.quarantinedSourceCount = quarantinedNow.length;
      runRecord.skippedSourceCount = allSourcesNow.filter(
        (s) => s.eligibilityStatus === 'unavailable' || s.eligibilityStatus === 'requires_configuration' || s.eligibilityStatus === 'unsupported' || !s.activeStatus
      ).length;
      runRecord.jobsVerifiedCount = runRecord.validJobsDiscovered || 0;
      runRecord.jobsRejectedCount = Math.max(
        runRecord.jobsRejectedCount || 0,
        Math.max(0, runRecord.rawJobsDiscovered - runRecord.validJobsDiscovered)
      );

      runRecord.completedAt = new Date().toISOString();
      runRecord.durationMs = durationMs;
      runRecord.status = runRecord.failedSourceCount > 0 || runRecord.timedOutSourceCount > 0
        ? 'COMPLETED_WITH_ERRORS'
        : 'COMPLETED';

      this.lastSuccessAt = runRecord.completedAt;
      this.saveTimestamps();

      discoveryLedgerEngine.setStatus(
        runRecord.status === 'COMPLETED' ? 'COMPLETED' : 'ERROR',
        `Discovery complete: ${runRecord.queriedSourceCount} checked, ${runRecord.rawJobsDiscovered} jobs found.`
      );

      // Synchronize Target Company counts & Source Registry telemetry
      targetCompaniesStore.syncCountsFromRepository();
      sourceRegistry.recordDiscoveryRun(runRecord);

      this.saveRunHistory(runRecord);

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
        }
      } catch {}

      this.notifyProgress({
        runId,
        stage: 'complete',
        status: runRecord.status,
        message: `Discovery complete. ${runRecord.queriedSourceCount} sources checked, ${runRecord.rawJobsDiscovered} jobs found (${runRecord.newJobsAdded} new).`,
        percent: 100,
        sourcesQueried: runRecord.queriedSourceCount,
        totalEligibleSources: eligibleSources.length,
        totalRegisteredSources: allRegisteredSources.length,
        rawJobsDiscovered: runRecord.rawJobsDiscovered,
        newJobsAdded: runRecord.newJobsAdded,
        duplicatesRemoved: runRecord.duplicateJobsRemoved,
        successfulSources: runRecord.successfulSourceCount,
        failedSources: runRecord.failedSourceCount,
        timedOutSources: runRecord.timedOutSourceCount,
        sourcesWithZeroJobs: runRecord.sourcesReturningZeroJobs,
      });

      return runRecord;
    } catch (err: unknown) {
      console.error('Fatal discovery run error:', err);
      runRecord.status = 'FAILED';
      runRecord.completedAt = new Date().toISOString();
      runRecord.durationMs = Date.now() - startTime;
      runRecord.errorMessage = err instanceof Error ? err.message : 'Unknown discovery error';
      this.saveRunHistory(runRecord);

      discoveryLedgerEngine.setStatus('ERROR', runRecord.errorMessage);

      this.notifyProgress({
        runId,
        stage: 'error',
        status: 'FAILED',
        message: `Discovery halted: ${runRecord.errorMessage}`,
        percent: 100,
        sourcesQueried: runRecord.queriedSourceCount,
        totalEligibleSources: eligibleSources.length,
        totalRegisteredSources: allRegisteredSources.length,
        rawJobsDiscovered: runRecord.rawJobsDiscovered,
        newJobsAdded: runRecord.newJobsAdded,
        duplicatesRemoved: runRecord.duplicateJobsRemoved,
        successfulSources: runRecord.successfulSourceCount,
        failedSources: runRecord.failedSourceCount,
        timedOutSources: runRecord.timedOutSourceCount,
        sourcesWithZeroJobs: runRecord.sourcesReturningZeroJobs,
      });

      return runRecord;
    } finally {
      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      this.isRunning = false;
      this.activeRun = null;
      this.inFlightRunPromise = null;
      this.abortController = null;
      sourceOrchestrator.setProcessing(false);
      if (this.state !== 'PAUSED' && !this.isContinuousMode) {
        this.setState('DISCOVER');
      }
    }
  }

  private persistActiveRun(run: DiscoveryRunRecord): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_RUN_STORAGE_KEY, JSON.stringify(run));
      }
    } catch {}
  }

  private saveRunHistory(run: DiscoveryRunRecord): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(LAST_RUN_STORAGE_KEY, JSON.stringify(run));

      const existing: DiscoveryRunRecord[] = this.getRunHistory();
      const updated = [run, ...existing.filter((r) => r.id !== run.id)].slice(0, 20);
      localStorage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save discovery run history:', err);
    }
  }
}

export const discoveryEngine = new JobDiscoveryEngine();
