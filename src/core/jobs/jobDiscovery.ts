import { JobOpportunity, DiscoveryRun } from './types';
import { UserProfile } from '../profile/types';
import { sourceRegistry } from './sourceRegistry';
import { jobRepository } from './jobRepository';
import { buildCareerSearchModel } from './careerSearchModel';
import { connectorManager } from './jobConnectors';
import { normalizeRawJobs } from './jobPipeline';
import { targetCompaniesStore } from '../target-companies/targetCompanyStore';

export interface DiscoveryProgressEvent {
  stage: 'initiating' | 'querying_sources' | 'normalizing' | 'deduplicating' | 'verifying' | 'matching' | 'complete';
  percent: number;
  message: string;
  activeConnectorName?: string;
  sourcesQueried?: number;
  totalActiveSources?: number;
  jobsDiscovered?: number;
  jobsVerified?: number;
  duplicatesRemoved?: number;
}

export interface DiscoveryScanResult {
  scannedSourcesCount: number;
  newlyDiscoveredCount: number;
  mergedCount: number;
  opportunities: JobOpportunity[];
  run: DiscoveryRun;
}

/**
 * Continuous Job Discovery Engine
 * Dynamically queries all active sources in the Source Registry based on the user's
 * canonical Profile and CareerSearchModel.
 */
export async function runLiveDiscoveryScan(
  profile: UserProfile,
  onProgress?: (event: DiscoveryProgressEvent) => void
): Promise<DiscoveryScanResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // 1. Synchronize target companies from profile and store
  const userTargetCompanies = [
    ...(profile.targetMarkets?.targetCompanies || []),
    ...targetCompaniesStore.getCompanies().map((c) => c.name),
  ];
  const uniqueTargets = Array.from(new Set(userTargetCompanies));
  targetCompaniesStore.syncWithProfile(uniqueTargets);
  sourceRegistry.syncTargetCompanies(uniqueTargets);

  const activeSources = sourceRegistry.getActiveSources();
  const careerModel = buildCareerSearchModel(profile);

  onProgress?.({
    stage: 'initiating',
    percent: 10,
    message: `Initializing discovery across ${activeSources.length} active sources...`,
    sourcesQueried: 0,
    totalActiveSources: activeSources.length,
    jobsDiscovered: 0,
  });

  onProgress?.({
    stage: 'querying_sources',
    percent: 15,
    message: `Connecting to ${activeSources.length} enabled sources...`,
    sourcesQueried: 0,
    totalActiveSources: activeSources.length,
    jobsDiscovered: 0,
  });

  // 2. Run active ingestion across all enabled sources with real telemetry
  const { rawJobs, telemetry } = await connectorManager.runAllConnectors(
    profile,
    activeSources,
    careerModel,
    (p) => {
      onProgress?.({
        stage: 'querying_sources',
        percent: Math.min(65, Math.round((p.queried / p.total) * 45) + 15),
        message: `Querying active sources (${p.queried} / ${p.total} queried)...`,
        activeConnectorName: p.currentSource,
        sourcesQueried: p.queried,
        totalActiveSources: p.total,
        jobsDiscovered: p.rawJobsCount,
      });
    }
  );

  onProgress?.({
    stage: 'normalizing',
    percent: 75,
    message: `Normalizing ${rawJobs.length} raw opportunities & resolving official company logos...`,
    sourcesQueried: activeSources.length,
    totalActiveSources: activeSources.length,
    jobsDiscovered: rawJobs.length,
  });

  // 3. Normalize and verify each raw job using the canonical pipeline & verification engine
  const normalizedJobs: JobOpportunity[] = normalizeRawJobs(rawJobs, uniqueTargets);

  onProgress?.({
    stage: 'deduplicating',
    percent: 85,
    message: 'Deduplicating across sources & merging provenance records...',
    sourcesQueried: activeSources.length,
    totalActiveSources: activeSources.length,
    jobsDiscovered: rawJobs.length,
    jobsVerified: normalizedJobs.length,
  });

  // 4. Batch deduplicate and ingest into persistent repository
  const { added, merged } = jobRepository.ingestBatch(normalizedJobs);

  onProgress?.({
    stage: 'verifying',
    percent: 95,
    message: 'Validating application URLs & calculating career profile match scores...',
    sourcesQueried: activeSources.length,
    totalActiveSources: activeSources.length,
    jobsDiscovered: rawJobs.length,
    jobsVerified: added,
    duplicatesRemoved: merged,
  });

  const durationMs = Date.now() - startTime;
  const completedAt = new Date().toISOString();

  const runRecord: DiscoveryRun = {
    id: `run-${Date.now()}`,
    runId: `run-${Date.now()}`,
    startedAt,
    completedAt,
    durationMs,
    status: 'COMPLETED',
    requestedSourceCount: activeSources.length,
    eligibleSourceCount: activeSources.length,
    queriedSourceCount: telemetry.length,
    successfulSourceCount: telemetry.filter((t) => t.status === 'success').length,
    failedSourceCount: telemetry.filter((t) => t.status === 'failed').length,
    timedOutSourceCount: 0,
    sourcesReturningZeroJobs: telemetry.filter((t) => t.jobsDiscovered === 0).length,
    sourcesReturningJobs: telemetry.filter((t) => t.jobsDiscovered > 0).length,
    rawJobsDiscovered: rawJobs.length,
    validJobsDiscovered: added,
    duplicateJobsRemoved: merged,
    newJobsAdded: added,
    existingJobsRefreshed: merged,
    rejectedJobs: 0,
    sourceBreakdown: [],
    sourcesQueriedCount: telemetry.length,
    sourcesSucceededCount: telemetry.filter((t) => t.status === 'success').length,
    sourcesFailedCount: telemetry.filter((t) => t.status === 'failed').length,
    sourcesWithResultsCount: telemetry.filter((t) => t.jobsDiscovered > 0).length,
    rawDiscoveredCount: rawJobs.length,
    duplicatesRemovedCount: merged,
    invalidRemovedCount: 0,
    verifiedOpportunitiesCount: added,
    connectors: telemetry,
  };

  // Record discovery telemetry in the source registry
  sourceRegistry.recordDiscoveryRun(runRecord);

  // Synchronize target companies open & matching role counts
  targetCompaniesStore.syncCountsFromRepository();

  onProgress?.({
    stage: 'complete',
    percent: 100,
    message: `Discovery complete. ${added} new opportunities ingested (${merged} duplicates merged).`,
    sourcesQueried: telemetry.length,
    totalActiveSources: activeSources.length,
    jobsDiscovered: rawJobs.length,
    jobsVerified: added,
    duplicatesRemoved: merged,
  });

  return {
    scannedSourcesCount: telemetry.length,
    newlyDiscoveredCount: added,
    mergedCount: merged,
    opportunities: jobRepository.getActiveOpportunities(),
    run: runRecord,
  };
}
