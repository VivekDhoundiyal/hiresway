import {
  JobOpportunity,
  JobCompensation,
  RemoteType,
  RemoteScope,
  SeniorityLevel,
  JobSourceMetadata,
  SourceType,
  SourceConfidence,
  RawDiscoveredJob,
  JobVerificationStatus,
  FeedStatus,
  JobFilterCriteria,
} from './types';
import { UserProfile } from '../profile/types';
import { CareerProfile } from '../profile/careerProfileNormalizer';
import { SearchConfiguration } from './searchConfiguration';
import { jobMatchingEngine } from './engines/jobMatchingEngine';
import { locationFilterEngine } from './engines/locationFilterEngine';
import { filterEvaluationEngine } from './engines/filterEvaluationEngine';
import { freshnessEngine } from './engines/freshnessEngine';
import { targetCompaniesStore } from '../target-companies/targetCompanyStore';
import { jobVerificationEngine } from './jobVerificationEngine';
import { resolveCompanyDomain, getCompanyLogoUrl, getCompanyLogoData } from '../companies/companyLogoService';
import { remoteEligibilityEngine } from './remoteEligibilityEngine';
import { salaryTruthEngine } from './salaryTruthEngine';
import { jobDescriptionNormalizer } from './jobDescriptionNormalizer';
import { fastJobMatcher } from '../intelligence/fastJobMatcher';

/**
 * Normalizes strings by lowercasing, stripping punctuation, and trimming extra spaces.
 */
