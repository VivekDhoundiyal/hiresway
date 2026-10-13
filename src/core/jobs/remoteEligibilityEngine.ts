/**
 * CareerOs Dedicated Remote Eligibility Engine
 * 
 * Strict classification and evidence extraction for remote opportunities:
 * - WORLDWIDE_REMOTE: Work from anywhere, global, location independent
 * - REMOTE_FROM_INDIA: Explicitly open to applicants residing in India
 * - REMOTE_REGION_RESTRICTED: Restricted to EMEA, LATAM, EU, APAC (without confirmed India eligibility)
 * - REMOTE_COUNTRY_RESTRICTED: Restricted to US only, UK only, Canada only, etc.
 * - HYBRID: Requires periodic in-office presence
 * - ONSITE: Traditional office-based role
 * - UNKNOWN: Ambiguous "remote" text without clear country/region boundaries
 *
 * Strict Rule: "Remote — US" or any country-restricted non-India role MUST NEVER
 * enter the India-eligible feed.
 */

import type {
  RemoteEligibilityRecord,
  JobOpportunity,
  RawDiscoveredJob,
} from './types';

export interface RemoteClassificationInput {
  location?: string;
  title?: string;
  description?: string;
  country?: string;
  workFromAnywhere?: boolean;
}

const INDIAN_METROS = [
  'bengaluru',
  'bangalore',
  'hyderabad',
  'pune',
  'mumbai',
  'delhi',
  'new delhi',
  'noida',
  'gurgaon',
  'gurugram',
  'chennai',
  'kolkata',
  'ahmedabad',
  'kochi',
  'indore',
  'chandigarh',
  'jaipur',
];

const US_RESTRICTION_PATTERNS = [
  /\bus\s+only\b/i,
  /\bunited\s+states\s+only\b/i,
  /\bu\.s\.\s+only\b/i,
  /\bu\.s\.a\.\s+only\b/i,
  /\busa\s+only\b/i,
  /\bremote\s*[-—–:/]\s*(?:us|usa|united states)\b/i,
  /\b(?:us|usa|united states)\s*[-—–:/]\s*remote\b/i,
  /\b(?:in|within)\s+(?:the\s+)?(?:us|usa|united states)\b/i,
  /\bmust\s+reside\s+in\s+(?:the\s+)?(?:us|usa|united states)\b/i,
  /\bmust\s+be\s+located\s+in\s+(?:the\s+)?(?:us|usa|united states)\b/i,
  /\b(?:us|u\.s\.)\s+citizenship\b/i,
  /\b(?:us|u\.s\.)\s+work\s+authorization\s+required\b/i,
  /\bauthorized\s+to\s+work\s+in\s+the\s+(?:us|united states)\b/i,
  /\bremote\s*\((?:us|usa|united states)\)/i,
  /\b(?:ca|ny|tx|wa|il|ma|fl|nc|co|va|ga|pa|oh|nj)\s+remote\b/i,
  /\bremote\s*[-—–]\s*(?:ca|ny|tx|wa|il|ma|fl|nc|co|va|ga|pa|oh|nj)\b/i,
];

const UK_RESTRICTION_PATTERNS = [
  /\buk\s+only\b/i,
  /\bunited\s+kingdom\s+only\b/i,
  /\bremote\s*[-—–:/]\s*(?:uk|united kingdom|great britain)\b/i,
  /\b(?:uk|united kingdom)\s*[-—–:/]\s*remote\b/i,
  /\bmust\s+reside\s+in\s+(?:the\s+)?(?:uk|united kingdom)\b/i,
  /\bright\s+to\s+work\s+in\s+(?:the\s+)?uk\b/i,
];

const CANADA_RESTRICTION_PATTERNS = [
  /\bcanada\s+only\b/i,
  /\bremote\s*[-—–:/]\s*canada\b/i,
  /\bcanada\s*[-—–:/]\s*remote\b/i,
  /\bmust\s+reside\s+in\s+canada\b/i,
  /\bauthorized\s+to\s+work\s+in\s+canada\b/i,
];

