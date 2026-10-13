/**
 * CareerOS Location Filter & Semantic Eligibility Engine
 *
 * Implements strict semantic OR logic for location matching:
 * - A. INDIA: Jobs specifically available in India.
 * - B. WORLDWIDE REMOTE: Jobs explicitly allowing applicants/workers from anywhere in the world.
 * - C. GLOBAL / ANYWHERE: Normalizes equivalent source terminology
 *      (Worldwide, Global, Anywhere, Work from anywhere, Remote - Worldwide, Remote anywhere,
 *       Location independent, Distributed worldwide) into canonical 'Worldwide Remote'.
 * - D. REMOTE - INDIA: Jobs specifically allowing remote workers located in India.
 * - E. COUNTRY / REGION: Specific country/region eligibility (Germany, Netherlands, UK, USA, etc.).
 *
 * Rules:
 * 1. Location OR:
 *    [Worldwide Remote, India] => (Worldwide Remote) OR (India eligible).
 *    Never converts OR into AND!
 * 2. Workplace AND Location:
 *    [Remote] + [India] => Remote arrangement AND India eligibility.
 * 3. Remote Only:
 *    [Remote] => all remote jobs subject to baseline eligibility.
 * 4. Deduplication:
 *    Never creates separate active chips for overlapping semantic concepts.
 */

import { JobOpportunity, RawDiscoveredJob } from '../types';
import { remoteEligibilityEngine } from '../remoteEligibilityEngine';

export const CANONICAL_WORLDWIDE = 'Worldwide Remote';
export const CANONICAL_INDIA = 'India';

export const WORLDWIDE_SYNONYMS = new Set([
  'worldwide',
  'global',
  'anywhere',
  'work from anywhere',
  'wfa',
  'remote - worldwide',
  'remote anywhere',
  'location independent',
  'distributed worldwide',
  'worldwide remote',
  'remote worldwide',
  'remote worldwide / work from anywhere',
  'everywhere',
  'fully remote (worldwide)',
  'global remote',
]);

const INDIAN_CITIES_AND_REGIONS = [
  'bengaluru',
  'bangalore',
  'delhi',
  'new delhi',
  'delhi ncr',
  'noida',
  'gurgaon',
  'gurugram',
  'mumbai',
  'pune',
  'hyderabad',
  'chennai',
  'kolkata',
  'ahmedabad',
  'kochi',
  'indore',
  'chandigarh',
  'jaipur',
];

export interface LocationEvaluationResult {
  eligible: boolean;
  matchedRule?: string;
  reason: string;
  matchedConcept?: 'WORLDWIDE_REMOTE' | 'INDIA' | 'REMOTE_INDIA' | 'SPECIFIC_COUNTRY' | 'ALL';
}

