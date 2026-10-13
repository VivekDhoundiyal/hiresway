import {
  CareersPlatformType,
  TargetCompanyVerificationStatus,
  DiscoveryLogEntry,
} from '../jobs/types';
import { perfMonitor } from '../perf/performanceMonitor';

export interface CachedSourceEntry {
  companyName: string;
  normalizedKey: string;
  officialDomain: string;
  careersUrl: string;
  canonicalUrl: string;
  atsProvider: CareersPlatformType;
  atsOrganizationId?: string;
  verificationStatus: TargetCompanyVerificationStatus;
  verificationConfidence: number;
  verificationEvidence: string[];
  discoveryLog: DiscoveryLogEntry[];
  lastVerifiedAt: string;
  cachedAt: number;
}

const STORAGE_KEY = 'careeros_verified_sources_cache_v1';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

class IntelligentSourceCache {
  private memoryCache: Map<string, CachedSourceEntry> = new Map();
  private isLoadedFromStorage = false;

  constructor() {
    this.loadFromStorage();
  }

  private normalizeKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private loadFromStorage(): void {
    if (this.isLoadedFromStorage) return;
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const list: CachedSourceEntry[] = JSON.parse(raw);
        const now = Date.now();
        list.forEach((item) => {
          // Only keep entries within TTL
          if (now - item.cachedAt < DEFAULT_TTL_MS * 7) {
            this.memoryCache.set(item.normalizedKey, item);
          }
        });
      }
      this.isLoadedFromStorage = true;
    } catch (e) {
      console.error('Failed to load source cache from storage:', e);
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const list = Array.from(this.memoryCache.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to persist source cache:', e);
    }
  }

  public get(companyName: string, maxAgeMs: number = DEFAULT_TTL_MS): CachedSourceEntry | null {
    this.loadFromStorage();
    const key = this.normalizeKey(companyName);
    const entry = this.memoryCache.get(key);

    if (entry) {
      const age = Date.now() - entry.cachedAt;
      if (age <= maxAgeMs) {
        perfMonitor.recordCacheHit('source');
        return entry;
      }
    }

    perfMonitor.recordCacheMiss('source');
    return null;
  }

  public set(entry: Omit<CachedSourceEntry, 'normalizedKey' | 'cachedAt'>): void {
    this.loadFromStorage();
    const normalizedKey = this.normalizeKey(entry.companyName);
    const fullEntry: CachedSourceEntry = {
      ...entry,
      normalizedKey,
      cachedAt: Date.now(),
    };
    this.memoryCache.set(normalizedKey, fullEntry);
    this.persist();
  }

  public invalidate(companyName: string): void {
    this.loadFromStorage();
    const key = this.normalizeKey(companyName);
    this.memoryCache.delete(key);
    this.persist();
  }

  public clear(): void {
    this.memoryCache.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }
}

export const intelligentSourceCache = new IntelligentSourceCache();