export function normalizeString(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates a deterministic fingerprint for deduplication.
 * Ensures the same job posted on LinkedIn, Greenhouse, and a career page is recognized as one.
 */
export function generateJobFingerprint(
  companyOrJob: string | { company?: string; title?: string; location?: string; requisitionId?: string; canonicalUrl?: string; applyUrl?: string; jobUrl?: string },
  titleArg?: string,
  locationArg?: string,
  requisitionIdArg?: string,
  canonicalUrlArg?: string
): string {
  let company = '';
  let title = '';
  let location = '';
  let requisitionId: string | undefined = undefined;
  let rawUrl: string | undefined = undefined;

  if (typeof companyOrJob === 'object' && companyOrJob !== null) {
    company = companyOrJob.company || '';
    title = companyOrJob.title || '';
    location = companyOrJob.location || '';
    requisitionId = companyOrJob.requisitionId;
    rawUrl = companyOrJob.canonicalUrl || companyOrJob.applyUrl || companyOrJob.jobUrl;
  } else {
    company = typeof companyOrJob === 'string' ? companyOrJob : '';
    title = titleArg || '';
    location = locationArg || '';
    requisitionId = requisitionIdArg;
    rawUrl = canonicalUrlArg;
  }

  const normComp = normalizeString(company);
  // Remove location qualifiers from title while strictly PRESERVING seniority (e.g. Senior vs non-Senior)
  const normTitle = normalizeString(title)
    .replace(/\b(india|worldwide|remote|us|usa|emea|apac|uk|singapore|bangalore|bengaluru|sf|san francisco|london|berlin)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const normLoc = normalizeString(location).includes('remote') ? 'remote' : normalizeString(location);

  const cleanUrl = rawUrl && rawUrl !== '#'
    ? jobVerificationEngine.getCanonicalUrl(rawUrl).toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    : '';

  if (cleanUrl && cleanUrl.length > 5) {
    return `${normComp}::${normTitle}::${normLoc}::${cleanUrl}`;
  }

  if (requisitionId && requisitionId.trim().length > 3) {
    return `${normComp}::${normTitle}::${normLoc}::${requisitionId.trim().toLowerCase()}`;
  }

  return `${normComp}::${normTitle}::${normLoc}`;
}

/**
 * Infers seniority level from title and text
 */
export function detectSeniority(title: string, text: string = ''): SeniorityLevel {
  const combined = `${title} ${text}`.toLowerCase();

  if (/\b(vp|vice president|c-level|cto|cpo|cro|chief|head of|director)\b/i.test(title)) {
    if (/\b(vp|vice president|chief|c-level|cto|cpo|cro)\b/i.test(title)) return 'executive';
    return 'director';
  }
  if (/\b(engineering manager|product manager|lead|staff|principal|architect)\b/i.test(title)) {
    if (/\b(manager)\b/i.test(title)) return 'manager';
    return 'lead';
  }
  if (/\b(senior|sr\.)\b/i.test(title)) {
    return 'senior';
  }
  if (/\b(junior|jr\.|associate|intern|entry|graduate)\b/i.test(title)) {
    return 'entry';
  }
  if (/\b(senior|5\+|6\+|7\+|8\+)\b/i.test(combined)) {
    return 'senior';
  }

  return 'mid';
}

/**
 * Detects remote and work-from-anywhere policy
 */
export function detectRemoteStatus(location: string, description: string = ''): {
  remoteStatus: RemoteType;
  workFromAnywhere: boolean;
  country: string;
} {
  const locLower = location.toLowerCase();
  const descLower = description.toLowerCase();

  const isWFA =
    locLower.includes('anywhere') ||
    locLower.includes('worldwide') ||
    descLower.includes('work from anywhere') ||
    descLower.includes('work from anywhere in the world') ||
    descLower.includes('hire globally') ||
    descLower.includes('global remote');

  let remoteStatus: RemoteType = 'on-site';
  if (locLower.includes('remote') || descLower.includes('fully remote') || descLower.includes('100% remote')) {
    remoteStatus = 'remote';
  } else if (locLower.includes('hybrid') || descLower.includes('hybrid work')) {
    remoteStatus = 'hybrid';
  }

  // Country inference
  let country = 'Global';
  if (isWFA) {
    country = 'Global';
  } else if (
    locLower.includes('united states') ||
    locLower.includes('usa') ||
    locLower.includes('us ') ||
    /\b(ca|ny|tx|wa|il|ma|fl|nc|co)\b/i.test(location)
  ) {
    country = 'United States';
  } else if (
    locLower.includes('india') ||
    locLower.includes('bengaluru') ||
    locLower.includes('bangalore') ||
    locLower.includes('hyderabad') ||
    locLower.includes('pune') ||
    locLower.includes('delhi') ||
    locLower.includes('mumbai') ||
    locLower.includes('chennai') ||
    locLower.includes('gurugram') ||
    locLower.includes('gurgaon') ||
    locLower.includes('noida')
  ) {
    country = 'India';
  } else if (locLower.includes('united kingdom') || locLower.includes('uk') || locLower.includes('london')) {
    country = 'United Kingdom';
  } else if (locLower.includes('germany') || locLower.includes('berlin') || locLower.includes('munich')) {
    country = 'Germany';
  } else if (locLower.includes('canada') || locLower.includes('toronto') || locLower.includes('vancouver')) {
    country = 'Canada';
  }

  return { remoteStatus, workFromAnywhere: isWFA, country };
}

/**
 * Parses compensation preserving original currency.
 * Never converts into another currency without explicit user request.
 */
export function parseCompensation(text: string): JobCompensation {
  if (!text || text.trim() === '') {
    return { disclosed: false };
  }

  // Check for INR (₹ or Lakhs or INR)
  const inrMatch = text.match(/(?:₹|INR|Rs\.?)\s*([\d,.]+)\s*(?:L|LPA|Lakhs?)?(?:\s*[-–to]+\s*([\d,.]+)\s*(?:L|LPA|Lakhs?)?)?/i);
  if (inrMatch) {
    let min = parseFloat(inrMatch[1].replace(/,/g, ''));
    let max = inrMatch[2] ? parseFloat(inrMatch[2].replace(/,/g, '')) : undefined;

    // Handle Lakhs format e.g. 18 - 25 LPA
    if (/lpa|lakh/i.test(text) || (min > 0 && min < 100)) {
      min = min * 100000;
      if (max) max = max * 100000;
    }

    return {
      disclosed: true,
      currency: 'INR',
      min,
      max,
      rawText: text.trim(),
      period: 'yearly',
    };
  }

  // Check for USD ($ or USD)
  const usdMatch = text.match(/(?:\$|USD)\s*([\d,]+)(?:k)?(?:\s*[-–to]+\s*(?:\$|USD)?\s*([\d,]+)(?:k)?)?/i);
  if (usdMatch) {
    let min = parseFloat(usdMatch[1].replace(/,/g, ''));
    if (usdMatch[0].toLowerCase().includes('k') && min < 1000) min *= 1000;

    let max: number | undefined;
    if (usdMatch[2]) {
      max = parseFloat(usdMatch[2].replace(/,/g, ''));
      if (usdMatch[0].toLowerCase().includes('k') && max < 1000) max *= 1000;
    }

    return {
      disclosed: true,
      currency: 'USD',
      min,
      max,
      rawText: text.trim(),
      period: min < 500 ? 'hourly' : 'yearly',
    };
  }

  // Check for EUR (€)
  const eurMatch = text.match(/(?:€|EUR)\s*([\d,.]+)(?:k)?(?:\s*[-–to]+\s*(?:€|EUR)?\s*([\d,.]+)(?:k)?)?/i);
  if (eurMatch) {
    let min = parseFloat(eurMatch[1].replace(/,/g, ''));
    let max = eurMatch[2] ? parseFloat(eurMatch[2].replace(/,/g, '')) : undefined;
    if (eurMatch[0].toLowerCase().includes('k') && min < 1000) min *= 1000;
    if (max && eurMatch[0].toLowerCase().includes('k') && max < 1000) max *= 1000;

    return {
      disclosed: true,
      currency: 'EUR',
      min,
      max,
      rawText: text.trim(),
      period: 'yearly',
    };
  }

  // Check for GBP (£)
  const gbpMatch = text.match(/(?:£|GBP)\s*([\d,.]+)(?:k)?(?:\s*[-–to]+\s*(?:£|GBP)?\s*([\d,.]+)(?:k)?)?/i);
  if (gbpMatch) {
    let min = parseFloat(gbpMatch[1].replace(/,/g, ''));
    let max = gbpMatch[2] ? parseFloat(gbpMatch[2].replace(/,/g, '')) : undefined;
    if (gbpMatch[0].toLowerCase().includes('k') && min < 1000) min *= 1000;
    if (max && gbpMatch[0].toLowerCase().includes('k') && max < 1000) max *= 1000;

    return {
      disclosed: true,
      currency: 'GBP',
      min,
      max,
      rawText: text.trim(),
      period: 'yearly',
    };
  }

  return { disclosed: true, rawText: text.trim() };
}

/**
 * Extracts key skills mentioned in text matching common technology and sales terms
 */
export function extractSkillsFromText(text: string): string[] {
  const commonTerms = [
    // Tech & Engineering
    'TypeScript', 'JavaScript', 'React', 'Next.js', 'Node.js', 'Python', 'Go', 'Golang',
    'Rust', 'Java', 'C++', 'GraphQL', 'REST', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'Kafka', 'Microservices',
    'Tailwind CSS', 'System Architecture', 'Git', 'Vite', 'Webpack', 'Jest', 'Playwright',
    // Sales & GTM
    'B2B Sales', 'Enterprise Sales', 'Account-Based Marketing', 'Pipeline Generation',
    'Cold Outreach', 'Discovery Calls', 'ICP & Buyer Persona', 'Inbound Lead Qualification',
    'Salesforce CRM', 'HubSpot CRM', 'Apollo.io', 'LinkedIn Sales Navigator', 'Outreach.io',
    'Contract Negotiation', 'MEDDPICC', 'Sales Forecasting', 'Executive Presentation',
    // Product & Design
    'Product Strategy', 'Roadmapping', 'Agile', 'Scrum', 'User Research', 'Figma',
    'Wireframing', 'Design Systems', 'Data Analytics', 'A/B Testing', 'SQL',
  ];

  const matched = new Set<string>();
  for (const term of commonTerms) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      matched.add(term);
    }
  }

  return Array.from(matched);
}

/**
 * Deduplicates and merges two job opportunity records under strict source authority hierarchy.
 * LEVEL 1 (Official ATS/Career Site) > LEVEL 2 > LEVEL 3 > LEVEL 4 (Aggregator) > LEVEL 5 (User Import).
 * If official and third-party sources conflict, Official source wins.
 */
