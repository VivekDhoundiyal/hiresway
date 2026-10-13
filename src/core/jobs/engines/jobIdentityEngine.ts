/**
 * CareerOS Job Identity Engine
 *
 * Canonical Job Identity Algorithm combining:
 * - Canonical URL (tracking stripped)
 * - Cleaned entity employer name (legal suffixes stripped)
 * - Normalized title (seniority strictly preserved, location qualifiers stripped)
 * - Normalized location (country/city/remote)
 * - Requisition / External source ID
 * - Content / Description shingle fingerprint
 */

import { sourceTruthEngine } from './sourceTruthEngine';

export interface JobCanonicalIdentity {
  fingerprint: string;
  companyTitleKey: string;
  companyTitleLocKey: string;
  requisitionKey?: string;
  canonicalUrl: string;
  descriptionTokens: string[];
}

export class JobIdentityEngine {
  /**
   * Normalizes strings by lowercasing, stripping punctuation, and trimming spaces.
   */
  public normalizeString(str: unknown): string {
    if (typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Cleans company names by removing legal entity suffixes (Inc, LLC, Corp, Ltd, Pvt, Technologies, etc.)
   */
  public cleanCompanyName(company: string): string {
    return this.normalizeString(company)
      .replace(
        /\b(inc|incorporated|llc|corp|corporation|ltd|limited|pvt|private|technologies|technology|tech|solutions|systems|group|holdings)\b/gi,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes titles by stripping regional/location noise while strictly preserving seniority.
   */
  public normalizeTitle(title: string): string {
    return this.normalizeString(title)
      .replace(
        /\b(india|worldwide|remote|us|usa|emea|apac|uk|singapore|bangalore|bengaluru|sf|san francisco|london|berlin|germany|remote-first)\b/gi,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes locations (e.g. Remote vs Bangalore vs London).
   */
  public normalizeLocation(location?: string): string {
    if (!location) return '';
    const norm = this.normalizeString(location);
    if (norm.includes('remote') || norm.includes('worldwide') || norm.includes('wfa')) {
      return 'remote';
    }
    return norm;
  }

  /**
   * Generates a deterministic fingerprint for deduplication.
   */
  public generateJobFingerprint(
    companyOrJob: string | { company?: string; title?: string; location?: string; requisitionId?: string },
    titleArg?: string,
    locationArg?: string,
    requisitionIdArg?: string
  ): string {
    let company = '';
    let title = '';
    let location = '';
    let requisitionId: string | undefined;

    if (typeof companyOrJob === 'object' && companyOrJob !== null) {
      company = companyOrJob.company || '';
      title = companyOrJob.title || '';
      location = companyOrJob.location || '';
      requisitionId = companyOrJob.requisitionId;
    } else {
      company = typeof companyOrJob === 'string' ? companyOrJob : '';
      title = titleArg || '';
      location = locationArg || '';
      requisitionId = requisitionIdArg;
    }

    const normComp = this.cleanCompanyName(company);
    const normTitle = this.normalizeTitle(title);
    const normLoc = this.normalizeLocation(location);

    if (requisitionId && requisitionId.trim().length > 3) {
      return `${normComp}::${requisitionId.trim().toLowerCase()}`;
    }

    return `${normComp}::${normTitle}::${normLoc}`;
  }

  /**
   * Tokenizes text into distinct content shingles for Jaccard similarity.
   */
  public extractContentTokens(text?: string): string[] {
    if (!text || typeof text !== 'string') return [];
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3);
    return Array.from(new Set(words));
  }

  /**
   * Computes full canonical identity structure for a job record.
   */
  public computeCanonicalIdentity(job: {
    company?: string;
    title?: string;
    location?: string;
    applyUrl?: string;
    jobUrl?: string;
    requisitionId?: string;
    externalId?: string;
    description?: string;
  }): JobCanonicalIdentity {
    const company = job.company || '';
    const title = job.title || '';
    const location = job.location || '';
    const reqId = job.requisitionId || job.externalId;

    const normComp = this.cleanCompanyName(company);
    const normTitle = this.normalizeTitle(title);
    const normLoc = this.normalizeLocation(location);

    const companyTitleKey = `${normComp}::${normTitle}`;
    const companyTitleLocKey = `${normComp}::${normTitle}::${normLoc}`;
    const requisitionKey = reqId && reqId.trim().length > 2 ? `${normComp}::${reqId.trim().toLowerCase()}` : undefined;

    const rawUrl = job.applyUrl || job.jobUrl || '';
    const canonicalUrl = sourceTruthEngine.getCanonicalUrl(rawUrl);
    const fingerprint = requisitionKey || companyTitleLocKey;
    const descriptionTokens = this.extractContentTokens(job.description);

    return {
      fingerprint,
      companyTitleKey,
      companyTitleLocKey,
      requisitionKey,
      canonicalUrl,
      descriptionTokens,
    };
  }
}

export const jobIdentityEngine = new JobIdentityEngine();
