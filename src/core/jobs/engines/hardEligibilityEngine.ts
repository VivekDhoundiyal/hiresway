/**
 * CareerOS Hard Eligibility Engine
 *
 * Implements strict pre-feed qualification gating (Section 5 & 6).
 * Irrelevant, stale, broken, or excluded jobs are REJECTED before reaching the Active Feed.
 *
 * Rejected jobs are tagged with explicit rejection reasons and stored in the database
 * with lifecycleState = 'HISTORICAL' for transparency and diagnostics ("Why was this rejected?").
 */

import { JobOpportunity, RawDiscoveredJob } from '../types';
import { SearchConfiguration } from '../searchConfiguration';
import { freshnessEngine } from './freshnessEngine';
import { roleTaxonomyEngine } from './roleTaxonomyEngine';
import { locationFilterEngine } from './locationFilterEngine';
import { sourceTruthEngine } from './sourceTruthEngine';
import { jobVerificationEngine } from '../jobVerificationEngine';

export type HardEligibilityRejectionCode =
  | 'STALE_JOB'
  | 'ROLE_MISMATCH'
  | 'CAREER_DIRECTION_MISMATCH'
  | 'EXCLUDED_ROLE'
  | 'LOCATION_MISMATCH'
  | 'REMOTE_SCOPE_MISMATCH'
  | 'WORKPLACE_MISMATCH'
  | 'EXPERIENCE_MISMATCH'
  | 'EMPLOYMENT_TYPE_MISMATCH'
  | 'INVALID_APPLICATION_URL'
  | 'LOW_RELEVANCE'
  | 'INSUFFICIENT_JOB_DATA'
  | 'DUPLICATE'
  | 'QUARANTINED_SOURCE';

export interface HardEligibilityResult {
  eligible: boolean;
  rejectionCode?: HardEligibilityRejectionCode;
  rejectionReason?: string;
  rejectionExplanation?: string;
}

