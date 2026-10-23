import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProfile } from '../profile';
import {
  JobOpportunity,
  JobSourceRegistryEntry,
  RejectionReasonTag,
  DiscoveryRunRecord,
  MAX_JOB_AGE_DAYS,
} from './types';
import { jobRepository } from './jobRepository';
import { sourceRegistry } from './sourceRegistry';
import { discoveryEngine, DiscoveryEngineProgressEvent } from './discoveryEngine';
import { incrementalDiscoveryEngine, ContinuousDiscoveryState } from './engines/incrementalDiscoveryEngine';
import { parseRawJobInput } from './jobPipeline';
import { buildCareerSearchModel } from './careerSearchModel';
import { backgroundSyncManager } from './backgroundSyncManager';
import { jobFeedStore } from './jobFeedStore';

const LAST_DISCOVERY_KEY = 'careeros_last_discovery_time';

export function useJobFeed() {
  const { profile } = useProfile();
  const [opportunities, setOpportunities] = useState<JobOpportunity[]>([]);
  const [savedJobs, setSavedJobs] = useState<JobOpportunity[]>([]);
  const [rejectedJobs, setRejectedJobs] = useState<JobOpportunity[]>([]);
  const [sources, setSources] = useState<JobSourceRegistryEntry[]>([]);
  const [isScanning, setIsScanning] = useState(() => discoveryEngine.isDiscoveryRunning() || incrementalDiscoveryEngine.isDiscoveryRunning());
  const [continuousDiscoveryState, setContinuousDiscoveryState] = useState<ContinuousDiscoveryState>(() =>
    incrementalDiscoveryEngine.getState()
  );
  const [continuousDiscoveryError, setContinuousDiscoveryError] = useState<string | null>(() =>
    incrementalDiscoveryEngine.getErrorMessage()
  );
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [pendingNewJobsCount, setPendingNewJobsCount] = useState(0);
  const [activeRun, setActiveRun] = useState<DiscoveryRunRecord | null>(() => discoveryEngine.getActiveRun());

  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    const lastRun = discoveryEngine.getLastCompletedRun();
    if (lastRun && lastRun.completedAt) {
      return new Date(lastRun.completedAt);
    }
    try {
      const stored = localStorage.getItem(LAST_DISCOVERY_KEY);
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  });

  const [lastScanResult, setLastScanResult] = useState<{
    newlyDiscoveredCount: number;
    mergedCount: number;
    scannedSourcesCount: number;
  } | null>(() => {
    const last = discoveryEngine.getLastCompletedRun();
    if (last) {
      return {
        newlyDiscoveredCount: last.newJobsAdded,
        mergedCount: last.duplicateJobsRemoved,
        scannedSourcesCount: last.queriedSourceCount,
      };
    }
    return null;
  });

  const [discoveryProgress, setDiscoveryProgress] = useState<DiscoveryEngineProgressEvent | null>(null);
  const [lastDiscoveryRun, setLastDiscoveryRun] = useState<DiscoveryRunRecord | null>(() =>
    discoveryEngine.getLastCompletedRun()
  );

  const [lastAttemptAt, setLastAttemptAt] = useState<Date | null>(() => {
    const ts = discoveryEngine.getLastAttemptAt();
    return ts ? new Date(ts) : null;
  });

  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(() => {
    const ts = discoveryEngine.getLastSuccessAt();
    return ts ? new Date(ts) : null;
  });

  const [sourcesActuallyRan, setSourcesActuallyRan] = useState<any[]>(() => {
    return discoveryEngine.getSourcesActuallyRan();
  });

  const [feedAgeDays, setFeedAgeDays] = useState<number>(MAX_JOB_AGE_DAYS);

  const refreshState = useCallback(() => {
    setOpportunities(jobFeedStore.getPublishedFeedItems().map((item) => item.job));
    setPendingNewJobsCount(jobFeedStore.getPendingCount());
    setSavedJobs(jobRepository.getSavedOpportunities());
    setRejectedJobs(jobRepository.getRejectedOpportunities());
    setSources(sourceRegistry.getAllSources());
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Connect to discoveryEngine and jobFeedStore for real-time events and streaming
  useEffect(() => {
    const unsubFeed = jobFeedStore.subscribe(() => {
      refreshState();
    });

    const unsubProg = discoveryEngine.subscribeProgress((event) => {
      setDiscoveryProgress(event);
      setIsScanning(event.status === 'RUNNING' || event.status === 'QUEUED');
      setActiveRun(discoveryEngine.getActiveRun());

      const attempt = discoveryEngine.getLastAttemptAt();
      if (attempt) setLastAttemptAt(new Date(attempt));
      const success = discoveryEngine.getLastSuccessAt();
      if (success) setLastSuccessAt(new Date(success));
      setSourcesActuallyRan(discoveryEngine.getSourcesActuallyRan());

      if (event.status === 'COMPLETED' || event.status === 'COMPLETED_WITH_ERRORS') {
        const lastRun = discoveryEngine.getLastCompletedRun();
        if (lastRun) {
          setLastDiscoveryRun(lastRun);
          setLastScanResult({
            newlyDiscoveredCount: lastRun.newJobsAdded,
            mergedCount: lastRun.duplicateJobsRemoved,
            scannedSourcesCount: lastRun.queriedSourceCount,
          });
        }
        const now = new Date();
        try {
          localStorage.setItem(LAST_DISCOVERY_KEY, now.toISOString());
        } catch {}
        setLastUpdated(now);
        setDiscoveryError(null);
        refreshState();
      } else if (event.status === 'FAILED') {
        setDiscoveryError(event.message);
      }
    });

    const unsubBatch = discoveryEngine.subscribeBatch(() => {
      refreshState();
    });

    const unsubContinuousState = incrementalDiscoveryEngine.subscribeState((nextState) => {
      setContinuousDiscoveryState(nextState);
      setContinuousDiscoveryError(incrementalDiscoveryEngine.getErrorMessage());
      if (nextState === 'DISCOVERING') {
        setIsScanning(true);
      } else if (!discoveryEngine.isDiscoveryRunning()) {
        setIsScanning(false);
      }
    });

    const unsubContinuousBatch = incrementalDiscoveryEngine.subscribeBatch(() => {
      refreshState();
    });

    return () => {
      unsubFeed();
      unsubProg();
      unsubBatch();
      unsubContinuousState();
      unsubContinuousBatch();
    };
  }, [refreshState]);

  const handleToggleContinuousDiscovery = useCallback(() => {
    const currentState = incrementalDiscoveryEngine.getState();
    if (currentState === 'DISCOVER') {
      incrementalDiscoveryEngine.startContinuousLoop(profile);
    } else if (currentState === 'DISCOVERING') {
      incrementalDiscoveryEngine.pauseLoop();
    } else if (currentState === 'PAUSED') {
      incrementalDiscoveryEngine.resumeLoop(profile);
    } else if (currentState === 'ERROR') {
      incrementalDiscoveryEngine.startContinuousLoop(profile);
    }
  }, [profile]);

  const handlePauseContinuousDiscovery = useCallback(() => {
    incrementalDiscoveryEngine.pauseLoop();
  }, []);

  const handleResumeContinuousDiscovery = useCallback(() => {
    incrementalDiscoveryEngine.resumeLoop(profile);
  }, [profile]);

  const handleStopContinuousDiscovery = useCallback(() => {
    incrementalDiscoveryEngine.stopLoop();
  }, []);

  const handleRunDiscovery = useCallback(async () => {
    setIsScanning(true);
    setDiscoveryError(null);
    try {
      jobRepository.pruneExpiredJobs();
      const run = await discoveryEngine.startDiscoveryRun(profile);
      setLastDiscoveryRun(run);
      setLastScanResult({
        newlyDiscoveredCount: run.newJobsAdded,
        mergedCount: run.duplicateJobsRemoved,
        scannedSourcesCount: run.queriedSourceCount,
      });
      const now = new Date();
      try {
        localStorage.setItem(LAST_DISCOVERY_KEY, now.toISOString());
      } catch {}
      setLastUpdated(now);
      refreshState();
      return run;
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Discovery scan encountered an issue reaching external sources';
      console.error('Job discovery failed:', err);
      setDiscoveryError(msg);
    } finally {
      setIsScanning(false);
    }
  }, [profile, refreshState]);

  const handleCancelDiscovery = useCallback(() => {
    discoveryEngine.cancelRun();
    setIsScanning(false);
  }, []);

  const handleApplyPendingNewJobs = useCallback(() => {
    jobFeedStore.publishPendingJobs();
    setPendingNewJobsCount(0);
    refreshState();
  }, [refreshState]);

  // Silent background refresh every 2 minutes without resetting UI or blocking user
  const handleSilentRefresh = useCallback(async () => {
    if (discoveryEngine.isDiscoveryRunning()) return;
    setIsBackgroundSyncing(true);
    try {
      jobFeedStore.pruneExpiredJobs();
      const run = await discoveryEngine.startDiscoveryRun(profile);
      const now = new Date();
      try {
        localStorage.setItem(LAST_DISCOVERY_KEY, now.toISOString());
      } catch {}
      setLastUpdated(now);
      setLastDiscoveryRun(run);
      setLastScanResult({
        newlyDiscoveredCount: run.newJobsAdded,
        mergedCount: run.duplicateJobsRemoved,
        scannedSourcesCount: run.queriedSourceCount,
      });
      setDiscoveryError(null);
      refreshState();
    } catch (err: unknown) {
      console.error('Auto-refresh discovery error:', err);
    } finally {
      setIsBackgroundSyncing(false);
    }
  }, [profile, refreshState]);

  useEffect(() => {
    let isCancelled = false;

    jobFeedStore.whenHydrated().then(() => {
      if (isCancelled) return;
      refreshState();
      if (jobFeedStore.getPublishedFeedItems().length === 0 && !discoveryEngine.isDiscoveryRunning()) {
        handleRunDiscovery();
      }
    });

    // Register visibility-aware 2-minute background refresh with unmount cleanup
    const AUTO_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
    const unregister = backgroundSyncManager.registerTask(
      'job_feed_refresh',
      AUTO_REFRESH_INTERVAL_MS,
      () => handleSilentRefresh()
    );

    return () => {
      isCancelled = true;
      unregister();
    };
  }, [refreshState, handleRunDiscovery, handleSilentRefresh]);

  const handleImportJob = useCallback(
    (params: {
      rawText: string;
      title?: string;
      company?: string;
      url?: string;
      location?: string;
      sourceName?: string;
    }) => {
      const parsed = parseRawJobInput(params);
      const saved = jobRepository.saveOpportunity(parsed);
      refreshState();
      return saved;
    },
    [refreshState]
  );

  // Feed Save: marks saved in JobFeedStore and persists canonical record to Job Database
  const handleSaveJob = useCallback(
    (jobId: string, notes?: string) => {
      const saved = jobFeedStore.saveJobToDatabase(jobId, notes);
      refreshState();
      return saved?.job;
    },
    [refreshState]
  );

  const handleUnsaveJob = useCallback(
    (jobId: string) => {
      const unsaved = jobFeedStore.removeFromDatabase(jobId);
      refreshState();
      return unsaved?.job;
    },
    [refreshState]
  );

  // Reject: marks dismissed in feed and flags repository
  const handleRejectJob = useCallback(
    (jobId: string, reason?: RejectionReasonTag) => {
      const rejected = jobFeedStore.dismissJob(jobId, reason);
      jobRepository.markRejected(jobId, reason);
      refreshState();
      return rejected?.job;
    },
    [refreshState]
  );

  const handleUnrejectJob = useCallback(
    (jobId: string) => {
      jobRepository.unreject(jobId);
      refreshState();
    },
    [refreshState]
  );

  const handleApplyJob = useCallback(
    (jobId: string, notes?: string) => {
      const applied = jobFeedStore.markApplied(jobId, notes);
      refreshState();
      return applied?.job;
    },
    [refreshState]
  );

  const handleSkipJob = useCallback(
    (jobId: string) => {
      jobFeedStore.dismissJob(jobId, 'skipped');
      jobRepository.recordSkip(jobId);
      refreshState();
    },
    [refreshState]
  );

  const handleViewJob = useCallback(
    (jobId: string, matchScore?: number) => {
      const updated = jobFeedStore.markViewed(jobId, matchScore);
      refreshState();
      return updated?.job;
    },
    [refreshState]
  );

  const handleToggleSource = useCallback(
    (id: string, active: boolean) => {
      sourceRegistry.toggleSourceActive(id, active);
      refreshState();
    },
    [refreshState]
  );

  const handleActivateAllEligible = useCallback(async () => {
    const res = await sourceRegistry.activateAllEligible();
    refreshState();
    return res;
  }, [refreshState]);

  const handleDisableAllSources = useCallback(() => {
    const res = sourceRegistry.disableAll();
    refreshState();
    return res;
  }, [refreshState]);

  const handleRetryFailedSources = useCallback(() => {
    const res = sourceRegistry.retryFailed();
    refreshState();
    return res;
  }, [refreshState]);

  const handleRefreshSourceRegistry = useCallback(() => {
    sourceRegistry.refreshRegistry();
    refreshState();
  }, [refreshState]);

  const handleClearAll = useCallback(() => {
    jobRepository.clearAll();
    refreshState();
  }, [refreshState]);

  useEffect(() => {
    const unsubscribe = sourceRegistry.subscribe(refreshState);
    return () => unsubscribe();
  }, [refreshState]);

  const stats = useMemo(() => {
    const activeEnabled = sources.filter((s) => s.activeStatus).length;
    return {
      totalDiscovered: opportunities.length + savedJobs.length,
      activeCount: opportunities.length,
      savedCount: savedJobs.length,
      rejectedCount: rejectedJobs.length,
      activeSourcesCount: activeEnabled,
      enabledSourcesCount: activeEnabled,
      totalSourcesCount: sources.length,
    };
  }, [opportunities, savedJobs, rejectedJobs, sources]);

  const databaseTabCounts = useMemo(() => {
    return jobRepository.getDatabaseTabCounts();
  }, [opportunities, savedJobs, rejectedJobs]);

  const careerModel = useMemo(() => buildCareerSearchModel(profile), [profile]);

  return {
    careerModel,
    opportunities,
    savedJobs,
    rejectedJobs,
    sources,
    isScanning,
    isBackgroundSyncing,
    discoveryError,
    discoveryProgress,
    lastDiscoveryRun,
    activeRun,
    pendingNewJobsCount,
    applyPendingNewJobs: handleApplyPendingNewJobs,
    cancelDiscovery: handleCancelDiscovery,
    databaseTabCounts,
    runHistory: discoveryEngine.getRunHistory(),
    lastUpdated,
    lastAttemptAt,
    lastSuccessAt,
    sourcesActuallyRan,
    lastScanResult,
    stats,
    runDiscovery: handleRunDiscovery,
    continuousDiscoveryState,
    continuousDiscoveryError,
    toggleContinuousDiscovery: handleToggleContinuousDiscovery,
    pauseContinuousDiscovery: handlePauseContinuousDiscovery,
    resumeContinuousDiscovery: handleResumeContinuousDiscovery,
    stopContinuousDiscovery: handleStopContinuousDiscovery,
    importJob: handleImportJob,
    viewJob: handleViewJob,
    saveJob: handleSaveJob,
    unsaveJob: handleUnsaveJob,
    rejectJob: handleRejectJob,
    unrejectJob: handleUnrejectJob,
    applyJob: handleApplyJob,
    skipJob: handleSkipJob,
    toggleSource: handleToggleSource,
    activateAllEligibleSources: handleActivateAllEligible,
    disableAllSources: handleDisableAllSources,
    retryFailedSources: handleRetryFailedSources,
    refreshSourceRegistry: handleRefreshSourceRegistry,
    clearAll: handleClearAll,
    refresh: refreshState,
    feedAgeDays,
    setFeedAgeDays,
  };
}