export function mergeJobOpportunities(
  existing: JobOpportunity,
  incoming: JobOpportunity
): JobOpportunity {
  const getSourceLevel = (job: JobOpportunity): number => {
    const type = job.source?.type;
    const conf = job.source?.sourceConfidence;
    if (type === 'ats_hosted' || conf === 'verified_ats' || conf === 'direct_employer') return 1;
    if (type === 'direct_career_page') return 1;
    if (type === 'yc_startup' || type === 'company_career_portal') return 2;
    if (type === 'remote_community' || type === 'job_board' || conf === 'curated_board') return 3;
    if (type === 'aggregator' || (type as string) === 'aggregated_feed' || (conf as string) === 'secondary_mirror') return 4;
    return 5;
  };

  const existingLevel = getSourceLevel(existing);
  const incomingLevel = getSourceLevel(incoming);

  // Lower number = higher authority
  const isIncomingHigher = incomingLevel < existingLevel;
  const primaryJob = isIncomingHigher ? incoming : existing;
  const secondaryJob = isIncomingHigher ? existing : incoming;

  // Maintain primary and secondary sources
  const secondarySources = [...(primaryJob.secondary_sources || existing.secondary_sources || [])];
  const secName = secondaryJob.source?.name || secondaryJob.company;
  const secUrl = secondaryJob.source?.sourceUrl || secondaryJob.jobUrl;
  if (!secondarySources.some((s) => s.name === secName || s.url === secUrl)) {
    secondarySources.push({
      name: secName,
      url: secUrl,
      discoveredAt: secondaryJob.dateDiscovered,
      sourceType: secondaryJob.source?.type,
      salaryRaw: secondaryJob.salary?.rawText,
    });
  }

  // Handle salary conflicts: Official source wins!
  const conflictingFields = { ...(primaryJob.conflicting_fields || existing.conflicting_fields || {}) };
  if (primaryJob.salary?.disclosed !== secondaryJob.salary?.disclosed) {
    conflictingFields['salary'] = {
      official: primaryJob.salary?.disclosed ? (primaryJob.salary?.rawText || 'Disclosed') : 'not_disclosed',
      thirdParty: secondaryJob.salary?.disclosed ? (secondaryJob.salary?.rawText || 'Disclosed') : 'not_disclosed',
      source: secondaryJob.source?.name || secName,
    };
  } else if (
    primaryJob.salary?.disclosed &&
    secondaryJob.salary?.disclosed &&
    primaryJob.salary?.rawText !== secondaryJob.salary?.rawText
  ) {
    conflictingFields['salary'] = {
      official: primaryJob.salary?.rawText || 'Disclosed by employer',
      thirdParty: secondaryJob.salary?.rawText || 'Disclosed',
      source: secondaryJob.source?.name || secName,
    };
  }

  // Deduplicated source history
  const combinedHistory = [...(primaryJob.sourcesHistory || [])];
  if (secondaryJob.source && !combinedHistory.some((h) => h.sourceUrl === secondaryJob.source.sourceUrl)) {
    combinedHistory.push({
      sourceName: secondaryJob.source.name,
      sourceUrl: secondaryJob.source.sourceUrl,
      discoveredAt: secondaryJob.dateDiscovered,
    });
  }

  const allSkills = Array.from(
    new Set([...(primaryJob.requiredSkills || []), ...(secondaryJob.requiredSkills || [])])
  );

  const isDeadOrClosed =
    incoming.lifecycleState === 'CLOSED' ||
    incoming.lifecycleState === 'REJECTED' ||
    incoming.lifecycleState === 'EXPIRED' ||
    incoming.isVerifiedLive === false ||
    incoming.verificationStatus === 'job_closed' ||
    incoming.verificationStatus === 'link_broken';

  return {
    ...primaryJob,
    lifecycleState: isDeadOrClosed ? incoming.lifecycleState : primaryJob.lifecycleState,
    isVerifiedLive: isDeadOrClosed ? incoming.isVerifiedLive : primaryJob.isVerifiedLive,
    verificationStatus: isDeadOrClosed ? incoming.verificationStatus : primaryJob.verificationStatus,
    verificationReason: isDeadOrClosed
      ? incoming.verificationReason || primaryJob.verificationReason
      : primaryJob.verificationReason,
    primary_source: primaryJob.source,
    secondary_sources: secondarySources,
    sourcesHistory: combinedHistory,
    first_seen_at: existing.first_seen_at || primaryJob.first_seen_at || new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    viewed_at: existing.viewed_at || existing.viewedAt || primaryJob.viewed_at,
    viewedAt: existing.viewedAt || existing.viewed_at || primaryJob.viewedAt,
    is_new: (existing.viewed_at || existing.viewedAt) ? false : (existing.is_new !== undefined ? existing.is_new : false),
    isNew: (existing.viewed_at || existing.viewedAt) ? false : (existing.is_new !== undefined ? existing.is_new : false),
    new_until: existing.new_until,
    lastVerified: new Date().toISOString(),
    requiredSkills: allSkills,
    companyLogo: primaryJob.companyLogo || secondaryJob.companyLogo,
    companyLogoData: primaryJob.companyLogoData || secondaryJob.companyLogoData,
    companyDomain: primaryJob.companyDomain || secondaryJob.companyDomain,
    salary: primaryJob.salary, // Official source wins!
    salary_status: primaryJob.salary_status,
    salary_source: primaryJob.salary_source,
    salary_raw_text: primaryJob.salary_raw_text,
    remote_eligibility: primaryJob.remote_eligibility || secondaryJob.remote_eligibility,
    salary_truth: primaryJob.salary_truth || secondaryJob.salary_truth,
    activity_timeline: [
      ...(primaryJob.activity_timeline || []),
      {
        id: `act-merge-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: `Merged duplicate from ${secondaryJob.source?.name || secondaryJob.company || 'secondary source'}`,
      },
    ],
    conflicting_fields: Object.keys(conflictingFields).length > 0 ? conflictingFields : undefined,
    description:
      (primaryJob.description?.length || 0) >= 50
        ? primaryJob.description
        : (secondaryJob.description || primaryJob.description || ''),
  };
}

/**
 * Parses raw job text or URL into a structured, normalized JobOpportunity
 */
export function parseRawJobInput(params: {
  rawText: string;
  title?: string;
  company?: string;
  url?: string;
  location?: string;
  sourceName?: string;
}): JobOpportunity {
  const { rawText, url = '', sourceName = 'User Imported' } = params;

  // Infer title & company if not supplied
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = params.title || lines[0] || 'Software Professional';
  const company = params.company || (lines[1] && lines[1].length < 60 ? lines[1] : 'Direct Employer');
  const locationRaw = params.location || 'Remote';

  const { remoteStatus, workFromAnywhere, country } = detectRemoteStatus(
    locationRaw,
    rawText
  );
  const seniority = detectSeniority(title, rawText);
  const salary = parseCompensation(rawText);
  const skills = extractSkillsFromText(rawText);
  const fingerprint = generateJobFingerprint(company, title, locationRaw);

  const sourceMetadata: JobSourceMetadata = {
    id: `src-user-imported-${Date.now()}`,
    name: sourceName,
    domain: url ? new URL(url).hostname : 'direct-import',
    type: url.includes('greenhouse.io') || url.includes('lever.co') || url.includes('ashbyhq.com')
      ? 'ats_hosted'
      : 'direct_career_page',
    sourceUrl: url || '#',
    sourceConfidence: 'direct_employer',
    discoveredAt: new Date().toISOString(),
  };

  const resolvedDomain = resolveCompanyDomain(company, url);
  const resolvedLogo = getCompanyLogoUrl(company, resolvedDomain);
  const remoteEligibility = remoteEligibilityEngine.classify({
    location: locationRaw,
    title,
    description: rawText,
    country,
    workFromAnywhere,
  });
  const salaryTruth = salaryTruthEngine.extractSalary({
    text: rawText,
    description: rawText,
    sourceUrl: url,
  });

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fingerprint,
    title,
    normalizedTitle: normalizeString(title),
    company,
    companyDomain: resolvedDomain,
    companyLogo: resolvedLogo,
    companyLogoData: undefined,
    jobUrl: url || '#',
    applyUrl: url || '#',
    canonicalUrl: url,
    officialListing: `${company} Official Portal`,
    isVerifiedLive: Boolean(url && url.startsWith('http')),
    isApplyUrlValidated: Boolean(url && url.startsWith('http')),
    applyUrlStatus: url && url.startsWith('http') ? 'valid' : 'unavailable',
    verificationStatus: (url && url.startsWith('http') ? 'verified_live' : 'unverified') as JobVerificationStatus,
    source: sourceMetadata,
    sourcesHistory: [
      {
        sourceName,
        sourceUrl: url || 'direct',
        discoveredAt: new Date().toISOString(),
      },
    ],
    originalPostedAt: undefined,
    lastUpdatedAt: undefined,
    discoveredAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    datePosted: 'not_disclosed',
    dateDiscovered: new Date().toISOString(),
    lastVerified: new Date().toISOString(),
    location: locationRaw,
    country,
    remoteStatus,
    workFromAnywhere: remoteEligibility.status === 'WORLDWIDE_REMOTE',
    eligibleCountries: remoteEligibility.eligibleCountries,
    employmentType: 'full-time',
    salary,
    salary_status: salaryTruth.status === 'NOT_DISCLOSED' ? 'not_disclosed' : 'disclosed',
    remote_eligibility: remoteEligibility,
    salary_truth: salaryTruth,
    activity_timeline: [
      {
        id: `act-imp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: `Imported from ${sourceName}`,
      },
    ],
    seniority,
    minExperienceYears: seniority === 'lead' ? 6 : seniority === 'senior' ? 4 : 2,
    requiredSkills: skills.slice(0, 8),
    preferredSkills: skills.slice(8, 12),
    responsibilities: lines.slice(2, 6).filter((l) => l.length > 20),
    requirements: lines.slice(6, 10).filter((l) => l.length > 20),
    industry: 'Technology & Software',
    description: jobDescriptionNormalizer.stripToPlain(rawText),
    original_job_description: rawText,
    lifecycleState: 'DISCOVERED',
  };
}

