/**
 * CareerOS Source Truth Engine
 *
 * Source-Truth Validator for every job URL.
 * Pipeline: DISCOVER → FETCH → VALIDATE → EXTRACT → NORMALIZE → DEDUPE → SCORE → FEED
 *
 * A job enters the feed ONLY if:
 * - URL is reachable and well-formed
 * - Page is a real job/listing page (not generic homepage or search index)
 * - Job title and company can be extracted and verified
 * - Listing is still active (not closed, expired, or filled)
 * - Source is not a dead/404/expired page
 * - Canonical URL is valid and non-quarantined
 */

import { RawDiscoveredJob, JobOpportunity } from '../types';

export const RECOGNIZED_LEGITIMATE_DOMAINS = [
  'coursera.org',
  'greenhouse.io',
  'job-boards.greenhouse.io',
  'boards.greenhouse.io',
  'lever.co',
  'jobs.lever.co',
  'ashbyhq.com',
  'jobs.ashbyhq.com',
  'workable.com',
  'apply.workable.com',
  'smartrecruiters.com',
  'jobs.smartrecruiters.com',
  'myworkdayjobs.com',
  'bamboohr.com',
  'icims.com',
  'recruitee.com',
  'rippling-ats.com',
  'stripe.com',
  'datadoghq.com',
  'careers.datadoghq.com',
  'figma.com',
  'linear.app',
  'supabase.com',
  'notion.so',
  'openai.com',
  'anthropic.com',
  'cloudflare.com',
  'elastic.co',
  'gitlab.com',
  'shopify.com',
  'inmobi.com',
  'cred.club',
  'meesho.com',
  'swiggy.com',
  'careers.swiggy.com',
  'zeptonow.com',
  'razorpay.com',
  'postman.com',
  'phonepe.com',
  'freshworks.com',
  'vercel.com',
  'github.com',
  'automattic.com',
  'grafana.com',
  'sourcegraph.com',
  'mozilla.org',
  'airtable.com',
  'retool.com',
  'ramp.com',
  'deel.com',
  'canal.co',
  'shopcanal.com',
  'jobicy.com',
  'remoteok.com',
  'weworkremotely.com',
  'himalayas.app',
];

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'referrer',
  'ref_id',
  'fbclid',
  'gclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'trk',
  'trackingid',
  'src',
  'gh_src',
  'lever-source',
  'lever-origin',
  'ashby_jid',
  'error',
];

const DEAD_JOB_SIGNATURES = [
  'page not found',
  'the job board you were viewing is no longer active',
  'job board you were viewing is no longer active',
  'job board is no longer active',
  'job is no longer active',
  'job no longer active',
  'position no longer available',
  'position has been closed',
  'job has been closed',
  'this job has been closed',
  'this job is no longer accepting applications',
  'no longer accepting applications',
  'this position has been filled',
  'position has been filled',
  'requisition has been filled',
  'this vacancy is closed',
  'vacancy has been closed',
  'vacancy has been filled',
  'posting has expired',
  'job posting has expired',
  'job has expired',
  'listing has expired',
  '404 not found',
  'error 404',
  'the job you are looking for is no longer available',
];

export interface QuarantinedUrlRecord {
  url: string;
  reason: string;
  quarantinedAt: string;
}

export interface SourceTruthValidationResult {
  isValid: boolean;
  canonicalUrl: string;
  failureReason?: string;
  isQuarantined?: boolean;
}

const QUARANTINE_STORAGE_KEY = 'careeros_quarantined_urls_v1';

export class SourceTruthEngine {
  private quarantinedUrls: Map<string, QuarantinedUrlRecord> = new Map();

  constructor() {
    this.loadQuarantine();
  }

