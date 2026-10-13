/**
 * CareerOs Company Logo Service (Adapter & Bridge)
 * 
 * Forwards all resolution, canonicalization, and branding queries to the
 * centralized `companyIdentityService` to ensure a single source of truth.
 */

import {
  companyIdentityService,
  canonicalizeCompanyName,
  resolveCanonicalDomain,
  CompanyIdentity,
} from './companyIdentityService';
import { CompanyLogoData } from '../jobs/types';

export interface CompanyBrandInfo {
  name: string;
  domain: string;
  curatedLogoUrl?: string;
  initial: string;
  bg: string;
  text: string;
  border: string;
}

/**
 * Resolves the primary domain for any company name or URL
 */
export function resolveCompanyDomain(companyName: string, sourceUrl?: string): string {
  return resolveCanonicalDomain(companyName, sourceUrl);
}

/**
 * Resolves canonical company brand name
 */
export function resolveCanonicalName(companyName: string): string {
  return canonicalizeCompanyName(companyName);
}

/**
 * Returns an ordered array of candidate full-color logo URLs to try in cascade
 */
export function getCompanyLogoSources(
  companyName: string,
  domain?: string,
  explicitLogoUrl?: string
): string[] {
  return companyIdentityService.getCandidateUrls(companyName, domain, explicitLogoUrl);
}

/**
 * Returns the primary resolved logo URL
 */
export function getCompanyLogoUrl(
  companyName: string,
  domain?: string,
  explicitLogoUrl?: string
): string {
  return companyIdentityService.getCompanyLogoUrl(companyName, domain, explicitLogoUrl);
}

/**
 * Returns the rich CompanyLogoData object
 */
export function getCompanyLogoData(
  companyName: string,
  domain?: string,
  explicitLogoUrl?: string
): CompanyLogoData {
  return companyIdentityService.getCompanyLogoData(companyName, domain, explicitLogoUrl);
}

/**
 * Returns the full canonical company identity
 */
export function getCompanyIdentity(
  companyName: string,
  domainOrUrlHint?: string,
  explicitLogoUrl?: string
): CompanyIdentity {
  return companyIdentityService.getCompanyIdentity(companyName, domainOrUrlHint, explicitLogoUrl);
}

/**
 * Returns clean, neutral monogram presentation for fallback badge
 * Strictly adheres to neutral styling without fake colored backgrounds.
 */
export function getCompanyBrandColors(companyName: string): {
  initial: string;
  bg: string;
  text: string;
  border: string;
} {
  const initial = companyIdentityService.getCompanyInitial(companyName);
  return {
    initial,
    bg: 'bg-white',
    text: 'text-gray-700 dark:text-gray-200 font-semibold',
    border: 'border-gray-200 dark:border-gray-700',
  };
}

export { companyIdentityService };