export class LocationFilterEngine {
  /**
   * Normalizes an individual location query/token into a canonical concept.
   */
  public normalizeToken(loc: string): string {
    const trimmed = (loc || '').trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();

    // 1. Worldwide / Global synonyms
    if (
      WORLDWIDE_SYNONYMS.has(lower) ||
      lower.includes('worldwide') ||
      lower.includes('work from anywhere') ||
      lower.includes('wfa') ||
      lower === 'global' ||
      lower === 'anywhere' ||
      lower.includes('location independent') ||
      lower.includes('distributed worldwide')
    ) {
      return CANONICAL_WORLDWIDE;
    }

    // 2. City-level Indian normalization (preserves city specificity while standardizing synonyms)
    if (lower === 'bengaluru' || lower === 'bangalore' || lower.includes('bengaluru') || lower.includes('bangalore')) {
      return 'Bengaluru';
    }
    if (
      lower.includes('delhi') ||
      lower.includes('noida') ||
      lower.includes('gurgaon') ||
      lower.includes('gurugram')
    ) {
      return 'Delhi NCR';
    }
    if (lower.includes('mumbai') || lower.includes('bombay')) {
      return 'Mumbai';
    }
    if (lower.includes('hyderabad')) {
      return 'Hyderabad';
    }
    if (lower.includes('pune')) {
      return 'Pune';
    }
    if (lower.includes('chennai') || lower.includes('madras')) {
      return 'Chennai';
    }
    if (lower.includes('kolkata') || lower.includes('calcutta')) {
      return 'Kolkata';
    }
    if (lower.includes('ahmedabad')) {
      return 'Ahmedabad';
    }
    if (lower.includes('kochi') || lower.includes('cochin')) {
      return 'Kochi';
    }

    // 3. India Country Level
    if (lower === 'india' || lower.includes('india')) {
      return CANONICAL_INDIA;
    }

    // 4. Known country normalizations
    if (lower === 'us' || lower === 'usa' || lower.includes('united states')) return 'United States';
    if (lower === 'uk' || lower.includes('united kingdom') || lower.includes('great britain')) return 'United Kingdom';
    if (lower === 'eu' || lower === 'emea' || lower.includes('europe')) return 'Europe / EMEA';
    if (lower.includes('germany') || lower.includes('deutschland')) return 'Germany';
    if (lower.includes('netherlands') || lower.includes('holland') || lower.includes('amsterdam')) return 'Netherlands';
    if (lower.includes('canada') || lower.includes('toronto') || lower.includes('vancouver')) return 'Canada';
    if (lower.includes('singapore') || lower.includes('apac') || lower.includes('australia')) return 'Singapore & APAC';
    if (lower.includes('dubai') || lower.includes('uae') || lower.includes('middle east')) return 'UAE & Middle East';

    // Capitalize custom location
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  /**
   * Normalizes a list of target locations, collapsing duplicates and overlapping synonyms.
   */
  public normalizeTargetLocations(locations: string[]): string[] {
    if (!locations || locations.length === 0) return [];
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const loc of locations) {
      if (!loc || loc === 'all') continue;
      const canonical = this.normalizeToken(loc);
      if (!canonical) continue;
      const key = canonical.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(canonical);
      }
    }