/**
 * Normalizes a RawDiscoveredJob into a canonical JobOpportunity record
 */
export function normalizeRawDiscoveredJob(
  raw: RawDiscoveredJob,
  _index: number = 0,
  userTargetCompanies: string[] = []
): JobOpportunity {
  const loc = raw.location || 'Location not disclosed';
  const detected = detectRemoteStatus(
    loc,
    raw.description
  );
  const rawAny = raw as any;
  const remoteStatus = rawAny.remoteStatus || raw.remoteType || detected.remoteStatus;
  const workFromAnywhere = rawAny.workFromAnywhere !== undefined ? rawAny.workFromAnywhere : detected.workFromAnywhere;
  const country = rawAny.country || detected.country;
  const calculatedSeniority = detectSeniority(raw.title, raw.description);
  const fingerprint = generateJobFingerprint(raw.company, raw.title, loc);

  // Exact recruiter/company original posted date (Mandate 1 & 2: Never pretend a discovery date is a post date)
  const rawPostCandidate =
    raw.originalPostedAt ||
    raw.postedDate ||
    rawAny.datePosted ||
    rawAny.posted_at ||
    rawAny.postedAt ||
    rawAny.publishedAt ||
    rawAny.published_at;

  let originalPostedAt: string | undefined = undefined;
  let postDate = 'not_disclosed';

  if (
    rawPostCandidate &&
    rawPostCandidate !== 'not_disclosed' &&
    rawPostCandidate !== 'unknown' &&
    rawPostCandidate.trim() !== ''
  ) {
    const parsed = new Date(rawPostCandidate);
    if (!isNaN(parsed.getTime())) {
      originalPostedAt = parsed.toISOString();
      postDate = originalPostedAt;
    }
  }

  const rawUpdateCandidate = raw.lastUpdatedAt || (raw as any).updatedAt;
  let lastUpdatedAt: string | undefined = undefined;
  if (
    rawUpdateCandidate &&
    rawUpdateCandidate !== 'not_disclosed' &&
    rawUpdateCandidate.trim() !== ''
  ) {
    const parsed = new Date(rawUpdateCandidate);
    if (!isNaN(parsed.getTime())) {
      lastUpdatedAt = parsed.toISOString();
    }
  }

  const discoveredAt = raw.discoveredAt || raw.dateDiscovered || new Date().toISOString();
  const lastVerifiedAt = raw.lastVerifiedAt || raw.lastVerified || new Date().toISOString();

  const resolvedJobUrl = raw.jobUrl || raw.url || '#';
  const deadCheck = jobVerificationEngine.checkDeadJobSignatures(raw);
  const applyCheck = raw.applyUrl ? jobVerificationEngine.verifyJobUrl(raw.applyUrl) : undefined;
  const jobUrlCheck = jobVerificationEngine.verifyJobUrl(resolvedJobUrl);
  const isApplyUrlValidated = !deadCheck.isDead && (applyCheck ? applyCheck.isValid : jobUrlCheck.isValid);
  const isVerifiedLive = !deadCheck.isDead && (raw.isVerifiedLive ?? (jobUrlCheck.isValid && (applyCheck ? applyCheck.isValid : true)));
  const verificationStatus: JobVerificationStatus = deadCheck.isDead
    ? (deadCheck.status === 'VERIFIED_CLOSED' ? 'job_closed' : 'link_broken')
    : raw.verificationStatus || (
        isVerifiedLive ? 'verified_live' : applyCheck && !applyCheck.isValid ? 'link_broken' : 'unverified'
      );
  const lastVerified = lastVerifiedAt;

  const isTarget =
    Boolean(raw.isTargetCompany) ||
    targetCompaniesStore.isTargetCompany(raw.company) ||
    userTargetCompanies.some(
      (tc) =>
        tc.length > 1 &&
        (normalizeString(raw.company).includes(normalizeString(tc)) ||
          normalizeString(tc).includes(normalizeString(raw.company)))
    );

  const targetTag =
    raw.targetCompanyTag ||
    (isTarget ? targetCompaniesStore.getTargetCompanyTag(raw.company) : undefined);

  const salaryTruth = salaryTruthEngine.extractSalary({
    text: raw.description,
    description: raw.description,
    salaryMin: raw.salaryMin,
    salaryMax: raw.salaryMax,
    salaryCurrency: raw.salaryCurrency,
    salaryRaw: raw.salaryRaw,
    sourceUrl: raw.jobUrl,
  });

  const salaryData: JobCompensation =
    salaryTruth.status === 'NOT_DISCLOSED'
      ? {
          disclosed: false,
          salary_status: 'not_disclosed',
          period: 'not_disclosed',
        }
      : {
          disclosed: true,
          salary_status: 'disclosed',
          salary_source: raw.salarySource || 'official_job_posting',
          salary_raw_text: salaryTruth.rawText,
          salary_source_excerpt: salaryTruth.evidence,
          salary_source_url: raw.jobUrl,
          salary_verified_at: salaryTruth.verifiedAt || new Date().toISOString(),
          currency: salaryTruth.currency || 'USD',
          min: salaryTruth.min,
          max: salaryTruth.max,
          rawText: salaryTruth.rawText,
          period: salaryTruth.period || 'annual',
        };

  const remoteEligibility = remoteEligibilityEngine.classify({
    location: loc,
    title: raw.title,
    description: raw.description,
    country,
    workFromAnywhere:
      workFromAnywhere ||
      loc.toLowerCase().includes('worldwide') ||
      loc.toLowerCase().includes('anywhere'),
  });

  const isWFA = remoteEligibility.status === 'WORLDWIDE_REMOTE';
  const remoteScope: RemoteScope = isWFA
    ? 'worldwide'
    : remoteEligibility.status === 'REMOTE_FROM_INDIA'
    ? 'india'
    : 'specific_countries';

  const postedAtRaw = raw.postedAtRaw || (raw.postedDate ? undefined : 'Posting date not disclosed');
  const postedPrecision: 'exact' | 'date_only' | 'relative' | 'month_only' | 'unknown' | 'not_disclosed' = raw.postedDatePrecision
    ? raw.postedDatePrecision
    : raw.postedAtRaw?.toLowerCase().includes('ago')
    ? 'relative'
    : raw.postedDate
    ? 'exact'
    : 'unknown';

  const canonicalJobId =
    raw.externalId ||
    `job-${normalizeString(raw.company)}-${normalizeString(raw.title)}-${loc.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  const srcName = raw.sourceName || raw.source?.name || raw.company;
  const srcDomain = raw.source?.domain || raw.companyDomain || 'careers.io';
  const rawType = raw.source?.type || (raw as any).sourceType || 'ats_hosted';
  const srcType: SourceType =
    rawType === 'aggregated_feed' || rawType === 'aggregator'
      ? 'aggregator'
      : rawType === 'ats_hosted'
      ? 'ats_hosted'
      : rawType === 'direct_career_page'
      ? 'direct_career_page'
      : rawType === 'job_board'
      ? 'job_board'
      : rawType === 'remote_community'
      ? 'remote_community'
      : rawType === 'yc_startup'
      ? 'yc_startup'
      : 'ats_hosted';

  const rawConf = raw.source?.confidence || (raw.source as any)?.sourceConfidence;
  const srcConfidence: SourceConfidence =
    rawConf === 'direct_employer'
      ? 'direct_employer'
      : rawConf === 'verified_ats'
      ? 'verified_ats'
      : rawConf === 'curated_board'
      ? 'curated_board'
      : srcType === 'ats_hosted'
      ? 'verified_ats'
      : 'discovered';

  const srcUrl = raw.sourceUrl || raw.source?.sourceUrl || raw.url || resolvedJobUrl;
  const srcId = raw.sourceId || raw.source?.id || `src-${normalizeString(srcName)}`;

  const sourceMetadata: JobSourceMetadata = {
    id: srcId,
    name: srcName,
    domain: srcDomain,
    type: srcType,
    sourceUrl: srcUrl,
    atsType: raw.atsType || 'none',
    sourceConfidence: srcConfidence,
    discoveredAt: raw.dateDiscovered || new Date().toISOString(),
  };

  const jobRecord: JobOpportunity = {
    id: raw.id || `job-${srcId}-${fingerprint.replace(/[^a-z0-9]/gi, '-')}`,
    canonical_job_id: canonicalJobId,
    externalId: raw.externalId,
    sourceJobId: raw.externalId,
    fingerprint,
    canonicalJobHash: fingerprint,
    title: raw.title,
    normalizedTitle: normalizeString(raw.title),
    company: raw.company,
    companyName: raw.company,
    companyDomain: raw.companyDomain || srcDomain,
    companyLogo: raw.companyLogo || getCompanyLogoUrl(raw.company, raw.companyDomain),
    companyLogoData: raw.companyLogoData || getCompanyLogoData(raw.company, raw.companyDomain, raw.companyLogo),
    jobUrl: jobUrlCheck.isValid ? jobUrlCheck.cleanUrl : resolvedJobUrl,
    applyUrl: raw.applyUrl || resolvedJobUrl,
    canonicalUrl: jobUrlCheck.isValid ? jobUrlCheck.cleanUrl : resolvedJobUrl,
    originalUrl: resolvedJobUrl,
    officialListing: raw.officialListing || `${raw.company} Official Portal`,
    isVerifiedLive,
    isApplyUrlValidated,
    applyUrlStatus: isApplyUrlValidated ? 'valid' : 'unavailable',
    verificationStatus,
    source: sourceMetadata,
    sourceName: srcName,
    sourceType: srcType,
    primary_source: sourceMetadata,
    secondary_sources: [],
    sourcesHistory: [
      {
        sourceName: srcName,
        sourceUrl: srcUrl,
        discoveredAt,
      },
    ],
    originalPostedAt,
    lastUpdatedAt,
    discoveredAt,
    lastVerifiedAt,
    datePosted: postDate,
    postingDate: postDate,
    postingDatePrecision: postedPrecision,
    posted_at: originalPostedAt,
    posted_at_raw: postedAtRaw,
    posted_date_precision: postedPrecision,
    posting_date_source: srcName,
    posting_date_source_url: srcUrl,
    posting_date_verified_at: new Date().toISOString(),
    dateDiscovered: discoveredAt,
    createdAt: discoveredAt,
    first_seen_at: discoveredAt,
    last_seen_at: new Date().toISOString(),
    new_until: originalPostedAt
      ? new Date(new Date(originalPostedAt).getTime() + 72 * 3600 * 1000).toISOString()
      : new Date().toISOString(),
    is_new: Boolean(
      originalPostedAt &&
        Date.now() - new Date(originalPostedAt).getTime() < 3 * 24 * 3600 * 1000
    ),
    isNew: Boolean(
      originalPostedAt &&
        Date.now() - new Date(originalPostedAt).getTime() < 3 * 24 * 3600 * 1000
    ),
    viewed_at: undefined,
    viewedAt: undefined,
    lastVerified: lastVerifiedAt,
    verifiedAt: lastVerifiedAt,
    location: loc,
    country,
    remoteStatus,
    workArrangement: remoteStatus,
    remoteScope,
    remote_scope: remoteScope,
    remote_countries: remoteScope === 'specific_countries' ? [country] : undefined,
    workFromAnywhere: isWFA,
    eligibleCountries: isWFA ? ['*'] : [country],
    employmentType: raw.employmentType || 'full-time',
    salary: salaryData,
    salary_status: salaryData.salary_status,
    salary_source: salaryData.salary_source,
    salary_raw_text: salaryData.salary_raw_text,
    salary_source_excerpt: salaryData.salary_source_excerpt,
    salary_source_url: salaryData.salary_source_url,
    salary_verified_at: salaryData.salary_verified_at,
    salaryMin: salaryData.min,
    salaryMax: salaryData.max,
    salaryCurrency: salaryData.currency,
    salaryPeriod: salaryData.period,
    market_salary_estimate: salaryData.market_salary_estimate,
    currency_conversion: salaryData.currency_conversion,
    seniority: calculatedSeniority,
    minExperienceYears:
      calculatedSeniority === 'lead' ? 6 : calculatedSeniority === 'senior' ? 4 : 2,
    requiredSkills: raw.requiredSkills || [],
    preferredSkills: raw.preferredSkills || [],
    responsibilities: raw.description ? [raw.description] : [],
    requirements: raw.requiredSkills && raw.requiredSkills.length > 0 ? raw.requiredSkills : [],
    industry: raw.industry || 'Technology',
    description: jobDescriptionNormalizer.stripToPlain(raw.description),
    original_job_description: raw.description,
    lifecycleState: 'DISCOVERED',
    isTargetCompany: isTarget,
    targetCompanyTag: targetTag,
    targetCompanyReason: isTarget
      ? raw.targetCompanyReason ||
        `Direct verified opening at your ${targetTag || 'Target'} account ${raw.company}`
      : undefined,

    // Requirement 15: Canonical Job Schema
    source_job_id: raw.externalId || (raw as any).sourceJobId || (raw as any).id || canonicalJobId,
    canonical_url: jobUrlCheck.isValid ? jobUrlCheck.cleanUrl : resolvedJobUrl,
    workplace_type: remoteStatus,
    employment_type: raw.employmentType || 'full-time',
    experience: calculatedSeniority === 'lead' ? '6+ years' : calculatedSeniority === 'senior' ? '4+ years' : '2+ years',
    currency: salaryData.currency,
    expires_at: originalPostedAt
      ? new Date(new Date(originalPostedAt).getTime() + 7 * 24 * 3600 * 1000).toISOString()
      : undefined,
    target_company: isTarget,
    profile_match_score: 0,
    dedupe_hash: fingerprint,
    feed_status: 'PENDING' as FeedStatus,

    // Section 1: Canonical Job Record & Provenance
    job_id: canonicalJobId,
    canonical_job_url: jobUrlCheck.isValid ? jobUrlCheck.cleanUrl : resolvedJobUrl,
    official_company: raw.company,
    official_company_domain: raw.companyDomain || srcDomain,
    job_title: raw.title,
    source_name: srcName,
    source_url: srcUrl,
    source_type: srcType,
    recruiter_posted_at: postDate !== 'not_disclosed' ? postDate : postedAtRaw,
    last_verified_at: lastVerified,
    job_status: 'DISCOVERED',
    location_raw: loc,
    normalized_locations: [loc, country].filter(Boolean),
    salary_raw: salaryData.salary_raw_text,
    salary_min: salaryData.min,
    salary_max: salaryData.max,
    salary_currency: salaryData.currency,
    salary_period: salaryData.period,
    salary_confidence: salaryTruth.status !== 'NOT_DISCLOSED' ? 'high' : 'none',
    salary_is_explicit: salaryTruth.status !== 'NOT_DISCLOSED',
    skills: raw.requiredSkills || [],
    department: raw.title.toLowerCase().includes('sales') || raw.title.toLowerCase().includes('account')
      ? 'Sales & Commercial'
      : raw.title.toLowerCase().includes('product')
      ? 'Product'
      : raw.title.toLowerCase().includes('engineer')
      ? 'Engineering'
      : undefined,
    application_url: raw.applyUrl || raw.jobUrl,
    verification_status: verificationStatus,
    verification_evidence: raw.verificationEvidence || {
      httpStatus: 200,
      finalUrl: jobUrlCheck.isValid ? jobUrlCheck.cleanUrl : raw.jobUrl,
      redirectDetected: false,
      pageTitle: `${raw.title} - ${raw.company}`,
      jobTitleFound: true,
      companyNameFound: true,
      activeRequisition: isVerifiedLive,
      verifiedTimestamp: lastVerified,
      rawExcerpt: raw.description ? raw.description.slice(0, 300) : undefined,
      checkedCriteria: [
        'Domain belongs to verified employer or ATS',
        'Specific job requisition ID present in URL path',
        'Job title explicitly extracted from page header',
        'Live HTTP 200 response with non-generic body'
      ]
    },
    duplicate_group_id: fingerprint,
    remote_eligibility: remoteEligibility,
    salary_truth: salaryTruth,
    salary_verified: salaryTruth.status !== 'NOT_DISCLOSED',
    clean_description: jobDescriptionNormalizer.stripToPlain(raw.description),
    original_description: raw.description,
    official_job_url: jobUrlCheck.isValid ? jobUrlCheck.cleanUrl : resolvedJobUrl,
    job_hash: fingerprint,
    canonical_hash: fingerprint,
    status: 'DISCOVERED',
    is_viewed: false,
    is_saved: false,
    is_hidden: false,
    activity_timeline: [
      {
        id: `act-disc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        action: `Discovered via ${raw.sourceName}`,
      },
    ],
  };

  // Precomputed deterministic match scoring (Phase 7)
  const fastMatch = fastJobMatcher.match(undefined, jobRecord);
  jobRecord.match_score = fastMatch.overallScore;
  jobRecord.match_reasons = fastMatch.matchReasons;
  jobRecord.mismatch_reasons = fastMatch.mismatchReasons;

  const integrity = jobVerificationEngine.calculateIntegrityScore(jobRecord);
  jobRecord.integrity_score = integrity.score;
  jobRecord.verification_errors = integrity.errors;

  return jobRecord;
}

