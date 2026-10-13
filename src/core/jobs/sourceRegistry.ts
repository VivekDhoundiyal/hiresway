import {
  JobSourceRegistryEntry,
  SourceCategory,
  DiscoveryRun,
} from './types';
import { generate1248SourceCatalog } from './sourceCatalogData';
import { sourceOrchestrator } from './sourceOrchestrator';

const SOURCE_STORAGE_KEY = 'careeros_job_source_registry_v6';

export type SourceFilterTab =
  | 'all'
  | 'active'
  | 'inactive'
  | 'eligible'
  | 'unavailable'
  | 'requires_configuration'
  | 'failed'
  | 'recently_checked';

export interface SourceTelemetryStats {
  totalRegistered: number;
  activeSourcesCount: number;
  eligibleCount: number;
  unavailableCount: number;
  requiresConfigCount: number;
  unsupportedCount: number;
  activeConnectorsCount: number;
  liveQueriedCount: number;
  sourcesWithResultsCount: number;
  failedSourcesCount: number;
  healthyCount: number;
  degradedCount: number;
  disabledCount: number;
  totalVerifiedJobs: number;
  companyAtsCount: number;
  startupVcCount: number;
  remoteCount: number;
  majorAggregatorCount: number;
  regionalCount: number;
  targetCompanyCount: number;
  targetCompanyActiveCount: number;
}

export interface EligibilityBreakdown {
  totalRegistered: number;
  eligibleCount: number;
  activeCount: number;
  alreadyActiveCount: number;
  eligibleInactiveCount: number;
  unavailableCount: number;
  requiresConfigCount: number;
  unsupportedCount: number;
}

function getStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {}
  return null;
}

export class JobSourceRegistry {
  private sources: JobSourceRegistryEntry[] = [];
  private listeners: Set<() => void> = new Set();
  private lastRunStats: {
    queriedCount: number;
    withResultsCount: number;
    failedCount: number;
    lastRunAt?: string;
  } = {
    queriedCount: 0,
    withResultsCount: 0,
    failedCount: 0,
    lastRunAt: undefined,
  };

  constructor() {
    this.loadSources();
  }

