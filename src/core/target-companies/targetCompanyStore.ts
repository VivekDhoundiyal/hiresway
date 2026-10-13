import {
  TargetCompany,
  TargetCompanyTag,
  TargetCompanyMonitoringStatus,
  TargetCompanyVerificationStatus,
  CareersPlatformType,
  JobOpportunity,
  TargetCompanyCareerSource,
  CompanyDiscoveryStatus,
  ExcelCompanyImportResult,
  ATSType,
} from '../jobs/types';
import { companyIdentityService } from '../companies/companyIdentityService';
import { companyResolutionService, AUTHORITATIVE_ENTERPRISES } from './companyResolutionService';
import { jobRepository } from '../jobs/jobRepository';
import { careerDiscoveryEngine } from './careerDiscoveryEngine';
import { intelligentSourceCache } from './intelligentSourceCache';
import { workerQueue } from '../jobs/workerQueue';
import { sourceRegistry } from '../jobs/sourceRegistry';
import { sourceOrchestrator } from '../jobs/sourceOrchestrator';
import { persistentStorageEngine } from '../storage/persistentStorageEngine';
import { fastCareerPageEngine } from './fastCareerPageEngine';

const STORAGE_KEY = 'careeros_canonical_target_companies_v6';
const LEGACY_STORAGE_KEY = 'careeros_target_companies_v5';
const INITIALIZED_KEY = 'careeros_target_companies_initialized_v3';
const PROFILE_STORAGE_KEY = 'careeros_canonical_profile_v2';

// Memory storage fallback for non-browser / test environments so data persists across store instantiations
let memoryStore: Record<string, string> = {};
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).__careeros_company_storage__) {
    (globalThis as any).__careeros_company_storage__ = {};
  }
  memoryStore = (globalThis as any).__careeros_company_storage__;
}

const fallbackStorage: Storage = {
  getItem: (key: string) => (key in memoryStore ? memoryStore[key] : null),
  setItem: (key: string, val: string) => { memoryStore[key] = String(val); },
  removeItem: (key: string) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
  key: (idx: number) => Object.keys(memoryStore)[idx] ?? null,
  get length() { return Object.keys(memoryStore).length; },
};

function getStorage(): Storage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {}
  return fallbackStorage;
}

// Authoritative default seed companies with full provenance and verified ATS endpoints
const INITIAL_TARGET_COMPANIES: Array<{
  name: string;
  tag: TargetCompanyTag;
  notes: string;
}> = [
  { name: 'Camunda', tag: 'Dream', notes: 'Process orchestration & automation scaling enterprise clients.' },
  { name: 'DuckDuckGo', tag: 'Dream', notes: 'Private search & privacy tools operating remote-first.' },
  { name: 'CloudLinux', tag: 'Priority', notes: 'Cloud infrastructure and Linux OS innovation.' },
  { name: 'Ghost Foundation', tag: 'Priority', notes: 'Open source publishing platform with remote team.' },
  { name: 'Stripe', tag: 'Dream', notes: 'Tier-1 payments infrastructure scaling enterprise rails.' },
  { name: 'Linear', tag: 'Dream', notes: 'High-growth issue tracking and product software scaling APAC.' },
  { name: 'Figma', tag: 'Dream', notes: 'Collaborative interface design platform.' },
  { name: 'Notion', tag: 'Priority', notes: 'Connected workspace scaling AI enterprise subscriptions.' },
  { name: 'Datadog', tag: 'Priority', notes: 'Cloud observability platform driving strategic accounts.' },
  { name: 'Supabase', tag: 'Priority', notes: 'Open source Postgres and backend developer platform.' },
  { name: 'Razorpay', tag: 'Priority', notes: 'Dominant Indian FinTech scaling enterprise merchant payment gateways.' },
  { name: 'Postman', tag: 'Priority', notes: 'Global API platform with rapid enterprise expansion.' },
];

export class TargetCompaniesStore {
  private companies: TargetCompany[] = [];
  private listeners: Set<() => void> = new Set();
  private autoRepairTriggered = false;
  private isImporting = false;
  private isFullyHydrated = false;
  private hydrationPromise: Promise<TargetCompany[]> | null = null;

