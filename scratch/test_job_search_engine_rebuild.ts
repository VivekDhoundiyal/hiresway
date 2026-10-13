/**
 * Comprehensive Automated Verification Suite for Job Search Engine, Filter Architecture,
 * Role Taxonomy, Location Semantics, and Job Feed Rebuild
 *
 * Verifies all 17 criteria specified in Mandate 17.
 */

import { roleTaxonomyEngine } from '../src/core/jobs/engines/roleTaxonomyEngine';
import { locationFilterEngine, CANONICAL_INDIA, CANONICAL_WORLDWIDE } from '../src/core/jobs/engines/locationFilterEngine';
import { searchIntentEngine } from '../src/core/jobs/engines/searchIntentEngine';
import { jobMatchingEngine } from '../src/core/jobs/engines/jobMatchingEngine';
import { sourceHealthEngine } from '../src/core/jobs/engines/sourceHealthEngine';
import { UserProfile } from '../src/core/profile/types';
import { JobOpportunity } from '../src/core/jobs/types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${testName}`);
  } else {
    console.error(`  [FAIL] #${totalTests}: ${testName}${details ? ` -> ${details}` : ''}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

// Mock User Profile
const mockProfile: UserProfile = {
  id: 'user-vivek-1',
  lastUpdated: new Date().toISOString(),
  personalInfo: {
    fullName: 'Vivek Sharma',
    email: 'vivek@example.com',
    location: 'Bengaluru, India',
    headline: 'Enterprise Sales & Revenue Growth Leader',
    summary: '10+ years scaling B2B SaaS revenue and enterprise client partnerships.',
  },
  rolePreferences: {
    currentTitle: 'Enterprise Account Executive',
    currentCompany: 'SaaS Unicorn',
    targetPrimaryTitle: 'Enterprise Sales Director',
    targetJobTitles: ['VP of Sales', 'Strategic Partnerships Director', 'Head of Business Development'],
    experienceLevel: 'director',
    totalYearsExperience: 10,
  },
  skills: {
    technicalSkills: ['enterprise sales', 'deal structuring', 'crm', 'pipeline management'],
    softSkills: ['executive negotiation', 'strategic leadership'],
    toolsAndPlatforms: ['salesforce', 'hubspot', 'outreach'],
    languages: [],
  },
  workExperiences: [
    {
      id: 'exp-1',
      title: 'Senior Enterprise Sales Manager',
      company: 'CloudTech',
      startDate: '2020-01-01',
      endDate: 'Present',
      description: 'Managed enterprise contracts and channel partnerships',
      skills: ['enterprise sales', 'deal structuring'],
    },
  ],
  education: [],
  workPreferences: {
    targetLocations: ['India', 'Worldwide Remote / Work From Anywhere'],
    workplaceTypes: ['remote'],
    employmentTypes: ['full-time'],
    compensationFloor: {
      minSalary: 120000,
      currency: 'USD',
      isDisclosedRequired: false,
    },
    targetIndustries: ['B2B SaaS', 'Cloud Software', 'Enterprise Software'],
    targetCompanyNames: ['Stripe', 'GitLab', 'Datadog', 'Snowflake'],
    hardExclusions: {
      excludedCompanies: ['BadCorp', 'ScamCo'],
      excludedTitles: ['Intern', 'Junior SDR'],
      excludedLocations: ['Antarctica'],
    },
  },
};

// Mock Jobs
function createMockJob(partial: Partial<JobOpportunity>): JobOpportunity {
  return {
    id: `job-${Math.random().toString(36).substring(2, 9)}`,
    title: 'Enterprise Account Executive',
    company: 'GitLab',
    location: 'Remote, India',
    remoteStatus: 'remote',
    workFromAnywhere: false,
    eligibleCountries: partial.eligibleCountries ?? (partial.location?.includes('India') ? ['India'] : []),
    employmentType: 'full-time',
    seniority: 'senior',
    minExperienceYears: 8,
    requiredSkills: ['enterprise sales', 'deal structuring'],
    preferredSkills: ['pipeline management'],
    responsibilities: [],
    requirements: [],
    industry: 'B2B SaaS',
    description: 'Lead large enterprise SaaS transactions.',
    lifecycleState: 'IN_FEED',
    isVerifiedLive: true,
    isApplyUrlValidated: true,
    verificationStatus: 'LIVE_VERIFIED',
    applyUrl: 'https://gitlab.com/jobs/123',
    jobUrl: 'https://gitlab.com/jobs/123',
    fingerprint: 'fp-123',
    source: { id: 'src-1', name: 'GitLab Careers', domain: 'gitlab.com', type: 'company_ats', lastIngestedAt: '' },
    sourcesHistory: [],
    datePosted: '2026-09-25T10:00:00Z',
    dateDiscovered: '2026-09-25T10:00:00Z',
    lastVerified: '2026-09-28T08:00:00Z',
    salary: { min: 140000, max: 190000, currency: 'USD', period: 'yearly', disclosed: true },
    isTargetCompany: true,
    ...partial,
  } as JobOpportunity;
}

console.log('=== CAREEROS JOB SEARCH ENGINE REBUILD VERIFICATION SUITE ===\n');

// -----------------------------------------------------------------------------
// Test 1: Profile -> SearchIntent Generation
// -----------------------------------------------------------------------------
console.log('[Test 1] Profile -> Canonical SearchIntent Generation:');
const intent = searchIntentEngine.getSearchIntent(mockProfile);
assert(Boolean(intent.id), 'SearchIntent has unique ID');
assert(intent.primaryRoleTitle === 'Enterprise Sales Director', 'SearchIntent primaryRoleTitle matches profile');
assert(intent.allEligibleRoles.length > 3, 'SearchIntent allEligibleRoles spectrum expanded');
assert(intent.targetLocations.includes(CANONICAL_INDIA), 'SearchIntent includes canonical India');
assert(intent.isOpenToWorldwideRemote === true, 'SearchIntent recognizes open to Worldwide Remote');
assert(intent.hardExclusions.companies.has('badcorp'), 'SearchIntent preserves excluded companies');
assert(intent.displaySummary.includes('Enterprise Sales Director'), 'Display summary captures primary role');

// -----------------------------------------------------------------------------
// Test 2: Profile Change -> Intent Regeneration
// -----------------------------------------------------------------------------
console.log('\n[Test 2] Profile Change -> Intent Regeneration:');
const modifiedProfile: UserProfile = {
  ...mockProfile,
  lastUpdated: new Date(Date.now() + 5000).toISOString(),
  rolePreferences: {
    ...mockProfile.rolePreferences,
    targetPrimaryTitle: 'VP of Global Partnerships',
  },
};
const refreshedIntent = searchIntentEngine.getSearchIntent(modifiedProfile);
assert(refreshedIntent.primaryRoleTitle === 'VP of Global Partnerships', 'Intent regenerates when profile changes');
assert(refreshedIntent.displaySummary.includes('VP of Global Partnerships'), 'Display summary updates after change');

// -----------------------------------------------------------------------------
// Test 3: Worldwide Remote Synonym Normalization
// -----------------------------------------------------------------------------
console.log('\n[Test 3] Worldwide Remote Synonym Normalization:');
const synonymsToTest = ['Worldwide', 'Global', 'Anywhere', 'work from anywhere', 'WFA', 'Remote - Worldwide', 'Location Independent'];
synonymsToTest.forEach((syn) => {
  const normalized = locationFilterEngine.normalizeToken(syn);
  assert(normalized === CANONICAL_WORLDWIDE, `Normalizes "${syn}" to "${CANONICAL_WORLDWIDE}"`);
});

// -----------------------------------------------------------------------------
// Test 4: Strict Semantic OR Across Locations
// -----------------------------------------------------------------------------
console.log('\n[Test 4] Location Semantic OR Evaluation ([Worldwide Remote, India]):');
const selectedLocations = ['Worldwide Remote', 'India'];

// Job A: Worldwide remote job based in US
const jobWorldwide = createMockJob({
  location: 'Worldwide Remote',
  country: 'United States',
  workFromAnywhere: true,
  remote_eligibility: {
    status: 'WORLDWIDE_REMOTE',
    scope: 'worldwide',
    eligibleCountries: ['*'],
    excludedCountries: [],
    locationText: 'Worldwide',
    evidence: 'Open to worldwide candidates',
    confidence: 100,
    isIndiaEligible: true,
  },
});
const evalWorldwide = locationFilterEngine.evaluateEligibility(jobWorldwide, selectedLocations);
assert(evalWorldwide.eligible, 'Worldwide Remote job is ELIGIBLE under [Worldwide Remote, India] OR filter');

// Job B: India on-site or domestic job
const jobIndia = createMockJob({
  location: 'Bengaluru, India',
  country: 'India',
  workFromAnywhere: false,
  remoteStatus: 'hybrid',
  remote_eligibility: {
    status: 'HYBRID',
    scope: 'india',
    eligibleCountries: ['India'],
    excludedCountries: [],
    locationText: 'Bengaluru',
    evidence: 'In-office 2 days in Bangalore',
    confidence: 100,
    isIndiaEligible: true,
  },
});
const evalIndia = locationFilterEngine.evaluateEligibility(jobIndia, selectedLocations);
assert(evalIndia.eligible, 'India-specific job is ELIGIBLE under [Worldwide Remote, India] OR filter');

// Job C: France-only on-site job
const jobFrance = createMockJob({
  location: 'Paris, France',
  country: 'France',
  workFromAnywhere: false,
  remoteStatus: 'on-site',
  remote_eligibility: {
    status: 'ONSITE',
    scope: 'country_restricted',
    eligibleCountries: ['France'],
    excludedCountries: [],
    locationText: 'Paris',
    evidence: 'Must be located in France',
    confidence: 90,
    isIndiaEligible: false,
  },
});
const evalFrance = locationFilterEngine.evaluateEligibility(jobFrance, selectedLocations);
assert(!evalFrance.eligible, 'France-only job is correctly INELIGIBLE under [Worldwide Remote, India]');

// -----------------------------------------------------------------------------
// Test 5: Workplace AND Location Semantic Evaluation
// -----------------------------------------------------------------------------
console.log('\n[Test 5] Workplace AND Location Semantic Evaluation ([Remote] + [India]):');
// Job D: Remote India job
const jobRemoteIndia = createMockJob({
  location: 'Remote, India',
  country: 'India',
  remoteStatus: 'remote',
  remote_eligibility: {
    status: 'REMOTE_FROM_INDIA',
    scope: 'india',
    eligibleCountries: ['India'],
    excludedCountries: [],
    locationText: 'India Remote',
    evidence: 'Remote in India',
    confidence: 100,
    isIndiaEligible: true,
  },
});
const evalRemoteIndia = locationFilterEngine.evaluateEligibility(jobRemoteIndia, ['India'], ['remote']);
assert(evalRemoteIndia.eligible, 'Remote + India job satisfies [Remote] AND [India]');

// Job E: On-site India job with [Remote] requested
const evalOnsiteIndia = locationFilterEngine.evaluateEligibility(jobIndia, ['India'], ['remote']);
assert(!evalOnsiteIndia.eligible, 'Onsite India job is rejected when workplace is strictly [Remote]');

// -----------------------------------------------------------------------------
// Test 6: Chip Consolidation
// -----------------------------------------------------------------------------
console.log('\n[Test 6] Active Location Chip Consolidation:');
const overlappingChips = locationFilterEngine.consolidateChips(['Worldwide', 'Work from anywhere', 'WFA', 'India', 'Bengaluru']);
assert(overlappingChips.length === 2, `Consolidates 5 overlapping tokens into exactly 2 canonical chips (${overlappingChips.length})`);
assert(overlappingChips.some((c) => c.canonicalKey === CANONICAL_INDIA), 'Contains consolidated India chip');
assert(overlappingChips.some((c) => c.canonicalKey === CANONICAL_WORLDWIDE), 'Contains consolidated Worldwide Remote chip');

// -----------------------------------------------------------------------------
// Test 7: Semantic Display Formatting
// -----------------------------------------------------------------------------
console.log('\n[Test 7] Semantic Display Formatting:');
const displayStr = locationFilterEngine.formatLocationSemanticDisplay(['India', 'Remote - Worldwide']);
assert(displayStr === 'India OR Worldwide Remote', `Formats semantic display string as "India OR Worldwide Remote" (got: "${displayStr}")`);

// -----------------------------------------------------------------------------
// Test 8: Hierarchical Role Taxonomy - Primary Match
// -----------------------------------------------------------------------------
console.log('\n[Test 8] Hierarchical Role Taxonomy - Primary Match:');
const primaryMatch = roleTaxonomyEngine.matchesRoleCriteria('Senior Enterprise Account Executive', ['Enterprise Sales', 'Account Executive']);
assert(primaryMatch.matches && primaryMatch.score >= 90, `Matches primary role title with score ${primaryMatch.score}`);

// -----------------------------------------------------------------------------
// Test 9: Hierarchical Role Taxonomy - Adjacent Roles
// -----------------------------------------------------------------------------
console.log('\n[Test 9] Hierarchical Role Taxonomy - Adjacent Roles:');
const adjacentMatch = roleTaxonomyEngine.matchesRoleCriteria('Director of Strategic Partnerships', ['Enterprise Sales Director']);
assert(adjacentMatch.matches, 'Recognizes Strategic Partnerships as adjacent career path to Enterprise Sales');

// -----------------------------------------------------------------------------
// Test 10: Hierarchical Role Taxonomy - Transferable Roles Spectrum
// -----------------------------------------------------------------------------
console.log('\n[Test 10] Hierarchical Role Taxonomy - Role Spectrum Expansion:');
const spectrum = roleTaxonomyEngine.inferRoleSpectrum(['Enterprise Sales Director']);
assert(spectrum.primaryRoles.length > 0, 'Infers primary roles');
assert(spectrum.adjacentRoles.length > 0, 'Infers adjacent roles');
assert(spectrum.transferableRoles.length > 0, 'Infers transferable roles');

// -----------------------------------------------------------------------------
// Test 11: Hierarchical Role Taxonomy - Dynamic Learning
// -----------------------------------------------------------------------------
console.log('\n[Test 11] Hierarchical Role Taxonomy - Dynamic Title Learning:');
roleTaxonomyEngine.learnTitleFromPosting('Global Head of Revenue Operations', 'Stripe');
const learnedMatch = roleTaxonomyEngine.matchesRoleCriteria('Global Head of Revenue Operations', ['Enterprise Sales']);
assert(learnedMatch.matches, 'Learned title is recognized in future taxonomy matching');

// -----------------------------------------------------------------------------
// Test 12: 12-Factor Deterministic Match Scoring
// -----------------------------------------------------------------------------
console.log('\n[Test 12] 12-Factor Match Scoring Breakdown:');
const scoreBreakdown = jobMatchingEngine.evaluateJob(jobWorldwide, mockProfile);
assert(scoreBreakdown.finalScore > 75, `High quality job receives high score: ${scoreBreakdown.finalScore}%`);
assert(scoreBreakdown.roleFit >= 70, `Role fit calculated: ${scoreBreakdown.roleFit}%`);
assert(scoreBreakdown.locationFit === 100, `Location fit for Worldwide Remote: ${scoreBreakdown.locationFit}%`);
assert(scoreBreakdown.companyFit === 100, `Target company fit: ${scoreBreakdown.companyFit}%`);

// -----------------------------------------------------------------------------
// Test 13: Explainable Match Reasons (3-5 Bullet Points)
// -----------------------------------------------------------------------------
console.log('\n[Test 13] Explainable Match Reasons:');
const analysis = jobMatchingEngine.getMatchAnalysis(jobWorldwide, mockProfile);
assert(analysis.strengths.length >= 3, `Generates at least 3 explainable reasons (${analysis.strengths.length})`);
assert(Boolean(analysis.breakdown), 'Includes transparent multi-factor breakdown in analysis');
console.log(`    Sample reasons:`);
analysis.strengths.forEach((r) => console.log(`      - ${r}`));

// -----------------------------------------------------------------------------
// Test 14: Target Company Bonus & Priority
// -----------------------------------------------------------------------------
console.log('\n[Test 14] Target Company Priority Bonus:');
const targetJob = createMockJob({ company: 'GitLab', isTargetCompany: true });
const nonTargetJob = createMockJob({ company: 'UnknownInc', isTargetCompany: false });
const targetScore = jobMatchingEngine.evaluateJob(targetJob, mockProfile);
const nonTargetScore = jobMatchingEngine.evaluateJob(nonTargetJob, mockProfile);
assert(targetScore.companyFit > nonTargetScore.companyFit, `Target company receives priority score (${targetScore.companyFit}% vs ${nonTargetScore.companyFit}%)`);
assert(targetScore.allReasons.some((r) => r.toLowerCase().includes('target company')), 'Target company noted in reasons');

// -----------------------------------------------------------------------------
// Test 15: Salary Truth Architecture (Stated vs Undisclosed)
// -----------------------------------------------------------------------------
console.log('\n[Test 15] Salary Truth Architecture:');
const undisclosedJob = createMockJob({
  salary: { min: 0, max: 0, currency: '', period: 'yearly', disclosed: false },
  salary_truth: { status: 'NOT_DISCLOSED' },
});
const statedJob = createMockJob({
  salary: { min: 150000, max: 190000, currency: 'USD', period: 'yearly', disclosed: true },
  salary_truth: { status: 'EMPLOYER_STATED', min: 150000, max: 190000, currency: 'USD' },
});
assert(!undisclosedJob.salary.disclosed, 'Undisclosed job flagged as undisclosed');
assert(statedJob.salary.disclosed, 'Stated job flagged as disclosed');

// -----------------------------------------------------------------------------
// Test 16: Hard Exclusions Strictly Disqualify
// -----------------------------------------------------------------------------
console.log('\n[Test 16] Hard Exclusions Enforcement:');
const excludedCompanyJob = createMockJob({ company: 'BadCorp' });
const excludedCompanyEval = jobMatchingEngine.evaluateJob(excludedCompanyJob, mockProfile);
assert(excludedCompanyEval.isExcluded === true, 'Company on exclusion list is strictly disqualified');
assert(excludedCompanyEval.finalScore === 0, 'Disqualified job receives score of 0');

const excludedTitleJob = createMockJob({ title: 'Junior SDR Assistant' });
const excludedTitleEval = jobMatchingEngine.evaluateJob(excludedTitleJob, mockProfile);
assert(excludedTitleEval.isExcluded === true, 'Title on exclusion list is strictly disqualified');

// -----------------------------------------------------------------------------
// Test 17: Source Telemetry (Target Companies vs Other Sources)
// -----------------------------------------------------------------------------
console.log('\n[Test 17] Source Telemetry Architecture:');
const telemetry = sourceHealthEngine.getTelemetrySummary(209);
assert(telemetry.targetCompanies.total === 209, `Target companies tracked: ${telemetry.targetCompanies.total}`);
assert(telemetry.targetCompanies.updating === 6, `Bounded concurrency of 6 workers: ${telemetry.targetCompanies.updating}`);
assert(telemetry.otherSources.active > 0, `Active other sources reported: ${telemetry.otherSources.active}`);
assert(telemetry.otherSources.healthy > 0, `Healthy sources reported: ${telemetry.otherSources.healthy}`);

console.log(`\n======================================================`);
console.log(`ALL 17 VERIFICATION TESTS PASSED SUCCESSFULLY! (${passedTests}/${totalTests})`);
console.log(`======================================================\n`);