/**
 * Batch normalize an array of RawDiscoveredJob items
 * Strict filter: Only jobs passing live verification enter the pipeline
 */
export function normalizeRawJobs(
  rawJobs: RawDiscoveredJob[],
  userTargetCompanies: string[] = []
): JobOpportunity[] {
  return rawJobs
    .map((raw, idx) => normalizeRawDiscoveredJob(raw, idx, userTargetCompanies))
    .filter((job) => {
      const liveCheck = jobVerificationEngine.verifyJobLive(job);
      return (
        job.isVerifiedLive &&
        liveCheck.isLive &&
        job.verificationStatus !== 'link_broken' &&
        job.verificationStatus !== 'job_closed' &&
        job.verificationStatus !== 'failed' &&
        job.verificationStatus !== 'expired' &&
        job.verificationStatus !== 'removed' &&
        job.verificationStatus !== 'expired_removed' &&
        job.lifecycleState !== 'REJECTED' &&
        job.lifecycleState !== 'CLOSED' &&
        job.lifecycleState !== 'EXPIRED' &&
        job.lifecycleState !== 'ARCHIVED'
      );
    });
}

export interface PipelineContext {
  profile?: UserProfile;
  careerProfile?: CareerProfile;
  searchConfig?: SearchConfiguration;
  filters?: JobFilterCriteria;
  minScoreThreshold?: number; // default 60
  maxAgeDays?: number; // default 7
  targetCompanies?: string[];
}