    return normalized;
  }

  /**
   * Formats the semantic display string (e.g. "India OR Worldwide Remote").
   */
  public formatLocationSemanticDisplay(locations: string[]): string {
    const cleaned = this.normalizeTargetLocations(locations);
    if (cleaned.length === 0) return 'All Locations';
    if (cleaned.length === 1) return cleaned[0];
    return cleaned.join(' OR ');
  }

  /**
   * Evaluates if an opportunity satisfies the location and workplace filter criteria.
   * Rules:
   * 1. OR within location category: [India, Worldwide Remote] => (job is India) OR (job is Worldwide Remote).
   * 2. AND between workplace and location: [Remote] + [India] => (job is Remote) AND (job is India eligible).
   * 3. Remote only with no location: [Remote] => all remote jobs regardless of country.
   * 4. Empty locations: [] => universal location eligibility.
   */
  public evaluateEligibility(
    job: JobOpportunity | Partial<JobOpportunity> | RawDiscoveredJob,
    selectedLocations: string[] = [],
    workplaceTypes: string[] = []
  ): LocationEvaluationResult {
    const jLoc = ((job as any).location || '').toLowerCase();
    const jCountry = ((job as any).country || '').toLowerCase();
    const jRemoteStatus = ((job as any).remoteStatus || 'on-site').toLowerCase();
    const remoteRec = (job as any).remote_eligibility;

    const isJobWorldwide =
      remoteEligibilityEngine.isWorldwideRemote(job) ||
      (remoteRec?.status === 'WORLDWIDE_REMOTE') ||
      ((job as any).workFromAnywhere === true) ||
      jLoc.includes('worldwide') ||
      jLoc.includes('work from anywhere') ||
      jLoc.includes('location independent') ||
      jLoc.includes('distributed worldwide') ||
      jLoc.includes('global remote');

    const isJobRemote =
      isJobWorldwide ||
      jRemoteStatus === 'remote' ||
      remoteRec?.status === 'REMOTE_FROM_INDIA' ||
      remoteRec?.status === 'WORLDWIDE_REMOTE' ||
      remoteRec?.status === 'REMOTE_COUNTRY_RESTRICTED' ||
      remoteRec?.status === 'REMOTE_REGION_RESTRICTED' ||
      (job as any).isRemote === true;

    const isJobIndiaPhysical =
      remoteEligibilityEngine.isIndiaLocation(jLoc, jCountry) ||
      jCountry.includes('india') ||
      INDIAN_CITIES_AND_REGIONS.some((city) => jLoc.includes(city));

    const isJobIndiaEligible =
      isJobIndiaPhysical ||
      remoteEligibilityEngine.isEligibleForIndiaFeed(job) ||
      remoteRec?.status === 'REMOTE_FROM_INDIA' ||
      (isJobWorldwide && isJobRemote);

    // -------------------------------------------------------------------------
    // 1. WORKPLACE FILTER (AND Condition across categories)
    // -------------------------------------------------------------------------
    const activeWorkplaces = (workplaceTypes || []).filter((w) => w && w !== 'all');
    if (activeWorkplaces.length > 0) {
      const normalizedWorkplace = activeWorkplaces.map((w) => w.toLowerCase());
      let matchesWorkplace = false;

      // OR within the workplace category if multiple selected (e.g. Remote OR Hybrid)
      if (normalizedWorkplace.includes('remote') && isJobRemote) {
        matchesWorkplace = true;
      }
      if (
        normalizedWorkplace.includes('hybrid') &&
        (jRemoteStatus === 'hybrid' || remoteRec?.status === 'HYBRID')
      ) {
        matchesWorkplace = true;
      }
      if (
        (normalizedWorkplace.includes('on-site') || normalizedWorkplace.includes('onsite')) &&
        (jRemoteStatus === 'on-site' || jRemoteStatus === 'onsite' || remoteRec?.status === 'ONSITE')
      ) {
        matchesWorkplace = true;
      }

      if (!matchesWorkplace) {
        return {
          eligible: false,
          reason: `Workplace mode "${jRemoteStatus}" does not match requested workplace types [${activeWorkplaces.join(', ')}]`,
        };
      }
    }

    // -------------------------------------------------------------------------
    // 2. LOCATION ELIGIBILITY (Semantic OR across selected locations)
    // -------------------------------------------------------------------------
    const activeLocations = (selectedLocations || []).filter((l) => l && l !== 'all');
    const normalizedLocations = this.normalizeTargetLocations(activeLocations);

    // If no locations specified, any workplace-compliant job is eligible
    if (normalizedLocations.length === 0) {
      return {
        eligible: true,
        reason: 'Universal location eligibility (no location constraint)',
        matchedConcept: 'ALL',
      };
    }

    // Prioritize Worldwide Remote concept if selected and job is worldwide remote
    if (normalizedLocations.includes(CANONICAL_WORLDWIDE) && isJobWorldwide) {
      return {
        eligible: true,
        matchedRule: 'Worldwide Remote OR Match',
        reason: 'Job explicitly allows worldwide applicants from any country',
        matchedConcept: 'WORLDWIDE_REMOTE',
      };
    }

    // Evaluate each selected location concept using strict OR logic
    for (const locConcept of normalizedLocations) {
      // Concept A: WORLDWIDE REMOTE (strictly location-independent)
      if (locConcept === CANONICAL_WORLDWIDE) {
        if (isJobWorldwide) {
          return {
            eligible: true,
            matchedRule: 'Worldwide Remote OR Match',
            reason: 'Job explicitly allows worldwide applicants from any country',
            matchedConcept: 'WORLDWIDE_REMOTE',
          };
        }
      }

      // Concept B: INDIA (Physical India OR remote open to India)
      if (locConcept === CANONICAL_INDIA) {
        if (isJobIndiaEligible) {
          return {
            eligible: true,
            matchedRule: 'India Eligibility OR Match',
            reason: 'Job is based in or accepts candidates residing in India',
            matchedConcept: 'INDIA',
          };
        }
      }

      // Concept C: SPECIFIC CITIES & METROS (synonym-aware matching)
      if (locConcept === 'Bengaluru') {
        if (
          jLoc.includes('bengaluru') ||
          jLoc.includes('bangalore') ||
          ((job as any).city && /bengaluru|bangalore/i.test((job as any).city))
        ) {
          return {
            eligible: true,
            matchedRule: 'Bengaluru City Match',
            reason: 'Job is based in Bengaluru / Bangalore',
            matchedConcept: 'SPECIFIC_COUNTRY',
          };
        }
      }
      if (locConcept === 'Delhi NCR') {
        if (
          /(delhi|noida|gurgaon|gurugram)/i.test(jLoc) ||
          ((job as any).city && /(delhi|noida|gurgaon|gurugram)/i.test((job as any).city))
        ) {
          return {
            eligible: true,
            matchedRule: 'Delhi NCR Metro Match',
            reason: 'Job is based in Delhi NCR (Delhi, Noida, Gurgaon, Gurugram)',
            matchedConcept: 'SPECIFIC_COUNTRY',
          };
        }
      }
      if (locConcept === 'Mumbai') {
        if (
          /(mumbai|bombay)/i.test(jLoc) ||
          ((job as any).city && /(mumbai|bombay)/i.test((job as any).city))
        ) {
          return {
            eligible: true,
            matchedRule: 'Mumbai City Match',
            reason: 'Job is based in Mumbai',
            matchedConcept: 'SPECIFIC_COUNTRY',
          };
        }
      }
      if (locConcept === 'Chennai') {
        if (
          /(chennai|madras)/i.test(jLoc) ||
          ((job as any).city && /(chennai|madras)/i.test((job as any).city))
        ) {
          return {
            eligible: true,
            matchedRule: 'Chennai City Match',
            reason: 'Job is based in Chennai',
            matchedConcept: 'SPECIFIC_COUNTRY',
          };
        }
      }
      if (locConcept === 'Kolkata') {
        if (
          /(kolkata|calcutta)/i.test(jLoc) ||
          ((job as any).city && /(kolkata|calcutta)/i.test((job as any).city))
        ) {
          return {
            eligible: true,
            matchedRule: 'Kolkata City Match',
            reason: 'Job is based in Kolkata',
            matchedConcept: 'SPECIFIC_COUNTRY',
          };
        }
      }
      if (locConcept === 'Kochi') {
        if (
          /(kochi|cochin)/i.test(jLoc) ||
          ((job as any).city && /(kochi|cochin)/i.test((job as any).city))
        ) {
          return {
            eligible: true,
            matchedRule: 'Kochi City Match',
            reason: 'Job is based in Kochi',
            matchedConcept: 'SPECIFIC_COUNTRY',
          };
        }
      }

      // Concept D: SPECIFIC COUNTRY OR REGION
      const locLower = locConcept.toLowerCase();
      if (
        jCountry.includes(locLower) ||
        jLoc.includes(locLower) ||
        (Array.isArray((job as any).eligibleCountries) &&
          (job as any).eligibleCountries.some((c: string) => c.toLowerCase().includes(locLower)))
      ) {
        return {
          eligible: true,
          matchedRule: `${locConcept} Regional OR Match`,
          reason: `Job explicitly matches ${locConcept} geographical boundary`,
          matchedConcept: 'SPECIFIC_COUNTRY',
        };
      }
    }

    // None of the OR conditions were met
    return {
      eligible: false,
      reason: `Job location "${jLoc || jCountry}" does not match any selected target locations (${normalizedLocations.join(' OR ')})`,
    };
  }

  /**
   * Consolidates redundant active chips, preventing duplicate chips for overlapping semantic concepts.
   */
  public consolidateChips(selectedLocations: string[]): Array<{
    id: string;
    label: string;
    canonicalKey: string;
    description: string;
  }> {
    const normalized = this.normalizeTargetLocations(selectedLocations);
    return normalized.map((canonical) => {
      let description = `All roles eligible in ${canonical}`;
      if (canonical === CANONICAL_WORLDWIDE) {
        description = 'Worldwide, Global, Work From Anywhere, Location Independent';
      } else if (canonical === CANONICAL_INDIA) {
        description = 'India Tech Hubs & Remote from India';
      } else if (canonical === 'Bengaluru') {
        description = 'Bengaluru / Bangalore tech hub';
      } else if (canonical === 'Delhi NCR') {
        description = 'Delhi, New Delhi, Noida, Gurgaon / Gurugram';
      }

      return {
        id: `loc-${canonical.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        label: canonical,
        canonicalKey: canonical,
        description,
      };
    });
  }
}

export const locationFilterEngine = new LocationFilterEngine();
