/**
 * CareerOS Source Fingerprint Engine
 *
 * Structural Fingerprinting & Extraction Method Caching:
 * - Computes: domain + URL pattern + platform + HTTP behavior + job-schema pattern.
 * - If 100 URLs belong to the same ATS/platform pattern, learns the extraction method once and reuses it.
 * - Eliminates redundant discovery and expensive HTML parsing on known platform endpoints.
 */

import { JobSourceRegistryEntry } from '../types';

export type PlatformPatternType =
  | 'GREENHOUSE_API'
  | 'LEVER_API'
  | 'ASHBY_API'
  | 'WORKABLE_API'
  | 'SMARTRECRUITERS_API'
  | 'RSS_FEED'
  | 'STRUCTURED_SCHEMA_JSON_LD'
  | 'GENERIC_HTML_CAREER_PAGE'
  | 'UNKNOWN';

export interface ExtractionStrategy {
  patternType: PlatformPatternType;
  endpointTemplate?: string;
  expectedJobArrayKey?: string;
  fieldMapping: {
    id: string;
    title: string;
    company?: string;
    url: string;
    location?: string;
    description?: string;
    postedDate?: string;
    salary?: string;
  };
  supportsDirectPagination: boolean;
  rateLimitPerMinute: number;
}

const DEFAULT_STRATEGIES: Record<PlatformPatternType, ExtractionStrategy> = {
  GREENHOUSE_API: {
    patternType: 'GREENHOUSE_API',
    endpointTemplate: 'https://boards-api.greenhouse.io/v1/boards/{slug}/jobs',
    expectedJobArrayKey: 'jobs',
    fieldMapping: {
      id: 'id',
      title: 'title',
      url: 'absolute_url',
      location: 'location.name',
      description: 'content',
      postedDate: 'updated_at',
    },
    supportsDirectPagination: false,
    rateLimitPerMinute: 60,
  },
  LEVER_API: {
    patternType: 'LEVER_API',
    endpointTemplate: 'https://api.lever.co/v0/postings/{slug}?mode=json',
    expectedJobArrayKey: '', // Root is array
    fieldMapping: {
      id: 'id',
      title: 'text',
      url: 'hostedUrl',
      location: 'categories.location',
      description: 'description',
      postedDate: 'createdAt',
    },
    supportsDirectPagination: false,
    rateLimitPerMinute: 60,
  },
  ASHBY_API: {
    patternType: 'ASHBY_API',
    endpointTemplate: 'https://api.ashbyhq.com/posting-api/job-board/{slug}',
    expectedJobArrayKey: 'jobs',
    fieldMapping: {
      id: 'id',
      title: 'title',
      url: 'jobUrl',
      location: 'location',
      description: 'descriptionHtml',
      postedDate: 'publishedAt',
    },
    supportsDirectPagination: false,
    rateLimitPerMinute: 60,
  },
  WORKABLE_API: {
    patternType: 'WORKABLE_API',
    endpointTemplate: 'https://apply.workable.com/api/v1/widget/accounts/{slug}',
    expectedJobArrayKey: 'jobs',
    fieldMapping: {
      id: 'shortcode',
      title: 'title',
      url: 'url',
      location: 'location',
      description: 'description',
      postedDate: 'published_on',
    },
    supportsDirectPagination: false,
    rateLimitPerMinute: 60,
  },
  SMARTRECRUITERS_API: {
    patternType: 'SMARTRECRUITERS_API',
    endpointTemplate: 'https://api.smartrecruiters.com/v1/companies/{slug}/postings',
    expectedJobArrayKey: 'content',
    fieldMapping: {
      id: 'id',
      title: 'name',
      url: 'ref',
      location: 'location.city',
      postedDate: 'releasedDate',
    },
    supportsDirectPagination: true,
    rateLimitPerMinute: 60,
  },
  RSS_FEED: {
    patternType: 'RSS_FEED',
    fieldMapping: {
      id: 'guid',
      title: 'title',
      url: 'link',
      description: 'description',
      postedDate: 'pubDate',
    },
    supportsDirectPagination: false,
    rateLimitPerMinute: 30,
  },
  STRUCTURED_SCHEMA_JSON_LD: {
    patternType: 'STRUCTURED_SCHEMA_JSON_LD',
    fieldMapping: {
      id: '@id',
      title: 'title',
      url: 'url',
      company: 'hiringOrganization.name',
      location: 'jobLocation.address.addressLocality',
      description: 'description',
      postedDate: 'datePosted',
    },
    supportsDirectPagination: false,
    rateLimitPerMinute: 30,
  },
  GENERIC_HTML_CAREER_PAGE: {
    patternType: 'GENERIC_HTML_CAREER_PAGE',
    fieldMapping: {
      id: 'href',
      title: 'text',
      url: 'href',
    },
    supportsDirectPagination: false,
    rateLimitPerMinute: 20,
  },
  UNKNOWN: {
    patternType: 'UNKNOWN',
    fieldMapping: {
      id: 'id',
      title: 'title',
      url: 'url',
    },
    supportsDirectPagination: false,
    rateLimitPerMinute: 15,
  },
};