const EUROPE_RESTRICTION_PATTERNS = [
  /\beu\s+only\b/i,
  /\beurope\s+only\b/i,
  /\beuropean\s+union\s+only\b/i,
  /\bremote\s*[-—–:/]\s*(?:eu|europe|european union)\b/i,
  /\b(?:eu|europe)\s*[-—–:/]\s*remote\b/i,
  /\bmust\s+reside\s+in\s+(?:the\s+)?(?:eu|europe)\b/i,
  /\beuropean\s+timezones?\s+only\b/i,
  /\bcentral\s+european\s+time\s+only\b/i,
];

const LATAM_RESTRICTION_PATTERNS = [
  /\blatam\s+only\b/i,
  /\blatin\s+america\s+only\b/i,
  /\bremote\s*[-—–:/]\s*(?:latam|latin america)\b/i,
  /\b(?:latam|latin america)\s*[-—–:/]\s*remote\b/i,
];

const EMEA_RESTRICTION_PATTERNS = [
  /\bemea\s+only\b/i,
  /\bremote\s*[-—–:/]\s*emea\b/i,
  /\bemea\s*[-—–:/]\s*remote\b/i,
];

const APAC_RESTRICTION_PATTERNS = [
  /\bapac\s+only\b/i,
  /\basia[- ]pacific\s+only\b/i,
  /\bremote\s*[-—–:/]\s*apac\b/i,
  /\bapac\s*[-—–:/]\s*remote\b/i,
];

const WORLDWIDE_POSITIVE_PATTERNS = [
  /\bwork\s+from\s+anywhere\b/i,
  /\bwork\s+from\s+anywhere\s+in\s+the\s+world\b/i,
  /\banywhere\s+in\s+the\s+world\b/i,
  /\bworldwide\s+remote\b/i,
  /\bremote\s*[-—–:/]\s*worldwide\b/i,
  /\bremote\s*[-—–:/]\s*global\b/i,
  /\bglobal\s+remote\b/i,
  /\bfully\s+remote[,\s]+location\s+independent\b/i,
  /\blocation\s+independent\b/i,
  /\bhire\s+globally\b/i,
  /\bhire\s+anywhere\b/i,
  /\b100%\s+remote[,\s]+anywhere\b/i,
  /\bopen\s+worldwide\b/i,
  /\bworldwide\b/i,
];

const INDIA_POSITIVE_PATTERNS = [
  /\bremote\s*[-—–:/]\s*india\b/i,
  /\bindia\s*[-—–:/]\s*remote\b/i,
  /\bindia\s+remote\b/i,
  /\bremote\s+in\s+india\b/i,
  /\bremote\s*\(\s*india\s*\)/i,
  /\bopen\s+to\s+india\b/i,
  /\bbased\s+in\s+india\b/i,
  /\bindia\s+resident\b/i,
  /\banywhere\s+in\s+india\b/i,
];