export class HardEligibilityEngine {
  /**
   * Evaluates whether a job satisfies all Hard Eligibility requirements.
   * If any requirement fails, returns eligible: false with exact rejection code and explanation.
   */
  public evaluateEligibility(
    job: JobOpportunity | Partial<JobOpportunity> | RawDiscoveredJob,
    searchConfig: SearchConfiguration,
    options?: { broadDiscovery?: boolean }
  ): HardEligibilityResult {
    const isBroadDiscovery = Boolean(options?.broadDiscovery);

    // -------------------------------------------------------------------------
    // 1. DATA SUFFICIENCY CHECK (Real company, identifiable title)
    // -------------------------------------------------------------------------
    const title = (job.title || '').trim();
    const company = (job.company || '').trim();

    if (!title || !company) {
      return {
        eligible: false,
        rejectionCode: 'INSUFFICIENT_JOB_DATA',
        rejectionReason: 'Missing job title or company name schema',
        rejectionExplanation: 'The discovered record is missing mandatory title or company metadata.',
      };
    }

    if (company.length < 2 || title.length < 3) {
      return {
        eligible: false,
        rejectionCode: 'INSUFFICIENT_JOB_DATA',
        rejectionReason: 'Invalid or placeholder company/title',
        rejectionExplanation: `"${company}" or "${title}" appears to be a truncated placeholder.`,
      };
    }

    // -------------------------------------------------------------------------
    // 2. VALID APPLICATION URL CHECK
    // -------------------------------------------------------------------------
    const rawUrl = (job as any).canonicalUrl || (job as any).applyUrl || (job as any).jobUrl || (job as any).url;
    if (!rawUrl || rawUrl === '#' || !rawUrl.startsWith('http')) {
      return {
        eligible: false,
        rejectionCode: 'INVALID_APPLICATION_URL',
        rejectionReason: 'Missing or malformed application URL',
        rejectionExplanation: 'Job does not provide a valid, actionable application destination.',
      };
    }

    if (sourceTruthEngine.isUrlQuarantined(rawUrl)) {
      return {
        eligible: false,
        rejectionCode: 'INVALID_APPLICATION_URL',
        rejectionReason: 'Application URL is quarantined due to dead/404 endpoint',
        rejectionExplanation: 'The apply destination previously returned 404 or dead page signatures.',
      };
    }

    // Check dead job signatures in description or page
    const deadCheck = jobVerificationEngine.checkDeadJobSignatures(job as any);
    if (deadCheck.isDead) {
      return {
        eligible: false,
        rejectionCode: 'INVALID_APPLICATION_URL',
        rejectionReason: deadCheck.reason || 'Dead job posting signature detected',
        rejectionExplanation: 'The posting contains expired, closed, or dead page indicators.',
      };
    }

    // -------------------------------------------------------------------------
    // 3. STRICT 14-DAY RETENTION & FRESHNESS GATE (originalPostedAt <= 14 Days)
    // -------------------------------------------------------------------------
    // In broad discovery mode, live discovered ATS vacancies are retained in the feed
    // for 14 days from firstSeenAt. In strict role gate mode, maxAge applies to postedDate.
    const isTargetCo = Boolean((job as any).isTargetCompany);
    const maxAge = searchConfig.maxAgeDays || 14;
    const freshCheck = freshnessEngine.isJobWithinAgeWindow(job as any, maxAge);
    if (!freshCheck.eligible && !isTargetCo && !isBroadDiscovery) {
      return {
        eligible: false,
        rejectionCode: 'STALE_JOB',
        rejectionReason: freshCheck.reason || `Job posting age exceeds ${maxAge} days`,
        rejectionExplanation: `Posted ${freshCheck.ageDays != null ? `${freshCheck.ageDays.toFixed(1)} days ago` : 'at unknown date'}. Core Feed Rule strictly requires original posting date <= ${maxAge} days.`,
      };
    }

    // -------------------------------------------------------------------------
    // 4. NEGATIVE CAREER SIGNALS & EXCLUDED ROLES (Section 10)
    // -------------------------------------------------------------------------
    const desc = (job as any).description || '';
    const negCheck = roleTaxonomyEngine.isExcludedNegativeRole(title, desc, searchConfig.excludedRoles);
    if (negCheck.isExcluded) {
      return {
        eligible: false,
        rejectionCode: 'EXCLUDED_ROLE',
        rejectionReason: negCheck.reason || 'Matches negative career signals',
        rejectionExplanation: `Role "${title}" was excluded by profile negative signal filters (${negCheck.reason}).`,
      };
    }

    // Explicit excluded companies
    if (searchConfig.excludedCompanies && searchConfig.excludedCompanies.length > 0) {
      const compLower = company.toLowerCase();
      if (searchConfig.excludedCompanies.some((c) => compLower.includes(c.toLowerCase()))) {
        return {
          eligible: false,
          rejectionCode: 'EXCLUDED_ROLE',
          rejectionReason: `Company "${company}" is in user excluded companies list`,
          rejectionExplanation: `Candidate explicitly excluded ${company} from active opportunities.`,
        };
      }
    }

    // In broad discovery intake, active vacancies are admitted into inventory and scored
    // transparently via relevance ranking, rather than being discarded at discovery time.
    if (isBroadDiscovery) {
      return {
        eligible: true,
      };
    }

    // -------------------------------------------------------------------------
    // 5. ROLE & CAREER DIRECTION FIT (Section 8 & 9)
    // -------------------------------------------------------------------------
    // Must match either primary, secondary, or adjacent roles in taxonomy
    const allAllowedRoles = [
      ...searchConfig.primaryRoles,
      ...searchConfig.secondaryRoles,
      ...searchConfig.adjacentRoles,
    ];

    const roleMatch = roleTaxonomyEngine.matchesRoleCriteria(title, allAllowedRoles);

    // If completely unmatched by taxonomy and no role token overlap
    if ((!roleMatch.matches || roleMatch.score < 40) && !isTargetCo) {
      return {
        eligible: false,
        rejectionCode: 'ROLE_MISMATCH',
        rejectionReason: `Role title "${title}" does not align with candidate target, secondary, or adjacent roles`,
        rejectionExplanation: `"${title}" has no semantic overlap with candidate career direction (${searchConfig.primaryRoles.slice(0, 3).join(', ')}).`,
      };
    }

    // -------------------------------------------------------------------------
    // 6. LOCATION & REMOTE ELIGIBILITY (Sections 13-16: Semantic OR within Location)
    // -------------------------------------------------------------------------
    const locResult = locationFilterEngine.evaluateEligibility(
      job as any,
      searchConfig.locations,
      searchConfig.workplaceTypes
    );

    if (!locResult.eligible) {
      const isRemoteScopeIssue =
        locResult.reason.toLowerCase().includes('remote') ||
        locResult.reason.toLowerCase().includes('country-restricted');
      return {
        eligible: false,
        rejectionCode: isRemoteScopeIssue ? 'REMOTE_SCOPE_MISMATCH' : 'LOCATION_MISMATCH',
        rejectionReason: locResult.reason,
        rejectionExplanation: `Location "${(job as any).location || 'Unknown'}" does not meet target location criteria (${searchConfig.locations.join(' OR ')}).`,
      };
    }

    // -------------------------------------------------------------------------
    // 7. EXPERIENCE COMPATIBILITY (Extreme mismatch check)
    // -------------------------------------------------------------------------
    const jobMinExp = (job as any).minExperienceYears;
    if (jobMinExp !== undefined && jobMinExp !== null) {
      // If job requires 15+ years experience and candidate is mid/lead (8 years), or vice-versa
      if (jobMinExp >= 15) {
        return {
          eligible: false,
          rejectionCode: 'EXPERIENCE_MISMATCH',
          rejectionReason: `Job requires ${jobMinExp}+ years experience (executive overstretch)`,
          rejectionExplanation: `Executive role requiring ${jobMinExp} years experience exceeds target seniority.`,
        };
      }
    }

    // -------------------------------------------------------------------------
    // 8. EMPLOYMENT TYPE (Full-time / Contract)
    // -------------------------------------------------------------------------
    const empType = ((job as any).employmentType || 'full-time').toLowerCase();
    if (searchConfig.employmentTypes && searchConfig.employmentTypes.length > 0) {
      const allowed = searchConfig.employmentTypes.map((t) => t.toLowerCase());
      if (empType === 'internship' && !allowed.includes('internship')) {
        return {
          eligible: false,
          rejectionCode: 'EMPLOYMENT_TYPE_MISMATCH',
          rejectionReason: 'Internship role excluded by candidate full-time preference',
          rejectionExplanation: 'Candidate seeks permanent full-time/contract employment, not student internships.',
        };
      }
    }

    return {
      eligible: true,
    };
  }
}

export const hardEligibilityEngine = new HardEligibilityEngine();
