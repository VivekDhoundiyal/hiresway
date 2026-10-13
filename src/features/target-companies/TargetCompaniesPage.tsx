import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/core/profile';
import { targetCompaniesStore } from '@/core/target-companies';
import { TargetCompany, TargetCompanyTag, CareersPlatformType } from '@/core/jobs/types';
import { Button } from '@/components/button';
import { Modal } from '@/components/modal';
import { useVirtualizer } from '@/components/virtual';
import { AddCompanyModal } from './components/AddCompanyModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { TargetCompanyCard } from './components/TargetCompanyCard';
import { TargetCompanyErrorBoundary } from './components/TargetCompanyErrorBoundary';
import { SourceDetailsModal } from './components/SourceDetailsModal';
import { ManualSourceModal } from './components/ManualSourceModal';
import {
  Building2,
  Search,
  Plus,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Activity,
  ShieldCheck,
} from 'lucide-react';

export const TargetCompaniesPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateSection } = useProfile();

  const [companies, setCompanies] = useState<TargetCompany[]>(() => targetCompaniesStore.getCompanies());
  const [isHydrating, setIsHydrating] = useState<boolean>(
    () => !targetCompaniesStore.isHydrated() && targetCompaniesStore.getCompanies().length === 0
  );
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'Dream' | 'Priority' | 'Watchlist' | 'active_hiring'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debounce search input by 150ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<TargetCompany | null>(null);
  const [editTag, setEditTag] = useState<TargetCompanyTag>('Priority');
  const [editNotes, setEditNotes] = useState('');

  // Source inspection and manual override modals
  const [inspectingCompany, setInspectingCompany] = useState<TargetCompany | null>(null);
  const [manualConfigCompany, setManualConfigCompany] = useState<TargetCompany | null>(null);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to target company store and await IndexedDB hydration
  useEffect(() => {
    let isMounted = true;
    const updateFromStore = () => {
      if (isMounted) {
        const current = targetCompaniesStore.getCompanies();
        setCompanies(current);
        if (current.length > 0) {
          setIsHydrating(false);
        }
      }
    };

    updateFromStore();

    // Await authoritative IndexedDB hydration so all imported companies render on reload
    targetCompaniesStore.ensureHydrated().then((hydrated) => {
      if (isMounted) {
        setCompanies(hydrated);
        setIsHydrating(false);
      }
    });

    const unsubscribe = targetCompaniesStore.subscribe(updateFromStore);
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const stats = useMemo(() => {
    const valid = companies.filter(Boolean);
    const total = valid.length;
    const dream = valid.filter((c) => c.tag === 'Dream' || c.target_status === 'Dream').length;
    const priority = valid.filter((c) => c.tag === 'Priority' || c.target_status === 'Priority').length;
    const watchlist = valid.filter((c) => c.tag === 'Watchlist' || c.target_status === 'Watchlist').length;
    const verified = valid.filter((c) => c.verificationStatus === 'verified' || c.discovery_status === 'Active').length;
    const monitored = valid.filter((c) => c.discovery_enabled !== false && c.monitoringStatus === 'active').length;
    const totalMatchingRoles = valid.reduce((sum, c) => sum + (c.live_jobs ?? c.matchingOpeningsCount ?? 0), 0);
    const totalDiscovered = valid.reduce((sum, c) => sum + (c.jobs_discovered ?? c.totalOpeningsCount ?? 0), 0);

    return {
      total,
      dream,
      priority,
      watchlist,
      verified,
      monitored,
      totalMatchingRoles,
      totalDiscovered,
    };
  }, [companies]);

  // Discovering count
  const discoveringCount = useMemo(() => {
    return companies.filter(
      (c) =>
        c &&
        c.discoveryStatus &&
        c.discoveryStatus !== 'idle' &&
        c.discoveryStatus !== 'complete' &&
        c.discoveryStatus !== 'failed'
    ).length;
  }, [companies]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRefreshAll = () => {
    setIsRefreshing(true);
    targetCompaniesStore.refreshAll();
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Checked careers sources for updates.');
    }, 600);
  };

  const handleDeleteCompany = useCallback((id: string, name: string) => {
    targetCompaniesStore.removeCompany(id);
    const current = profile.targetMarkets?.targetCompanies || [];
    const updated = current.filter((c) => c.toLowerCase() !== name.toLowerCase());
    updateSection('targetMarkets', {
      ...profile.targetMarkets,
      targetCompanies: updated,
    });
    showToast(`Removed "${name}" from target companies.`);
  }, [profile.targetMarkets, updateSection]);

  const handleToggleMonitoring = useCallback((id: string) => {
    targetCompaniesStore.toggleMonitoring(id);
    const comp = targetCompaniesStore.getCompanyById(id);
    if (comp) {
      showToast(
        comp.monitoringStatus === 'active'
          ? `Monitoring resumed for ${comp.name}.`
          : `Monitoring paused for ${comp.name}.`
      );
    }
  }, []);

  const handleRetryDiscovery = useCallback((id: string) => {
    targetCompaniesStore.retryCareersDiscovery(id);
    showToast('Re-running multi-tier discovery pipeline...');
  }, []);

  const handleOpenEdit = useCallback((comp: TargetCompany) => {
    setEditingCompany(comp);
    setEditTag(comp.tag);
    setEditNotes(comp.notes || '');
  }, []);

  const handleSaveEdit = () => {
    if (!editingCompany) return;
    targetCompaniesStore.updateCompany(editingCompany.id, {
      tag: editTag,
      notes: editNotes.trim(),
    });
    setEditingCompany(null);
    showToast('Company preferences updated.');
  };

  const handleSaveManualSource = async (
    id: string,
    url: string,
    platform: CareersPlatformType
  ): Promise<boolean> => {
    const success = await targetCompaniesStore.updateManualCareerSource(id, url, platform);
    if (success) {
      showToast('Career source verified and activated.');
    } else {
      showToast('Failed to verify manual career URL.');
    }
    return success;
  };

  const handleViewInFeed = useCallback((companyName: string) => {
    navigate(`/job-feed?q=${encodeURIComponent(companyName)}`);
  }, [navigate]);

  const handleViewSourceDetails = useCallback((c: TargetCompany) => {
    setInspectingCompany(c);
  }, []);

  const handleEditManualSource = useCallback((c: TargetCompany) => {
    setManualConfigCompany(c);
  }, []);

  // Filtered List with debounced query
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (!c) return false;
      const cName = c.name || c.display_name || '';

      // Tab Filtering
      if (activeTab !== 'all') {
        if (activeTab === 'active_hiring') {
          if (c.hiringActivity !== 'active' && c.hiringActivity !== 'very_high') {
            return false;
          }
        } else if (c.tag !== activeTab && c.target_status !== activeTab) {
          return false;
        }
      }

      // Search Query Filtering (debounced)
      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase().trim();
        const matchName = cName.toLowerCase().includes(q);
        const matchDomain = (c.officialDomain || c.domain || '').toLowerCase().includes(q);
        const matchNotes = (c.notes || '').toLowerCase().includes(q);
        const matchIndustry = (c.industry || '').toLowerCase().includes(q);
        if (!matchName && !matchDomain && !matchNotes && !matchIndustry) {
          return false;
        }
      }

      return true;
    });
  }, [companies, activeTab, debouncedQuery]);

  // Virtualized 2-column grid
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridVirtualizer = useVirtualizer({
    count: filteredCompanies.length,
    columns: 2,
    estimateSize: 260,
    overscan: 4,
    containerRef: gridContainerRef,
  });

  return (
    <TargetCompanyErrorBoundary fallbackType="page">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-gray-800 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Target Companies
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {companies.length} Monitored
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            Automated company watchlist. CareerOs discovers official career endpoints, monitors ATS portals, and alerts you to verified openings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />}
            className="text-xs h-8"
          >
            {isRefreshing ? 'Checking Sources...' : 'Check All'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExcelModalOpen(true)}
            leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
            className="text-xs h-8"
          >
            Import Excel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            className="text-xs h-8 font-semibold shadow-xs"
          >
            Add Target Company
          </Button>
        </div>
      </div>

      {/* Active Discovery Banner (when running background discovery) */}
      {discoveringCount > 0 && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-blue-900 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
            <span>
              <strong>Autonomous Career Discovery in Progress:</strong> Scanning official domains and ATS platforms for{' '}
              {discoveringCount} {discoveringCount === 1 ? 'company' : 'companies'}...
            </span>
          </div>
          <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Background Queue
          </span>
        </div>
      )}

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-3xs">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Watchlist Accounts</span>
            <Building2 className="h-4 w-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {stats.dream} Dream · {stats.priority} Priority · {stats.watchlist} Watchlist
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-3xs">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Verified Sources</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {stats.verified}
            <span className="text-xs font-normal text-gray-400 ml-1.5">/ {stats.total}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {stats.verified === stats.total ? '100% verified sources' : `${stats.total - stats.verified} pending verification`}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-3xs">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Continuous Monitoring</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.monitored}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Hourly automated ATS crawl
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-3xs">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Matching Openings</span>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.totalMatchingRoles}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Qualified opportunities in feed
          </p>
        </div>
      </div>

      {/* 3. Search & Tabs Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-3xs">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            All Accounts ({companies.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Dream')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'Dream'
                ? 'bg-purple-50 text-purple-700 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            ★ Dream ({stats.dream})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Priority')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'Priority'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Priority ({stats.priority})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Watchlist')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'Watchlist'
                ? 'bg-gray-100 text-gray-900 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Watchlist ({stats.watchlist})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('active_hiring')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'active_hiring'
                ? 'bg-emerald-50 text-emerald-700 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Active Hiring Only
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search company, domain, role..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50/70 border border-gray-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500 text-gray-800 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* 4. Company Cards Grid (Virtualized) */}
      <div
        ref={gridContainerRef}
        className="relative w-full"
        style={{ minHeight: filteredCompanies.length === 0 ? 'auto' : `${gridVirtualizer.totalSize}px` }}
      >
        {isHydrating && companies.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-44 bg-white rounded-2xl border border-gray-200/80 p-5 space-y-3 animate-pulse shadow-3xs"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gray-100" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-32 bg-gray-200/80 rounded" />
                    <div className="h-3 w-20 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="h-12 bg-gray-50/80 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 text-center py-16 px-4 space-y-3.5 shadow-3xs">
            <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">
                {companies.length === 0 ? 'Build your company watchlist.' : 'No target companies match your filters'}
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                {companies.length === 0
                  ? 'Add companies manually or import a spreadsheet. CareerOs will find their official careers pages and monitor them for relevant opportunities.'
                  : 'Try clearing your search query or switching tabs to view all monitored accounts.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsExcelModalOpen(true)}
                leftIcon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
                className="text-xs"
              >
                Import Excel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                leftIcon={<Plus className="h-4 w-4" />}
                className="text-xs font-semibold"
              >
                Add Company
              </Button>
            </div>
          </div>
        ) : (
          gridVirtualizer.virtualItems.map((virtualRow) => {
            const firstIndex = virtualRow.index * 2;
            const rowCompanies = filteredCompanies.slice(firstIndex, firstIndex + 2);
            return (
              <div
                key={virtualRow.index}
                className="absolute top-0 left-0 w-full grid grid-cols-1 md:grid-cols-2 gap-4"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  minHeight: `${virtualRow.size}px`,
                }}
              >
                {rowCompanies.map((comp) => (
                  <TargetCompanyErrorBoundary
                    key={comp.id || comp.company_id}
                    fallbackType="card"
                    companyName={comp.name || comp.display_name}
                  >
                    <TargetCompanyCard
                      company={comp}
                      onEdit={handleOpenEdit}
                      onDelete={handleDeleteCompany}
                      onToggleMonitoring={handleToggleMonitoring}
                      onRetryDiscovery={handleRetryDiscovery}
                      onViewInFeed={handleViewInFeed}
                      onViewSourceDetails={handleViewSourceDetails}
                      onEditManualSource={handleEditManualSource}
                    />
                  </TargetCompanyErrorBoundary>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* 5. Add Company Modal */}
      <AddCompanyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCompanyAdded={(name) => {
          const allComps = targetCompaniesStore.getCompanies();
          setCompanies(allComps);
          const current = profile.targetMarkets?.targetCompanies || [];
          if (!current.some((c) => c.toLowerCase() === name.toLowerCase())) {
            updateSection('targetMarkets', {
              ...profile.targetMarkets,
              targetCompanies: [...current, name],
            });
          }
          showToast(`"${name}" added. Career discovery initiated.`);
        }}
      />

      {/* 6. Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImportComplete={(count) => {
          const allComps = targetCompaniesStore.getCompanies();
          setCompanies(allComps);
          showToast(`Imported ${count} companies. Monitored watchlist updated.`);
        }}
      />

      {/* 7. Quick Edit Tag & Notes Modal */}
      {editingCompany && (
        <Modal
          isOpen={true}
          onClose={() => setEditingCompany(null)}
          title={`Edit ${editingCompany.name}`}
          description="Update monitoring priority and strategic notes for this company."
          size="sm"
        >
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">
                Monitoring Tier
              </label>
              <select
                value={editTag}
                onChange={(e) => setEditTag(e.target.value as TargetCompanyTag)}
                className="w-full h-9 px-3 text-xs bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500"
              >
                <option value="Dream">★ Dream Company</option>
                <option value="Priority">Priority Target</option>
                <option value="Watchlist">Watchlist</option>
                <option value="Active Pipeline">Active Pipeline</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">
                Strategic Notes / Target Teams
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="e.g. Targeting Core Infrastructure or Product Engineering roles..."
                className="w-full p-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 text-gray-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingCompany(null)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 8. Source Details & Evidence Modal */}
      <SourceDetailsModal
        isOpen={!!inspectingCompany}
        onClose={() => setInspectingCompany(null)}
        company={inspectingCompany}
        onRetryDiscovery={handleRetryDiscovery}
        onOpenManualEdit={(comp) => setManualConfigCompany(comp)}
      />

      {/* 9. Manual Career Source Override Modal */}
      <ManualSourceModal
        isOpen={!!manualConfigCompany}
        onClose={() => setManualConfigCompany(null)}
        company={manualConfigCompany}
        onSaveManualSource={handleSaveManualSource}
      />
      </div>
    </TargetCompanyErrorBoundary>
  );
};