  private loadQuarantine(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(QUARANTINE_STORAGE_KEY);
        if (stored) {
          const list: QuarantinedUrlRecord[] = JSON.parse(stored);
          list.forEach((item) => this.quarantinedUrls.set(this.getCanonicalUrl(item.url), item));
        }
      }
    } catch {}
  }

  private saveQuarantine(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const list = Array.from(this.quarantinedUrls.values());
        localStorage.setItem(QUARANTINE_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {}
  }

  /**
   * Normalizes a raw URL into a clean canonical URL:
   * - Strips all tracking/UTM parameters
   * - Strips tracking hash fragments
   * - Lowercases domain
   * - Strips trailing slash
   */
  public getCanonicalUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed);
      parsed.hostname = parsed.hostname.toLowerCase();
      parsed.hash = '';

      for (const p of TRACKING_PARAMS) {
        parsed.searchParams.delete(p);
      }

      let pathname = parsed.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      parsed.pathname = pathname;

      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  /**
   * Validates application URL destination.
   * Rejects empty, dead, '#', localhost, or fake domains, generic career roots, and search pages.
   */
  public verifyJobUrl(url: string | undefined): { isValid: boolean; cleanUrl: string; reason?: string } {
    if (!url || typeof url !== 'string' || url.trim() === '' || url.trim() === '#') {
      return { isValid: false, cleanUrl: '', reason: 'Application URL is missing or placeholder #' };
    }

    const trimmed = url.trim();

    if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
      return { isValid: false, cleanUrl: '', reason: 'Invalid URL protocol' };
    }

    try {
      const parsed = new URL(trimmed);
      const hostname = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();

      // Block placeholder or test hosts
      if (
        hostname === 'example.com' ||
        hostname.endsWith('.example.com') ||
        hostname === 'fake.url' ||
        hostname === 'placeholder.io' ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1'
      ) {
        return { isValid: false, cleanUrl: '', reason: 'Placeholder or simulated domain' };
      }

      // Block generic roots and career indexes missing specific requisition
      const isGenericRoot = pathname === '' || pathname === '/' || pathname === '/index.html';
      const isGenericCareersIndex =
        pathname === '/careers' ||
        pathname === '/careers/' ||
        pathname === '/jobs' ||
        pathname === '/jobs/' ||
        pathname === '/open-positions' ||
        pathname === '/openings';
      const isSearchPage =
        pathname.includes('/search') ||
        parsed.search.includes('query=') ||
        parsed.search.includes('q=') ||
        parsed.search.includes('keyword=');

      if (isGenericRoot) {
        return {
          isValid: false,
          cleanUrl: '',
          reason: 'Generic company homepage, not a specific job requisition',
        };
      }

      if (isGenericCareersIndex && !parsed.hash && !parsed.search) {
        return {
          isValid: false,
          cleanUrl: '',
          reason: 'Generic careers portal index without specific job requisition ID',
        };
      }

      if (isSearchPage) {
        return {
          isValid: false,
          cleanUrl: '',
          reason: 'Generic search results page instead of specific job posting',
        };
      }

      // Check for ATS error redirects (e.g. ?error=true on Greenhouse when job is expired/closed)
      if (parsed.searchParams.get('error') === 'true' || parsed.search.includes('error=true')) {
        return {
          isValid: false,
          cleanUrl: '',
          reason: 'Application URL redirected to job board error page (?error=true)',
        };
      }

      const isRecognized = RECOGNIZED_LEGITIMATE_DOMAINS.some(
        (legit) => hostname === legit || hostname.endsWith(`.${legit}`)
      );

      if (!isRecognized) {
        // Custom employer domain requires identifiable path
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length < 2 && !pathname.includes('job') && !pathname.includes('career')) {
          return {
            isValid: false,
            cleanUrl: '',
            reason: 'URL lacks identifiable job posting requisition path',
          };
        }
      }

      const clean = this.getCanonicalUrl(trimmed);
      if (this.isUrlQuarantined(clean)) {
        return {
          isValid: false,
          cleanUrl: clean,
          reason: `URL is in quarantine: ${this.quarantinedUrls.get(clean)?.reason || 'Previously detected dead'}`,
        };
      }

      return { isValid: true, cleanUrl: clean };
    } catch {
      return { isValid: false, cleanUrl: '', reason: 'Malformed URL' };
    }
  }

  /**
   * Detects dead job markers, HTTP status errors, and closed/expired listings.
   */
  public checkDeadJobSignatures(job: RawDiscoveredJob | JobOpportunity | Partial<JobOpportunity>): {
    isDead: boolean;
    reason?: string;
    status: 'VERIFIED_DEAD' | 'VERIFIED_CLOSED' | 'VERIFICATION_FAILED' | 'BLOCKED' | null;
  } {
    if (!job) {
      return { isDead: true, status: 'VERIFIED_DEAD', reason: 'Empty or undefined job record' };
    }

    // 1. Evidence HTTP status
    const evidence = (job as any).verification_evidence || (job as any).verificationEvidence;
    const httpStatus = evidence?.httpStatus;
    if (httpStatus) {
      if (httpStatus === 404 || httpStatus === 410) {
        return {
          isDead: true,
          status: 'VERIFIED_DEAD',
          reason: `HTTP ${httpStatus}: Requisition page not found or permanently removed`,
        };
      }
      if (httpStatus === 403) {
        return {
          isDead: true,
          status: 'BLOCKED',
          reason: 'HTTP 403: Application destination access forbidden',
        };
      }
      if (httpStatus === 429) {
        return {
          isDead: true,
          status: 'BLOCKED',
          reason: 'HTTP 429: Destination rate limit exceeded',
        };
      }
      if (httpStatus >= 500) {
        return {
          isDead: true,
          status: 'VERIFICATION_FAILED',
          reason: `HTTP ${httpStatus}: Destination server error`,
        };
      }
    }

    // 2. Lifecycle check
    if ('lifecycleState' in job && job.lifecycleState) {
      if (job.lifecycleState === 'CLOSED') {
        return { isDead: true, status: 'VERIFIED_CLOSED', reason: 'Job marked CLOSED by employer' };
      }
      if (
        job.lifecycleState === 'EXPIRED' ||
        job.lifecycleState === 'REJECTED' ||
        job.lifecycleState === 'ARCHIVED'
      ) {
        return { isDead: true, status: 'VERIFIED_DEAD', reason: `Job marked ${job.lifecycleState}` };
      }
    }

    // 3. Verification status check
    if ('verificationStatus' in job && job.verificationStatus) {
      if (job.verificationStatus === 'job_closed') {
        return { isDead: true, status: 'VERIFIED_CLOSED', reason: 'Posting marked closed by employer' };
      }
      if (
        job.verificationStatus === 'link_broken' ||
        job.verificationStatus === 'expired' ||
        job.verificationStatus === 'removed' ||
        job.verificationStatus === 'expired_removed' ||
        job.verificationStatus === 'failed'
      ) {
        return { isDead: true, status: 'VERIFIED_DEAD', reason: `Verification status is ${job.verificationStatus}` };
      }
    }

    // 4. Redirect check
    if (evidence?.redirectDetected && evidence?.finalUrl) {
      const redirectCheck = this.verifyJobUrl(evidence.finalUrl);
      if (!redirectCheck.isValid) {
        return {
          isDead: true,
          status: 'VERIFIED_DEAD',
          reason: `Redirected to invalid destination (${redirectCheck.reason || evidence.finalUrl})`,
        };
      }
    }

    // 4b. Check for error parameters in URLs (e.g. ?error=true on Greenhouse)
    const testUrl = (job as any).applyUrl || (job as any).jobUrl || (job as any).canonicalUrl || '';
    if (typeof testUrl === 'string' && (testUrl.includes('?error=true') || testUrl.includes('&error=true'))) {
      return {
        isDead: true,
        status: 'VERIFIED_DEAD',
        reason: 'Application URL redirected to job board error page (?error=true)',
      };
    }

    // 5. Content text signatures
    const contentToCheck = [
      job.title,
      job.description,
      evidence?.rawExcerpt,
      evidence?.pageTitle,
    ]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' ')
      .toLowerCase();

    for (const sig of DEAD_JOB_SIGNATURES) {
      if (contentToCheck.includes(sig)) {
        return {
          isDead: true,
          status: sig.includes('closed') || sig.includes('filled') ? 'VERIFIED_CLOSED' : 'VERIFIED_DEAD',
          reason: `Dead job signature detected: "${sig}"`,
        };
      }
    }

    return { isDead: false, status: null };
  }

  /**
   * Complete Source Truth Validator.
   * Validates title, employer, reachability, active listing, and non-quarantined status.
   */
  public validateJob(job: RawDiscoveredJob | JobOpportunity): SourceTruthValidationResult {
    const rawUrl = 'applyUrl' in job && job.applyUrl ? job.applyUrl : job.jobUrl;
    const urlCheck = this.verifyJobUrl(rawUrl);

    if (!urlCheck.isValid) {
      return {
        isValid: false,
        canonicalUrl: urlCheck.cleanUrl || this.getCanonicalUrl(rawUrl || ''),
        failureReason: urlCheck.reason || 'Invalid application destination',
      };
    }

    const deadCheck = this.checkDeadJobSignatures(job);
    if (deadCheck.isDead) {
      // Automatically quarantine the dead URL
      this.quarantineUrl(urlCheck.cleanUrl, deadCheck.reason || 'Dead listing signature');
      return {
        isValid: false,
        canonicalUrl: urlCheck.cleanUrl,
        failureReason: deadCheck.reason || 'Job is dead or closed',
        isQuarantined: true,
      };
    }

    if (!job.title || job.title.trim().length < 3) {
      return {
        isValid: false,
        canonicalUrl: urlCheck.cleanUrl,
        failureReason: 'Missing or corrupted job title',
      };
    }

    if (!job.company || job.company.trim().length < 2) {
      return {
        isValid: false,
        canonicalUrl: urlCheck.cleanUrl,
        failureReason: 'Missing or corrupted company name',
      };
    }

    return {
      isValid: true,
      canonicalUrl: urlCheck.cleanUrl,
    };
  }

  public quarantineUrl(url: string, reason: string): void {
    if (!url) return;
    const clean = this.getCanonicalUrl(url);
    this.quarantinedUrls.set(clean, {
      url: clean,
      reason,
      quarantinedAt: new Date().toISOString(),
    });
    this.saveQuarantine();
  }

  public unquarantineUrl(url: string): void {
    const clean = this.getCanonicalUrl(url);
    this.quarantinedUrls.delete(clean);
    this.saveQuarantine();
  }

  public isUrlQuarantined(url: string): boolean {
    const clean = this.getCanonicalUrl(url);
    return this.quarantinedUrls.has(clean);
  }

  public getQuarantinedUrls(): QuarantinedUrlRecord[] {
    return Array.from(this.quarantinedUrls.values());
  }

  public clearQuarantine(): void {
    this.quarantinedUrls.clear();
    this.saveQuarantine();
  }
}

export const sourceTruthEngine = new SourceTruthEngine();