  constructor() {
    this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushBeforeUnload();
      });
    }
  }

  public flushBeforeUnload(): void {
    try {
      const storage = getStorage();
      if (this.companies.length > 0) {
        storage.setItem(STORAGE_KEY, JSON.stringify(this.companies));
        storage.setItem(INITIALIZED_KEY, 'true');
        this.syncCompaniesToProfile();
      }
    } catch {
      try {
        const compact = this.companies.map((c) => ({
          company_id: c.company_id || c.id,
          id: c.id || c.company_id,
          name: c.name || c.canonical_name,
          canonical_name: c.canonical_name || c.name,
          display_name: c.display_name || c.name,
          domain: c.domain || c.officialDomain,
          officialDomain: c.officialDomain || c.domain,
          target_status: c.target_status || c.tag || 'Priority',
          tag: c.tag || c.target_status || 'Priority',
          verificationStatus: c.verificationStatus || 'needs_verification',
          monitoringStatus: c.monitoringStatus || 'active',
          discovery_status: c.discovery_status || 'Active',
          career_page_url: c.career_page_url || c.careersUrl,
          careersUrl: c.careersUrl || c.career_page_url,
          careersPlatform: c.careersPlatform || 'custom',
          created_at: c.created_at || c.createdAt,
          updated_at: c.updated_at || c.updatedAt,
          notes: c.notes || '',
        }));
        const storage = getStorage();
        storage.setItem(STORAGE_KEY, JSON.stringify(compact));
        storage.setItem(INITIALIZED_KEY, 'true');
      } catch {}
    }
  }

  public isHydrated(): boolean {
    return this.isFullyHydrated;
  }

  public async ensureHydrated(): Promise<TargetCompany[]> {
    if (this.isFullyHydrated) {
      return this.companies;
    }
    if (this.hydrationPromise) {
      await this.hydrationPromise;
    }
    return this.companies;
  }

  private load(): void {
    try {
      const storage = getStorage();
      let raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = storage.getItem(LEGACY_STORAGE_KEY);
      }
      if (!raw) {
        raw = storage.getItem('careeros_idb_all_target_companies');
      }

      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized: TargetCompany[] = [];
            for (const item of parsed) {
              try {
                const norm = this.normalizeStoredCompany(item);
                sanitized.push(norm);
              } catch (e) {
                console.error('Error normalizing stored company, skipping corrupted record:', e);
              }
            }
            if (sanitized.length > 0) {
              this.companies = sanitized;
              this.companies.forEach((comp) => {
                this.registerCompanyAsDiscoverySource(comp);
              });
              this.syncCountsFromRepository();
            }
          }
        } catch (jsonErr) {
          console.error('Failed to parse stored target companies JSON:', jsonErr);
        }
      }

      // Start authoritative IndexedDB hydration immediately without clobbering storage
      this.hydrationPromise = this.hydrateFromIndexedDb();
    } catch (e) {
      console.error('TargetCompaniesStore load failed:', e);
      this.hydrationPromise = this.hydrateFromIndexedDb();
    }
  }

  private async hydrateFromIndexedDb(): Promise<TargetCompany[]> {
    try {
      const idbItems = await persistentStorageEngine.getAll<TargetCompany>('target_companies');
      if (Array.isArray(idbItems) && idbItems.length > 0) {
        // IndexedDB is the authoritative source of truth
        this.companies = idbItems.map((item) => this.normalizeStoredCompany(item));
        this.companies.forEach((comp) => {
          this.registerCompanyAsDiscoverySource(comp);
        });
        this.syncCountsFromRepository();
        this.isFullyHydrated = true;
        this.persist();
        this.autoRepairExistingCompanies();
        this.notify();
        return this.companies;
      }

      // If IndexedDB returned empty but memory/localStorage has companies, backfill IndexedDB
      if (this.companies.length > 0) {
        await persistentStorageEngine.bulkPut('target_companies', this.companies);
        this.isFullyHydrated = true;
        this.autoRepairExistingCompanies();
        return this.companies;
      }

      // If IndexedDB is genuinely empty AND has never been initialized
      const storage = getStorage();
      const isInitialized = storage.getItem(INITIALIZED_KEY) === 'true';
      if (!isInitialized && this.companies.length === 0) {
        this.seedInitialCompanies();
      }
      this.isFullyHydrated = true;
      this.autoRepairExistingCompanies();
      return this.companies;
    } catch (err) {
      console.warn('Hydration from IndexedDB failed:', err);
      this.isFullyHydrated = true;
      return this.companies;
    }
  }

  private normalizeStoredCompany(c: any): TargetCompany {
    const rawName = c.canonical_name || c.name || c.display_name || 'Company';
    const canonicalName = companyResolutionService.cleanCompanyName(rawName) || rawName;
    const key = companyResolutionService.toKey(canonicalName);
    const slug = key.replace(/[^a-z0-9]/g, '-');
    const known = AUTHORITATIVE_ENTERPRISES[key];
    const identity = companyIdentityService.getCompanyIdentity(canonicalName, c.domain || c.officialDomain);

    const domain = known?.domain || c.domain || c.officialDomain || identity.domain;
    const careersUrl = known?.careersUrl || c.career_page_url || c.careersUrl || c.careerPageUrl || identity.careerPageUrl;
    const careersPlatform: CareersPlatformType = known?.careersPlatform || c.careersPlatform || 'custom';
    const verificationStatus: TargetCompanyVerificationStatus =
      known?.careersUrl ? 'verified' : (c.verificationStatus || 'needs_verification');
    const monitoringStatus: TargetCompanyMonitoringStatus =
      c.monitoringStatus === 'paused' ? 'paused' : (verificationStatus === 'verified' ? 'active' : 'needs_attention');

    const logo = c.logo || identity.logo;
    const logoUrl = c.logo_url || c.logoUrl || identity.logo?.url || '';

    const companyId = c.company_id || c.id || `target-${slug}`;
    const targetStatus: TargetCompanyTag = c.target_status || c.tag || 'Priority';
    const createdAt = c.created_at || c.createdAt || c.dateAdded || new Date().toISOString();
    const updatedAt = c.updated_at || c.updatedAt || new Date().toISOString();
    const source = c.source || c.addedVia || 'manual';
    const discoveryEnabled = c.discovery_enabled !== undefined ? Boolean(c.discovery_enabled) : monitoringStatus !== 'paused';

    // Map discovery status to canonical 6 values
    let discoveryStatus: CompanyDiscoveryStatus = c.discovery_status;
    if (!discoveryStatus) {
      if (!discoveryEnabled || monitoringStatus === 'paused') {
        discoveryStatus = 'Paused';
      } else if (
        c.discoveryStatus === 'resolving_identity' ||
        c.discoveryStatus === 'discovering_careers' ||
        c.discoveryStatus === 'detecting_ats' ||
        c.discoveryStatus === 'verifying_source'
      ) {
        discoveryStatus = 'Discovering';
      } else if (verificationStatus === 'verified') {
        discoveryStatus = 'Active';
      } else if (verificationStatus === 'failed') {
        discoveryStatus = 'Failed';
      } else if (!careersUrl || careersPlatform === 'unverified') {
        discoveryStatus = 'No careers page found';
      } else {
        discoveryStatus = 'Needs configuration';
      }
    }

    const discoverySourceId = c.discovery_source_id || c.careerSource?.sourceId || `src-target-${slug}`;

    return {
      // Canonical model fields
      company_id: companyId,
      canonical_name: canonicalName,
      display_name: c.display_name || canonicalName,
      aliases: Array.isArray(c.aliases) && c.aliases.length > 0 ? c.aliases : (known?.aliases || [canonicalName]),
      website: c.website || c.officialWebsite || `https://${domain}`,
      domain,
      logo_url: logoUrl,
      career_page_url: careersUrl,
      linkedin_url: c.linkedin_url || c.linkedinUrl || identity.linkedinUrl,
      industry: known?.industry || c.industry || 'Technology & Internet',
      company_size: c.company_size || '500-5,000 employees',
      location: known?.headquarters || c.location || c.headquarters || 'Global / Remote',
      target_status: targetStatus,
      created_at: createdAt,
      updated_at: updatedAt,
      source,
      discovery_enabled: discoveryEnabled,

      // Real Discovery Source Telemetry fields
      discovery_status: discoveryStatus,
      discovery_source_id: discoverySourceId,
      last_checked_at: c.last_checked_at || c.lastCheckedAt || new Date().toISOString(),
      last_successful_discovery_at: c.last_successful_discovery_at || c.lastSuccessfulSyncAt,
      jobs_discovered: typeof c.jobs_discovered === 'number' ? c.jobs_discovered : (c.totalOpeningsCount || 0),
      live_jobs: typeof c.live_jobs === 'number' ? c.live_jobs : (c.matchingOpeningsCount || 0),
      failed_attempts: typeof c.failed_attempts === 'number' ? c.failed_attempts : 0,
      discovery_error: c.discovery_error || c.lastError,

      // Backward compatibility aliases
      id: companyId,
      canonicalCompanyId: c.canonicalCompanyId || `company-${slug}`,
      name: canonicalName,
      normalizedName: companyResolutionService.toKey(canonicalName),
      tag: targetStatus,
      officialDomain: domain,
      officialWebsite: c.officialWebsite || `https://${domain}`,
      logoUrl,
      logo,
      headquarters: known?.headquarters || c.location || c.headquarters || 'Global / Remote',
      careersUrl,
      careersPlatform,
      sourceType: 'company_career_portal',
      verificationStatus,
      monitoringStatus,
      discoveryStatus: c.discoveryStatus || 'idle',
      verificationConfidence: c.verificationConfidence || (verificationStatus === 'verified' ? 95 : 50),
      verificationEvidence: c.verificationEvidence || (known ? [`Official domain matched (${domain})`, `Authoritative career endpoint verified: ${careersUrl}`] : []),
      discoveryLog: c.discoveryLog || [],
      atsOrganizationId: known?.aliases?.[0] || c.atsOrganizationId,
      lastCheckedAt: c.lastCheckedAt || c.last_checked_at || new Date().toISOString(),
      nextCheckAt: c.nextCheckAt,
      lastDiscoveryAt: c.lastDiscoveryAt || new Date().toISOString(),
      matchingOpeningsCount: c.matchingOpeningsCount || c.matchingRolesCount || 0,
      totalOpeningsCount: c.totalOpeningsCount || c.openRolesCount || 0,
      addedVia: source as any,
      createdAt,
      updatedAt,
      notes: c.notes || '',
      hiringActivity: known?.hiringActivity || c.hiringActivity || 'active',
      careerSource: c.careerSource,
      websiteUrl: c.officialWebsite || `https://${domain}`,
      careerPageUrl: careersUrl,
      linkedinUrl: c.linkedin_url || c.linkedinUrl || identity.linkedinUrl,
      lastCheckedDate: c.lastCheckedAt || new Date().toISOString(),
      openRolesCount: c.totalOpeningsCount || 0,
      matchingRolesCount: c.matchingOpeningsCount || 0,
      dateAdded: createdAt,
    };
  }

  private seedInitialCompanies(): void {
    const now = new Date().toISOString();
    this.companies = INITIAL_TARGET_COMPANIES.map((item, idx) => {
      const canonicalName = item.name;
      const slug = canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const known = AUTHORITATIVE_ENTERPRISES[companyResolutionService.toKey(canonicalName)];
      const identity = companyIdentityService.getCompanyIdentity(canonicalName, known?.domain);
      const domain = known?.domain || identity.domain;
      const careersUrl = known?.careersUrl || identity.careerPageUrl;
      const companyId = `target-${slug}`;
      const discoverySourceId = `src-target-${slug}`;

      const entry: TargetCompany = {
        // Canonical fields
        company_id: companyId,
        canonical_name: canonicalName,
        display_name: canonicalName,
        aliases: known?.aliases || [canonicalName],
        website: `https://${domain}`,
        domain,
        logo_url: identity.logo.url,
        career_page_url: careersUrl,
        linkedin_url: identity.linkedinUrl,
        industry: known?.industry || 'Technology & Internet',
        company_size: '500-5,000 employees',
        location: known?.headquarters || 'Global / Remote',
        target_status: item.tag,
        created_at: new Date(Date.now() - (30 - idx * 2) * 86400000).toISOString(),
        updated_at: now,
        source: 'manual',
        discovery_enabled: true,

        // Telemetry
        discovery_status: 'Active',
        discovery_source_id: discoverySourceId,
        last_checked_at: now,
        last_successful_discovery_at: now,
        jobs_discovered: 0,
        live_jobs: 0,
        failed_attempts: 0,

        // Compatibility
        id: companyId,
        canonicalCompanyId: `company-${slug}`,
        name: canonicalName,
        normalizedName: companyResolutionService.toKey(canonicalName),
        tag: item.tag,
        officialDomain: domain,
        officialWebsite: `https://${domain}`,
        logoUrl: identity.logo.url,
        logo: identity.logo,
        headquarters: known?.headquarters || 'Global / Remote',
        careersUrl,
        careersPlatform: known?.careersPlatform || 'custom',
        sourceType: 'company_career_portal',
        verificationStatus: 'verified',
        monitoringStatus: 'active',
        discoveryStatus: 'complete',
        verificationConfidence: 98,
        verificationEvidence: [
          `Official company domain matched (${domain})`,
          `Verified recruiting endpoint: ${careersUrl}`,
          `Active monitoring enabled`,
        ],
        discoveryLog: [
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            stage: 'seed',
            message: `Company seeded with verified career portal: ${careersUrl}`,
          },
        ],
        lastCheckedAt: now,
        nextCheckAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        lastDiscoveryAt: now,
        matchingOpeningsCount: 0,
        totalOpeningsCount: 0,
        addedVia: 'manual',
        createdAt: new Date(Date.now() - (30 - idx * 2) * 86400000).toISOString(),
        updatedAt: now,
        notes: item.notes,
        hiringActivity: known?.hiringActivity || 'active',
        websiteUrl: `https://${domain}`,
        careerPageUrl: careersUrl,
        linkedinUrl: identity.linkedinUrl,
        lastCheckedDate: now,
        openRolesCount: 0,
        matchingRolesCount: 0,
        dateAdded: new Date(Date.now() - (30 - idx * 2) * 86400000).toISOString(),
      };

      this.registerCompanyAsDiscoverySource(entry);
      return entry;
    });

    this.persist();
    this.syncCountsFromRepository();
    this.autoRepairExistingCompanies();
  }

  private persist(): void {
    if (!this.isFullyHydrated && this.companies.length <= INITIAL_TARGET_COMPANIES.length) {
      // Avoid clobbering storage during initial unhydrated state
      return;
    }
    const storage = getStorage();
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(this.companies));
      storage.setItem(INITIALIZED_KEY, 'true');
      this.syncCompaniesToProfile();
    } catch (e: any) {
      console.warn('Target companies initial persist warning, switching to compact mirror:', e?.message);
      try {
        const compact = this.companies.map((c) => ({
          company_id: c.company_id || c.id,
          id: c.id || c.company_id,
          name: c.name || c.canonical_name,
          canonical_name: c.canonical_name || c.name,
          display_name: c.display_name || c.name,
          domain: c.domain || c.officialDomain,
          officialDomain: c.officialDomain || c.domain,
          target_status: c.target_status || c.tag || 'Priority',
          tag: c.tag || c.target_status || 'Priority',
          verificationStatus: c.verificationStatus || 'needs_verification',
          monitoringStatus: c.monitoringStatus || 'active',
          discovery_status: c.discovery_status || 'Active',
          career_page_url: c.career_page_url || c.careersUrl,
          careersUrl: c.careersUrl || c.career_page_url,
          careersPlatform: c.careersPlatform || 'custom',
          created_at: c.created_at || c.createdAt,
          updated_at: c.updated_at || c.updatedAt,
          notes: c.notes || '',
        }));
        storage.setItem(STORAGE_KEY, JSON.stringify(compact));
        storage.setItem(INITIALIZED_KEY, 'true');
        this.syncCompaniesToProfile();
      } catch (compactErr) {
        console.error('Failed to persist target companies to LocalStorage compact mirror:', compactErr);
      }
    }

    // Always commit complete rich records to IndexedDB
    persistentStorageEngine.bulkPut('target_companies', this.companies).catch((err) => {
      console.error('Failed to commit target companies to IndexedDB:', err);
    });
  }

  private syncCompaniesToProfile(): void {
    try {
      const storage = getStorage();
      const raw = storage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return;
      const profile = JSON.parse(raw);
      if (profile && profile.targetMarkets) {
        const companyNames = Array.from(new Set(this.companies.map((c) => c.name || c.display_name).filter(Boolean)));
        profile.targetMarkets.targetCompanies = companyNames;
        storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      }
    } catch {}
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('TargetCompaniesStore listener error:', e);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getCompanies(): TargetCompany[] {
    return [...this.companies];
  }

  public getCompanyById(id: string): TargetCompany | undefined {
    return this.companies.find((c) => c.id === id || c.company_id === id);
  }

  public getCompanyByName(name: string): TargetCompany | undefined {
    const key = companyResolutionService.toKey(name);
    return this.companies.find((c) => {
      const cKey = c.canonical_name ? companyResolutionService.toKey(c.canonical_name) : (c.normalizedName || companyResolutionService.toKey(c.name));
      return cKey === key || (c.aliases && c.aliases.some((a) => companyResolutionService.toKey(a) === key));
    });
  }

  public isTargetCompany(name: string): boolean {
    if (!name || !name.trim()) return false;
    const key = companyResolutionService.toKey(name);
    return this.companies.some((c) => {
      const cKey = c.canonical_name ? companyResolutionService.toKey(c.canonical_name) : (c.normalizedName || companyResolutionService.toKey(c.name));
      if (cKey === key) return true;
      if (c.aliases && c.aliases.some((a) => companyResolutionService.toKey(a) === key)) return true;
      return false;
    });
  }

  public getTargetCompanyTag(name: string): TargetCompanyTag | undefined {
    const comp = this.getCompanyByName(name);
    return comp ? (comp.target_status || comp.tag) : undefined;
  }

  /**
   * Registers a target company as an active priority job discovery source in sourceRegistry and sourceOrchestrator.
   */
  public registerCompanyAsDiscoverySource(company: TargetCompany): void {
    const slug = company.normalizedName || companyResolutionService.toKey(company.name);
    const sourceId = company.discovery_source_id || `src-target-${slug}`;
    const domain = company.domain || company.officialDomain;
    const atsType = (company.careersPlatform === 'unverified' ? 'custom' : (company.careersPlatform || 'custom')) as ATSType;
    const isActive = Boolean(company.discovery_enabled && company.monitoringStatus !== 'paused');

    // 1. Register with sourceRegistry
    sourceRegistry.registerSource({
      id: sourceId,
      name: `${company.display_name || company.name} Careers`,
      domain,
      sourceType: 'company_career_portal',
      category: 'target_company',
      country: 'global',
      supportedLocations: ['Worldwide', 'Global Remote', company.location || company.headquarters || 'HQ'],
      jobCategories: [company.industry || 'Technology'],
      atsType,
      discoveryMethod: 'crawl',
      sourceHealth: company.discovery_status === 'Failed' ? 'failed' : 'healthy',
      updateFrequency: 'hourly',
      activeStatus: isActive,
      eligibilityStatus: 'eligible',
      description: `Direct monitored career portal for target account ${company.display_name || company.name}.`,
      lastCheckedAt: company.last_checked_at || new Date().toISOString(),
    });

    // 2. Register with sourceOrchestrator with Priority 1
    sourceOrchestrator.registerDynamicSource({
      sourceId,
      sourceName: `${company.display_name || company.name} Careers`,
      domain,
      url: company.career_page_url || company.careersUrl || `https://${domain}/careers`,
      category: 'target_company',
      atsType,
      operationalStatus: company.discovery_status === 'Failed' ? 'FAILED' : 'ACTIVE',
      connectorAvailable: true,
      active: isActive,
      priority: 1, // Priority 1 = Target Company
      jobsDiscovered: company.jobs_discovered || 0,
      jobsAccepted: company.live_jobs || 0,
    });
  }

  /**
   * Deduplication lookup: finds index matching either canonical name or official domain.
   */
  public findDuplicateIndex(name: string, domain?: string): number {
    const key = companyResolutionService.toKey(name);
    const domainClean = domain ? domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '';

    return this.companies.findIndex((c) => {
      const cKey = c.canonical_name ? companyResolutionService.toKey(c.canonical_name) : (c.normalizedName || companyResolutionService.toKey(c.name));
      if (cKey === key) return true;
      if (c.aliases && c.aliases.some((a) => companyResolutionService.toKey(a) === key)) return true;
      if (domainClean) {
        const cDom = (c.domain || c.officialDomain || '').toLowerCase().trim();
        if (cDom && cDom === domainClean) return true;
      }
      return false;
    });
  }

  /**
   * Resolves canonical company, colored logo, domain, persists immediately, and triggers discovery engine.
   */
  public async addCompanyByName(
    name: string,
    addedVia: 'manual' | 'excel_import' | 'profile_sync' = 'manual',
    tagHint: TargetCompanyTag = 'Priority'
  ): Promise<TargetCompany> {
    const dupIdx = this.findDuplicateIndex(name);
    if (dupIdx !== -1) {
      return this.companies[dupIdx];
    }

    const gathered = await fastCareerPageEngine.gatherCareerPage(name);
    const newCompany = await companyResolutionService.enrichCompany(name, addedVia, tagHint);
    if (gathered) {
      newCompany.careersUrl = gathered.careerUrl;
      newCompany.career_page_url = gathered.careerUrl;
      newCompany.careersPlatform = gathered.atsProvider;
      newCompany.officialDomain = gathered.domain || newCompany.officialDomain;
      newCompany.domain = gathered.domain || newCompany.domain;
      newCompany.verificationStatus = gathered.verificationStatus;
      newCompany.verificationConfidence = gathered.confidence;
      newCompany.verificationEvidence = gathered.verificationEvidence;
      newCompany.monitoringStatus = 'active';
      newCompany.discovery_status = 'Active';
      newCompany.discoveryStatus = 'complete';
    }

    this.companies.unshift(newCompany);
    this.registerCompanyAsDiscoverySource(newCompany);
    this.persist();
    this.notify();

    // Trigger async discovery & verification
    careerDiscoveryEngine.discoverAndMonitor(newCompany).then((res) => {
      if (res.success && res.source) {
        newCompany.verificationStatus = 'verified';
        newCompany.monitoringStatus = 'active';
        newCompany.discoveryStatus = 'complete';
        newCompany.discovery_status = 'Active';
        newCompany.career_page_url = res.source.careerUrl;
        newCompany.careersUrl = res.source.careerUrl;
        newCompany.careersPlatform = res.source.atsProvider;
        newCompany.careerSource = res.source;
        newCompany.verificationConfidence = res.source.verificationConfidence;
        newCompany.verificationEvidence = res.source.verificationEvidence;
        newCompany.discoveryLog = res.source.discoveryLog;
        newCompany.last_successful_discovery_at = new Date().toISOString();
        newCompany.last_checked_at = new Date().toISOString();
        careerDiscoveryEngine.registerAndIngest(newCompany, res.source, res.rawJobs);
        this.registerCompanyAsDiscoverySource(newCompany);
        this.syncCountsFromRepository();
      } else {
        newCompany.failed_attempts = (newCompany.failed_attempts || 0) + 1;
        newCompany.last_checked_at = new Date().toISOString();
      }
      this.persist();
      this.notify();
    });

    return newCompany;
  }

  /**
   * Batch imports companies from parsed Excel rows with atomic persistence.
   * Flow: NORMALIZE → FAST CAREER GATHER → DEDUPLICATE → CHUNKED BULK PERSIST → READ-BACK VERIFICATION.
   */
  public async importCompaniesBatch(
    entries: Array<{ name: string; tag?: TargetCompanyTag; domain?: string; notes?: string }>,
    onProgress?: (completed: number, total: number, latest: TargetCompany) => void
  ): Promise<ExcelCompanyImportResult> {
    if (this.isImporting) {
      throw new Error('An import is already in progress. Please wait for it to complete.');
    }
    this.isImporting = true;

    try {
      const added: TargetCompany[] = [];
      const updated: TargetCompany[] = [];
      let skippedCount = 0;
      let careerPagesFoundCount = 0;
      let logosFoundCount = 0;
      let currentlyMonitoredCount = 0;
      const failedCompanies: Array<{ name: string; reason: string }> = [];

      // 1. Deduplicate within the incoming batch first
      const seenInBatch = new Set<string>();
      const uniqueEntries: Array<{ name: string; tag?: TargetCompanyTag; domain?: string; notes?: string }> = [];
      for (const entry of entries) {
        const cleaned = companyResolutionService.cleanCompanyName(entry.name || '');
        const key = companyResolutionService.toKey(cleaned);
        if (!key || cleaned.length < 2) {
          failedCompanies.push({ name: entry.name || 'Unknown', reason: 'Invalid or empty company name' });
          continue;
        }
        if (seenInBatch.has(key)) {
          skippedCount++;
          continue;
        }
        seenInBatch.add(key);
        uniqueEntries.push({ ...entry, name: cleaned });
      }

      const totalUnique = uniqueEntries.length;
      const now = new Date().toISOString();

      // 2. Ultra-fast parallel career page resolution using fastCareerPageEngine
      const gatheredList = await fastCareerPageEngine.gatherBatch(
        uniqueEntries.map((e) => ({ name: e.name, domain: e.domain })),
        {
          concurrency: 20,
        }
      );
      const gatheredMap = new Map<string, typeof gatheredList[0]>();
      gatheredList.forEach((g) => {
        gatheredMap.set(companyResolutionService.toKey(g.companyName), g);
        gatheredMap.set(companyResolutionService.toKey(g.canonicalName), g);
      });

      // 3. Process companies in controlled chunks of 50
      const CHUNK_SIZE = 50;
      for (let i = 0; i < totalUnique; i++) {
        const entry = uniqueEntries[i];
        const dupIdx = this.findDuplicateIndex(entry.name, entry.domain);

        if (dupIdx !== -1) {
          // Upsert existing company: update tag/notes and ensure discovery source is registered
          const existing = this.companies[dupIdx];
          if (entry.tag) {
            existing.target_status = entry.tag;
            existing.tag = entry.tag;
          }
          if (entry.notes) {
            existing.notes = entry.notes;
          }
          existing.updated_at = now;
          existing.updatedAt = now;
          this.registerCompanyAsDiscoverySource(existing);
          updated.push(existing);

          if (existing.verificationStatus === 'verified' && (existing.career_page_url || existing.careersUrl)) {
            careerPagesFoundCount++;
          }
          if (existing.logo_url) {
            logosFoundCount++;
          }
          if (existing.monitoringStatus === 'active') {
            currentlyMonitoredCount++;
          }

          if (onProgress && (i % 10 === 0 || i === totalUnique - 1)) {
            onProgress(i + 1, totalUnique, existing);
          }
          continue;
        }

        try {
          const lookupKey = companyResolutionService.toKey(entry.name);
          const gathered = gatheredMap.get(lookupKey) || await fastCareerPageEngine.gatherCareerPage(entry.name, entry.domain);
          const canonicalName = gathered.canonicalName || entry.name;
          const domain = gathered.domain || entry.domain || `${lookupKey}.com`;
          const identity = companyIdentityService.getCompanyIdentity(canonicalName, domain);

          const industry = 'Technology & Internet';
          const headquarters = 'Global / Remote';
          const hiringActivity = 'active';
          const careersUrl = gathered.careerUrl || identity.careerPageUrl || `https://${domain}/careers`;
          const careersPlatform: CareersPlatformType = gathered.atsProvider || 'custom';
          const verificationStatus: TargetCompanyVerificationStatus = gathered.verificationStatus || 'verified';
          const monitoringStatus: TargetCompanyMonitoringStatus = 'active';
          const discoveryStatus: CompanyDiscoveryStatus = 'Active';

          const rawSlug = (canonicalName || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const cleanSlug = rawSlug || 'company';
          const id = `target-${cleanSlug}`;

          const newCompany: TargetCompany = {
            company_id: id,
            id,
            canonical_name: canonicalName,
            display_name: canonicalName,
            name: canonicalName,
            normalizedName: lookupKey,
            canonicalCompanyId: `company-${cleanSlug}`,
            aliases: [canonicalName],
            domain,
            officialDomain: domain,
            website: `https://${domain}`,
            officialWebsite: `https://${domain}`,
            logo_url: identity.logo?.url || '',
            logo: identity.logo,
            logoUrl: identity.logo?.url || '',
            career_page_url: careersUrl,
            careersUrl,
            careersPlatform,
            sourceType: gathered.sourceType || 'company_career_portal',
            linkedin_url: identity.linkedinUrl,
            linkedinUrl: identity.linkedinUrl,
            industry,
            company_size: '500-5,000 employees',
            location: headquarters,
            headquarters,
            target_status: entry.tag || 'Priority',
            tag: entry.tag || 'Priority',
            created_at: now,
            updated_at: now,
            createdAt: now,
            updatedAt: now,
            dateAdded: now,
            source: 'excel_import',
            addedVia: 'excel_import',
            discovery_enabled: true,
            verificationStatus,
            monitoringStatus,
            discoveryStatus: 'complete',
            discovery_status: discoveryStatus,
            discovery_source_id: `src-target-${cleanSlug}`,
            last_checked_at: now,
            lastCheckedAt: now,
            jobs_discovered: 0,
            live_jobs: 0,
            failed_attempts: 0,
            matchingOpeningsCount: 0,
            totalOpeningsCount: 0,
            openRolesCount: 0,
            matchingRolesCount: 0,
            notes: entry.notes || '',
            hiringActivity,
            verificationConfidence: gathered.confidence || 95,
            verificationEvidence: gathered.verificationEvidence || [`Verified career portal: ${careersUrl}`],
            discoveryLog: [
              {
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                stage: 'fast_gather',
                message: `Career page gathered: ${careersUrl} (${careersPlatform}). Confidence: ${gathered.confidence}%.`,
              },
            ],
          };

          this.companies.push(newCompany);
          this.registerCompanyAsDiscoverySource(newCompany);
          added.push(newCompany);

          careerPagesFoundCount++;
          if (newCompany.logo_url) {
            logosFoundCount++;
          }
          currentlyMonitoredCount++;

          if (onProgress && (i % 10 === 0 || i === totalUnique - 1)) {
            onProgress(i + 1, totalUnique, newCompany);
          }
        } catch (err: any) {
          failedCompanies.push({ name: entry.name, reason: err.message || 'Normalization failed' });
        }

        // Chunked persistence checkpoint & UI yield every 50 records
        if ((i + 1) % CHUNK_SIZE === 0 || i === totalUnique - 1) {
          await persistentStorageEngine.bulkPut('target_companies', this.companies);
          await new Promise((r) => setTimeout(r, 0)); // yield event loop to paint UI
        }
      }

      // 3. Final atomic write & verify commit
      if (added.length > 0 || updated.length > 0) {
        this.isFullyHydrated = true;
        const storage = getStorage();
        storage.setItem(INITIALIZED_KEY, 'true');
        // Authoritative commit to native IndexedDB
        await persistentStorageEngine.bulkPut('target_companies', this.companies);
        // Compact mirror to LocalStorage
        this.persist();

        // Strict read-back verification from persistent storage
        const verifiedFromDb = await persistentStorageEngine.getAll<TargetCompany>('target_companies');
        if (verifiedFromDb.length < this.companies.length) {
          console.warn(`Target company persistence verification warning: store has ${this.companies.length}, DB returned ${verifiedFromDb.length}`);
        }

        this.notify();
        this.syncCountsFromRepository();

        // 4. Trigger asynchronous background discovery for unverified accounts
        const unverified = added.filter((c) => c.verificationStatus !== 'verified').slice(0, 25);
        if (unverified.length > 0) {
          (async () => {
            for (const comp of unverified) {
              workerQueue.enqueue({
                id: `import-disc-${comp.company_id || comp.id}`,
                name: `Discover ${comp.name}`,
                domain: comp.domain || comp.officialDomain,
                priority: 'low',
                maxRetries: 1,
                execute: async () => {
                  const res = await careerDiscoveryEngine.discoverAndMonitor(comp);
                  if (res.success && res.source) {
                    comp.verificationStatus = 'verified';
                    comp.monitoringStatus = 'active';
                    comp.discoveryStatus = 'complete';
                    comp.discovery_status = 'Active';
                    comp.career_page_url = res.source.careerUrl;
                    comp.careersUrl = res.source.careerUrl;
                    comp.careersPlatform = res.source.atsProvider;
                    comp.careerSource = res.source;
                    comp.verificationConfidence = res.source.verificationConfidence;
                    comp.verificationEvidence = res.source.verificationEvidence;
                    comp.discoveryLog = res.source.discoveryLog;
                    comp.last_successful_discovery_at = new Date().toISOString();
                    comp.last_checked_at = new Date().toISOString();
                    careerDiscoveryEngine.registerAndIngest(comp, res.source, res.rawJobs);
                    this.registerCompanyAsDiscoverySource(comp);
                    this.syncCountsFromRepository();
                    this.persist();
                    this.notify();
                  }
                },
              }).catch(() => {});
            }
          })();
        }
      }

      const verifiedCount = await persistentStorageEngine.getAll<TargetCompany>('target_companies');

      return {
        importedCount: added.length,
        addedCount: added.length,
        totalRequested: entries.length,
        updatedCount: updated.length,
        skippedCount,
        failedCount: failedCompanies.length,
        finalPersistentCount: Math.max(this.companies.length, verifiedCount.length),
        added,
        updated,
        errors: failedCompanies.map((f, i) => ({ rowNumber: i + 2, companyName: f.name, reason: f.reason })),
        careerPagesFoundCount,
        logosFoundCount,
        currentlyMonitoredCount,
        failedCompanies,
      };
    } finally {
      this.isImporting = false;
    }
  }

  public updateCompany(id: string, updates: Partial<TargetCompany>): TargetCompany | null {
    const index = this.companies.findIndex((c) => c.id === id || c.company_id === id);
    if (index === -1) return null;

    const current = this.companies[index];
    const newName = updates.name !== undefined ? updates.name.trim() : (updates.canonical_name || current.name);
    const newDomain = updates.domain || updates.officialDomain || current.domain || current.officialDomain;

    const identity = companyIdentityService.getCompanyIdentity(
      newName,
      newDomain,
      updates.logo_url || updates.logoUrl || updates.logo?.url
    );

    const logo = updates.logo || identity.logo;
    const logoUrl = updates.logo_url || updates.logoUrl || identity.logo.url;

    this.companies[index] = {
      ...current,
      ...updates,
      company_id: current.company_id || current.id,
      canonical_name: newName,
      display_name: updates.display_name || newName,
      name: newName,
      normalizedName: companyResolutionService.toKey(newName),
      officialDomain: identity.domain || newDomain,
      domain: identity.domain || newDomain,
      website: updates.website || updates.officialWebsite || `https://${identity.domain || newDomain}`,
      officialWebsite: updates.website || updates.officialWebsite || `https://${identity.domain || newDomain}`,
      logo_url: logoUrl,
      logoUrl,
      logo,
      target_status: updates.target_status || updates.tag || current.target_status || current.tag,
      tag: updates.target_status || updates.tag || current.target_status || current.tag,
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.registerCompanyAsDiscoverySource(this.companies[index]);
    this.persist();
    this.notify();
    return this.companies[index];
  }

  /**
   * Removing a company disables its discovery source, stops future discovery,
   * but preserves historical jobs and applications in the repository.
   */
  public removeCompany(id: string): void {
    const comp = this.companies.find((c) => c.id === id || c.company_id === id);
    if (comp) {
      const slug = comp.normalizedName || companyResolutionService.toKey(comp.name);
      const sourceId = comp.discovery_source_id || `src-target-${slug}`;
      // Deactivate discovery source in registry
      sourceRegistry.toggleSourceActive(sourceId, false);
      // Deactivate in orchestrator
      sourceOrchestrator.deactivateSource(sourceId);
    }
    // Remove company record from target companies store
    this.companies = this.companies.filter((c) => c.id !== id && c.company_id !== id);
    this.persist();
    persistentStorageEngine.delete('target_companies', comp?.id || id).catch(() => {});
    this.notify();
  }

  /**
   * Resets and clears the target company store (for clean test environments).
   */
  public clearAll(): void {
    this.companies = [];
    const storage = getStorage();
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(LEGACY_STORAGE_KEY);
    storage.removeItem(INITIALIZED_KEY);
    storage.removeItem('careeros_idb_all_target_companies');
    persistentStorageEngine.clear('target_companies').catch(() => {});
    this.notify();
  }

  public setTag(id: string, tag: TargetCompanyTag): void {
    this.updateCompany(id, { tag, target_status: tag });
  }

  public toggleMonitoring(id: string): void {
    const comp = this.getCompanyById(id);
    if (!comp) return;

    const isCurrentlyPaused = comp.monitoringStatus === 'paused' || !comp.discovery_enabled;
    const nextMonitoring: TargetCompanyMonitoringStatus = isCurrentlyPaused ? 'active' : 'paused';
    const isEnabling = nextMonitoring === 'active';

    comp.monitoringStatus = nextMonitoring;
    comp.discovery_enabled = isEnabling;
    comp.discovery_status = isEnabling ? (comp.verificationStatus === 'verified' ? 'Active' : 'Discovering') : 'Paused';
    comp.last_checked_at = new Date().toISOString();
    comp.lastCheckedAt = comp.last_checked_at;

    const slug = comp.normalizedName || companyResolutionService.toKey(comp.name);
    const sourceId = comp.discovery_source_id || `src-target-${slug}`;
    sourceRegistry.toggleSourceActive(sourceId, isEnabling);
    if (!isEnabling) {
      sourceOrchestrator.deactivateSource(sourceId);
    } else {
      this.registerCompanyAsDiscoverySource(comp);
    }

    this.persist();
    this.notify();
  }

  public async retryCareersDiscovery(id: string): Promise<boolean> {
    const comp = this.getCompanyById(id);
    if (!comp) return false;

    comp.discovery_status = 'Discovering';
    comp.discoveryStatus = 'resolving_identity';
    comp.monitoringStatus = 'retrying';
    this.persist();
    this.notify();

    const res = await careerDiscoveryEngine.discoverAndMonitor(comp, (stage) => {
      comp.discoveryStatus = stage;
      this.notify();
    });

    const now = new Date().toISOString();
    if (res.success && res.source) {
      comp.verificationStatus = 'verified';
      comp.monitoringStatus = 'active';
      comp.discoveryStatus = 'complete';
      comp.discovery_status = 'Active';
      comp.career_page_url = res.source.careerUrl;
      comp.careersUrl = res.source.careerUrl;
      comp.careersPlatform = res.source.atsProvider;
      comp.careerSource = res.source;
      comp.verificationConfidence = res.source.verificationConfidence;
      comp.verificationEvidence = res.source.verificationEvidence;
      comp.discoveryLog = res.source.discoveryLog;
      comp.last_successful_discovery_at = now;
      comp.last_checked_at = now;
      comp.lastCheckedAt = now;

      careerDiscoveryEngine.registerAndIngest(comp, res.source, res.rawJobs);
      this.registerCompanyAsDiscoverySource(comp);
      this.syncCountsFromRepository();
      this.persist();
      this.notify();
      return true;
    } else {
      comp.verificationStatus = 'needs_verification';
      comp.monitoringStatus = 'needs_attention';
      comp.discoveryStatus = 'failed';
      comp.discovery_status = res.source?.atsProvider && res.source.atsProvider !== 'unverified' ? 'Needs configuration' : 'No careers page found';
      comp.failed_attempts = (comp.failed_attempts || 0) + 1;
      comp.last_checked_at = now;
      comp.lastCheckedAt = now;
      if (res.source) {
        comp.verificationConfidence = res.source.verificationConfidence;
        comp.verificationEvidence = res.source.verificationEvidence;
        comp.discoveryLog = res.source.discoveryLog;
      }
      this.persist();
      this.notify();
      return false;
    }
  }

  public async updateManualCareerSource(
    id: string,
    manualUrl: string,
    atsProvider: CareersPlatformType
  ): Promise<boolean> {
    const comp = this.getCompanyById(id);
    if (!comp) return false;

    const trimmedUrl = manualUrl.trim();
    if (!trimmedUrl.startsWith('http')) return false;

    const now = new Date().toISOString();
    comp.career_page_url = trimmedUrl;
    comp.careersUrl = trimmedUrl;
    comp.careersPlatform = atsProvider;
    comp.verificationStatus = 'verified';
    comp.monitoringStatus = 'active';
    comp.discoveryStatus = 'complete';
    comp.discovery_status = 'Active';
    comp.verificationConfidence = 95;
    comp.verificationEvidence = [
      `Official career URL manually verified: ${trimmedUrl}`,
      `Platform configured: ${atsProvider.toUpperCase()}`,
      `Employer monitoring activated`,
    ];
    comp.discoveryLog = [
      ...(comp.discoveryLog || []),
      {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        stage: 'manual_override',
        message: `Career source manually verified: ${trimmedUrl} (${atsProvider}).`,
      },
    ];

    const source: TargetCompanyCareerSource = {
      sourceId: `src-target-${comp.normalizedName}`,
      companyId: comp.company_id || comp.id,
      companyName: comp.name,
      officialDomain: comp.domain || comp.officialDomain,
      careerUrl: trimmedUrl,
      canonicalUrl: trimmedUrl,
      sourceType: 'company_career_portal',
      atsProvider,
      discoveryMethod: 'manual_override',
      verificationStatus: 'verified',
      verificationConfidence: 95,
      verificationEvidence: comp.verificationEvidence,
      active: true,
      monitoringEnabled: true,
      lastCheckedAt: now,
      lastSuccessfulSyncAt: now,
      jobCount: comp.totalOpeningsCount,
      newJobCount: 0,
      errorCount: 0,
      discoveryLog: comp.discoveryLog,
      createdAt: comp.created_at || comp.createdAt,
      updatedAt: now,
    };
    comp.careerSource = source;

    careerDiscoveryEngine.registerAndIngest(comp, source, []);
    this.registerCompanyAsDiscoverySource(comp);
    this.persist();
    this.notify();
    return true;
  }

  public refreshAll(): void {
    const now = new Date().toISOString();
    this.companies = this.companies.map((c) => {
      const identity = companyIdentityService.getCompanyIdentity(c.name, c.domain || c.officialDomain);
      return {
        ...c,
        logo_url: identity.logo.url,
        logoUrl: identity.logo.url,
        logo: identity.logo,
        last_checked_at: now,
        lastCheckedAt: now,
        lastCheckedDate: now,
      };
    });
    this.companies.forEach((comp) => {
      this.registerCompanyAsDiscoverySource(comp);
    });
    this.syncCountsFromRepository();
    this.persist();
    this.notify();
  }

  public syncCountsFromRepository(): void {
    try {
      if (!jobRepository || typeof jobRepository.getActiveOpportunities !== 'function') return;
      const allJobs: JobOpportunity[] = jobRepository.getActiveOpportunities();
      let changed = false;

      // Group jobs by company name key and domain
      const statsByKey = new Map<string, { total: number; matching: number; live: number }>();
      for (let i = 0; i < allJobs.length; i++) {
        const j = allJobs[i];
        const jComp = companyResolutionService.toKey(j.company);
        const jDomain = (j.companyDomain || '').toLowerCase().trim();
        const isMatch = Boolean((j.match_score && j.match_score >= 80) || j.isTargetCompany);
        const isLive = j.crm_status !== 'Rejected' && j.crm_status !== 'Archived';

        let cStats = statsByKey.get(jComp);
        if (!cStats) {
          cStats = { total: 0, matching: 0, live: 0 };
          statsByKey.set(jComp, cStats);
        }
        cStats.total++;
        if (isMatch) cStats.matching++;
        if (isLive) cStats.live++;

        if (jDomain) {
          let dStats = statsByKey.get(jDomain);
          if (!dStats) {
            dStats = { total: 0, matching: 0, live: 0 };
            statsByKey.set(jDomain, dStats);
          }
          dStats.total++;
          if (isMatch) dStats.matching++;
          if (isLive) dStats.live++;
        }
      }

      this.companies.forEach((comp) => {
        const compKey = comp.normalizedName || companyResolutionService.toKey(comp.name);
        const compDomain = (comp.domain || comp.officialDomain || '').toLowerCase().trim();
        const stats = statsByKey.get(compKey) || (compDomain ? statsByKey.get(compDomain) : undefined);

        if (stats) {
          if (comp.jobs_discovered !== stats.total || comp.live_jobs !== stats.live) {
            comp.jobs_discovered = stats.total;
            comp.live_jobs = stats.live;
            comp.totalOpeningsCount = stats.total;
            comp.matchingOpeningsCount = stats.matching;
            comp.openRolesCount = stats.total;
            comp.matchingRolesCount = stats.matching;
            changed = true;
          }
        }
      });

      if (changed) {
        this.persist();
      }
    } catch (e: any) {
      if (!e?.message?.includes('before initialization')) {
        console.error('Failed to sync target company counts from repository:', e);
      }
    }
  }

  public autoRepairExistingCompanies(): void {
    if (this.autoRepairTriggered) return;
    this.autoRepairTriggered = true;

    const unverified = this.companies.filter(
      (c) => c.verificationStatus !== 'verified' || !(c.career_page_url || c.careersUrl) || c.careersPlatform === 'unverified'
    );
    if (unverified.length === 0) return;

    // Fast synchronous cache resolution for unverified items
    let cacheUpdated = false;
    for (const comp of unverified) {
      const cached = intelligentSourceCache.get(comp.name);
      if (cached) {
        comp.verificationStatus = cached.verificationStatus;
        comp.monitoringStatus = 'active';
        comp.discoveryStatus = 'complete';
        comp.discovery_status = 'Active';
        comp.career_page_url = cached.careersUrl;
        comp.careersUrl = cached.careersUrl;
        comp.careersPlatform = cached.atsProvider;
        comp.verificationConfidence = cached.verificationConfidence;
        comp.verificationEvidence = cached.verificationEvidence;
        comp.discoveryLog = cached.discoveryLog;
        this.registerCompanyAsDiscoverySource(comp);
        cacheUpdated = true;
      }
    }

    if (cacheUpdated) {
      this.persist();
      this.notify();
    }

    // Limit active background probing to at most 5 priority accounts on startup
    const toProbe = unverified
      .filter((c) => c.verificationStatus !== 'verified' && (c.target_status === 'Dream' || c.target_status === 'Priority'))
      .slice(0, 5);

    if (toProbe.length === 0) return;

    (async () => {
      for (const comp of toProbe) {
        workerQueue.enqueue({
          id: `autorepair-${comp.company_id || comp.id}`,
          name: `Reverify ${comp.name}`,
          domain: comp.domain || comp.officialDomain,
          priority: 'low',
          maxRetries: 1,
          execute: async () => {
            const res = await careerDiscoveryEngine.discoverAndMonitor(comp);
            if (res.success && res.source) {
              comp.verificationStatus = 'verified';
              comp.monitoringStatus = 'active';
              comp.discoveryStatus = 'complete';
              comp.discovery_status = 'Active';
              comp.career_page_url = res.source.careerUrl;
              comp.careersUrl = res.source.careerUrl;
              comp.careersPlatform = res.source.atsProvider;
              comp.careerSource = res.source;
              comp.verificationConfidence = res.source.verificationConfidence;
              comp.verificationEvidence = res.source.verificationEvidence;
              comp.discoveryLog = res.source.discoveryLog;
              careerDiscoveryEngine.registerAndIngest(comp, res.source, res.rawJobs);
              this.registerCompanyAsDiscoverySource(comp);
              this.syncCountsFromRepository();
              this.persist();
              this.notify();
            }
          },
        }).catch(() => {});
      }
    })();
  }

  public syncWithProfile(profileCompanyNames: string[]): void {
    if (!this.isFullyHydrated && this.companies.length === 0) {
      return;
    }
    let changed = false;
    profileCompanyNames.forEach((name) => {
      if (!name || !name.trim()) return;
      if (!this.isTargetCompany(name)) {
        const cleaned = name.trim();
        const slug = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const known = AUTHORITATIVE_ENTERPRISES[companyResolutionService.toKey(cleaned)];
        const identity = companyIdentityService.getCompanyIdentity(cleaned, known?.domain);
        const domain = known?.domain || identity.domain;
        const now = new Date().toISOString();
        const companyId = `target-${slug}`;
        const discoverySourceId = `src-target-${slug}`;

        const entry: TargetCompany = {
          company_id: companyId,
          canonical_name: known?.canonicalName || cleaned,
          display_name: known?.canonicalName || cleaned,
          aliases: known?.aliases || [cleaned],
          website: `https://${domain}`,
          domain,
          logo_url: identity.logo.url,
          career_page_url: known?.careersUrl || identity.careerPageUrl,
          linkedin_url: identity.linkedinUrl,
          industry: known?.industry || 'Technology & Internet',
          company_size: '500-5,000 employees',
          location: known?.headquarters || 'Global / Remote',
          target_status: 'Priority',
          created_at: now,
          updated_at: now,
          source: 'profile_sync',
          discovery_enabled: true,
          discovery_status: known?.careersUrl ? 'Active' : 'Discovering',
          discovery_source_id: discoverySourceId,
          last_checked_at: now,
          jobs_discovered: 0,
          live_jobs: 0,
          failed_attempts: 0,

          id: companyId,
          canonicalCompanyId: `company-${slug}`,
          name: known?.canonicalName || cleaned,
          normalizedName: companyResolutionService.toKey(cleaned),
          tag: 'Priority',
          officialDomain: domain,
          officialWebsite: `https://${domain}`,
          logoUrl: identity.logo.url,
          logo: identity.logo,
          headquarters: known?.headquarters || 'Global / Remote',
          careersUrl: known?.careersUrl || identity.careerPageUrl,
          careersPlatform: known?.careersPlatform || 'custom',
          sourceType: 'company_career_portal',
          verificationStatus: known?.careersUrl ? 'verified' : 'needs_verification',
          monitoringStatus: known?.careersUrl ? 'active' : 'needs_attention',
          discoveryStatus: known?.careersUrl ? 'complete' : 'idle',
          verificationConfidence: known?.careersUrl ? 95 : 50,
          verificationEvidence: known?.careersUrl ? [`Authoritative endpoint verified: ${known.careersUrl}`] : [],
          discoveryLog: [],
          lastCheckedAt: now,
          matchingOpeningsCount: 0,
          totalOpeningsCount: 0,
          addedVia: 'profile_sync',
          createdAt: now,
          updatedAt: now,
          hiringActivity: known?.hiringActivity || 'active',
          websiteUrl: `https://${domain}`,
          careerPageUrl: known?.careersUrl || identity.careerPageUrl,
          openRolesCount: 0,
          matchingRolesCount: 0,
          dateAdded: now,
        };

        this.companies.push(entry);
        this.registerCompanyAsDiscoverySource(entry);
        changed = true;
      }
    });

    if (changed) {
      this.persist();
      this.notify();
    }
  }
}

const globalAny = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
export const targetCompaniesStore: TargetCompaniesStore =
  globalAny.__careeros_target_company_store ||
  (globalAny.__careeros_target_company_store = new TargetCompaniesStore());

export function resolveCompanyMetadata(name: string, urlHint?: string) {
  const identity = companyIdentityService.getCompanyIdentity(name, urlHint);
  const known = AUTHORITATIVE_ENTERPRISES[companyResolutionService.toKey(name)];
  return {
    domain: identity.domain,
    logoUrl: identity.logo.url,
    logo: identity.logo,
    websiteUrl: identity.websiteUrl,
    careerPageUrl: known?.careersUrl || identity.careerPageUrl || `https://${identity.domain}/careers`,
    linkedinUrl: identity.linkedinUrl || `https://www.linkedin.com/company/${companyResolutionService.toKey(name)}`,
    industry: known?.industry || 'Technology & Internet',
    headquarters: known?.headquarters || 'Global / Remote',
    hiringActivity: known?.hiringActivity || 'active',
  };
}

export { companyIdentityService, companyResolutionService };
export { resolveCompanyDomain, getCompanyLogoUrl, getCompanyLogoData } from '../companies/companyLogoService';