export class RemoteEligibilityEngine {
  /**
   * Classifies a job's remote eligibility and extracts precise evidence.
   */
  public classify(input: RemoteClassificationInput): RemoteEligibilityRecord {
    const loc = (input.location || '').trim();
    const title = (input.title || '').trim();
    const desc = (input.description || '').trim();
    const country = (input.country || '').trim();
    const combined = `${title} | ${loc} | ${desc.slice(0, 1500)}`;

    // 1. Check for On-site explicit indicators
    const isOnsite =
      (/\bon-?site\b/i.test(loc) || /\boffice\s+only\b/i.test(loc) || /\bin-office\b/i.test(loc)) &&
      !/\bremote\b/i.test(loc) &&
      !/\banywhere\b/i.test(loc);

    if (isOnsite) {
      const isIndiaLoc = this.isIndiaLocation(loc, country);
      return {
        status: 'ONSITE',
        scope: 'onsite_hybrid',
        eligibleCountries: isIndiaLoc ? ['India'] : country ? [country] : [],
        excludedCountries: [],
        locationText: loc || 'On-site',
        evidence: `On-site requirement specified: "${loc}"`,
        confidence: 90,
        isIndiaEligible: isIndiaLoc,
      };
    }

    // 2. Check for Hybrid explicit indicators
    const isHybrid =
      /\bhybrid\b/i.test(loc) ||
      /\bhybrid\s+work\b/i.test(desc) ||
      /\b(?:2|3|4)\s+days\s+in\s+(?:the\s+)?office\b/i.test(desc);

    if (isHybrid && !/\b100%\s+remote\b/i.test(loc)) {
      const isIndiaLoc = this.isIndiaLocation(loc, country);
      return {
        status: 'HYBRID',
        scope: 'onsite_hybrid',
        eligibleCountries: isIndiaLoc ? ['India'] : country ? [country] : [],
        excludedCountries: [],
        locationText: loc || 'Hybrid',
        evidence: `Hybrid schedule requiring office presence: "${loc}"`,
        confidence: 88,
        isIndiaEligible: isIndiaLoc,
      };
    }

    // 3. Explicit Negative signals: US Restricted (Takes strict precedence)
    for (const pattern of US_RESTRICTION_PATTERNS) {
      const match = loc.match(pattern) || title.match(pattern) || desc.slice(0, 600).match(pattern);
      if (match) {
        return {
          status: 'REMOTE_COUNTRY_RESTRICTED',
          scope: 'country_restricted',
          eligibleCountries: ['United States'],
          excludedCountries: ['India', 'Global'],
          locationText: loc || 'Remote (US only)',
          workAuthRequirement: 'US work authorization / residence required',
          evidence: `Restricted to United States applicants: "${match[0]}"`,
          confidence: 96,
          isIndiaEligible: false,
        };
      }
    }

    // 4. Explicit Negative signals: UK Restricted
    for (const pattern of UK_RESTRICTION_PATTERNS) {
      const match = loc.match(pattern) || title.match(pattern) || desc.slice(0, 600).match(pattern);
      if (match) {
        return {
          status: 'REMOTE_COUNTRY_RESTRICTED',
          scope: 'country_restricted',
          eligibleCountries: ['United Kingdom'],
          excludedCountries: ['India', 'Global'],
          locationText: loc || 'Remote (UK only)',
          workAuthRequirement: 'UK work authorization required',
          evidence: `Restricted to United Kingdom applicants: "${match[0]}"`,
          confidence: 94,
          isIndiaEligible: false,
        };
      }
    }

    // 5. Explicit Negative signals: Canada Restricted
    for (const pattern of CANADA_RESTRICTION_PATTERNS) {
      const match = loc.match(pattern) || title.match(pattern) || desc.slice(0, 600).match(pattern);
      if (match) {
        return {
          status: 'REMOTE_COUNTRY_RESTRICTED',
          scope: 'country_restricted',
          eligibleCountries: ['Canada'],
          excludedCountries: ['India', 'Global'],
          locationText: loc || 'Remote (Canada only)',
          workAuthRequirement: 'Canada residence/authorization required',
          evidence: `Restricted to Canada applicants: "${match[0]}"`,
          confidence: 94,
          isIndiaEligible: false,
        };
      }
    }

    // 6. Explicit Negative signals: Europe/EU Restricted
    for (const pattern of EUROPE_RESTRICTION_PATTERNS) {
      const match = loc.match(pattern) || title.match(pattern) || desc.slice(0, 600).match(pattern);
      if (match) {
        return {
          status: 'REMOTE_REGION_RESTRICTED',
          scope: 'region_restricted',
          eligibleCountries: ['European Union', 'Europe'],
          excludedCountries: ['India'],
          locationText: loc || 'Remote (Europe only)',
          evidence: `Restricted to European countries: "${match[0]}"`,
          confidence: 92,
          isIndiaEligible: false,
        };
      }
    }

    // 7. Explicit Negative signals: LATAM Restricted
    for (const pattern of LATAM_RESTRICTION_PATTERNS) {
      const match = loc.match(pattern) || title.match(pattern) || desc.slice(0, 600).match(pattern);
      if (match) {
        return {
          status: 'REMOTE_REGION_RESTRICTED',
          scope: 'region_restricted',
          eligibleCountries: ['Latin America'],
          excludedCountries: ['India'],
          locationText: loc || 'Remote (LATAM only)',
          evidence: `Restricted to Latin America: "${match[0]}"`,
          confidence: 92,
          isIndiaEligible: false,
        };
      }
    }

    // 8. Positive India remote signals
    for (const pattern of INDIA_POSITIVE_PATTERNS) {
      const match = loc.match(pattern) || title.match(pattern) || desc.slice(0, 800).match(pattern);
      if (match) {
        return {
          status: 'REMOTE_FROM_INDIA',
          scope: 'india',
          eligibleCountries: ['India'],
          excludedCountries: [],
          locationText: loc || 'Remote — India',
          evidence: `Explicit India remote eligibility: "${match[0]}"`,
          confidence: 95,
          isIndiaEligible: true,
        };
      }
    }

    // 9. Positive worldwide signals (Only when NO country restriction exists)
    for (const pattern of WORLDWIDE_POSITIVE_PATTERNS) {
      const match = loc.match(pattern) || title.match(pattern) || desc.slice(0, 800).match(pattern);
      if (match) {
        return {
          status: 'WORLDWIDE_REMOTE',
          scope: 'worldwide',
          eligibleCountries: ['*'],
          excludedCountries: [],
          locationText: loc || 'Remote Worldwide',
          evidence: `Explicit worldwide remote signal: "${match[0]}"`,
          confidence: 95,
          isIndiaEligible: true,
        };
      }
    }



    // 10. EMEA Disambiguation (Check if India is explicitly included)
    for (const pattern of EMEA_RESTRICTION_PATTERNS) {
      const match = loc.match(pattern) || title.match(pattern) || desc.slice(0, 600).match(pattern);
      if (match) {
        const mentionsIndia = /\bindia\b/i.test(combined);
        if (mentionsIndia) {
          return {
            status: 'REMOTE_FROM_INDIA',
            scope: 'india',
            eligibleCountries: ['India', 'EMEA'],
            excludedCountries: [],
            locationText: loc || 'Remote — EMEA (including India)',
            evidence: `EMEA remote posting with explicit India inclusion`,
            confidence: 90,
            isIndiaEligible: true,
          };
        }
        return {
          status: 'REMOTE_REGION_RESTRICTED',
          scope: 'region_restricted',
          eligibleCountries: ['EMEA'],
          excludedCountries: ['India'],
          locationText: loc || 'Remote (EMEA only)',
          evidence: `Restricted to EMEA without confirmed India eligibility: "${match[0]}"`,
          confidence: 88,
          isIndiaEligible: false,
        };
      }
    }

    // 11. APAC Disambiguation (Do NOT assume India is included unless stated)
    for (const pattern of APAC_RESTRICTION_PATTERNS) {
      const match = loc.match(pattern) || title.match(pattern) || desc.slice(0, 600).match(pattern);
      if (match) {
        const mentionsIndia =
          /\bindia\b/i.test(combined) ||
          /\bincluding\s+india\b/i.test(combined) ||
          /\bindia\s+eligible\b/i.test(combined);

        if (mentionsIndia) {
          return {
            status: 'REMOTE_FROM_INDIA',
            scope: 'india',
            eligibleCountries: ['India', 'APAC'],
            excludedCountries: [],
            locationText: loc || 'Remote — APAC (including India)',
            evidence: `APAC posting with explicit India eligibility confirmed`,
            confidence: 92,
            isIndiaEligible: true,
          };
        }
        return {
          status: 'REMOTE_REGION_RESTRICTED',
          scope: 'region_restricted',
          eligibleCountries: ['APAC'],
          excludedCountries: [],
          locationText: loc || 'Remote (APAC)',
          evidence: `APAC regional restriction without verified India inclusion: "${match[0]}"`,
          confidence: 85,
          isIndiaEligible: false,
        };
      }
    }

    // 12. Direct India city in location text
    if (this.isIndiaLocation(loc, country)) {
      const hasRemote = /\bremote\b/i.test(loc) || /\bremote\b/i.test(title);
      return {
        status: hasRemote ? 'REMOTE_FROM_INDIA' : 'ONSITE',
        scope: hasRemote ? 'india' : 'onsite_hybrid',
        eligibleCountries: ['India'],
        excludedCountries: [],
        locationText: loc,
        evidence: `Location confirmed in India: "${loc}"`,
        confidence: 95,
        isIndiaEligible: true,
      };
    }

    // 13. Generic "Remote" without country qualifier
    if (/\bremote\b/i.test(loc) || /\bremote\b/i.test(title)) {
      // If workFromAnywhere was explicitly flagged on input
      if (input.workFromAnywhere) {
        return {
          status: 'WORLDWIDE_REMOTE',
          scope: 'worldwide',
          eligibleCountries: ['*'],
          excludedCountries: [],
          locationText: loc || 'Remote (Worldwide)',
          evidence: `Structured source marked work-from-anywhere`,
          confidence: 85,
          isIndiaEligible: true,
        };
      }

      return {
        status: 'UNKNOWN',
        scope: 'unknown',
        eligibleCountries: [],
        excludedCountries: [],
        locationText: loc || 'Remote',
        evidence: `Generic remote term found without explicit geographic boundaries`,
        confidence: 45,
        isIndiaEligible: false, // Rule: UNKNOWN is excluded from verified India feed
      };
    }

    // 14. Default fallback: Onsite/Unspecified foreign location
    return {
      status: 'UNKNOWN',
      scope: 'unknown',
      eligibleCountries: country ? [country] : [],
      excludedCountries: [],
      locationText: loc || 'Location not disclosed',
      evidence: `Unspecified location eligibility`,
      confidence: 40,
      isIndiaEligible: false,
    };
  }

