import React, { useState, useMemo, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { sourceOrchestrator } from '@/core/jobs/sourceOrchestrator';
import { discoveryEngine } from '@/core/jobs/discoveryEngine';
import { jobRepository } from '@/core/jobs/jobRepository';
import { sourceRegistry } from '@/core/jobs/sourceRegistry';
import {
  Activity,
  CheckCircle2,
  Layers,
  Search,
  Database,
  TrendingUp,
  History,
  RotateCcw,
  AlertTriangle,
  Copy,
  Check,
  ArrowLeft,
  Clock,
  ShieldAlert,
} from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Error Boundary to prevent any unhandled render crash from turning into a blank white screen
interface ErrorBoundaryProps {
  children: ReactNode;
  onClose: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class DiagnosticsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message || 'An unexpected error occurred' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DiagnosticsModal render error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Diagnostics Telemetry Temporarily Unavailable</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              A data rendering error occurred. Your jobs and discovery state remain completely safe.
            </p>
            {this.state.errorMessage && (
              <p className="text-[11px] font-mono text-red-700 bg-red-50 p-2 rounded mt-2 max-w-lg mx-auto overflow-x-auto">
                {this.state.errorMessage}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            >
              Retry
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={this.props.onClose}
            >
              Back to Job Feed
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'funnels' | 'failed' | 'skipped' | 'runs' | 'telemetry'>('funnels');
  const [searchQuery, setSearchQuery] = useState('');
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Live polling during active discovery so diagnostics update dynamically in real time
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="System Diagnostics & Telemetry"
      size="5xl"
    >
      <DiagnosticsErrorBoundary onClose={onClose}>
        <DiagnosticsContent
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          retryMessage={retryMessage}
          setRetryMessage={setRetryMessage}
          copiedUrl={copiedUrl}
          setCopiedUrl={setCopiedUrl}
          onClose={onClose}
        />
      </DiagnosticsErrorBoundary>
    </Modal>
  );
};

interface DiagnosticsContentProps {
  activeTab: 'funnels' | 'failed' | 'skipped' | 'runs' | 'telemetry';
  setActiveTab: (tab: 'funnels' | 'failed' | 'skipped' | 'runs' | 'telemetry') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  retryMessage: string | null;
  setRetryMessage: (m: string | null) => void;
  copiedUrl: string | null;
  setCopiedUrl: (url: string | null) => void;
  onClose: () => void;
}

const DiagnosticsContent: React.FC<DiagnosticsContentProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  retryMessage,
  setRetryMessage,
  copiedUrl,
  setCopiedUrl,
  onClose,
}) => {
  const orchestratorStats = sourceOrchestrator.getStats() || {
    totalRegistered: 0,
    connectorsAvailable: 0,
    currentlyActive: 0,
    queuedCount: 0,
    checkingCount: 0,
    successfullyQueried: 0,
    noResultsCount: 0,
    failedCount: 0,
    timedOutCount: 0,
    rateLimitedCount: 0,
    staleCount: 0,
    totalJobsDiscovered: 0,
    totalJobsAccepted: 0,
  };
  const runtimeHealth = sourceOrchestrator.getAllRuntimeHealth() || [];
  const activeOpportunities = jobRepository.getActiveOpportunities() || [];
  const databaseOpportunities = jobRepository.getDatabaseOpportunities() || [];
  const tabCounts = jobRepository.getDatabaseTabCounts() || { all: 0, newCount: 0, savedCount: 0, appliedCount: 0 };
  const runHistory = discoveryEngine.getRunHistory() || [];
  const activeRun = discoveryEngine.getActiveRun();
  const latestRun = activeRun || runHistory[0];

  const allSources = sourceRegistry.getAllSources() || [];
  const sourceMap = useMemo(() => new Map(allSources.map((s) => [s.id, s])), [allSources]);

  // Genuine Failed, Quarantined & Decommissioned Sources collection
  const failedAndDecommissionedSources = useMemo(() => {
    return allSources.filter(
      (s) =>
        s.healthState === 'DECOMMISSIONED' ||
        s.healthState === 'QUARANTINED' ||
        s.healthState === 'NOT_FOUND' ||
        s.healthState === 'TEMPORARILY_FAILED' ||
        s.sourceHealth === 'failed' ||
        s.sourceHealth === 'quarantined' ||
        (s.consecutiveFailures && s.consecutiveFailures > 0) ||
        Boolean(s.last_error) ||
        Boolean(s.quarantineReason)
    );
  }, [allSources]);

  // Truthful Metrics Computation (Zero fabrication)
  const isCurrentlyDiscovering = Boolean(discoveryEngine.isDiscoveryRunning() && activeRun && activeRun.status === 'RUNNING');
  const discoveryStatus = isCurrentlyDiscovering
    ? 'RUNNING'
    : latestRun
    ? latestRun.status || 'COMPLETED'
    : 'IDLE';

  const totalSourcesCount = allSources.length || orchestratorStats.totalRegistered || 0;

  // Real quarantined sources from registry
  const quarantinedSources = useMemo(() => sourceRegistry.getQuarantinedSources(), [allSources]);
  const quarantinedCount = isCurrentlyDiscovering
    ? activeRun?.quarantinedSourceCount ?? quarantinedSources.length
    : latestRun?.quarantinedSourceCount ?? quarantinedSources.length;

  // Real intentionally skipped sources (explicit rule reasons: disabled, requires config, unsupported)
  const intentionallySkippedSources = useMemo(() => {
    return allSources.filter(
      (s) =>
        !s.activeStatus ||
        s.eligibilityStatus === 'unavailable' ||
        s.eligibilityStatus === 'requires_configuration' ||
        s.eligibilityStatus === 'unsupported'
    );
  }, [allSources]);

  const successfulCount = isCurrentlyDiscovering
    ? activeRun?.successfulSourceCount ?? activeRun?.sourcesSucceededCount ?? 0
    : latestRun?.successfulSourceCount ?? latestRun?.sourcesSucceededCount ?? orchestratorStats.successfullyQueried;

  const failedCount = isCurrentlyDiscovering
    ? activeRun?.failedSourceCount ?? activeRun?.sourcesFailedCount ?? 0
    : latestRun?.failedSourceCount ?? latestRun?.sourcesFailedCount ?? orchestratorStats.failedCount;

  // Checked MUST equal successful + failed
  const checkedCount = Math.max(
    successfulCount + failedCount,
    isCurrentlyDiscovering
      ? activeRun?.queriedSourceCount ?? activeRun?.sourcesQueriedCount ?? 0
      : latestRun?.queriedSourceCount ?? latestRun?.sourcesQueriedCount ?? (successfulCount + failedCount)
  );

  const skippedCount = isCurrentlyDiscovering
    ? activeRun?.skippedSourceCount ?? intentionallySkippedSources.length
    : latestRun?.skippedSourceCount ?? intentionallySkippedSources.length;

  // Pending: sources not yet checked and not skipped or quarantined
  const pendingCount = Math.max(
    0,
    totalSourcesCount - (checkedCount + skippedCount + quarantinedCount)
  );

  // Job reconciliation metrics
  const jobsDiscoveredCount = isCurrentlyDiscovering
    ? activeRun?.rawJobsDiscovered ?? activeRun?.rawDiscoveredCount ?? 0
    : latestRun?.rawJobsDiscovered ?? latestRun?.rawDiscoveredCount ?? orchestratorStats.totalJobsDiscovered;

  const duplicatesRemovedCount = isCurrentlyDiscovering
    ? activeRun?.duplicateJobsRemoved ?? activeRun?.duplicatesRemovedCount ?? 0
    : latestRun?.duplicateJobsRemoved ?? latestRun?.duplicatesRemovedCount ?? 0;

  const jobsRejectedCount = isCurrentlyDiscovering
    ? activeRun?.jobsRejectedCount ?? activeRun?.invalidRecordsCount ?? 0
    : latestRun?.jobsRejectedCount ?? latestRun?.invalidRecordsCount ?? 0;

  const jobsVerifiedCount = isCurrentlyDiscovering
    ? activeRun?.jobsVerifiedCount ?? activeRun?.validJobsDiscovered ?? Math.max(0, jobsDiscoveredCount - jobsRejectedCount)
    : latestRun?.jobsVerifiedCount ?? latestRun?.validJobsDiscovered ?? Math.max(0, jobsDiscoveredCount - jobsRejectedCount);

  const jobsAddedToFeedCount = isCurrentlyDiscovering
    ? activeRun?.newJobsAdded ?? Math.max(0, jobsVerifiedCount - duplicatesRemovedCount)
    : latestRun?.newJobsAdded ?? Math.max(0, jobsVerifiedCount - duplicatesRemovedCount);

  const deadInvalidSourcesCount = failedAndDecommissionedSources.filter(
    (s) => s.healthState === 'DECOMMISSIONED' || (s.consecutiveFailures || 0) >= 2
  ).length;

  const verifiedLiveCount = activeOpportunities.filter((j) => j && j.isVerifiedLive).length;
  const indiaEligibleCount = activeOpportunities.filter(
    (j) => j && j.remote_eligibility?.isIndiaEligible
  ).length;
  const salaryDisclosedCount = activeOpportunities.filter(
    (j) => j && (j.salary_truth?.status === 'EMPLOYER_STATED' || Boolean(j.salary?.disclosed))
  ).length;

  const allJobsInRepo = jobRepository.getAllOpportunities();
  const enabledSourcesCount = sourceRegistry.getActiveSources().length;
  const expiredHistoricalCount = allJobsInRepo.filter((j) => j.lifecycleState === 'HISTORICAL' || j.feed_status === 'EXPIRED').length;
  const profileRelevantCount = activeOpportunities.filter((j) => ((j as any).match?.overallScore ?? (j as any).match_score ?? 0) >= 50).length;
  const filterEligibleCount = activeOpportunities.length;
  const publishedToFeedCount = jobRepository.getActiveOpportunities().length;

  const handleRetryFailedSources = () => {
    const { retriedCount } = sourceRegistry.retryFailed();
    setRetryMessage(`Successfully restored ${retriedCount} source(s) to healthy state.`);
    setTimeout(() => setRetryMessage(null), 3500);
  };

  const handleCopyUrl = (url: string) => {
    if (!url) return;
    navigator.clipboard?.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const filteredRuntime = runtimeHealth.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const source = sourceMap.get(r.sourceId);
    const sourceName = (r.sourceName || '').toLowerCase();
    const domain = (r.domain || '').toLowerCase();
    const opStatus = (r.operationalStatus || '').toLowerCase();
    const httpStatus = source?.lastHttpStatus ? `http ${source.lastHttpStatus}` : '';

    return (
      sourceName.includes(q) ||
      domain.includes(q) ||
      opStatus.includes(q) ||
      httpStatus.includes(q)
    );
  });

  // Empty state check
  const isCompletelyEmpty =
    totalSourcesCount === 0 &&
    runHistory.length === 0 &&
    !activeRun &&
    activeOpportunities.length === 0;

  if (isCompletelyEmpty) {
    return (
      <div className="py-12 px-4 text-center space-y-4 text-gray-700">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto">
          <Database className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">No Discovery Diagnostics Available</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Zero discovery runs have occurred in this session. Start discovery on the Job Feed to aggregate opportunities and populate live source telemetry.
          </p>
        </div>
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onClose}>
            Back to Job Feed
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-gray-800 overflow-x-hidden">
      {/* 1. MASTER DISCOVERY DIAGNOSTICS KPI BAR (Required 9 Metrics) */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-800 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Discovery Engine Diagnostics
            </span>
          </div>

          {/* Current Discovery Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Status:</span>
            {discoveryStatus === 'RUNNING' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/40 animate-pulse">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                RUNNING ({checkedCount} checked, {pendingCount} queued)
              </span>
            ) : checkedCount > 0 && checkedCount < totalSourcesCount && pendingCount > 0 ? (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40"
                title="Only a subset of sources evaluated; remaining sources are pending in discovery queue"
              >
                <AlertTriangle className="h-3 w-3" />
                PARTIAL ({checkedCount} checked, {pendingCount} queued)
              </span>
            ) : discoveryStatus === 'COMPLETED' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                <CheckCircle2 className="h-3 w-3" />
                COMPLETED
              </span>
            ) : discoveryStatus === 'COMPLETED_WITH_ERRORS' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                <AlertTriangle className="h-3 w-3" />
                PARTIAL RESULTS
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">
                IDLE / READY
              </span>
            )}
          </div>
        </div>

        {/* Master 12 Reconciled Discovery Telemetry Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-center">
          {/* 1. Total Sources */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-white leading-tight">{totalSourcesCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Total Sources
            </div>
          </div>

          {/* 2. Pending / Queued */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-sky-400 leading-tight">{pendingCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Pending / Queued
            </div>
          </div>

          {/* 3. Checked */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-blue-400 leading-tight">{checkedCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Checked
            </div>
          </div>

          {/* 4. Successful */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-emerald-400 leading-tight">{successfulCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Successful
            </div>
          </div>

          {/* 5. Failed */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-red-400 leading-tight">{failedCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Failed
            </div>
          </div>

          {/* 6. Skipped */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-amber-300 leading-tight">{skippedCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Skipped
            </div>
          </div>

          {/* 7. Quarantined */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-rose-400 leading-tight">{quarantinedCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Quarantined
            </div>
          </div>

          {/* 8. Jobs Discovered */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-indigo-300 leading-tight">{jobsDiscoveredCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Jobs Discovered
            </div>
          </div>

          {/* 9. Jobs Verified */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-cyan-300 leading-tight">{jobsVerifiedCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Jobs Verified
            </div>
          </div>

          {/* 10. Jobs Rejected */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-pink-400 leading-tight">{jobsRejectedCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Jobs Rejected
            </div>
          </div>

          {/* 11. Duplicates Removed */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-teal-300 leading-tight">{duplicatesRemovedCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Duplicates Removed
            </div>
          </div>

          {/* 12. Added to Feed */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col justify-center items-center min-h-[64px]">
            <div className="text-base font-black text-emerald-300 leading-tight">{jobsAddedToFeedCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5 leading-none">
              Added to Feed
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Single Responsive Row, Zero Horizontal Scrollbar) */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 border-b border-gray-200 pb-2 w-full">
        <button
          type="button"
          onClick={() => setActiveTab('funnels')}
          className={`h-8 sm:h-9 px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none w-full min-w-0 ${
            activeTab === 'funnels'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Funnels & Telemetry"
        >
          <TrendingUp className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate hidden md:inline">Funnels & Telemetry</span>
          <span className="truncate md:hidden">Funnels</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('failed')}
          className={`h-8 sm:h-9 px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none w-full min-w-0 ${
            activeTab === 'failed'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          title={`Failed & Quarantined (${failedAndDecommissionedSources.length + quarantinedSources.length})`}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate hidden lg:inline">
            Failed & Quarantined ({failedAndDecommissionedSources.length + quarantinedSources.length})
          </span>
          <span className="truncate lg:hidden">
            Failed ({failedAndDecommissionedSources.length + quarantinedSources.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('skipped')}
          className={`h-8 sm:h-9 px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none w-full min-w-0 ${
            activeTab === 'skipped'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          title={`Skipped Sources (${intentionallySkippedSources.length})`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate hidden md:inline">
            Skipped Sources ({intentionallySkippedSources.length})
          </span>
          <span className="truncate md:hidden">
            Skipped ({intentionallySkippedSources.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('runs')}
          className={`h-8 sm:h-9 px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none w-full min-w-0 ${
            activeTab === 'runs'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          title={`Discovery Runs (${runHistory.length + (activeRun ? 1 : 0)})`}
        >
          <History className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate hidden md:inline">
            Discovery Runs ({runHistory.length + (activeRun ? 1 : 0)})
          </span>
          <span className="truncate md:hidden">
            Runs ({runHistory.length + (activeRun ? 1 : 0)})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('telemetry')}
          className={`h-8 sm:h-9 px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none w-full min-w-0 ${
            activeTab === 'telemetry'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          title={`Per-Source Telemetry (${runtimeHealth.length})`}
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate hidden lg:inline">
            Per-Source Telemetry ({runtimeHealth.length})
          </span>
          <span className="truncate lg:hidden">
            Telemetry ({runtimeHealth.length})
          </span>
        </button>
      </div>

      {/* Tab 1: Funnels & Telemetry */}
      {activeTab === 'funnels' && (
        <div className="space-y-4">
          {/* ========================================================================= */}
          {/* 10-STAGE TRANSPARENT PIPELINE FUNNEL (Requirement 14)                     */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-xl p-4 text-white shadow-sm border border-blue-800/60">
            <div className="flex items-center justify-between mb-3 border-b border-blue-800/40 pb-2 flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-400" />
                10-Stage Transparent Discovery Funnel (Database Backed)
              </span>
              <span className="text-[11px] text-blue-300 font-mono">
                Real-Time Verified Pipeline
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5 text-center">
              {/* 1. Sources Enabled */}
              <div className="bg-white/10 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-white leading-tight">
                  {enabledSourcesCount.toLocaleString()}
                </div>
                <div className="text-[9.5px] text-blue-200 font-medium uppercase mt-0.5 leading-tight">
                  1. Sources Enabled
                </div>
              </div>

              {/* 2. Sources Queried */}
              <div className="bg-white/10 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-blue-300 leading-tight">
                  {successfulCount.toLocaleString()}
                </div>
                <div className="text-[9.5px] text-blue-200 font-medium uppercase mt-0.5 leading-tight">
                  2. Successfully Queried
                </div>
              </div>

              {/* 3. Jobs Retrieved */}
              <div className="bg-white/10 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-sky-300 leading-tight">
                  {(latestRun?.rawJobsDiscovered ?? allJobsInRepo.length).toLocaleString()}
                </div>
                <div className="text-[9.5px] text-blue-200 font-medium uppercase mt-0.5 leading-tight">
                  3. Jobs Retrieved
                </div>
              </div>

              {/* 4. Jobs Parsed */}
              <div className="bg-white/10 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-indigo-300 leading-tight">
                  {(latestRun?.validJobsDiscovered ?? allJobsInRepo.length).toLocaleString()}
                </div>
                <div className="text-[9.5px] text-blue-200 font-medium uppercase mt-0.5 leading-tight">
                  4. Jobs Parsed
                </div>
              </div>

              {/* 5. Jobs Verified */}
              <div className="bg-white/10 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-emerald-400 leading-tight">
                  {verifiedLiveCount.toLocaleString()}
                </div>
                <div className="text-[9.5px] text-blue-200 font-medium uppercase mt-0.5 leading-tight">
                  5. Jobs Verified
                </div>
              </div>

              {/* 6. Duplicates Removed */}
              <div className="bg-white/10 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-amber-300 leading-tight">
                  {(latestRun?.duplicateJobsRemoved ?? 0).toLocaleString()}
                </div>
                <div className="text-[9.5px] text-blue-200 font-medium uppercase mt-0.5 leading-tight">
                  6. Duplicates Removed
                </div>
              </div>

              {/* 7. Expired Removed */}
              <div className="bg-white/10 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-rose-300 leading-tight">
                  {expiredHistoricalCount.toLocaleString()}
                </div>
                <div className="text-[9.5px] text-blue-200 font-medium uppercase mt-0.5 leading-tight">
                  7. Expired Removed
                </div>
              </div>

              {/* 8. Profile-Relevant */}
              <div className="bg-white/10 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-teal-300 leading-tight">
                  {profileRelevantCount.toLocaleString()}
                </div>
                <div className="text-[9.5px] text-blue-200 font-medium uppercase mt-0.5 leading-tight">
                  8. Profile-Relevant
                </div>
              </div>

              {/* 9. Filter-Eligible */}
              <div className="bg-white/10 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-cyan-300 leading-tight">
                  {filterEligibleCount.toLocaleString()}
                </div>
                <div className="text-[9.5px] text-blue-200 font-medium uppercase mt-0.5 leading-tight">
                  9. Filter-Eligible
                </div>
              </div>

              {/* 10. Published to Feed */}
              <div className="bg-white/20 rounded-lg p-2 border border-emerald-400/50 flex flex-col justify-center items-center min-h-[58px]">
                <div className="text-base font-black text-emerald-300 leading-tight">
                  {publishedToFeedCount.toLocaleString()}
                </div>
                <div className="text-[9.5px] text-emerald-200 font-bold uppercase mt-0.5 leading-tight">
                  10. Published to Feed
                </div>
              </div>
            </div>
          </div>

          {/* Funnel 1: Source Discovery Funnel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-blue-600" />
                1. Source Truth Funnel (Zero Fake Claims)
              </span>
              <span className="text-[11px] text-gray-400 font-medium">
                Finite Bounded Execution
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
              <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-2.5">
                <div className="text-lg font-black text-gray-900">
                  {orchestratorStats.totalRegistered.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-gray-500 font-medium mt-0.5">
                  Registered Catalog
                </div>
              </div>
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-blue-700">
                  {orchestratorStats.connectorsAvailable.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-blue-600 font-medium mt-0.5">
                  Enabled Sources
                </div>
              </div>
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-indigo-700">
                  {checkedCount.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-indigo-600 font-medium mt-0.5">
                  Queried This Session
                </div>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-emerald-700">
                  {orchestratorStats.successfullyQueried.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-emerald-600 font-medium mt-0.5">
                  Successful
                </div>
              </div>
              <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-amber-700">
                  {(orchestratorStats.timedOutCount || 0).toLocaleString()}
                </div>
                <div className="text-[10.5px] text-amber-600 font-medium mt-0.5">
                  Timed Out (5s)
                </div>
              </div>
              <div className="bg-red-50/60 border border-red-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-red-700">
                  {orchestratorStats.failedCount.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-red-600 font-medium mt-0.5">
                  Failed / Blocked
                </div>
              </div>
            </div>
          </div>

          {/* Funnel 2: Ingestion & Work Queue Funnel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-blue-600" />
                2. Opportunities Pipeline & CRM Database
              </span>
              <span className="text-[11px] text-gray-400 font-medium">
                Feed Is Work Queue
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
              <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-2.5">
                <div className="text-lg font-black text-gray-900">
                  {tabCounts.all}
                </div>
                <div className="text-[10.5px] text-gray-500 font-medium mt-0.5">
                  Active Feed Queue
                </div>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-emerald-700">
                  {tabCounts.newCount}
                </div>
                <div className="text-[10.5px] text-emerald-600 font-medium mt-0.5">
                  New Opportunities
                </div>
              </div>
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-blue-700">
                  {verifiedLiveCount}
                </div>
                <div className="text-[10.5px] text-blue-600 font-medium mt-0.5">
                  Verified Live
                </div>
              </div>
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-indigo-700">
                  {indiaEligibleCount}
                </div>
                <div className="text-[10.5px] text-indigo-600 font-medium mt-0.5">
                  India / WFA Eligible
                </div>
              </div>
              <div className="bg-teal-50/60 border border-teal-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-teal-700">
                  {salaryDisclosedCount}
                </div>
                <div className="text-[10.5px] text-teal-600 font-medium mt-0.5">
                  Disclosed Salary
                </div>
              </div>
              <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-2.5">
                <div className="text-lg font-black text-purple-700">
                  {databaseOpportunities.length}
                </div>
                <div className="text-[10.5px] text-purple-600 font-medium mt-0.5">
                  CRM Database
                </div>
              </div>
            </div>
          </div>

          {/* Funnel 3: Run Count Reconciliation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                3. Discovery Run Reconciliation & Source Health Engine
              </span>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Raw = New + Refreshed + Merged + Invalid
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5">
                <div className="text-lg font-black text-blue-900">
                  {latestRun ? (latestRun.rawJobsDiscovered ?? latestRun.rawDiscoveredCount ?? 0) : 0}
                </div>
                <div className="text-[10.5px] text-blue-700 font-semibold mt-0.5">
                  Raw Discovered
                </div>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5">
                <div className="text-lg font-black text-emerald-800">
                  {latestRun ? (latestRun.newJobsAdded ?? latestRun.newOpportunitiesCount ?? 0) : 0}
                </div>
                <div className="text-[10.5px] text-emerald-700 font-semibold mt-0.5">
                  New Canonical
                </div>
              </div>
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-2.5">
                <div className="text-lg font-black text-indigo-800">
                  {latestRun ? (latestRun.existingJobsRefreshed || 0) : 0}
                </div>
                <div className="text-[10.5px] text-indigo-700 font-semibold mt-0.5">
                  Existing Refreshed
                </div>
              </div>
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5">
                <div className="text-lg font-black text-amber-800">
                  {latestRun ? (latestRun.duplicateJobsRemoved ?? latestRun.duplicatesRemovedCount ?? 0) : 0}
                </div>
                <div className="text-[10.5px] text-amber-700 font-semibold mt-0.5">
                  Duplicates Merged
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                <div className="text-lg font-black text-gray-800">
                  {latestRun ? (latestRun.invalidRecordsCount || 0) : 0}
                </div>
                <div className="text-[10.5px] text-gray-600 font-semibold mt-0.5">
                  Invalid Records
                </div>
              </div>
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-2.5">
                <div className="text-lg font-black text-rose-800">
                  {deadInvalidSourcesCount}
                </div>
                <div className="text-[10.5px] text-rose-700 font-semibold mt-0.5">
                  Decommissioned (404)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Failed & Dead Sources (Explicitly Required View) */}
      {activeTab === 'failed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-gray-600">
              Endpoints returning repeated 404, timeouts, or network errors are isolated to protect ingestion health.
            </span>

            {failedAndDecommissionedSources.length > 0 && (
              <button
                type="button"
                onClick={handleRetryFailedSources}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restore & Retry All</span>
              </button>
            )}
          </div>

          {retryMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-2.5 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{retryMessage}</span>
            </div>
          )}

          {failedAndDecommissionedSources.length === 0 ? (
            <div className="text-center py-10 px-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
              <div className="text-xs font-bold text-emerald-900">Zero Failed Sources</div>
              <p className="text-[11px] text-emerald-700 max-w-sm mx-auto">
                All queried endpoints responded with healthy HTTP status codes. No sources are currently decommissioned or broken.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 font-semibold text-gray-600 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Source Name</th>
                    <th className="py-2.5 px-2">Source URL</th>
                    <th className="py-2.5 px-2">Failure Reason / Status</th>
                    <th className="py-2.5 px-2 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {failedAndDecommissionedSources.map((source) => {
                    const rawUrl = source.endpointUrl || `https://${source.domain}`;
                    const failureReason =
                      source.ineligibilityReason ||
                      source.last_error ||
                      (source.lastHttpStatus ? `HTTP ${source.lastHttpStatus} ${source.lastHttpStatus === 404 ? 'Not Found' : 'Error'}` : 'Endpoint Unreachable / Timeout');
                    const isDecommissioned = source.healthState === 'DECOMMISSIONED' || (source.consecutiveFailures || 0) >= 2;
                    const timestamp = source.lastFailureAt || source.lastCheckedAt;

                    return (
                      <tr key={source.id} className="hover:bg-gray-50/80">
                        {/* 1. Source Name */}
                        <td className="py-2.5 px-3 font-semibold text-gray-900 max-w-[180px]">
                          <div className="truncate">{source.name}</div>
                          <div className="text-[10px] text-gray-400 font-normal uppercase">
                            {source.atsType || source.category?.replace(/_/g, ' ') || 'job board'}
                          </div>
                        </td>

                        {/* 2. URL (Strictly text / copyable, NEVER navigating to external source) */}
                        <td className="py-2.5 px-2 max-w-[220px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-gray-600 truncate select-all">
                              {rawUrl}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(rawUrl)}
                              className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
                              title="Copy endpoint URL (Safe, does not navigate)"
                            >
                              {copiedUrl === rawUrl ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 3. Failure Reason / Status */}
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                source.healthState === 'QUARANTINED' || source.sourceHealth === 'quarantined'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : isDecommissioned
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {source.healthState === 'QUARANTINED' || source.sourceHealth === 'quarantined'
                                ? 'QUARANTINED'
                                : isDecommissioned
                                ? 'DECOMMISSIONED'
                                : 'FAILED'}
                            </span>
                            {source.lastHttpStatus && (
                              <span className="font-mono text-[10px] text-red-600 font-bold">
                                HTTP {source.lastHttpStatus}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-600 mt-0.5 truncate max-w-[260px]" title={failureReason}>
                            {source.quarantineReason || failureReason}
                          </div>
                        </td>

                        {/* 4. Timestamp */}
                        <td className="py-2.5 px-2 text-right text-[11px] text-gray-500 whitespace-nowrap">
                          {timestamp ? new Date(timestamp).toLocaleTimeString() : 'Recent'}
                          {timestamp && (
                            <div className="text-[10px] text-gray-400 font-sans">
                              {new Date(timestamp).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Skipped Sources (Explicit Skip Reasons) */}
      {activeTab === 'skipped' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-600">
            A source is classified as Skipped ONLY when the discovery engine intentionally decided not to query it with a recorded reason (e.g., source disabled, unsupported, or requires API credentials). Unqueried sources waiting in queue are tracked as Pending.
          </div>

          {intentionallySkippedSources.length === 0 ? (
            <div className="text-center py-10 px-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
              <div className="text-xs font-bold text-emerald-900">Zero Skipped Sources</div>
              <p className="text-[11px] text-emerald-700 max-w-sm mx-auto">
                All catalog sources are currently enabled and active for discovery.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 font-semibold text-gray-600 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Source Name</th>
                    <th className="py-2.5 px-2">Domain / Platform</th>
                    <th className="py-2.5 px-2">Recorded Skip Reason</th>
                    <th className="py-2.5 px-2 text-right">Eligibility Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {intentionallySkippedSources.map((source) => {
                    const skipReason =
                      source.quarantineReason ||
                      source.skipReason ||
                      source.ineligibilityReason ||
                      (!source.activeStatus ? 'Source disabled by user preference' : 'Requires API Key or credentials');
                    return (
                      <tr key={source.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-gray-900 max-w-[180px]">
                          <div className="truncate">{source.name}</div>
                          <div className="text-[10px] text-gray-400 font-normal uppercase">
                            {source.atsType || source.category?.replace(/_/g, ' ') || 'catalog source'}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-gray-600">
                          {source.domain || 'api.careeros.local'}
                        </td>
                        <td className="py-2.5 px-2 text-[11px] text-amber-800 font-medium">
                          {skipReason}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200 uppercase">
                            {source.eligibilityStatus || (!source.activeStatus ? 'disabled' : 'unsupported')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Discovery Runs */}
      {activeTab === 'runs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Finite asynchronous discovery runs with per-source isolation.</span>
            <span>{runHistory.length} total runs logged</span>
          </div>

          {activeRun && (
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                </span>
                <span className="font-bold text-blue-950">Active Run: {activeRun.runId || activeRun.id || 'Current'}</span>
              </div>
              <div className="text-blue-800 font-medium">
                {activeRun.sourcesQueriedCount ?? activeRun.queriedSourceCount ?? 0} /{' '}
                {activeRun.sourcesEligibleCount ?? activeRun.eligibleSourceCount ?? totalSourcesCount} sources checked •{' '}
                {activeRun.newOpportunitiesCount ?? activeRun.newJobsAdded ?? 0} new jobs
              </div>
            </div>
          )}

          {runHistory.length === 0 && !activeRun ? (
            <div className="text-center py-8 text-xs text-gray-400">
              No discovery runs logged yet in this session. Click "Discover" to start a finite run.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 font-semibold text-gray-600 z-10">
                  <tr>
                    <th className="py-2 px-3">Run ID</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2 text-right">Duration</th>
                    <th className="py-2 px-2 text-right">Queried</th>
                    <th className="py-2 px-2 text-right">Succeeded</th>
                    <th className="py-2 px-2 text-right">Timed Out</th>
                    <th className="py-2 px-2 text-right">Failed</th>
                    <th className="py-2 px-2 text-right">New Jobs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {runHistory.map((run) => {
                    const runIdentifier = String(run.runId || run.id || 'run-unknown');
                    const statusClass =
                      run.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : run.status === 'COMPLETED_WITH_ERRORS'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : run.status === 'RUNNING'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-red-50 text-red-700 border-red-200';

                    return (
                      <tr key={runIdentifier} className="hover:bg-gray-50/80">
                        <td className="py-2 px-3 font-mono text-[11px] text-gray-900">
                          {runIdentifier.length > 14 ? `${runIdentifier.slice(0, 14)}...` : runIdentifier}
                          <div className="text-[10px] text-gray-400 font-sans">
                            {run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : '—'}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold border ${statusClass}`}>
                            {run.status || 'COMPLETED'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-gray-500">
                          {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-gray-900">
                          {run.sourcesQueriedCount ?? run.queriedSourceCount ?? 0}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-emerald-600">
                          {run.sourcesSucceededCount ?? run.successfulSourceCount ?? 0}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-amber-600">
                          {run.sourcesTimedOutCount ?? run.timedOutSourceCount ?? 0}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-red-600">
                          {run.sourcesFailedCount ?? run.failedSourceCount ?? 0}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-blue-600">
                          +{run.newOpportunitiesCount ?? run.newJobsAdded ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Per-Source Telemetry */}
      {activeTab === 'telemetry' && (
        <div className="space-y-3">
          {/* Search runtime health */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter sources by name, domain, status, or 'http 404'..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-gray-500 font-medium shrink-0">
              Showing {filteredRuntime.length} of {runtimeHealth.length}
            </span>
          </div>

          {/* Table */}
          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 font-semibold text-gray-600 z-10">
                <tr>
                  <th className="py-2 px-3">Source Name</th>
                  <th className="py-2 px-2">Type / ATS</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-right">Latency</th>
                  <th className="py-2 px-2 text-right">Discovered</th>
                  <th className="py-2 px-2 text-right">Accepted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRuntime.map((r) => {
                  const source = sourceMap.get(r.sourceId);
                  const isDecommissioned = source?.healthState === 'DECOMMISSIONED' || (source?.consecutiveFailures || 0) >= 2;
                  const statusClass =
                    isDecommissioned
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : r.operationalStatus === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : r.operationalStatus === 'CHECKING'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : r.operationalStatus === 'FAILED'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : r.operationalStatus === 'TIMEOUT'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-gray-100 text-gray-600 border-gray-200';

                  return (
                    <tr key={r.sourceId} className="hover:bg-gray-50/80">
                      <td className="py-2 px-3 font-medium text-gray-900 max-w-[200px] truncate">
                        {r.sourceName || 'Unknown Source'}
                        <div className="text-[10.5px] text-gray-400 font-normal">
                          {r.domain || '—'}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-gray-500 uppercase text-[10px]">
                        {r.atsType || r.category || 'ATS'}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold border ${statusClass}`}
                        >
                          {isDecommissioned ? 'DECOMMISSIONED' : r.operationalStatus || 'ACTIVE'}
                        </span>
                        {source?.lastHttpStatus ? (
                          <div className="text-[10px] text-red-600 font-mono mt-0.5">
                            HTTP {source.lastHttpStatus}
                            {source.consecutiveFailures ? ` (${source.consecutiveFailures}x)` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-500">
                        {r.responseTimeMs ? `${r.responseTimeMs}ms` : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-900">
                        {r.jobsDiscovered || 0}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-emerald-600">
                        {r.jobsAccepted || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Footer with Safe Back Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Real-time discovery diagnostics • Feed state preserved</span>
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            <span>Back to Job Feed</span>
          </Button>
          <Button variant="primary" size="sm" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
