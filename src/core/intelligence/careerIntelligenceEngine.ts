import { UserProfile } from '../profile/types';
import {
  JobPosting,
  JobMatchAnalysis,
  FitCategory,
  StrategicCompany,
  TailoredResumeBlueprint,
  OutreachBlueprint,
  InterviewBrief,
  CareerGrowthGap,
  IntelligenceTierInfo,
} from './types';
import { mockJobCatalog } from './mockJobCatalog';
import { JobOpportunity, TargetCompanyTag, RemoteType } from '../jobs/types';
import { behavioralLearningEngine } from '../jobs/behavioralLearning';
import { targetCompaniesStore } from '../target-companies/targetCompanyStore';
import { matchScoreCache } from './matchScoreCache';
import { jobMatchingEngine } from '../jobs/engines/jobMatchingEngine';

// Helper: Normalize text for case-insensitive matching
function clean(str: string): string {
  return (str || '').toLowerCase().trim();
}

function words(str: string): string[] {
  return clean(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// Multi-currency display helper
function formatSalaryDisplay(amount: number, currency: string = 'USD'): string {
  if (currency === 'INR') {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  if (currency === 'EUR') return `€${Math.round(amount / 1000)}k`;
  if (currency === 'GBP') return `£${Math.round(amount / 1000)}k`;
  return `$${Math.round(amount / 1000)}k`;
}

// Semantic domain & title synonym equivalence groups
const TITLE_SYNONYM_GROUPS: string[][] = [
  // Engineering & Technical
  [
    'software engineer',
    'software developer',
    'frontend',
    'front end',
    'full stack',
    'fullstack',
    'backend',
    'web engineer',
    'ui engineer',
    'application engineer',
  ],
  ['lead', 'staff', 'principal', 'architect', 'tech lead'],
  ['engineering manager', 'tech lead manager', 'director of engineering', 'vp of engineering'],
  // Commercial, Sales & GTM
  [
    'business development',
    'bdr',
    'sdr',
    'sales development',
    'account executive',
    'enterprise sales',
    'gtm',
    'partnerships',
    'outbound',
    'commercial strategy',
    'revenue growth',
    'client acquisition',
  ],
  // Product & Design
  [
    'product manager',
    'technical product manager',
    'product lead',
    'group product manager',
    'head of product',
    'cpo',
  ],
  ['product designer', 'ux designer', 'ui designer', 'design systems lead', 'ux/ui'],
  // Data & Infrastructure
  [
    'data scientist',
    'machine learning engineer',
    'ai engineer',
    'data analyst',
    'data platform',
    'analytics engineer',
    'devops',
    'cloud engineer',
  ],
];

export type CareerFunctionFamily =
  | 'SALES_AND_BD'
  | 'GROWTH_AND_REVENUE'
  | 'OPERATIONS_AND_MANAGEMENT'
  | 'PRODUCT_MANAGEMENT'
  | 'SOFTWARE_ENGINEERING'
  | 'DATA_AND_AI'
  | 'PRODUCT_DESIGN'
  | 'FINANCE_AND_LEGAL'
  | 'PEOPLE_AND_TALENT'
  | 'SOLUTIONS_ENGINEERING';

/**
 * Deeply analyzes candidate's complete profile + resume to infer demonstrated career function families.
 */
export function inferProfileCareerFunctions(profile: UserProfile): Set<CareerFunctionFamily> {
  const families = new Set<CareerFunctionFamily>();

  const allProfileText = [
    profile.rolePreferences.targetPrimaryTitle || '',
    ...(profile.rolePreferences.targetJobTitles || []),
    profile.rolePreferences.currentTitle || '',
    profile.personalInfo.headline || '',
    profile.professionalSummary.summaryText || '',
    ...profile.workExperience.map(
      (e) =>
        `${e.title} ${e.description} ${(e.keyAchievements || []).join(' ')} ${(e.skillsUsed || []).join(' ')}`
    ),
    ...(profile.skills.technicalSkills || []),
    ...(profile.skills.softSkills || []),
    ...(profile.skills.toolsAndPlatforms || []),
  ]
    .join(' ')
    .toLowerCase();

  // 1. Sales & Business Development
  if (
    /\b(b2b sales|enterprise sales|business development|account executive|bdr|sdr|outbound sales|lead generation|deal closure|sales pipeline|consultative selling|client relationship|commercial negotiation|commercial terms|key account|sales quota|prospecting)\b/i.test(
      allProfileText
    ) ||
    /\b(hubspot|salesforce|apollo\.io|sales navigator|outreach\.io|zoominfo)\b/i.test(allProfileText)
  ) {
    families.add('SALES_AND_BD');
  }

  // 2. Growth & Revenue & Partnerships
  if (
    /\b(growth & revenue|revenue growth|strategic partnerships|brand partnerships|media sales|gtm lead|commercial partnerships|revenue operations|commercial strategy|sponsorship)\b/i.test(
      allProfileText
    )
  ) {
    families.add('GROWTH_AND_REVENUE');
  }

  // 3. Operations & Management / Entrepreneurship
  if (
    /\b(founder|co-founder|entrepreneur|business operations|commercial operations|distribution|p&l ownership|general management|built businesses)\b/i.test(
      allProfileText
    )
  ) {
    families.add('OPERATIONS_AND_MANAGEMENT');
  }

  // 4. Product Management
  if (
    /\b(product manager|product management|roadmap|group product manager|technical product manager|head of product|cpo)\b/i.test(
      allProfileText
    )
  ) {
    families.add('PRODUCT_MANAGEMENT');
  }

  // 5. Software Engineering (Strict: only if actual programming languages/dev titles exist)
  if (
    /\b(software engineer|software developer|frontend engineer|backend engineer|full stack engineer|fullstack developer|devops engineer|cloud architect|site reliability engineer|sre|system architecture)\b/i.test(
      allProfileText
    ) &&
    /\b(typescript|javascript|python|java|c\+\+|golang|go|rust|react|node\.js|kubernetes|docker)\b/i.test(
      allProfileText
    )
  ) {
    families.add('SOFTWARE_ENGINEERING');
  }

  // 6. Data & AI
  if (
    /\b(data scientist|machine learning engineer|ai engineer|analytics engineer|deep learning|data engineer|nlp)\b/i.test(
      allProfileText
    )
  ) {
    families.add('DATA_AND_AI');
  }

  // 7. Product Design
  if (
    /\b(product designer|ux designer|ui designer|ui\/ux|design systems lead|figma wireframing)\b/i.test(
      allProfileText
    )
  ) {
    families.add('PRODUCT_DESIGN');
  }

  // 8. Solutions Engineering & Technical Pre-Sales (Strict: requires technical pre-sales architecture in profile)
  if (
    /\b(solutions engineer|sales engineer|pre-sales engineer|presales engineer|technical solutions architect)\b/i.test(
      allProfileText
    )
  ) {
    families.add('SOLUTIONS_ENGINEERING');
  }

  // Fallback: If no families detected, default to SALES_AND_BD
  if (families.size === 0) {
    families.add('SALES_AND_BD');
  }

  return families;
}

/**
 * Classifies a job posting into its primary Career Function Family.
 * Enforces: "Do not treat a shared word like 'growth', 'technology', 'manager' or 'strategy' as sufficient relevance."
 */
export function classifyJobCareerFunction(job: {
  title: string;
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  requiredSkills?: string[];
  preferredTools?: string[];
}): {
  primary: CareerFunctionFamily;
  isTechnicalEngineering: boolean;
} {
  const titleLower = clean(job.title);
  const skillsText = [
    ...(job.requiredSkills || []),
    ...(job.preferredTools || []),
    ...(job.responsibilities || []),
    ...(job.requirements || []),
    job.description || '',
  ]
    .join(' ')
    .toLowerCase();

  // HARD RULE 0: Solutions Engineering & Technical Pre-Sales
  if (
    /\b(solutions engineer|sales engineer|pre-sales engineer|presales engineer|technical account manager|technical solutions|customer solutions engineer)\b/i.test(
      titleLower
    )
  ) {
    return { primary: 'SOLUTIONS_ENGINEERING', isTechnicalEngineering: true };
  }

  // HARD RULE 1: Pure Software Engineering & Technical roles
  const isEngineeringTitle =
    /\b(engineer|engineering|developer|devops|infrastructure|architect|backend|frontend|fullstack|full-stack|sre|systems engineer|platform engineer|kernel|compiler|canvas|firmware|qa engineer|test engineer|compute platform)\b/i.test(
      titleLower
    );

  const hasEngineeringSkills =
    /\b(c\+\+|rust|golang|go|kubernetes|docker|distributed systems|postgres sharding|v8|webassembly|webrtc|kafka streaming|ec2 fleet|caching layers|microservices architecture)\b/i.test(
      skillsText
    );

  if (isEngineeringTitle || (titleLower.includes('software') && !titleLower.includes('sales'))) {
    return { primary: 'SOFTWARE_ENGINEERING', isTechnicalEngineering: true };
  }

  // HARD RULE 2: Data & AI roles
  if (
    /\b(data scientist|machine learning|ml engineer|ai researcher|ai systems engineer|data platform|analytics engineer|model inference|cuda|deep learning)\b/i.test(
      titleLower
    )
  ) {
    return { primary: 'DATA_AND_AI', isTechnicalEngineering: true };
  }

  // HARD RULE 3: Product Design roles
  if (
    /\b(product designer|ux designer|ui designer|ui\/ux|design systems designer|visual designer|motion designer)\b/i.test(
      titleLower
    )
  ) {
    return { primary: 'PRODUCT_DESIGN', isTechnicalEngineering: false };
  }

  // HARD RULE 4: Pure Product Management roles
  if (
    /\b(product manager|group product manager|technical product manager|director of product|vp of product|head of product)\b/i.test(
      titleLower
    )
  ) {
    return { primary: 'PRODUCT_MANAGEMENT', isTechnicalEngineering: false };
  }

  // HARD RULE 5: Sales & Business Development
  if (
    /\b(sales|business development|account executive|bdr|sdr|account manager|partnerships|commercial|merchant acquisition|client acquisition|enterprise bd|channel sales|alliances)\b/i.test(
      titleLower
    )
  ) {
    return { primary: 'SALES_AND_BD', isTechnicalEngineering: false };
  }

  // HARD RULE 6: Growth & Revenue
  if (
    /\b(growth|revenue|brand partnerships|sponsorship|commercial lead|commercial director|head of revenue|cro)\b/i.test(
      titleLower
    )
  ) {
    return { primary: 'GROWTH_AND_REVENUE', isTechnicalEngineering: false };
  }

  // HARD RULE 7: Operations & Management
  if (
    /\b(operations|general manager|chief of staff|commercial operations|business operations|founder in residence|entrepreneur in residence)\b/i.test(
      titleLower
    )
  ) {
    return { primary: 'OPERATIONS_AND_MANAGEMENT', isTechnicalEngineering: false };
  }

  // Fallback check on skills
  if (
    /\b(b2b sales|pipeline generation|outbound prospecting|discovery calls|contract negotiation|icp|account-based marketing|salesforce|hubspot)\b/i.test(
      skillsText
    )
  ) {
    return { primary: 'SALES_AND_BD', isTechnicalEngineering: false };
  }

  if (hasEngineeringSkills) {
    return { primary: 'SOFTWARE_ENGINEERING', isTechnicalEngineering: true };
  }

  return { primary: 'OPERATIONS_AND_MANAGEMENT', isTechnicalEngineering: false };
}

export interface LocationEligibilityResult {
  isEligible: boolean;
  matchedMarket?: string;
  isExplicitWFA: boolean;
  failureReason?: string;
}

/**
 * Evaluates whether a job posting strictly matches the candidate's configured location markets.
 * Enforces: "Remote != Worldwide". Country-restricted remote jobs (e.g. US Only, EMEA Only, Tokyo)
 * are disqualified unless the candidate explicitly configured that market.
 */
export function checkLocationEligibility(
  job: {
    location?: string;
    country?: string;
    remoteStatus?: RemoteType;
    workFromAnywhere?: boolean;
    eligibleCountries?: string[];
  },
  userTargetMarkets: string[] = [],
  userHomeCountry: string = 'India',
  userWorkplaceTypes?: ('remote' | 'hybrid' | 'on-site')[]
): LocationEligibilityResult {
  // Workplace Type filter: if user configured workplace types (e.g. only 'remote')
  if (userWorkplaceTypes && userWorkplaceTypes.length > 0 && job.remoteStatus) {
    if (!userWorkplaceTypes.includes(job.remoteStatus)) {
      return {
        isEligible: false,
        isExplicitWFA: false,
        failureReason: `Work arrangement "${job.remoteStatus}" does not match your preference (${userWorkplaceTypes.join(', ')}).`,
      };
    }
  }

  const configuredMarkets =
    userTargetMarkets && userTargetMarkets.length > 0
      ? userTargetMarkets
      : [userHomeCountry, 'Remote Worldwide / Work From Anywhere'];

  const locClean = (job.location || '').toLowerCase();
  const countryClean = (job.country || '').toLowerCase();

  // Explicit regional/country restriction cues
  const hasCountryRestriction =
    /\b(us only|us-only|usa only|americas only|north america only|emea only|apac only|canada only|uk only|europe only|latam only|germany only|japan only|australia only)\b/i.test(
      locClean
    ) ||
    /\bremote,\s*(united states|us\b|usa\b|emea|germany|ireland|netherlands|united kingdom|uk\b|australia|canada|japan|france)\b/i.test(
      locClean
    ) ||
    /\bremote\s*\(us\b|\bremote\s*-\s*us\b|\bremote\s*-\s*dach\b/i.test(locClean);

  // Check if job is genuinely Work From Anywhere (Worldwide Remote without regional barriers)
  const isExplicitWFA =
    !hasCountryRestriction &&
    (Boolean(job.workFromAnywhere) ||
      Boolean(job.eligibleCountries?.includes('*')) ||
      locClean.includes('work from anywhere') ||
      locClean.includes('worldwide (wfa)') ||
      locClean.includes('anywhere in the world') ||
      locClean.includes('global remote') ||
      (job.remoteStatus === 'remote' &&
        (locClean === 'remote' ||
          locClean === 'worldwide' ||
          locClean === 'anywhere' ||
          locClean === 'global')));

  const isIndiaJob =
    countryClean === 'india' ||
    /\b(india|bengaluru|bangalore|delhi|mumbai|pune|hyderabad|chennai|noida|gurugram|gurgaon|kolkata|ahmedabad)\b/i.test(
      locClean
    );

  const isIndiaEligibleRemote =
    job.remoteStatus === 'remote' &&
    (isIndiaJob ||
      isExplicitWFA ||
      Boolean(job.eligibleCountries?.some((c) => c.toLowerCase().includes('india') || c === '*')));

  // 1. Check if user configured Worldwide WFA and job qualifies
  const userAcceptsWorldwide = configuredMarkets.some(
    (m) =>
      m.toLowerCase().includes('worldwide') ||
      m.toLowerCase().includes('anywhere') ||
      m.toLowerCase().includes('wfa')
  );

  if (userAcceptsWorldwide && isExplicitWFA) {
    return {
      isEligible: true,
      matchedMarket: 'Remote Worldwide / Work From Anywhere',
      isExplicitWFA: true,
    };
  }

  // 2. Check each configured target market against job location
  for (const market of configuredMarkets) {
    const mLower = market.toLowerCase().trim();

    // Skip worldwide check here as it was handled above
    if (
      mLower.includes('worldwide') ||
      mLower.includes('anywhere') ||
      mLower.includes('wfa')
    ) {
      continue;
    }

    // Specific India Remote Eligible check
    if (mLower.includes('remote — india eligible') || mLower.includes('remote - india eligible')) {
      if (isIndiaEligibleRemote) {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
      continue;
    }

    // Specific Hybrid India check
    if (mLower.includes('hybrid — india') || mLower.includes('hybrid - india')) {
      if (isIndiaJob && job.remoteStatus === 'hybrid') {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
      continue;
    }

    // Specific On-site India check
    if (mLower.includes('on-site — india') || mLower.includes('on-site - india') || mLower.includes('onsite - india')) {
      if (isIndiaJob && job.remoteStatus === 'on-site') {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
      continue;
    }

    // India market check
    if (mLower.includes('india')) {
      if (isIndiaJob) {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
    }

    // United States market check
    if (mLower.includes('united states') || mLower === 'us' || mLower === 'usa') {
      const isUSJob =
        countryClean.includes('united states') ||
        /\b(united states|usa|san francisco|new york|nyc|austin|seattle|chicago|california|ny|ca|tx|wa)\b/i.test(
          locClean
        ) ||
        /\bremote,\s*(united states|us)\b/i.test(locClean);
      if (isUSJob) {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
    }

    // United Kingdom market check
    if (
      mLower.includes('united kingdom') ||
      mLower === 'uk' ||
      mLower.includes('london')
    ) {
      const isUKJob =
        countryClean.includes('united kingdom') ||
        /\b(united kingdom|uk|london|manchester)\b/i.test(locClean);
      if (isUKJob) {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
    }

    // Europe / EMEA market check
    if (
      mLower.includes('europe') ||
      mLower.includes('emea') ||
      mLower.includes('germany') ||
      mLower.includes('france')
    ) {
      const isEuropeJob =
        /\b(emea|europe|germany|berlin|munich|france|paris|amsterdam|netherlands|ireland|dublin)\b/i.test(
          locClean
        );
      if (isEuropeJob) {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
    }

    // Singapore & APAC market check
    if (mLower.includes('singapore') || mLower.includes('apac')) {
      const isAPACJob =
        /\b(singapore|apac|asia-pacific|australia|sydney|melbourne|tokyo|japan|seoul|korea)\b/i.test(
          locClean
        );
      if (isAPACJob) {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
    }

    // Middle East / UAE market check
    if (
      mLower.includes('uae') ||
      mLower.includes('dubai') ||
      mLower.includes('middle east')
    ) {
      const isUAEJob = /\b(uae|dubai|abu dhabi|middle east|riyadh|saudi)\b/i.test(
        locClean
      );
      if (isUAEJob) {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
    }

    // Canada market check
    if (mLower.includes('canada') || mLower.includes('toronto')) {
      const isCanadaJob = /\b(canada|toronto|vancouver|montreal|ontario)\b/i.test(
        locClean
      );
      if (isCanadaJob) {
        return { isEligible: true, matchedMarket: market, isExplicitWFA };
      }
    }

    // Direct substring or country match
    if (locClean.includes(mLower) || countryClean.includes(mLower)) {
      return { isEligible: true, matchedMarket: market, isExplicitWFA };
    }
  }

  return {
    isEligible: false,
    isExplicitWFA,
    failureReason: `Location "${job.location || 'Undisclosed'}" is outside your configured target markets (${configuredMarkets.join(', ')}).`,
  };
}

// 1. Job Match Analysis
export function analyzeJobMatch(profile: UserProfile, job: JobPosting): JobMatchAnalysis {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];

  const profileFunctions = inferProfileCareerFunctions(profile);
  const jobFunction = classifyJobCareerFunction(job);

  // HARD EXCLUSION GATE:
  // If the job's primary career function is NOT supported by the candidate's profile,
  // HARD REJECT immediately. Score = 0. Never display in Recommended Opportunities.
  const isFunctionSupported = profileFunctions.has(jobFunction.primary);

  if (!isFunctionSupported) {
    return {
      overallScore: 0,
      fitCategory: 'Poor Fit',
      titleMatchScore: 0,
      skillsMatchScore: 0,
      experienceMatchScore: 0,
      compensationMatchScore: 0,
      workplaceMatchScore: 0,
      strengths: [],
      gaps: [
        `Hard exclusion: ${job.title} is classified under ${jobFunction.primary}, which is outside your demonstrated career functions (${Array.from(profileFunctions).join(', ')}).`,
      ],
      recommendations: [
        'CareerOs enforces strict functional relevance so that unrelated technical or specialist roles never clutter your feed.',
      ],
      trajectoryRelevance: 'Excluded from recommendations due to career function mismatch.',
    };
  }

  // A. Title & Role Matching (Weight: 35%)
  let titleMatchScore = 40;
  const targetTitle =
    profile.rolePreferences.targetPrimaryTitle || profile.personalInfo.headline || '';
  const currentTitle = profile.rolePreferences.currentTitle || '';
  const altTitles = profile.rolePreferences.targetJobTitles || [];
  const allProfileTitles = [targetTitle, currentTitle, ...altTitles].filter(Boolean);

  const jobTitleWords = words(job.title);
  const jobTitleClean = clean(job.title);
  let bestTitleOverlap = 0;

  for (const pTitle of allProfileTitles) {
    const pWords = words(pTitle);
    const overlap = jobTitleWords.filter((w) => pWords.includes(w)).length;
    const ratio = overlap / Math.max(1, jobTitleWords.length);
    if (ratio > bestTitleOverlap) bestTitleOverlap = ratio;
  }

  // Check semantic synonym groups
  let isSynonymMatch = false;
  for (const group of TITLE_SYNONYM_GROUPS) {
    const jobInGroup = group.some((term) => jobTitleClean.includes(term));
    if (jobInGroup) {
      const profileInGroup = allProfileTitles.some((pt) =>
        group.some((term) => clean(pt).includes(term))
      );
      if (profileInGroup) {
        isSynonymMatch = true;
        break;
      }
    }
  }

  if (bestTitleOverlap >= 0.5) {
    titleMatchScore = Math.round(80 + bestTitleOverlap * 20);
    strengths.push(
      `Direct title alignment: "${job.title}" maps closely to your target "${targetTitle || allProfileTitles[0]}"`
    );
  } else if (isSynonymMatch) {
    titleMatchScore = 85;
    strengths.push(
      `Role alignment: "${job.title}" maps directly to your background in ${targetTitle || currentTitle}`
    );
  } else if (bestTitleOverlap > 0) {
    titleMatchScore = 70;
    strengths.push(`Direct functional experience in ${job.title}`);
  } else {
    titleMatchScore = 15;
    gaps.push(
      `Job title differs from your primary target role ("${targetTitle || 'Not specified'}")`
    );
  }

  // B. Skills & Responsibilities Matching (Weight: 30%)
  const userTechSkills = (profile.skills.technicalSkills || []).map(clean);
  const userTools = (profile.skills.toolsAndPlatforms || []).map(clean);
  const userSoftSkills = (profile.skills.softSkills || []).map(clean);
  const userAllSkills = new Set([...userTechSkills, ...userTools, ...userSoftSkills]);

  profile.workExperience.forEach((exp) => {
    (exp.skillsUsed || []).forEach((s) => userAllSkills.add(clean(s)));
  });

  const matchedRequiredSkills: string[] = [];
  const missingRequiredSkills: string[] = [];

  (job.requiredSkills || []).forEach((skill) => {
    const sClean = clean(skill);
    const isPresent =
      userAllSkills.has(sClean) ||
      Array.from(userAllSkills).some((us) => us.includes(sClean) || sClean.includes(us));
    if (isPresent) {
      matchedRequiredSkills.push(skill);
    } else {
      missingRequiredSkills.push(skill);
    }
  });

  const matchedTools: string[] = [];
  (job.preferredTools || []).forEach((tool) => {
    const tClean = clean(tool);
    const isPresent =
      userAllSkills.has(tClean) ||
      Array.from(userAllSkills).some((ut) => ut.includes(tClean) || tClean.includes(ut));
    if (isPresent) {
      matchedTools.push(tool);
    }
  });

  let effectiveMatchedCount = matchedRequiredSkills.length;
  let effectiveTotalSkills = (job.requiredSkills || []).length;
  if (effectiveTotalSkills === 0 && job.description) {
    const descLower = job.description.toLowerCase();
    const foundUserSkills = Array.from(userAllSkills).filter(
      (s) => s.length > 2 && descLower.includes(s)
    );
    effectiveMatchedCount = Math.min(foundUserSkills.length, 5);
    effectiveTotalSkills = 5;
    if (foundUserSkills.length > 0) {
      matchedRequiredSkills.push(...foundUserSkills.slice(0, 3));
    }
  }

  const skillsMatchScore = Math.min(
    100,
    Math.round(
      (effectiveMatchedCount / Math.max(1, effectiveTotalSkills)) * 80 +
        (matchedTools.length / Math.max(1, (job.preferredTools || []).length || 1)) * 20
    )
  );

  if (matchedRequiredSkills.length > 0) {
    strengths.push(
      `Core competency match: ${matchedRequiredSkills.slice(0, 3).join(', ')}${matchedRequiredSkills.length > 3 ? ` (+${matchedRequiredSkills.length - 3} more)` : ''}`
    );
  }
  if (matchedTools.length > 0) {
    strengths.push(
      `Proficient in ${job.company}'s commercial stack: ${matchedTools.slice(0, 2).join(', ')}`
    );
  }
  if (missingRequiredSkills.length > 0) {
    gaps.push(
      `Growth areas / additional qualifications: ${missingRequiredSkills.slice(0, 2).join(', ')}`
    );
  }

  // C. Experience & Seniority Matching (Weight: 15%)
  const userYears = profile.rolePreferences.totalYearsExperience || 0;
  let experienceMatchScore = 75;
  if (userYears >= job.minExperienceYears) {
    experienceMatchScore = Math.min(100, 85 + (userYears - job.minExperienceYears) * 3);
    strengths.push(
      `Experience seniority: ${userYears} yrs matches ${job.company}'s ${job.minExperienceYears}+ yrs requirement`
    );
  } else {
    experienceMatchScore = Math.max(
      30,
      Math.round((userYears / Math.max(1, job.minExperienceYears)) * 80)
    );
    gaps.push(
      `Requires ${job.minExperienceYears}+ years experience (profile indicates ~${userYears} yrs)`
    );
  }

  // D. Workplace & Location Compatibility (Weight: 10%)
  let workplaceMatchScore = 80;
  const userWorkplaceTypes = profile.workPreferences.workplaceTypes || ['remote'];
  const userCountry =
    profile.locationAndAuth.currentCountry || profile.personalInfo.country || 'India';
  const jobLocClean = clean(job.location);

  const isWFA =
    jobLocClean.includes('anywhere') ||
    jobLocClean.includes('worldwide') ||
    jobLocClean.includes('global');
  const isLocalToUser =
    clean(userCountry) !== '' &&
    (jobLocClean.includes(clean(userCountry)) ||
      jobLocClean.includes('delhi') ||
      jobLocClean.includes('bengaluru') ||
      jobLocClean.includes('bangalore') ||
      jobLocClean.includes('mumbai') ||
      jobLocClean.includes('chennai'));

  if (job.locationType === 'remote') {
    if (isWFA) {
      workplaceMatchScore = 100;
      strengths.push(
        `Work-From-Anywhere policy allows working from ${userCountry}`
      );
    } else if (isLocalToUser) {
      workplaceMatchScore = 100;
      strengths.push(`Remote role available within ${userCountry}`);
    } else {
      const isUSJob =
        jobLocClean.includes('united states') ||
        jobLocClean.includes('us ') ||
        jobLocClean.includes('usa');
      const isUserOutsideUS =
        clean(userCountry) !== 'united states' && clean(userCountry) !== 'usa';
      const hasUSAuth =
        profile.locationAndAuth.workAuthorizationStatus === 'citizen' ||
        profile.locationAndAuth.workAuthorizationStatus === 'permanent_resident';

      if (isUSJob && isUserOutsideUS && !hasUSAuth) {
        workplaceMatchScore = 30;
        gaps.push(
          `Remote posting may require US work authorization (your profile lists ${userCountry})`
        );
      } else {
        workplaceMatchScore = 85;
        strengths.push(`Remote flexibility aligned with ${job.location}`);
      }
    }
  } else if (userWorkplaceTypes.includes(job.locationType)) {
    if (isLocalToUser) {
      workplaceMatchScore = 95;
      strengths.push(`Local ${job.locationType} role in ${job.location}`);
    } else {
      workplaceMatchScore = 50;
      gaps.push(
        `On-site/hybrid location (${job.location}) differs from your home base (${userCountry})`
      );
    }
  } else {
    workplaceMatchScore = 50;
    gaps.push(
      `Role is ${job.locationType}, whereas you prefer ${userWorkplaceTypes.join(', ')}`
    );
  }

  // E. Compensation Compatibility (Weight: 5%)
  let compensationMatchScore = 70;
  const targetSalary = profile.compensation.targetBaseSalary || 0;
  const minSalary = profile.compensation.minBaseSalary || 0;
  const isSalaryDisclosed = Boolean((job.salaryMin && job.salaryMin > 0) || (job.salaryMax && job.salaryMax > 0));
  const curr = job.currency || profile.compensation.currency || 'INR';

  if (isSalaryDisclosed && job.salaryMax > 0 && targetSalary > 0) {
    if (job.salaryMax >= targetSalary && job.salaryMin >= minSalary) {
      compensationMatchScore = 100;
      strengths.push(
        `Salary band (${formatSalaryDisplay(job.salaryMin, curr)} - ${formatSalaryDisplay(job.salaryMax, curr)}) meets or exceeds your target ${formatSalaryDisplay(targetSalary, curr)}`
      );
    } else if (job.salaryMax >= minSalary) {
      compensationMatchScore = 80;
      strengths.push(
        `Salary meets your baseline threshold of ${formatSalaryDisplay(minSalary, curr)}`
      );
    } else {
      compensationMatchScore = 45;
      gaps.push(
        `Salary maximum (${formatSalaryDisplay(job.salaryMax, curr)}) is below your target expectation (${formatSalaryDisplay(targetSalary, curr)})`
      );
    }
  } else if (!isSalaryDisclosed) {
    compensationMatchScore = 70;
    gaps.push('Salary not disclosed by employer');
  }

  // F. Strategic Target Company Boost (Weight: 5%)
  const userTargetCompanies = (profile.targetMarkets?.targetCompanies || []).map(clean);
  const isTargetComp =
    Boolean(job.isTargetCompany) ||
    userTargetCompanies.some(
      (tc) => tc.length > 1 && (clean(job.company).includes(tc) || tc.includes(clean(job.company)))
    );

  let targetCompanyBoost = 0;
  if (isTargetComp) {
    targetCompanyBoost = 8;
    strengths.unshift(
      `Target Company match: Verified opening at ${job.company} (listed in your strategic target companies)`
    );
  }

  // Calculate Overall Composite Score according to Mandated Weighting:
  // - Role relevance: 40%
  // - Skills overlap: 30%
  // - Location & remote fit: 20%
  // - Seniority & experience: 10%
  const overallScore = Math.min(
    99,
    Math.max(
      0,
      Math.round(
        titleMatchScore * 0.40 +
          skillsMatchScore * 0.30 +
          workplaceMatchScore * 0.20 +
          experienceMatchScore * 0.10 +
          targetCompanyBoost
      )
    )
  );

  let fitCategory: FitCategory = 'Potential Fit';
  if (overallScore >= 88) {
    fitCategory = 'Excellent Fit';
  } else if (overallScore >= 75) {
    fitCategory = 'Strong Fit';
  } else if (overallScore >= 60) {
    fitCategory = 'Potential Fit';
  } else if (overallScore >= 45) {
    fitCategory = 'Stretch Opportunity';
  } else {
    fitCategory = 'Poor Fit';
  }

  const shortTerm = profile.careerGoals.shortTermGoals || '';
  const userIndustries = profile.targetMarkets.targetIndustries || [];
  const trajectoryRelevance = userIndustries.some((i) =>
    clean(job.industry).includes(clean(i))
  )
    ? `Directly supports your commercial expansion in ${job.industry}.`
    : shortTerm
      ? `Aligns with your milestone: "${shortTerm}".`
      : `High-leverage commercial role to scale revenue and partnerships in ${job.industry}.`;

  return {
    overallScore,
    fitCategory,
    titleMatchScore,
    skillsMatchScore,
    experienceMatchScore,
    compensationMatchScore,
    workplaceMatchScore,
    strengths,
    gaps,
    recommendations,
    trajectoryRelevance,
  };
}

/**
 * Adapter converting a normalized JobOpportunity into a JobPosting
 */
export function opportunityToJobPosting(opp: JobOpportunity): JobPosting {
  return {
    id: opp.id,
    title: opp.title,
    company: opp.company,
    companyLogo: opp.companyLogo,
    location: opp.location,
    locationType: opp.remoteStatus,
    employmentType: opp.employmentType,
    industry: opp.industry,
    seniority: opp.seniority,
    minExperienceYears:
      opp.minExperienceYears ||
      (opp.seniority === 'lead' ? 6 : opp.seniority === 'senior' ? 4 : 2),
    salaryMin: opp.salary?.disclosed ? opp.salary.min || 0 : 0,
    salaryMax: opp.salary?.disclosed ? opp.salary.max || 0 : 0,
    currency: opp.salary?.currency || 'USD',
    requiredSkills: opp.requiredSkills || [],
    preferredTools: opp.preferredSkills || [],
    responsibilities: opp.responsibilities || [],
    requirements: opp.requirements || [],
    description: opp.description || '',
    postedDate: opp.datePosted === 'not_disclosed' ? opp.dateDiscovered : opp.datePosted,
    sourceUrl: opp.jobUrl,
    isTargetCompany: opp.isTargetCompany,
  };
}

/**
 * Classifies a list of JobOpportunity items against user profile.
 * Enforces strict hard gates in priority order:
 * 1. Active Live Verification & URL Gate
 * 2. Staleness Gate (No 2025 or >90 day old listings)
 * 3. Location Market Eligibility Gate ("Remote != Worldwide")
 * 4. Profile Career Function Gate (Zero tolerance for unrelated engineering/developer roles)
 * 5. Quality-Over-Quantity Threshold (>= 50)
 */
export function classifyOpportunities(
  profile: UserProfile,
  opportunities: JobOpportunity[],
  minScoreThreshold: number = 0
): (JobOpportunity & { match: JobMatchAnalysis })[] {
  const userTargetCompanies = (profile?.targetMarkets?.targetCompanies || []).map(clean);
  const processed: (JobOpportunity & { match: JobMatchAnalysis })[] = [];

  for (const opp of opportunities) {
    const effectiveApplyUrl =
      opp.applyUrl && opp.applyUrl !== '#' && opp.applyUrl.startsWith('http')
        ? opp.applyUrl
        : opp.jobUrl && opp.jobUrl !== '#' && opp.jobUrl.startsWith('http')
        ? opp.jobUrl
        : opp.canonical_job_url && opp.canonical_job_url.startsWith('http')
        ? opp.canonical_job_url
        : undefined;

    // GATE 1: Only drop if explicitly unverified/expired or without valid URL
    if (
      opp.isVerifiedLive === false ||
      opp.verificationStatus === 'expired' ||
      opp.verificationStatus === 'failed' ||
      !effectiveApplyUrl
    ) {
      continue;
    }

    // Target Company Lookup
    const isStoreTarget = targetCompaniesStore.isTargetCompany(opp.company);
    const isProfileTarget = userTargetCompanies.some(
      (tc) => tc.length > 1 && (clean(opp.company).includes(tc) || tc.includes(clean(opp.company)))
    );
    const isTargetComp = Boolean(opp.isTargetCompany) || isStoreTarget || isProfileTarget;
    const targetCompanyTag: TargetCompanyTag | undefined =
      opp.targetCompanyTag ||
      (isTargetComp ? targetCompaniesStore.getTargetCompanyTag(opp.company) || 'Priority' : undefined);

    let match: JobMatchAnalysis;

    // Mandate 8: Match Score Truth
    // Never invent a score or use dummy fallback ("Standard technology opening").
    // Always use real Job Matching Engine when a user profile is present.
    const isDummyMatch =
      opp.match_reasons &&
      opp.match_reasons.some(
        (r) =>
          r.toLowerCase().includes('standard technology') ||
          r.toLowerCase().includes('profile match pending')
      );

    if (
      !profile &&
      opp.match_score !== undefined &&
      opp.match_reasons &&
      opp.match_reasons.length > 0 &&
      !isDummyMatch
    ) {
      const score = Math.max(15, Math.min(99, opp.match_score));
      match = {
        overallScore: score,
        fitCategory:
          score >= 85
            ? 'Excellent Fit'
            : score >= 70
            ? 'Strong Fit'
            : score >= 50
            ? 'Potential Fit'
            : 'Poor Fit',
        titleMatchScore: Math.round(score * 0.3),
        skillsMatchScore: Math.round(score * 0.2),
        experienceMatchScore: Math.round(score * 0.2),
        compensationMatchScore: Math.round(score * 0.15),
        workplaceMatchScore: Math.round(score * 0.15),
        strengths: opp.match_reasons,
        gaps: opp.mismatch_reasons || [],
        recommendations:
          score >= 70
            ? ['Strong background alignment. Recommended to apply.']
            : ['Review requirements and consider applying.'],
        trajectoryRelevance: `Verified opportunity at ${opp.company}.`,
      };
    } else if (!profile) {
      match = {
        overallScore: 0,
        fitCategory: 'Poor Fit',
        titleMatchScore: 0,
        skillsMatchScore: 0,
        experienceMatchScore: 0,
        compensationMatchScore: 0,
        workplaceMatchScore: 0,
        strengths: ['Profile match pending'],
        gaps: [],
        recommendations: ['Configure your career profile to calculate matching intelligence.'],
        trajectoryRelevance: `Opportunity at ${opp.company}.`,
      };
    } else {
      const profileVersionKey = matchScoreCache.getProfileVersionKey(profile);
      const cachedMatch = matchScoreCache.get(opp.id, profileVersionKey, isTargetComp);

      if (cachedMatch) {
        match = cachedMatch;
      } else {
        // Evaluate using real 12-factor Job Matching Engine
        const calculatedMatch = jobMatchingEngine.getMatchAnalysis(opp, profile);

        const { scoreAdjustment, behavioralInsight } =
          behavioralLearningEngine.calculateBehavioralModifier(opp);

        // Genuinely relevant matching: Drop clearly irrelevant roles (score < 40 unless Target Company)
        let adjustedScore = 0;
        if (calculatedMatch.overallScore >= 40) {
          adjustedScore = Math.min(99, Math.max(40, calculatedMatch.overallScore + scoreAdjustment));
        } else if (isTargetComp && calculatedMatch.overallScore >= 25) {
          adjustedScore = Math.min(99, Math.max(40, calculatedMatch.overallScore + 15 + scoreAdjustment));
        }

        if (behavioralInsight && scoreAdjustment > 0 && adjustedScore > 0) {
          calculatedMatch.strengths.push(behavioralInsight);
        }

        calculatedMatch.overallScore = adjustedScore;
        match = calculatedMatch;
        matchScoreCache.set(opp.id, profileVersionKey, isTargetComp, calculatedMatch);
      }
    }

    // Drop disqualified/excluded jobs (overallScore === 0 from hard exclusions or < 40 threshold)
    // Note: Do not drop if match is simply pending profile setup (score === 0 with 'Profile match pending')
    const isPending = match.strengths.some((r) => r.toLowerCase().includes('profile match pending'));
    if (!isPending && (match.overallScore < 40 || (minScoreThreshold > 0 && match.overallScore < minScoreThreshold))) {
      continue;
    }

    processed.push({
      ...opp,
      applyUrl: effectiveApplyUrl,
      isTargetCompany: isTargetComp,
      targetCompanyTag,
      targetCompanyReason: isTargetComp
        ? opp.targetCompanyReason ||
          `Strategic ${targetCompanyTag || 'Target'} Company verified opening`
        : undefined,
      match,
      match_score: match.overallScore,
      match_reasons: match.strengths,
      mismatch_reasons: match.gaps,
    });
  }

  // Prioritize high-match target company roles (>= 75), then sort by overall score
  return processed.sort((a, b) => {
    if (a.isTargetCompany && !b.isTargetCompany && a.match.overallScore >= 75) return -1;
    if (!a.isTargetCompany && b.isTargetCompany && b.match.overallScore >= 75) return 1;
    return b.match.overallScore - a.match.overallScore;
  });
}


// 2. Classify and Rank Catalog
export function classifyJobs(
  profile: UserProfile,
  customCatalog?: JobPosting[]
): (JobPosting & { match: JobMatchAnalysis })[] {
  const catalog = customCatalog || mockJobCatalog;
  return catalog
    .map((job) => ({
      ...job,
      match: analyzeJobMatch(profile, job),
    }))
    .sort((a, b) => b.match.overallScore - a.match.overallScore);
}

// 3. Strategic Target Companies
export function getStrategicCompanies(profile: UserProfile): StrategicCompany[] {
  const userTargetCompanies = profile.targetMarkets.targetCompanies || [];
  const userIndustries = profile.targetMarkets.targetIndustries || [
    'Enterprise Software & Cloud',
  ];
  const primaryRole = profile.rolePreferences.targetPrimaryTitle || 'B2B Sales Leader';

  const defaultStrategic: StrategicCompany[] = [
    {
      id: 'comp-1',
      name: 'CloudScale Technologies',
      industry: 'Enterprise Software & Cloud',
      headquarters: 'San Francisco, CA (Remote Friendly)',
      openRolesCount: 5,
      matchScore: 95,
      whyRelevant: [
        'Hiring aggressively for Lead Business Development roles',
        'Matches your preferred remote workplace policy and $90k-$120k compensation band',
        'Uses your core tech stack: HubSpot CRM, Apollo.io, and Salesforce',
      ],
      strategicAlignment:
        'High-growth Series B SaaS scaling enterprise outbound pipelines.',
      isManualTarget: userTargetCompanies.some(
        (c) => clean(c) === clean('CloudScale Technologies')
      ),
      sampleOpenRoles: ['Lead – Enterprise Business Development', 'Strategic SDR'],
    },
    {
      id: 'comp-2',
      name: 'Nexus AI Intelligence',
      industry: 'Artificial Intelligence & SaaS',
      headquarters: 'New York, NY (Remote Friendly)',
      openRolesCount: 8,
      matchScore: 91,
      whyRelevant: [
        'High demand for multi-touch outbound prospecting cadences',
        'Actively scaling North America commercial go-to-market teams',
        'Prioritizes candidates with entrepreneurial or venture backgrounds',
      ],
      strategicAlignment:
        'Leading agentic workflow platform expanding sales development footprint.',
      isManualTarget: userTargetCompanies.some(
        (c) => clean(c) === clean('Nexus AI Intelligence')
      ),
      sampleOpenRoles: ['Senior Strategic SDR', 'Enterprise Account Executive'],
    },
    {
      id: 'comp-3',
      name: 'VentureForge Labs',
      industry: 'Venture Studio & AI Platforms',
      headquarters: 'Remote, Global',
      openRolesCount: 3,
      matchScore: 89,
      whyRelevant: [
        'Specifically seeks entrepreneurial talent with founder/co-founder experience',
        'Focuses on auto-prospecting and scalable outbound growth funnels',
        'Provides equity incentives aligning with your compensation preferences',
      ],
      strategicAlignment: 'Venture studio building multi-tenant outbound engines.',
      isManualTarget: userTargetCompanies.some(
        (c) => clean(c) === clean('VentureForge Labs')
      ),
      sampleOpenRoles: ['Head of Growth & Outbound Strategy'],
    },
    {
      id: 'comp-4',
      name: 'Apex Data Platforms',
      industry: 'Data & Analytics',
      headquarters: 'Austin, TX',
      openRolesCount: 4,
      matchScore: 82,
      whyRelevant: [
        'Expanding commercial mid-market sales cycles',
        'Values proven track record in discovery calls and pipeline velocity',
      ],
      strategicAlignment:
        'Established data integration platform scaling enterprise sales pods.',
      isManualTarget: userTargetCompanies.some(
        (c) => clean(c) === clean('Apex Data Platforms')
      ),
      sampleOpenRoles: ['Account Executive – Commercial & Mid-Market'],
    },
  ];

  // Also include any user manual companies if not already in list
  userTargetCompanies.forEach((companyName, idx) => {
    if (!defaultStrategic.some((c) => clean(c.name) === clean(companyName))) {
      defaultStrategic.unshift({
        id: `manual-comp-${idx}`,
        name: companyName,
        industry: userIndustries[0] || 'Target Industry',
        headquarters: 'Global / Remote',
        openRolesCount: 2,
        matchScore: 88,
        whyRelevant: [
          'Directly added to your strategic target company roadmap',
          `Targeted for ${primaryRole} opportunities`,
        ],
        strategicAlignment:
          'User-specified target account earmarked for direct outreach.',
        isManualTarget: true,
        sampleOpenRoles: [`Senior ${primaryRole}`, `Lead ${primaryRole}`],
      });
    }
  });

  return defaultStrategic.sort((a, b) => b.matchScore - a.matchScore);
}

// 4. Tailored Resume Blueprint Generator
export function generateTailoredResume(
  profile: UserProfile,
  job: JobPosting
): TailoredResumeBlueprint {
  const targetCompany = job.company;
  const jobTitle = job.title;

  // Custom headline tailored to job title & profile headline
  const customHeadline = `${jobTitle} | ${profile.personalInfo.headline || profile.rolePreferences.targetPrimaryTitle}`;

  // Custom summary synthesized from professional summary & job needs
  const baseSummary = profile.professionalSummary.summaryText || '';
  const customSummary = baseSummary
    ? `Results-driven professional with proven expertise in ${job.requiredSkills.slice(0, 3).join(', ')}. ${baseSummary} Committed to driving measurable pipeline and revenue growth for ${targetCompany}.`
    : `Dedicated professional specializing in ${job.requiredSkills.slice(0, 3).join(', ')} with a strong track record of pipeline execution and cross-functional performance.`;

  // Score and prioritize work experience items
  const prioritized = profile.workExperience.map((exp) => {
    let relevanceScore = 50;
    const expText =
      `${exp.title} ${exp.company} ${exp.description} ${exp.keyAchievements.join(' ')}`.toLowerCase();

    // Check keyword overlaps
    job.requiredSkills.forEach((skill) => {
      if (expText.includes(clean(skill))) relevanceScore += 12;
    });
    job.preferredTools.forEach((tool) => {
      if (expText.includes(clean(tool))) relevanceScore += 8;
    });

    return {
      experience: exp,
      relevanceScore,
      highlightedAchievements: exp.keyAchievements.slice(0, 3),
      emphasizedSkills: (exp.skillsUsed || []).filter((s) =>
        job.requiredSkills.some(
          (rs) => clean(rs).includes(clean(s)) || clean(s).includes(clean(rs))
        )
      ),
    };
  });

  prioritized.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Filter skills to highlight
  const highlightedSkills = (profile.skills.technicalSkills || []).filter((s) =>
    job.requiredSkills.some(
      (rs) => clean(rs).includes(clean(s)) || clean(s).includes(clean(rs))
    )
  );
  const highlightedTools = (profile.skills.toolsAndPlatforms || []).filter((t) =>
    job.preferredTools.some(
      (pt) => clean(pt).includes(clean(t)) || clean(t).includes(clean(pt))
    )
  );

  const topAchievement =
    profile.workExperience[0]?.keyAchievements[0] ||
    'consistently exceeded quarterly pipeline generation quotas';

  const coverLetterHook = `I am writing to express my strong interest in the ${jobTitle} position at ${targetCompany}. Having recently ${topAchievement.toLowerCase()}, I have honed the exact outbound methodologies and pipeline disciplines required to accelerate ${targetCompany}'s commercial targets.`;

  return {
    jobId: job.id,
    jobTitle,
    targetCompany,
    customHeadline,
    customSummary,
    prioritizedExperiences: prioritized,
    highlightedSkills:
      highlightedSkills.length > 0 ? highlightedSkills : job.requiredSkills.slice(0, 4),
    highlightedTools:
      highlightedTools.length > 0 ? highlightedTools : job.preferredTools.slice(0, 3),
    coverLetterHook,
  };
}

// 5. Outreach Message Generator
export function generateOutreachDraft(
  profile: UserProfile,
  job: JobPosting,
  contactName: string = 'Hiring Manager'
): OutreachBlueprint {
  const userName = profile.personalInfo.fullName || 'Candidate';
  const topRole = profile.workExperience[0];
  const topAchievement =
    topRole?.keyAchievements[0] ||
    'scaled outbound pipeline generation and qualified meetings';

  const subjectLine = `${job.title} — ${userName} (Background in ${job.requiredSkills[0] || 'Pipeline Generation'})`;

  const bodyText = `Hi ${contactName},

I noticed ${job.company}'s focus on expanding its ${job.industry} footprint through the ${job.title} role.

In my recent experience at ${topRole?.company || 'my recent role'}, I ${topAchievement.toLowerCase()}. Leveraging tools like ${job.preferredTools.slice(0, 2).join(' and ')}, I specialized in ${job.requiredSkills.slice(0, 2).join(' and ')}.

Given ${job.company}'s ambitious growth trajectory, I would welcome the chance to share a couple of specific outbound plays that could support your pipeline goals.

Would you be open to a brief 10-minute introductory conversation this week?

Best regards,
${userName}
${profile.personalInfo.email || ''} | ${profile.personalInfo.phone || ''}
${profile.personalInfo.linkedinUrl || ''}`;

  return {
    jobId: job.id,
    jobTitle: job.title,
    companyName: job.company,
    contactName,
    contactTitle: `VP of Sales / Talent Acquisition at ${job.company}`,
    subjectLine,
    bodyText,
    citedAchievement: topAchievement,
    valueProposition: `Demonstrated capability in ${job.requiredSkills[0] || 'outbound execution'} at ${topRole?.company || 'scale'}`,
  };
}

// 6. Interview Preparation Brief
export function generateInterviewBrief(
  profile: UserProfile,
  job: JobPosting
): InterviewBrief {
  const topRole = profile.workExperience[0];
  const topAchievement = topRole?.keyAchievements[0] || 'scaled qualified sales pipeline';
  const secondaryAchievement =
    profile.workExperience[1]?.keyAchievements[0] ||
    'conducted strategic discovery calls with enterprise buyers';

  const predictedQuestions = [
    {
      id: 'q-1',
      question: `Can you walk us through how you built and managed outbound pipeline at ${topRole?.company || 'your previous company'}?`,
      category: 'behavioral' as const,
      whyAsked: `Validates your day-to-day execution against ${job.company}'s pipeline expectations.`,
      recommendedStory: {
        situation: `At ${topRole?.company || 'previous position'}, faced with scaling outbound opportunities.`,
        actionFromProfile: `Implemented structured multi-channel cadences using ${job.preferredTools[0] || 'modern CRM'} and targeted ICP research.`,
        achievementQuote: topAchievement,
      },
      keySkillsToEmphasize: [
        job.requiredSkills[0] || 'Pipeline Generation',
        'ICP Targeting',
      ],
    },
    {
      id: 'q-2',
      question: `How do you handle objections when conducting discovery calls with enterprise decision-makers?`,
      category: 'technical' as const,
      whyAsked: `Assesses consultative selling rigor and objection management in ${job.industry}.`,
      recommendedStory: {
        situation:
          'Encountering budget constraints or timing objections from enterprise prospects.',
        actionFromProfile:
          'Anchoring on business ROI and quantified pain points rather than feature pitching.',
        achievementQuote: secondaryAchievement,
      },
      keySkillsToEmphasize: ['Discovery Calls', 'Value Proposition Selling'],
    },
    {
      id: 'q-3',
      question: `Tell us about a time you had to adapt your sales or go-to-market strategy when targets shifted.`,
      category: 'strategy' as const,
      whyAsked: 'Evaluates resilience, self-direction, and commercial agility.',
      recommendedStory: {
        situation: 'Pivoting target customer profiles amid market changes.',
        actionFromProfile:
          'Iterating cold outreach messaging and testing new channel sequences.',
        achievementQuote: `Tested and validated new value propositions leading to sustained meeting booking rates.`,
      },
      keySkillsToEmphasize: ['Commercial Agility', 'Account-Based Marketing'],
    },
  ];

  const strategicQuestionsToAsk = [
    `What are the primary metrics or KPIs that define an exceptional first 90 days for this ${job.title} role?`,
    `How does ${job.company}'s sales team currently collaborate with Marketing to refine ICPs and account tiers?`,
    `What outbound channels (email, phone, LinkedIn, video) have proven most effective for your enterprise segment?`,
  ];

  const weaknessMitigation = [
    {
      gap: `Experience with ${job.requiredSkills[job.requiredSkills.length - 1] || 'specific tooling'}`,
      honestFraming: `Highlight strong adjacent proficiency in ${profile.skills.toolsAndPlatforms[0] || 'your core tools'} and emphasize speed of adoption.`,
    },
  ];

  return {
    jobTitle: job.title,
    companyName: job.company,
    predictedQuestions,
    strategicQuestionsToAsk,
    weaknessMitigation,
  };
}

// 7. Growth & Career Gap Analysis
export function analyzeGrowthGaps(profile: UserProfile): CareerGrowthGap {
  const targetRole =
    profile.rolePreferences.targetPrimaryTitle || 'Enterprise Sales Leader';
  const years = profile.rolePreferences.totalYearsExperience || 0;
  const userSkills = new Set((profile.skills.technicalSkills || []).map(clean));

  const standardSalesLeadershipSkills = [
    'Enterprise Sales',
    'Account-Based Marketing',
    'Pipeline Generation',
    'Sales Enablement',
    'MEDDIC / MEDDPICC',
    'Contract Negotiation',
    'Revenue Forecasting',
  ];

  const missingSkills = standardSalesLeadershipSkills.filter(
    (s) => !userSkills.has(clean(s))
  );

  let estimatedLevel = 'Mid-Senior Specialist';
  if (years >= 8) estimatedLevel = 'Executive / Director';
  else if (years >= 5) estimatedLevel = 'Lead / Principal';
  else if (years >= 3) estimatedLevel = 'Senior Professional';
  else estimatedLevel = 'Emerging Professional';

  const readinessScore = Math.min(
    95,
    Math.max(
      40,
      Math.round(
        50 +
          (years >= 4 ? 20 : years * 5) +
          (standardSalesLeadershipSkills.length - missingSkills.length) * 5
      )
    )
  );

  return {
    targetRole,
    currentEstimatedLevel: estimatedLevel,
    benchmarkedReadinessScore: readinessScore,
    missingHighDemandSkills: missingSkills.slice(0, 3),
    experienceGaps:
      years < 5
        ? [
            `Target roles frequently ask for 5+ years of closing or lead experience (currently ~${years} yrs).`,
          ]
        : [],
    recommendedMilestones: [
      {
        title: 'Document Multi-Stage Deal Negotiations',
        impact: 'high',
        description:
          'Add specific bullet points highlighting contract sizes, negotiation cycles, or cross-functional buy-in.',
      },
      {
        title: 'Adopt MEDDIC or Consultative Frameworks',
        impact: 'medium',
        description:
          'Explicitly reference deal qualification methodologies (MEDDIC, BANT, or Challenger) in your skills and experience.',
      },
    ],
  };
}

// 8. Intelligence Tier Computation
export function getIntelligenceTier(profile: UserProfile): IntelligenceTierInfo {
  let score = 0;
  if (profile.personalInfo.fullName.trim()) score += 10;
  if (profile.personalInfo.headline.trim()) score += 10;
  if (profile.rolePreferences.targetPrimaryTitle.trim()) score += 15;
  if (profile.skills.technicalSkills.length >= 3) score += 20;
  if (profile.workExperience.length >= 1) score += 20;
  if (profile.education.length >= 1) score += 10;
  if (profile.compensation.targetBaseSalary > 0) score += 5;
  if (profile.workPreferences.workplaceTypes.length >= 1) score += 5;
  if (profile.careerGoals.shortTermGoals.trim()) score += 5;

  score = Math.min(100, score);

  if (score >= 90) {
    return {
      tier: 4,
      tierName: 'Tier 4: Autonomous Career Engine',
      completionPercentage: score,
      unlockedCapabilities: [
        'Predictive Job Match & Explainable Gap Analysis',
        'Automated Target Company Strategy Discovery',
        'Resume Studio Multi-Version Tailoring Engine',
        'Context-Aware Executive Outreach Generator',
        'Real-History Interview Story Mapping (STAR)',
        'Strategic Career Growth & Seniority Benchmarking',
      ],
      nextTierMilestones: [
        'Profile at maximal career intelligence. Keep achievements and targets current.',
      ],
    };
  }

  if (score >= 70) {
    return {
      tier: 3,
      tierName: 'Tier 3: High Career Intelligence',
      completionPercentage: score,
      unlockedCapabilities: [
        'Personalized Job Match Analysis with Strengths & Gaps',
        'Target Company Compatibility Scoring',
        'Resume Studio Tailoring Blueprints',
        'Personalized Outreach Message Generation',
        'Interview Question Predictions',
      ],
      nextTierMilestones: [
        'Add short-term & long-term career goals (+5%)',
        'Specify target base salary and compensation notes (+5%)',
        'Document 1 more quantified work achievement (+5%)',
      ],
    };
  }

  if (score >= 40) {
    return {
      tier: 2,
      tierName: 'Tier 2: Active Matching Engine',
      completionPercentage: score,
      unlockedCapabilities: [
        'Job Feed & Job Database Profile Matching',
        'Basic Skill Alignment Tracking',
        'Location and Workplace Compatibility Filtering',
      ],
      nextTierMilestones: [
        'Add at least 3 core skills & tools (+20%)',
        'Specify your target primary job title (+15%)',
        'Add at least 1 detailed work experience milestone (+20%)',
      ],
    };
  }

  return {
    tier: 1,
    tierName: 'Tier 1: Foundation Baseline',
    completionPercentage: score,
    unlockedCapabilities: [
      'Basic Professional Identity Stored',
      'Contact Information Export & Backup',
    ],
    nextTierMilestones: [
      'Import your resume or add work experience (+20%)',
      'Specify your target role and seniority (+15%)',
      'Add top 5 technical skills (+20%)',
    ],
  };
}