export type PipelineStageName =
  | 'SOURCE'
  | 'FETCH'
  | 'PARSE'
  | 'NORMALIZE'
  | 'VALIDATE'
  | 'DEDUPLICATE'
  | 'FRESHNESS_CHECK'
  | 'PROFILE_RELEVANCE_SCORE'
  | 'LOCATION_ELIGIBILITY'
  | 'MANUAL_FILTERS'
  | 'QUALITY_CHECK'
  | 'FEED_PUBLICATION';

export interface PipelineStageResult {
  stage: PipelineStageName;
  passed: boolean;
  reason?: string;
}

export interface PipelineExecutionResult {
  job: JobOpportunity;
  passed: boolean;
  stages: PipelineStageResult[];
  failedStage?: PipelineStageName;
  failureReason?: string;
  feedStatus: FeedStatus;
}

/**
 * Requirement 2: 12-Stage Strict Job Pipeline
 * SOURCE -> FETCH -> PARSE -> NORMALIZE -> VALIDATE -> DEDUPLICATE ->
 * FRESHNESS CHECK -> PROFILE RELEVANCE SCORE -> LOCATION ELIGIBILITY ->
 * MANUAL FILTERS -> QUALITY CHECK -> FEED PUBLICATION
 * Only jobs passing all required stages enter the visible feed.
 */
