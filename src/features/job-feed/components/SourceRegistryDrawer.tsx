import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Drawer } from '@/components/drawer';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { JobSourceRegistryEntry } from '@/core/jobs';
import { connectorManager } from '@/core/jobs/jobConnectors';
import { sourceRegistry, SourceFilterTab } from '@/core/jobs/sourceRegistry';
import { sourceValueEngine } from '@/core/jobs/engines/sourceValueEngine';
import { useVirtualizer } from '@/components/virtual';
import { ActivateAllSourcesModal } from './ActivateAllSourcesModal';
import { DisableAllSourcesModal } from './DisableAllSourcesModal';
import { AddSourceModal } from './AddSourceModal';
import {
  Search,
  Cpu,
  Layers,
  CheckCircle2,
  Clock,
  FileCheck,
  AlertTriangle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  RefreshCw,
  Power,
  RotateCcw,
  Building2,
  Lock,
  Plus,
} from 'lucide-react';

export interface SourceRegistryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources?: JobSourceRegistryEntry[];
  onToggleSource: (sourceId: string, active: boolean) => void;
  onStartDiscovery?: () => void;
  initialFilterTab?: SourceFilterTab;
}

export const SourceRegistryDrawer: React.FC<SourceRegistryDrawerProps> = ({
  isOpen,
  onClose,
  sources: _sources,
  onToggleSource,
  onStartDiscovery,
  initialFilterTab = 'all',
}) => {
  const [activeTab, setActiveTab] = useState<'connectors' | 'registry' | 'targets'>('registry');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterTab, setFilterTab] = useState<SourceFilterTab>(initialFilterTab);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [, setRerenderToggle] = useState(0);

  // Debounce search by 150ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Modals
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilterTab) {
      setFilterTab(initialFilterTab);
      if (initialFilterTab === 'failed') {
        setActiveTab('registry');
      }
    }
  }, [initialFilterTab]);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const stats = sourceRegistry.getStats();
  const connectors = connectorManager.getAllConnectors();

  // Filter sources using registry multi-facet logic
  const filteredSources = useMemo(() => {
    return sourceRegistry.filterSources(
      debouncedSearch,
      activeTab === 'targets' ? 'all' : filterTab,
      activeTab === 'targets' ? 'target_company' : selectedCategory
    );
  }, [debouncedSearch, activeTab, filterTab, selectedCategory]);

  const sourceListRef = useRef<HTMLDivElement>(null);
  const sourceVirtualizer = useVirtualizer({
    count: filteredSources.length,
    estimateSize: 104,
    overscan: 6,
    scrollContainerRef: sourceListRef,
  });

  const formatTimeAgo = (isoDate?: string): string => {
    if (!isoDate) return 'Never checked';
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleRefreshRegistry = () => {
    sourceRegistry.refreshRegistry();
    setRerenderToggle((v) => v + 1);
    showNotice('Source registry re-checked and refreshed.');
  };

  const handleRetryFailed = () => {
    const result = sourceRegistry.retryFailed();
    setRerenderToggle((v) => v + 1);
    showNotice(`Reset ${result.retriedCount} failing sources to healthy state.`);
  };

  const handleConfirmDisableAll = () => {
    const res = sourceRegistry.disableAll();
    setRerenderToggle((v) => v + 1);
    showNotice(`Disabled ${res.disabledCount} active sources.`);
  };

  const renderHealthIndicator = (health: string) => {
    switch (health) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Healthy
          </span>
        );
      case 'degraded':
      case 'rate_limited':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Degraded
          </span>
        );
      case 'failed':
      case 'failing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            Never checked
          </span>
        );
    }
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        placement="right"
        width="max-w-3xl w-full"
        title="Job Source Ecosystem & Connectors"
        description="Truthful separation of configured Active Ingestion Connectors from the authentic Source Registry."
      >
        <div className="space-y-5 pb-6">
          {/* Action Notice Toast */}
          {actionNotice && (
            <div className="p-3 rounded-xl bg-gray-900 text-white text-xs flex items-center gap-2 shadow-lg animate-fadeIn">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Section 18: Top Summary Architecture Banner */}
          <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <span className="text-[11px] text-text-muted block font-medium uppercase tracking-wider">
                  Source Registry
                </span>
                <span className="text-lg font-bold text-text-primary">
                  {stats.totalRegistered.toLocaleString()} available
                </span>
              </div>
              <div>
                <span className="text-[11px] text-text-muted block font-medium uppercase tracking-wider">
                  Active Sources
                </span>
                <span className="text-lg font-bold text-primary">
                  {stats.activeSourcesCount.toLocaleString()} enabled
                </span>
              </div>
              <div>
                <span className="text-[11px] text-text-muted block font-medium uppercase tracking-wider">
                  Active Connectors
                </span>
                <span className="text-lg font-bold text-accent">
                  {stats.activeConnectorsCount} Engines
                </span>
              </div>
              <div>
                <span className="text-[11px] text-text-muted block font-medium uppercase tracking-wider">
                  Last Discovery
                </span>
                <span className="text-lg font-bold text-success">
                  {formatTimeAgo(sourceRegistry.getLastRunStats().lastRunAt)}
                </span>
              </div>
            </div>

            {/* Bulk Action Controls */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/70 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setIsActivateModalOpen(true)}
                  leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                  className="font-semibold text-xs h-8"
                >
                  {stats.activeSourcesCount >= stats.eligibleCount
                    ? `All ${stats.eligibleCount.toLocaleString()} Sources Active`
                    : `Activate All ${stats.eligibleCount.toLocaleString()} Eligible Sources`}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshRegistry}
                  leftIcon={<RefreshCw className="h-3 w-3" />}
                  className="text-xs h-8"
                >
                  Refresh Registry
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddSourceModalOpen(true)}
                  leftIcon={<Plus className="h-3.5 w-3.5 text-blue-600" />}
                  className="text-xs h-8 text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold"
                >
                  + Add Source
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {stats.failedSourcesCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRetryFailed}
                    leftIcon={<RotateCcw className="h-3 w-3 text-amber-600" />}
                    className="text-xs h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    Retry Failed ({stats.failedSourcesCount})
                  </Button>
                )}

                {stats.activeSourcesCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDisableModalOpen(true)}
                    leftIcon={<Power className="h-3 w-3 text-gray-500" />}
                    className="text-xs h-8 text-gray-600 hover:text-red-600 hover:bg-red-50"
                  >
                    Disable All
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Mode Selector Tabs */}
          <div className="flex items-center gap-2 border-b border-border/70 pb-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('registry')}
              className={`px-3 py-1.5 rounded-lg text-body-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'registry'
                  ? 'bg-primary-soft text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Source Registry ({stats.totalRegistered.toLocaleString()})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('connectors')}
              className={`px-3 py-1.5 rounded-lg text-body-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'connectors'
                  ? 'bg-primary-soft text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
              }`}
            >
              <Cpu className="h-4 w-4" />
              <span>Active Connectors ({connectors.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('targets')}
              className={`px-3 py-1.5 rounded-lg text-body-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'targets'
                  ? 'bg-primary-soft text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Target Company Sources ({stats.targetCompanyCount})</span>
            </button>
          </div>

          {/* Tab 1: Active Ingestion Connectors */}
          {activeTab === 'connectors' && (
            <div className="space-y-3">
              <p className="text-body-xs text-text-muted">
                These active technical ingestion engines poll verified public ATS endpoints (Ashby, Greenhouse), remote platforms (Remotive, Jobicy), and your dedicated Target Companies during live discovery.
              </p>

              <div className="space-y-2.5">
                {connectors.map((conn) => (
                  <div
                    key={conn.id}
                    className="p-4 rounded-xl border border-border bg-surface hover:border-primary/40 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-primary-soft text-primary font-bold text-sm">
                          <Cpu className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-text-primary text-body-sm block">
                            {conn.name}
                          </span>
                          <span className="text-caption text-text-muted flex items-center gap-2">
                            <span className="capitalize">ATS: {conn.atsType}</span>
                            <span>•</span>
                            <span className="capitalize">Category: {conn.category.replace('_', ' ')}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {conn.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-700 border border-rose-500/30">
                            <XCircle className="h-3 w-3" />
                            Failed
                          </span>
                        ) : conn.status === 'disabled' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                            Disabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const next = conn.status === 'disabled' ? 'active' : 'disabled';
                            connectorManager.setConnectorStatus(conn.id, next);
                            setRerenderToggle((v) => v + 1);
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                          title={conn.status === 'disabled' ? 'Enable connector' : 'Disable connector'}
                        >
                          {conn.status === 'disabled' ? (
                            <ToggleLeft className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ToggleRight className="h-5 w-5 text-blue-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {conn.errorMessage && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>{conn.errorMessage}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/60">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-text-muted" />
                        Last sync: {conn.lastChecked ? new Date(conn.lastChecked).toLocaleTimeString() : 'Ready / Active'}
                      </span>
                      <span className="font-medium text-text-secondary">
                        {conn.jobsDiscoveredCount} opportunities normalized
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2 & 3: Source Registry Catalog & Target Companies */}
          {(activeTab === 'registry' || activeTab === 'targets') && (
            <div className="space-y-3.5">
              {/* Target Companies banner */}
              {activeTab === 'targets' && (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Target Company Sources:</strong> {stats.targetCompanyCount} monitored • {stats.targetCompanyActiveCount} active in live discovery.
                    </span>
                  </div>
                </div>
              )}

              {/* Section 9: Structured Filter Tabs */}
              {activeTab === 'registry' && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {[
                    { id: 'all', label: `All (${stats.totalRegistered.toLocaleString()})` },
                    { id: 'active', label: `Active (${stats.activeSourcesCount.toLocaleString()})` },
                    { id: 'inactive', label: `Inactive (${stats.disabledCount.toLocaleString()})` },
                    { id: 'eligible', label: `Eligible (${stats.eligibleCount.toLocaleString()})` },
                    { id: 'unavailable', label: `Unavailable (${stats.unavailableCount})` },
                    { id: 'requires_configuration', label: `Requires Config (${stats.requiresConfigCount})` },
                    { id: 'failed', label: `Failed (${stats.failedSourcesCount})` },
                    { id: 'recently_checked', label: 'Recently Checked' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterTab(tab.id as SourceFilterTab)}
                      className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        filterTab === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Search & Category Dropdown */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search by company, source name, ATS, or domain..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    leftIcon={<Search className="h-4 w-4" />}
                  />
                </div>

                {activeTab === 'registry' && (
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-10 px-3 text-xs bg-surface border border-border rounded-lg text-text-secondary focus:outline-none focus:border-primary"
                  >
                    <option value="all">All Categories</option>
                    <option value="company_ats">Company ATS Portals ({stats.companyAtsCount})</option>
                    <option value="startup_vc">Startup & VC Directories ({stats.startupVcCount})</option>
                    <option value="remote_first">Curated Remote Hubs ({stats.remoteCount})</option>
                    <option value="major_aggregator">Major Networks ({stats.majorAggregatorCount})</option>
                    <option value="regional_portal">Regional Portals ({stats.regionalCount})</option>
                  </select>
                )}
              </div>

              {/* Sources Count Label */}
              <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                <span>Showing {filteredSources.length.toLocaleString()} sources</span>
                {filterTab !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTab('all');
                      setSelectedCategory('all');
                      setSearchInput('');
                      setDebouncedSearch('');
                    }}
                    className="text-primary hover:underline"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {/* Sources List with Genuine Telemetry (Virtualized) */}
              <div ref={sourceListRef} className="max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
                {filteredSources.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                    No sources found matching your active filter criteria.
                  </div>
                ) : (
                  <div
                    className="relative w-full"
                    style={{ minHeight: `${sourceVirtualizer.totalSize}px` }}
                  >
                    {sourceVirtualizer.virtualItems.map((virtualRow) => {
                      const source = filteredSources[virtualRow.index];
                      if (!source) return null;
                      return (
                        <div
                          key={source.id}
                          className="absolute top-0 left-0 w-full"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                            minHeight: `${virtualRow.size}px`,
                            paddingBottom: '10px',
                          }}
                        >
                          <div
                            className={`p-3.5 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              source.activeStatus
                                ? 'bg-surface border-border hover:border-primary/40'
                                : 'bg-surface-subtle/70 border-border/60 opacity-70'
                            }`}
                          >
                            <div className="space-y-1.5 min-w-0 flex-1">
                              {(() => {
                                const evaluation = sourceValueEngine.evaluateSource(source);
                                return (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-body-sm font-semibold text-text-primary truncate">
                                      {source.name}
                                    </span>

                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                        evaluation.tier === 'TIER_1_HIGH_VALUE'
                                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                          : evaluation.tier === 'TIER_2_USEFUL'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : evaluation.tier === 'TIER_3_LOW_VALUE'
                                          ? 'bg-gray-100 text-gray-600 border border-gray-200'
                                          : 'bg-red-50 text-red-700 border border-red-200'
                                      }`}
                                      title={evaluation.reason}
                                    >
                                      {evaluation.tier === 'TIER_1_HIGH_VALUE'
                                        ? 'Tier 1'
                                        : evaluation.tier === 'TIER_2_USEFUL'
                                        ? 'Tier 2'
                                        : evaluation.tier === 'TIER_3_LOW_VALUE'
                                        ? 'Tier 3'
                                        : 'Tier 4'}
                                    </span>

                                    {source.category && (
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">
                                        {source.category.replace(/_/g, ' ')}
                                      </span>
                                    )}

                                    {source.atsType !== 'none' && (
                                      <Badge variant="primary" size="sm" className="uppercase text-[10px]">
                                        ATS: {source.atsType}
                                      </Badge>
                                    )}

                                    <span className="text-caption text-text-muted font-mono">
                                      {source.domain}
                                    </span>
                                  </div>
                                );
                              })()}

                              <p className="text-caption text-text-muted line-clamp-1">
                                {source.description}
                              </p>

                              {/* Error notice if unavailable / requires config */}
                              {source.last_error && (
                                <div className="p-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-1.5">
                                  <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                  <span className="truncate">{source.last_error}</span>
                                </div>
                              )}

                              {/* Telemetry Metrics */}
                              <div className="flex items-center gap-2.5 text-[11px] text-text-muted pt-0.5 flex-wrap">
                                {renderHealthIndicator(source.sourceHealth)}
                                <span>•</span>
                                <span className="flex items-center gap-1 text-text-secondary">
                                  <FileCheck className="h-3 w-3 text-primary" />
                                  <span>{source.jobs_verified ?? 0} opportunities discovered</span>
                                </span>
                                <span>•</span>
                                <span>Last checked {formatTimeAgo(source.lastCheckedAt)}</span>
                                <span>•</span>
                                <span className="truncate max-w-[140px]">
                                  {source.supportedLocations.slice(0, 2).join(', ')}
                                </span>
                              </div>
                            </div>

                            {/* Enable/Disable Toggle Control */}
                            <div className="shrink-0 self-end sm:self-center">
                              {source.eligibilityStatus === 'unsupported' ? (
                                <span className="text-[11px] text-gray-400 font-medium px-2 py-1 bg-gray-100 rounded border border-gray-200">
                                  Unsupported
                                </span>
                              ) : source.eligibilityStatus === 'requires_configuration' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-purple-700 font-medium px-2 py-1 bg-purple-50 rounded border border-purple-200">
                                  <Lock className="h-3 w-3" />
                                  Requires Config
                                </span>
                              ) : (
                                <Button
                                  variant={source.activeStatus ? 'outline' : 'ghost'}
                                  size="sm"
                                  onClick={() => {
                                    onToggleSource(source.id, !source.activeStatus);
                                    setRerenderToggle((v) => v + 1);
                                  }}
                                  className="h-8 text-xs font-semibold"
                                >
                                  {source.activeStatus ? 'Disable' : 'Enable'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {/* Confirmation & Bulk Modals */}
      <ActivateAllSourcesModal
        isOpen={isActivateModalOpen}
        onClose={() => setIsActivateModalOpen(false)}
        onStartDiscovery={() => {
          setIsActivateModalOpen(false);
          onClose();
          onStartDiscovery?.();
        }}
        onViewRegistry={() => {
          setIsActivateModalOpen(false);
          setActiveTab('registry');
        }}
      />

      <DisableAllSourcesModal
        isOpen={isDisableModalOpen}
        onClose={() => setIsDisableModalOpen(false)}
        onConfirm={handleConfirmDisableAll}
        activeCount={stats.activeSourcesCount}
      />

      <AddSourceModal
        isOpen={isAddSourceModalOpen}
        onClose={() => setIsAddSourceModalOpen(false)}
        onSourceAdded={() => {
          setRerenderToggle((v) => v + 1);
          showNotice('New source registered successfully.');
        }}
      />
    </>
  );
};