  /**
   * Helper: Checks whether a location string corresponds to an Indian city or country.
   */
  public isIndiaLocation(location: string, country?: string): boolean {
    const locLower = (location || '').toLowerCase();
    const countryLower = (country || '').toLowerCase();

    if (countryLower === 'india' || locLower.includes('india')) {
      return true;
    }

    return INDIAN_METROS.some((city) => locLower.includes(city));
  }

  /**
   * Evaluates whether an opportunity qualifies for the active India candidate feed.
   */
  public isEligibleForIndiaFeed(job: Partial<JobOpportunity> | RawDiscoveredJob): boolean {
    const existing = (job as JobOpportunity).remote_eligibility;
    if (existing) {
      return existing.isIndiaEligible;
    }

    const classification = this.classify({
      location: job.location,
      title: job.title,
      description: job.description,
      country: (job as JobOpportunity).country,
      workFromAnywhere: (job as JobOpportunity).workFromAnywhere,
    });

    return classification.isIndiaEligible;
  }

  /**
   * Evaluates whether an opportunity strictly qualifies as Worldwide Remote.
   * Rejects US-only, Canada-only, UK-only, EMEA-only, or country-restricted remote roles.
   */
  public isWorldwideRemote(job: Partial<JobOpportunity> | RawDiscoveredJob): boolean {
    const existing = (job as JobOpportunity).remote_eligibility;
    if (existing) {
      return existing.status === 'WORLDWIDE_REMOTE' && (existing.scope?.toLowerCase() === 'worldwide' || !existing.scope);
    }

    const classification = this.classify({
      location: job.location,
      title: job.title,
      description: job.description,
      country: (job as JobOpportunity).country,
      workFromAnywhere: (job as JobOpportunity).workFromAnywhere,
    });

    return classification.status === 'WORLDWIDE_REMOTE' && classification.scope === 'worldwide';
  }
}

export const remoteEligibilityEngine = new RemoteEligibilityEngine();