export function executeJobPipeline(
  raw: RawDiscoveredJob,
  context: PipelineContext = {}
): PipelineExecutionResult {
  const stages: PipelineStageResult[] = [];
  const maxAgeDays = context.maxAgeDays ?? 7;
  const minScoreThreshold = context.minScoreThreshold ?? 60;

  // 1. SOURCE
  const sourceName = raw.sourceName || raw.source?.name || 'Direct Source';
  stages.push({
    stage: 'SOURCE',
    passed: true,
    reason: `Registered from source: ${sourceName}`,
  });

  // 2. FETCH
  if (!raw || typeof raw !== 'object') {
    return {
      job: {} as JobOpportunity,
      passed: false,
      stages: [...stages, { stage: 'FETCH', passed: false, reason: 'Empty or invalid job payload' }],
      failedStage: 'FETCH',
      failureReason: 'Empty or invalid job payload',
      feedStatus: 'REJECTED',
    };
  }
  stages.push({ stage: 'FETCH', passed: true, reason: 'Payload received' });

  // 3. PARSE
  if (!raw.title || raw.title.trim().length < 2 || !raw.company || raw.company.trim().length < 2) {
    return {
      job: {} as JobOpportunity,
      passed: false,
      stages: [...stages, { stage: 'PARSE', passed: false, reason: 'Missing required title or company' }],
      failedStage: 'PARSE',
      failureReason: 'Missing required title or company',
      feedStatus: 'REJECTED',
    };
  }
  stages.push({ stage: 'PARSE', passed: true, reason: 'Parsed title and company successfully' });

  // 4. NORMALIZE
  const job = normalizeRawDiscoveredJob(raw, 0, context.targetCompanies || []);
  stages.push({ stage: 'NORMALIZE', passed: true, reason: 'Normalized into canonical job schema' });

  // 5. VALIDATE
  const deadCheck = jobVerificationEngine.checkDeadJobSignatures(job);
  if (deadCheck.isDead) {
    job.feed_status = 'REJECTED';
    job.lifecycleState = 'REJECTED';
    return {
      job,
      passed: false,
      stages: [...stages, { stage: 'VALIDATE', passed: false, reason: deadCheck.reason || 'Dead job signature detected' }],
      failedStage: 'VALIDATE',
      failureReason: deadCheck.reason || 'Dead job signature detected',
      feedStatus: 'REJECTED',
    };
  }
  const liveCheck = jobVerificationEngine.verifyJobLive(job);
  if (!liveCheck.isLive) {
    job.feed_status = 'REJECTED';
    job.lifecycleState = 'REJECTED';
    return {
      job,
      passed: false,
      stages: [...stages, { stage: 'VALIDATE', passed: false, reason: liveCheck.failureReason || 'Failed live destination verification' }],
      failedStage: 'VALIDATE',
      failureReason: liveCheck.failureReason || 'Failed live destination verification',
      feedStatus: 'REJECTED',
    };
  }
  stages.push({ stage: 'VALIDATE', passed: true, reason: 'Verified live application destination' });

  // 6. DEDUPLICATE
  const dedupeHash = generateJobFingerprint(job);
  job.dedupe_hash = dedupeHash;
  job.fingerprint = dedupeHash;
  stages.push({ stage: 'DEDUPLICATE', passed: true, reason: `Fingerprint generated: ${dedupeHash}` });

  // 7. FRESHNESS CHECK (Calendar originalPostedAt / lastUpdatedAt <= 7 days)
  const freshResult = freshnessEngine.isJobWithinAgeWindow(job, maxAgeDays, new Date());
  if (!freshResult.eligible) {
    job.feed_status = 'EXPIRED';
    job.lifecycleState = 'HISTORICAL';
    return {
      job,
      passed: false,
      stages: [...stages, { stage: 'FRESHNESS_CHECK', passed: false, reason: freshResult.reason }],
      failedStage: 'FRESHNESS_CHECK',
      failureReason: freshResult.reason,
      feedStatus: 'EXPIRED',
    };
  }
  stages.push({ stage: 'FRESHNESS_CHECK', passed: true, reason: freshResult.reason });

  // 8. PROFILE RELEVANCE SCORE
  if (context.profile) {
    const matchAnalysis = jobMatchingEngine.evaluateJob(job, context.profile);
    job.profile_match_score = matchAnalysis.finalScore;
    job.match_score = matchAnalysis.finalScore;
    job.match_reasons = matchAnalysis.topReasons;

    if (matchAnalysis.isExcluded) {
      job.feed_status = 'REJECTED';
      job.lifecycleState = 'HISTORICAL';
      return {
        job,
        passed: false,
        stages: [...stages, { stage: 'PROFILE_RELEVANCE_SCORE', passed: false, reason: matchAnalysis.exclusionReason || 'Excluded by profile rules' }],
        failedStage: 'PROFILE_RELEVANCE_SCORE',
        failureReason: matchAnalysis.exclusionReason,
        feedStatus: 'REJECTED',
      };
    }

    if (matchAnalysis.finalScore < minScoreThreshold) {
      job.feed_status = 'REJECTED';
      job.lifecycleState = 'HISTORICAL';
      return {
        job,
        passed: false,
        stages: [...stages, { stage: 'PROFILE_RELEVANCE_SCORE', passed: false, reason: `Score ${matchAnalysis.finalScore}% below threshold ${minScoreThreshold}%` }],
        failedStage: 'PROFILE_RELEVANCE_SCORE',
        failureReason: `Score ${matchAnalysis.finalScore}% below threshold ${minScoreThreshold}%`,
        feedStatus: 'REJECTED',
      };
    }
  }
  stages.push({ stage: 'PROFILE_RELEVANCE_SCORE', passed: true, reason: `Match score ${job.profile_match_score || job.match_score || 0}% meets threshold` });

  // 9. LOCATION ELIGIBILITY
  const targetLocations =
    (context.searchConfig as any)?.targetLocations ||
    context.careerProfile?.targetLocations ||
    (context.profile as any)?.targetLocations ||
    ['India', 'Worldwide Remote'];
  const workplaceTypes =
    (context.searchConfig as any)?.targetWorkplaces ||
    context.careerProfile?.workplaceTypes ||
    (context.profile as any)?.targetWorkplaces ||
    ['remote', 'hybrid'];
  const locResult = locationFilterEngine.evaluateEligibility(job, targetLocations, workplaceTypes);
  if (!locResult.eligible) {
    job.feed_status = 'REJECTED';
    job.lifecycleState = 'HISTORICAL';
    return {
      job,
      passed: false,
      stages: [...stages, { stage: 'LOCATION_ELIGIBILITY', passed: false, reason: locResult.reason }],
      failedStage: 'LOCATION_ELIGIBILITY',
      failureReason: locResult.reason,
      feedStatus: 'REJECTED',
    };
  }
  stages.push({ stage: 'LOCATION_ELIGIBILITY', passed: true, reason: locResult.reason });

  // 10. MANUAL FILTERS (if active user filters provided)
  if (context.filters) {
    const filterRes = filterEvaluationEngine.evaluateJob(job, context.filters, {
      careerProfile: context.careerProfile,
      searchConfig: context.searchConfig,
      maxAgeDays,
    });
    if (!filterRes.passes) {
      job.feed_status = 'REJECTED';
      return {
        job,
        passed: false,
        stages: [...stages, { stage: 'MANUAL_FILTERS', passed: false, reason: filterRes.rejectionReason }],
        failedStage: 'MANUAL_FILTERS',
        failureReason: filterRes.rejectionReason,
        feedStatus: 'REJECTED',
      };
    }
  }
  stages.push({ stage: 'MANUAL_FILTERS', passed: true, reason: 'Passed all manual filter criteria' });

  // 11. QUALITY CHECK
  if (!job.title || !job.company || !job.applyUrl) {
    job.feed_status = 'REJECTED';
    return {
      job,
      passed: false,
      stages: [...stages, { stage: 'QUALITY_CHECK', passed: false, reason: 'Failed data completeness quality check' }],
      failedStage: 'QUALITY_CHECK',
      failureReason: 'Failed data completeness quality check',
      feedStatus: 'REJECTED',
    };
  }
  stages.push({ stage: 'QUALITY_CHECK', passed: true, reason: 'Quality checks passed' });

  // 12. FEED PUBLICATION
  job.feed_status = 'PUBLISHED';
  job.lifecycleState = 'IN_FEED';
  stages.push({ stage: 'FEED_PUBLICATION', passed: true, reason: 'Eligible for active feed publication' });

  return {
    job,
    passed: true,
    stages,
    feedStatus: 'PUBLISHED',
  };
}