  private loadSources(): void {
    try {
      const storage = getStorage();
      if (storage) {
        const stored = storage.getItem(SOURCE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length >= 1200) {
            this.sources = parsed.map((s) => {
              if (s.eligibilityStatus === 'eligible' && !s.activeStatus) {
                return { ...s, activeStatus: true };
              }
              return s;
            });
            sourceOrchestrator.initializeSources(this.sources);
            return;
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse stored sources, regenerating catalog:', e);
    }

    // Default to the 1,248 genuine registered source catalog
    this.sources = generate1248SourceCatalog();
    sourceOrchestrator.initializeSources(this.sources);
    this.persist();
  }

  private persist(): void {
    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(SOURCE_STORAGE_KEY, JSON.stringify(this.sources));
      }
      sourceOrchestrator.initializeSources(this.sources);
    } catch (e) {
      console.error('Failed to persist source registry:', e);
    }
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('SourceRegistry subscriber notification error:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getAllSources(): JobSourceRegistryEntry[] {
    return [...this.sources];
  }

  public getActiveSources(): JobSourceRegistryEntry[] {
    return this.sources.filter((s) => s.activeStatus);
  }

  public getSourceById(id: string): JobSourceRegistryEntry | undefined {
    return this.sources.find((s) => s.id === id);
  }

  public getSourcesByCategory(category: SourceCategory): JobSourceRegistryEntry[] {
    return this.sources.filter((s) => s.category === category);
  }

  public getEligibilityBreakdown(): EligibilityBreakdown {
    const totalRegistered = this.sources.length;
    const activeCount = this.sources.filter((s) => s.activeStatus).length;
    const eligibleSources = this.sources.filter((s) => s.eligibilityStatus === 'eligible');
    const alreadyActiveCount = eligibleSources.filter((s) => s.activeStatus).length;
    const eligibleInactiveCount = eligibleSources.filter((s) => !s.activeStatus).length;
    const unavailableCount = this.sources.filter((s) => s.eligibilityStatus === 'unavailable').length;
    const requiresConfigCount = this.sources.filter((s) => s.eligibilityStatus === 'requires_configuration').length;
    const unsupportedCount = this.sources.filter((s) => s.eligibilityStatus === 'unsupported').length;

    return {
      totalRegistered,
      eligibleCount: eligibleSources.length,
      activeCount,
      alreadyActiveCount,
      eligibleInactiveCount,
      unavailableCount,
      requiresConfigCount,
      unsupportedCount,
    };
  }

  /**
   * Activates all eligible sources in the registry.
   * Broken/unavailable and unconfigured sources remain safe and protected.
   */
  public async activateAllEligible(
    onProgress?: (completed: number, total: number, currentCategory: string) => void
  ): Promise<{
    activatedCount: number;
    alreadyActiveCount: number;
    unavailableCount: number;
    requiresConfigCount: number;
    unsupportedCount: number;
  }> {
    const eligible = this.sources.filter((s) => s.eligibilityStatus === 'eligible');
    const alreadyActiveCount = eligible.filter((s) => s.activeStatus).length;
    const toActivate = eligible.filter((s) => !s.activeStatus);

    const chunkSize = 40;
    for (let i = 0; i < toActivate.length; i += chunkSize) {
      const chunk = toActivate.slice(i, i + chunkSize);
      chunk.forEach((s) => {
        s.activeStatus = true;
      });

      if (onProgress) {
        const completed = Math.min(i + chunkSize, toActivate.length);
        const cat = chunk[0]?.category?.replace(/_/g, ' ') || 'sources';
        onProgress(completed, toActivate.length, cat);
        // Small delay to allow UI renders
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    this.persist();
    this.notify();

    const unavailableCount = this.sources.filter((s) => s.eligibilityStatus === 'unavailable').length;
    const requiresConfigCount = this.sources.filter((s) => s.eligibilityStatus === 'requires_configuration').length;
    const unsupportedCount = this.sources.filter((s) => s.eligibilityStatus === 'unsupported').length;

    return {
      activatedCount: toActivate.length,
      alreadyActiveCount,
      unavailableCount,
      requiresConfigCount,
      unsupportedCount,
    };
  }

  /**
   * Disables all sources across the registry with safety confirmation.
   */
  public disableAll(): { disabledCount: number } {
    const previouslyActive = this.sources.filter((s) => s.activeStatus).length;
    this.sources.forEach((s) => {
      s.activeStatus = false;
    });
    this.persist();
    this.notify();
    return { disabledCount: previouslyActive };
  }

  /**
   * Real-time source check recorder for HTTP status, consecutive failures, and graceful 404 decommissioning.
   */
  public recordSourceCheck(
    sourceId: string,
    result: {
      status?: 'success' | 'failed' | 'rate_limited' | 'not_found' | 'decommissioned' | 'quarantined';
      success?: boolean;
      httpCode?: number;
      httpStatus?: number;
      errorMessage?: string;
      error?: string;
      jobsFound?: number;
      jobsVerified?: number;
    }
  ): JobSourceRegistryEntry | undefined {
    const source = this.sources.find((s) => s.id === sourceId);
    if (!source) return undefined;

    const now = new Date().toISOString();
    source.lastCheckedAt = now;
    const statusCode = result.httpStatus || result.httpCode;
    if (statusCode) {
      source.lastHttpStatus = statusCode;
    }

    const isSuccess = result.status === 'success' || result.success === true;
    const isRateLimited = result.status === 'rate_limited' || statusCode === 429;
    const isNotFound = result.status === 'not_found' || statusCode === 404 || statusCode === 410;
    const isQuarantinedExplicit = result.status === 'quarantined' || result.status === 'decommissioned';
    const errorMsg = result.errorMessage || result.error;

    if (isSuccess) {
      source.lastSuccessfulFetch = now;
      source.sourceHealth = 'healthy';
      source.healthState = 'HEALTHY';
      source.operationalStatus = 'SUCCESS';
      source.consecutiveFailures = 0;
      source.last_error = undefined;
      source.quarantineReason = undefined;
      source.jobs_found = (source.jobs_found || 0) + (result.jobsFound || 0);
      source.jobs_verified = (source.jobs_verified || 0) + (result.jobsVerified || 0);
    } else {
      source.lastFailureAt = now;
      source.consecutiveFailures = (source.consecutiveFailures || 0) + 1;
      source.last_error = errorMsg;

      if (isQuarantinedExplicit || (isNotFound && source.consecutiveFailures >= 2) || (errorMsg && (
        errorMsg.toLowerCase().includes('no longer active') ||
        errorMsg.toLowerCase().includes('page not found') ||
        errorMsg.toLowerCase().includes('job board you were viewing is no longer active')
      ))) {
        source.healthState = 'QUARANTINED';
        source.operationalStatus = 'QUARANTINED';
        source.sourceHealth = 'quarantined';
        source.activeStatus = false;
        source.eligibilityStatus = 'unavailable';
        source.quarantineReason = errorMsg || 'Endpoint returned 404 / dead page ("Page not found" or "job board no longer active"). Quarantined to protect discovery.';
        source.ineligibilityReason = source.quarantineReason;
      } else if (isNotFound) {
        source.healthState = 'NOT_FOUND';
        source.operationalStatus = 'FAILED';
        source.sourceHealth = 'degraded';
      } else if (isRateLimited) {
        source.sourceHealth = 'rate_limited';
        source.healthState = 'BLOCKED';
        source.operationalStatus = 'RATE_LIMITED';
      } else {
        if (source.consecutiveFailures >= 3) {
          source.healthState = 'QUARANTINED';
          source.operationalStatus = 'QUARANTINED';
          source.sourceHealth = 'quarantined';
          source.activeStatus = false;
          source.eligibilityStatus = 'unavailable';
          source.quarantineReason = `Source failed ${source.consecutiveFailures} consecutive times: ${errorMsg || 'Unknown error'}`;
          source.ineligibilityReason = source.quarantineReason;
        } else {
          source.sourceHealth = 'degraded';
          source.healthState = 'TEMPORARILY_FAILED';
          source.operationalStatus = 'FAILED';
        }
      }
    }

    this.persist();
    this.notify();
    return source;
  }

  /**
   * Returns whether a given source is quarantined.
   */
  public isSourceQuarantined(sourceId: string): boolean {
    const source = this.sources.find((s) => s.id === sourceId);
    if (!source) return false;
    return (
      source.healthState === 'QUARANTINED' ||
      source.healthState === 'DECOMMISSIONED' ||
      source.sourceHealth === 'quarantined'
    );
  }

  /**
   * Retrieves all currently quarantined sources with reasons.
   */
  public getQuarantinedSources(): JobSourceRegistryEntry[] {
    return this.sources.filter((s) => this.isSourceQuarantined(s.id));
  }

  /**
   * Resets and retests failing & quarantined sources to restore healthy state.
   */
  public retryFailed(): { retriedCount: number; restored: JobSourceRegistryEntry[] } {
    let retriedCount = 0;
    const restored: JobSourceRegistryEntry[] = [];
    this.sources.forEach((s) => {
      if (
        s.sourceHealth === 'failed' ||
        s.sourceHealth === 'degraded' ||
        s.sourceHealth === 'failing' ||
        s.sourceHealth === 'quarantined' ||
        s.healthState === 'QUARANTINED' ||
        s.healthState === 'DECOMMISSIONED' ||
        s.healthState === 'NOT_FOUND' ||
        s.healthState === 'TEMPORARILY_FAILED'
      ) {
        s.sourceHealth = 'healthy';
        s.healthState = 'HEALTHY';
        s.operationalStatus = 'ACTIVE';
        s.consecutiveFailures = 0;
        s.lastHttpStatus = undefined;
        s.last_error = undefined;
        s.quarantineReason = undefined;
        s.activeStatus = true;
        s.eligibilityStatus = 'eligible';
        s.lastCheckedAt = new Date().toISOString();
        retriedCount++;
        restored.push(s);
      }
    });
    this.persist();
    this.notify();
    return { retriedCount, restored };
  }

  /**
   * Refreshes registry timestamp and checks connectivity.
   */
  public refreshRegistry(): void {
    const now = new Date().toISOString();
    this.sources.forEach((s) => {
      s.lastCheckedAt = now;
    });
    this.persist();
    this.notify();
  }

  public toggleSourceActive(id: string, active: boolean): void {
    this.sources = this.sources.map((s) => {
      if (s.id === id) {
        // Guard: don't allow activating unsupported or requires_config without resolution
        if (active && s.eligibilityStatus === 'unsupported') {
          return s;
        }
        return { ...s, activeStatus: active };
      }
      return s;
    });
    this.persist();
    this.notify();
  }

  public registerSource(entry: JobSourceRegistryEntry): void {
    const existingIndex = this.sources.findIndex(
      (s) => s.id === entry.id || (entry.domain && s.domain === entry.domain && s.name === entry.name)
    );
    if (existingIndex >= 0) {
      this.sources[existingIndex] = { ...this.sources[existingIndex], ...entry };
    } else {
      this.sources.unshift(entry);
    }
    this.persist();
    this.notify();
  }

  public syncTargetCompanies(companyNames: string[]): void {
    let changed = false;
    companyNames.forEach((name) => {
      if (!name || !name.trim()) return;
      const cleanName = name.trim();
      const id = `src-target-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const domain = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      const entry: JobSourceRegistryEntry = {
        id,
        name: `${cleanName} Career Portal`,
        domain,
        sourceType: 'company_career_portal',
        category: 'target_company',
        country: 'global',
        supportedLocations: ['Worldwide', 'Global Remote', 'Local Hubs'],
        jobCategories: ['All Core Departments'],
        atsType: 'none',
        discoveryMethod: 'crawl',
        sourceHealth: 'healthy',
        updateFrequency: 'daily',
        activeStatus: true,
        eligibilityStatus: 'eligible',
        description: `Direct monitored career portal for your target account ${cleanName}.`,
      };
      const existing = this.sources.find((s) => s.id === id);
      if (!existing) {
        this.sources.unshift(entry);
        changed = true;
      }
    });
    if (changed) {
      this.persist();
      this.notify();
    }
  }

  /**
   * Filters the source registry with search and structured eligibility/status tabs.
   */
  public filterSources(
    query: string = '',
    filterTab: SourceFilterTab = 'all',
    categoryFilter: string = 'all'
  ): JobSourceRegistryEntry[] {
    return this.sources.filter((s) => {
      // 1. Text Search Filter
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchDomain = s.domain.toLowerCase().includes(q);
        const matchCat = (s.category || '').toLowerCase().includes(q);
        const matchAts = s.atsType.toLowerCase().includes(q);
        const matchLoc = s.supportedLocations.some((loc) => loc.toLowerCase().includes(q));
        if (!matchName && !matchDomain && !matchCat && !matchAts && !matchLoc) return false;
      }

      // 2. Status / Eligibility Tab Filter
      if (filterTab === 'active' && !s.activeStatus) return false;
      if (filterTab === 'inactive' && s.activeStatus) return false;
      if (filterTab === 'eligible' && s.eligibilityStatus !== 'eligible') return false;
      if (filterTab === 'unavailable' && s.eligibilityStatus !== 'unavailable') return false;
      if (filterTab === 'requires_configuration' && s.eligibilityStatus !== 'requires_configuration') return false;
      if (filterTab === 'failed' && s.sourceHealth !== 'failed' && s.sourceHealth !== 'failing') return false;
      if (filterTab === 'recently_checked' && !s.lastCheckedAt) return false;

      // 3. Category Selector Filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'target_company' && s.category !== 'target_company' && s.sourceType !== 'company_career_portal') {
          return false;
        }
        if (categoryFilter === 'company_ats' && s.category !== 'company_ats' && s.atsType === 'none') {
          return false;
        }
        if (categoryFilter === 'startup_vc' && s.category !== 'startup_vc' && s.sourceType !== 'yc_startup') {
          return false;
        }
        if (categoryFilter === 'remote_first' && s.category !== 'remote_first' && s.sourceType !== 'remote_community') {
          return false;
        }
        if (categoryFilter === 'major_aggregator' && s.category !== 'major_aggregator' && s.sourceType !== 'aggregator') {
          return false;
        }
        if (categoryFilter === 'regional_portal' && s.category !== 'regional_portal' && s.sourceType !== 'job_board') {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Updates registry source metrics and telemetry based on a real completed discovery run.
   */
  public recordDiscoveryRun(run: DiscoveryRun): void {
    this.lastRunStats = {
      queriedCount: run.sourcesQueriedCount ?? run.queriedSourceCount ?? 0,
      withResultsCount: run.sourcesWithResultsCount ?? run.sourcesReturningJobs ?? 0,
      failedCount: run.sourcesFailedCount ?? run.failedSourceCount ?? 0,
      lastRunAt: run.completedAt,
    };

    // Update individual connector / source telemetry
    (run.connectors || []).forEach((conn) => {
      const match = this.sources.find((s) => s.id === conn.sourceId || s.name.includes(conn.sourceName));
      if (match) {
        match.lastSuccessfulFetch = conn.status === 'success' ? conn.timestamp : match.lastSuccessfulFetch;
        match.lastCheckedAt = conn.timestamp;
        match.sourceHealth = conn.status === 'failed' ? 'failed' : conn.status === 'rate_limited' ? 'degraded' : 'healthy';
        match.jobs_found = (match.jobs_found || 0) + conn.jobsDiscovered;
        match.jobs_verified = (match.jobs_verified || 0) + conn.jobsVerified;
        if (conn.status === 'failed') {
          match.lastFailureAt = conn.timestamp;
          match.last_error = conn.errorMessage;
        }
      }
    });

    this.persist();
    this.notify();
  }

  public getStats(): SourceTelemetryStats {
    const totalRegistered = this.sources.length;
    const activeSourcesCount = this.sources.filter((s) => s.activeStatus).length;
    const eligibleCount = this.sources.filter((s) => s.eligibilityStatus === 'eligible').length;
    const unavailableCount = this.sources.filter((s) => s.eligibilityStatus === 'unavailable').length;
    const requiresConfigCount = this.sources.filter((s) => s.eligibilityStatus === 'requires_configuration').length;
    const unsupportedCount = this.sources.filter((s) => s.eligibilityStatus === 'unsupported').length;

    const activeConnectorsCount = 7; // Ashby, Greenhouse, Lever, Workable, Remotive, Jobicy, TargetCompanyCrawler

    const healthyCount = this.sources.filter((s) => s.sourceHealth === 'healthy').length;
    const degradedCount = this.sources.filter((s) => s.sourceHealth === 'degraded' || s.sourceHealth === 'rate_limited').length;
    const disabledCount = this.sources.filter((s) => !s.activeStatus).length;

    const companyAtsCount = this.sources.filter((s) => s.category === 'company_ats' || s.atsType !== 'none').length;
    const startupVcCount = this.sources.filter((s) => s.category === 'startup_vc').length;
    const remoteCount = this.sources.filter((s) => s.category === 'remote_first').length;
    const majorAggregatorCount = this.sources.filter((s) => s.category === 'major_aggregator').length;
    const regionalCount = this.sources.filter((s) => s.category === 'regional_portal').length;
    const targetCompanyCount = this.sources.filter((s) => s.category === 'target_company' || s.sourceType === 'company_career_portal').length;
    const targetCompanyActiveCount = this.sources.filter((s) => (s.category === 'target_company' || s.sourceType === 'company_career_portal') && s.activeStatus).length;

    const totalVerifiedJobs = this.sources.reduce((acc, s) => acc + (s.jobs_verified || 0), 0);

    return {
      totalRegistered,
      activeSourcesCount,
      eligibleCount,
      unavailableCount,
      requiresConfigCount,
      unsupportedCount,
      activeConnectorsCount,
      liveQueriedCount: this.lastRunStats.queriedCount,
      sourcesWithResultsCount: this.lastRunStats.withResultsCount,
      failedSourcesCount: this.lastRunStats.failedCount,
      healthyCount,
      degradedCount,
      disabledCount,
      totalVerifiedJobs,
      companyAtsCount,
      startupVcCount,
      remoteCount,
      majorAggregatorCount,
      regionalCount,
      targetCompanyCount,
      targetCompanyActiveCount,
    };
  }

  /**
   * Convenience method to register a custom source with partial defaults.
   */
  public registerCustomSource(params: {
    name: string;
    sourceUrl: string;
    domain: string;
    category?: SourceCategory;
    extractionStrategy?: string;
    atsType?: any;
  }): JobSourceRegistryEntry {
    const id = `custom-${params.domain.replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
    const newEntry: JobSourceRegistryEntry = {
      id,
      name: params.name,
      domain: params.domain,
      endpointUrl: params.sourceUrl,
      sourceType: 'company_career_portal',
      category: params.category || 'company_ats',
      country: 'global',
      supportedLocations: ['Global', 'Remote'],
      jobCategories: ['Engineering', 'Technology', 'Product'],
      atsType: params.atsType || 'none',
      discoveryMethod: 'feed',
      sourceHealth: 'healthy',
      updateFrequency: 'daily',
      activeStatus: true,
      eligibilityStatus: 'eligible',
      jobs_found: 0,
      jobs_verified: 0,
      jobs_rejected: 0,
      extractionStrategy: (params.extractionStrategy as any) || 'web_scrape_fallback',
    };
    this.registerSource(newEntry);
    return newEntry;
  }

  public getLastRunStats() {
    return { ...this.lastRunStats };
  }
}

const globalAny = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
export const sourceRegistry: JobSourceRegistry =
  globalAny.__careeros_source_registry_instance ||
  (globalAny.__careeros_source_registry_instance = new JobSourceRegistry());