export class SourceFingerprintEngine {
  private learnedPatternCache: Map<string, ExtractionStrategy> = new Map();

  constructor() {
    // Seed default strategies
    for (const [key, strat] of Object.entries(DEFAULT_STRATEGIES)) {
      this.learnedPatternCache.set(key, strat);
    }
  }

  /**
   * Generates a deterministic structural fingerprint for a source or URL.
   */
  public generateFingerprint(source: {
    domain?: string;
    endpointUrl?: string;
    atsType?: string;
    sourceType?: string;
  }): string {
    const domain = (source.domain || '').toLowerCase().replace(/^www\./, '');
    const url = (source.endpointUrl || '').toLowerCase();
    const ats = (source.atsType || '').toLowerCase();

    // Check platform signature
    if (ats === 'greenhouse' || domain.includes('greenhouse.io') || url.includes('greenhouse.io')) {
      return `GREENHOUSE_API::${domain}`;
    }
    if (ats === 'lever' || domain.includes('lever.co') || url.includes('lever.co')) {
      return `LEVER_API::${domain}`;
    }
    if (ats === 'ashby' || domain.includes('ashbyhq.com') || url.includes('ashbyhq.com')) {
      return `ASHBY_API::${domain}`;
    }
    if (ats === 'workable' || domain.includes('workable.com') || url.includes('workable.com')) {
      return `WORKABLE_API::${domain}`;
    }
    if (ats === 'smartrecruiters' || domain.includes('smartrecruiters.com') || url.includes('smartrecruiters.com')) {
      return `SMARTRECRUITERS_API::${domain}`;
    }
    if (url.endsWith('.rss') || url.endsWith('.xml') || url.includes('/feed')) {
      return `RSS_FEED::${domain}`;
    }

    return `WEB::${domain || 'generic'}`;
  }

  /**
   * Resolves the optimal extraction strategy for a source.
   */
  public resolveStrategy(source: JobSourceRegistryEntry): ExtractionStrategy {
    const ats = (source.atsType || '').toLowerCase();
    if (ats === 'greenhouse') return DEFAULT_STRATEGIES.GREENHOUSE_API;
    if (ats === 'lever') return DEFAULT_STRATEGIES.LEVER_API;
    if (ats === 'ashby') return DEFAULT_STRATEGIES.ASHBY_API;
    if (ats === 'workable') return DEFAULT_STRATEGIES.WORKABLE_API;
    if (ats === 'smartrecruiters') return DEFAULT_STRATEGIES.SMARTRECRUITERS_API;

    const fp = this.generateFingerprint(source);
    if (this.learnedPatternCache.has(fp)) {
      return this.learnedPatternCache.get(fp)!;
    }

    if (fp.startsWith('GREENHOUSE')) return DEFAULT_STRATEGIES.GREENHOUSE_API;
    if (fp.startsWith('LEVER')) return DEFAULT_STRATEGIES.LEVER_API;
    if (fp.startsWith('ASHBY')) return DEFAULT_STRATEGIES.ASHBY_API;
    if (fp.startsWith('WORKABLE')) return DEFAULT_STRATEGIES.WORKABLE_API;
    if (fp.startsWith('SMARTRECRUITERS')) return DEFAULT_STRATEGIES.SMARTRECRUITERS_API;
    if (fp.startsWith('RSS')) return DEFAULT_STRATEGIES.RSS_FEED;

    return DEFAULT_STRATEGIES.GENERIC_HTML_CAREER_PAGE;
  }

  /**
   * Records a successfully learned extraction pattern for reuse across similar domains.
   */
  public learnStrategy(fingerprint: string, strategy: ExtractionStrategy): void {
    this.learnedPatternCache.set(fingerprint, strategy);
  }

  /**
   * Extracts clean company slug from domain or URL.
   */
  public extractSlug(source: JobSourceRegistryEntry): string {
    if (source.domain) {
      const parts = source.domain.split('.');
      if (parts.length > 0 && parts[0] !== 'www') return parts[0].toLowerCase();
      if (parts.length > 1) return parts[1].toLowerCase();
    }
    return source.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}

export const sourceFingerprintEngine = new SourceFingerprintEngine();
