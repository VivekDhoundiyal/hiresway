import { executeJobPipeline, generateJobFingerprint, normalizeRawDiscoveredJob } from '../src/core/jobs/jobPipeline';
import { jobMatchingEngine } from '../src/core/jobs/engines/jobMatchingEngine';
import { locationFilterEngine } from '../src/core/jobs/engines/locationFilterEngine';
import { filterEvaluationEngine } from '../src/core/jobs/engines/filterEvaluationEngine';
import { feedRankingEngine } from '../src/core/jobs/engines/feedRankingEngine';
import { JobOpportunity, RawDiscoveredJob, JobFilterCriteria } from '../src/core/jobs/types';
import { UserProfile } from '../src/core/profile/types';

// Mock test profile
const testProfile: UserProfile = {
  id: 'test-user',
  fullName: 'Vivek Dhoundiyal',
  currentRole: 'Senior Enterprise AE',
  targetRoles: ['Enterprise Account Executive', 'Strategic Account Executive', 'Director of Sales'],
  primaryRoles: ['Enterprise Account Executive', 'Strategic Account Executive'],
  yearsOfExperience: 8,
  coreSkills: ['Enterprise Sales', 'B2B SaaS', 'Contract Negotiation', 'MEDDPICC', 'Outbound Prospecting'],
  preferredSkills: ['Salesforce', 'HubSpot'],
  targetLocations: ['India', 'Worldwide Remote'],
  targetWorkplaces: ['remote', 'hybrid'],
  homeCountry: 'India',
  targetMarkets: {
    targetCompanies: ['Salesforce', 'HubSpot', 'Stripe'],
    homeCountry: 'India',
  },
  compensation: {
    minBaseSalary: 120000,
    preferredCurrency: 'USD',
  },
} as any;

console.log('================================================================');
console.log('  RUNNING PRODUCTION-GRADE SYSTEM VERIFICATION SUITE');
console.log('================================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - Detail: ${detail}` : ''}`);
    testsFailed++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Generic Words Guard (Requirement 6)
// "business", "manager", "sales", "growth" must NEVER trigger role match alone
// -----------------------------------------------------------------------------
const genericJob: JobOpportunity = {
  id: 'job-generic-1',
  title: 'Business Manager',
  company: 'Generic Corp',
  location: 'Bangalore, India',
  jobUrl: 'https://example.com/job/bm1',
  applyUrl: 'https://example.com/job/bm1/apply',
  remoteStatus: 'on-site',
  originalPostedAt: new Date().toISOString(),
  datePosted: new Date().toISOString(),
} as any;

const genericAnalysis = jobMatchingEngine.evaluateJob(genericJob, testProfile);
assert(
  genericAnalysis.roleFit < 50,
  'Generic words guard: "Business Manager" alone does NOT score high role fit',
  `Role fit was ${genericAnalysis.roleFit}`
);

// -----------------------------------------------------------------------------
// TEST 2: Exact Target Role High Match (Requirement 6)
// -----------------------------------------------------------------------------
const targetJob: JobOpportunity = {
  id: 'job-target-1',
  title: 'Enterprise Account Executive',
  company: 'Stripe',
  location: 'Worldwide Remote',
  jobUrl: 'https://stripe.com/jobs/eae-1',
  applyUrl: 'https://stripe.com/jobs/eae-1/apply',
  remoteStatus: 'remote',
  workFromAnywhere: true,
  requiredSkills: ['Enterprise Sales', 'B2B SaaS', 'MEDDPICC'],
  originalPostedAt: new Date().toISOString(),
  datePosted: new Date().toISOString(),
} as any;

const targetAnalysis = jobMatchingEngine.evaluateJob(targetJob, testProfile);
assert(
  targetAnalysis.roleFit >= 90 && targetAnalysis.finalScore >= 80,
  'Target Role match: "Enterprise Account Executive" at Stripe scores >= 80%',
  `Final score was ${targetAnalysis.finalScore}%, roleFit was ${targetAnalysis.roleFit}`
);

// -----------------------------------------------------------------------------
// TEST 3: Seniority Fit & Exclusion Penalties (Requirement 6)
// -----------------------------------------------------------------------------
const internJob: JobOpportunity = {
  id: 'job-intern-1',
  title: 'Sales Intern',
  company: 'Acme Corp',
  location: 'Bangalore, India',
  jobUrl: 'https://example.com/job/intern',
  applyUrl: 'https://example.com/job/intern/apply',
  originalPostedAt: new Date().toISOString(),
} as any;

const internAnalysis = jobMatchingEngine.evaluateJob(internJob, testProfile);
assert(
  internAnalysis.seniorityFit <= 30 && internAnalysis.finalScore < 40,
  'Seniority Mismatch Penalty: Experienced profile vs "Sales Intern" gets penalized',
  `Seniority fit: ${internAnalysis.seniorityFit}, final score: ${internAnalysis.finalScore}`
);

// -----------------------------------------------------------------------------
// TEST 4: Location Semantic OR (Requirement 8)
// India + Worldwide Remote = (location = India) OR (workplace = Worldwide Remote)
// -----------------------------------------------------------------------------
const indiaJob: JobOpportunity = {
  id: 'job-india-physical',
  title: 'Account Executive',
  company: 'Indian Tech Ltd',
  location: 'Bangalore, India',
  country: 'India',
  remoteStatus: 'on-site',
  originalPostedAt: new Date().toISOString(),
} as any;

const wfaJob: JobOpportunity = {
  id: 'job-wfa-global',
  title: 'Account Executive',
  company: 'Gitlab',
  location: 'Worldwide Remote',
  remoteStatus: 'remote',
  workFromAnywhere: true,
  remote_eligibility: { status: 'WORLDWIDE_REMOTE', scope: 'worldwide', isIndiaEligible: true } as any,
  originalPostedAt: new Date().toISOString(),
} as any;

const usOnlyJob: JobOpportunity = {
  id: 'job-us-restricted',
  title: 'Account Executive',
  company: 'US Firm',
  location: 'San Francisco, CA, USA',
  country: 'USA',
  remoteStatus: 'on-site',
  originalPostedAt: new Date().toISOString(),
} as any;

const indiaLocEval = locationFilterEngine.evaluateEligibility(indiaJob, ['India', 'Worldwide Remote']);
const wfaLocEval = locationFilterEngine.evaluateEligibility(wfaJob, ['India', 'Worldwide Remote']);
const usLocEval = locationFilterEngine.evaluateEligibility(usOnlyJob, ['India', 'Worldwide Remote']);

assert(indiaLocEval.eligible === true, 'Location OR: Physical India job passes [India, Worldwide Remote]');
assert(wfaLocEval.eligible === true, 'Location OR: Worldwide Remote job passes [India, Worldwide Remote]');
assert(usLocEval.eligible === false, 'Location OR: US-only on-site job rejected by [India, Worldwide Remote]');

// -----------------------------------------------------------------------------
// TEST 5: India-only remote job is NEVER Worldwide Remote (Requirement 8)
// -----------------------------------------------------------------------------
const indiaRemoteJob: JobOpportunity = {
  id: 'job-in-remote',
  title: 'Account Executive',
  company: 'Bangalore Startup',
  location: 'India (Remote)',
  country: 'India',
  remoteStatus: 'remote',
  workFromAnywhere: false,
  remote_eligibility: { status: 'REMOTE_FROM_INDIA', scope: 'india', isIndiaEligible: true } as any,
  originalPostedAt: new Date().toISOString(),
} as any;

const indiaRemoteWorldwideEval = locationFilterEngine.evaluateEligibility(indiaRemoteJob, ['Worldwide Remote']);
assert(
  indiaRemoteWorldwideEval.eligible === false,
  'Strict Guard: India-only remote job is NOT classified as Worldwide Remote'
);

// -----------------------------------------------------------------------------
// TEST 6: Strict 7-Day Freshness Gate (Requirement 2 & 11)
// -----------------------------------------------------------------------------
const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
const freshToday = new Date().toISOString();

const expiredJob: JobOpportunity = {
  ...targetJob,
  id: 'job-expired-1',
  originalPostedAt: eightDaysAgo,
  datePosted: eightDaysAgo,
};

const freshJob: JobOpportunity = {
  ...targetJob,
  id: 'job-fresh-1',
  originalPostedAt: freshToday,
  datePosted: freshToday,
};

const freshFilterRes = filterEvaluationEngine.evaluateJob(freshJob, {
  searchQuery: '',
  fitTier: 'all',
  remoteType: 'all',
  countryMarket: 'all',
  salaryDisclosedOnly: false,
  seniority: 'all',
  industry: 'all',
  sortBy: 'best_match',
}, { maxAgeDays: 7 });

const expiredFilterRes = filterEvaluationEngine.evaluateJob(expiredJob, {
  searchQuery: '',
  fitTier: 'all',
  remoteType: 'all',
  countryMarket: 'all',
  salaryDisclosedOnly: false,
  seniority: 'all',
  industry: 'all',
  sortBy: 'best_match',
}, { maxAgeDays: 7 });

assert(freshFilterRes.passes === true, 'Freshness gate: Job posted today passes 7-day window');
assert(expiredFilterRes.passes === false && expiredFilterRes.failedCategory === 'freshness', 'Freshness gate: Job posted 8 days ago rejected by 7-day window');

// -----------------------------------------------------------------------------
// TEST 7: Canonical Fingerprint & Cross-Requisition Collision Prevention (Requirement 10)
// -----------------------------------------------------------------------------
const jobReq1: JobOpportunity = {
  id: 'job-google-1',
  company: 'Google',
  title: 'Enterprise Account Executive',
  location: 'Bangalore',
  canonicalUrl: 'https://careers.google.com/jobs/results/11111',
} as any;

const jobReq2: JobOpportunity = {
  id: 'job-google-2',
  company: 'Google',
  title: 'Enterprise Account Executive',
  location: 'Bangalore',
  canonicalUrl: 'https://careers.google.com/jobs/results/22222',
} as any;

const fp1 = generateJobFingerprint(jobReq1);
const fp2 = generateJobFingerprint(jobReq2);

assert(fp1 !== fp2, 'Fingerprint collision prevention: Two distinct requisitions at Google with different URLs yield distinct fingerprints');

// -----------------------------------------------------------------------------
// TEST 8: Full 12-Stage Pipeline Execution (Requirement 3)
// -----------------------------------------------------------------------------
const rawGoodJob: RawDiscoveredJob = {
  id: 'raw-1',
  title: 'Enterprise Account Executive',
  company: 'Stripe',
  location: 'Bangalore, India',
  country: 'India',
  jobUrl: 'https://stripe.com/jobs/eae-in',
  applyUrl: 'https://stripe.com/jobs/eae-in/apply',
  remoteStatus: 'remote',
  datePosted: freshToday,
  description: 'Join Stripe as an Enterprise Account Executive in India.',
  requiredSkills: ['Enterprise Sales', 'B2B SaaS'],
  source: { id: 'ashby-1', name: 'Ashby' },
} as any;

const pipelineResult = executeJobPipeline(rawGoodJob, {
  profile: testProfile,
  maxAgeDays: 7,
  minScoreThreshold: 60,
});

assert(pipelineResult.passed === true, '12-Stage Pipeline: Valid fresh matching job passes all 12 stages');
assert(pipelineResult.feedStatus === 'PUBLISHED', '12-Stage Pipeline: Final job status is PUBLISHED');
assert(pipelineResult.stages.length === 12, '12-Stage Pipeline: All 12 required stages are recorded');

// -----------------------------------------------------------------------------
// TEST 9: Feed Ranking - All 8 Sort Modes (Requirement 9)
// -----------------------------------------------------------------------------
const candidateA: any = {
  id: 'cand-a',
  title: 'Enterprise AE',
  company: 'Acme',
  originalPostedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5h ago
  lastUpdatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  salary: { min: 100000, max: 150000, disclosed: true },
  isTargetCompany: false,
  match: { overallScore: 88 },
};

const candidateB: any = {
  id: 'cand-b',
  title: 'Senior Enterprise AE',
  company: 'Stripe', // Target company
  originalPostedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(), // 20h ago
  lastUpdatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  salary: { min: 140000, max: 180000, disclosed: true },
  isTargetCompany: true,
  match: { overallScore: 94 },
};

const candidateC: any = {
  id: 'cand-c',
  title: 'Strategic AE',
  company: 'Beta',
  originalPostedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 2d ago
  lastUpdatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  salary: { disclosed: false }, // Unspecified salary
  isTargetCompany: false,
  match: { overallScore: 75 },
};

const candidates = [candidateA, candidateB, candidateC];

// Mode 1: Newest
const sortedNewest = feedRankingEngine.sortOpportunities(candidates, 'newest');
assert(sortedNewest[0].id === 'cand-a', 'Sort Mode 1 (Newest): candidateA (5h ago) is on top');

// Mode 2: Recently Updated
const sortedUpdated = feedRankingEngine.sortOpportunities(candidates, 'recently_updated');
assert(sortedUpdated[0].id === 'cand-b', 'Sort Mode 2 (Recently Updated): candidateB (1h ago update) is on top');

// Mode 3: Highest Match
const sortedMatch = feedRankingEngine.sortOpportunities(candidates, 'highest_match');
assert(sortedMatch[0].id === 'cand-b', 'Sort Mode 3 (Highest Match): candidateB (94%) is on top');

// Mode 4: Salary High -> Low (unspecified at bottom)
const sortedSalHigh = feedRankingEngine.sortOpportunities(candidates, 'salary_high_low');
assert(
  sortedSalHigh[0].id === 'cand-b' && sortedSalHigh[2].id === 'cand-c',
  'Sort Mode 4 (Salary High->Low): candidateB ($180k) on top, candidateC ($0/unspecified) strictly at bottom'
);

// Mode 5: Salary Low -> High (unspecified at bottom)
const sortedSalLow = feedRankingEngine.sortOpportunities(candidates, 'salary_low_high');
assert(
  sortedSalLow[0].id === 'cand-a' && sortedSalLow[2].id === 'cand-c',
  'Sort Mode 5 (Salary Low->High): candidateA ($100k) on top, candidateC ($0/unspecified) strictly at bottom'
);

// Mode 6: Target Companies
const sortedTarget = feedRankingEngine.sortOpportunities(candidates, 'target_companies');
assert(sortedTarget[0].id === 'cand-b', 'Sort Mode 6 (Target Companies): Stripe (target company) is on top');

// Mode 7: Best Match
const sortedBest = feedRankingEngine.sortOpportunities(candidates, 'best_match');
assert(sortedBest[0].id === 'cand-b', 'Sort Mode 7 (Best Match): Candidate B (Target + Highest Match) is on top');

// Mode 8: Closing Soon
const candExpSoon: any = { ...candidateA, id: 'cand-exp', expires_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString() };
const candExpLater: any = { ...candidateB, id: 'cand-later', expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString() };
const sortedClosing = feedRankingEngine.sortOpportunities([candExpLater, candExpSoon], 'closing_soon');
assert(sortedClosing[0].id === 'cand-exp', 'Sort Mode 8 (Closing Soon): Job expiring in 2h is on top');

// -----------------------------------------------------------------------------
// TEST 10: Multi-Filter Semantic OR and Cross-Category AND (Requirement 8 & 16)
// -----------------------------------------------------------------------------
const filterTestCriteria: JobFilterCriteria = {
  searchQuery: '',
  fitTier: 'all',
  remoteType: 'all',
  countryMarket: 'all',
  salaryDisclosedOnly: false,
  seniority: 'all',
  industry: 'all',
  sortBy: 'best_match',
  targetCompaniesOnly: true,
  sources: ['Ashby', 'Lever'],
};

const passingFilteredJob: JobOpportunity = {
  ...targetJob,
  id: 'filtered-pass',
  isTargetCompany: true,
  sourceName: 'Ashby',
  originalPostedAt: freshToday,
  datePosted: freshToday,
};

const failingFilteredJob: JobOpportunity = {
  ...targetJob,
  id: 'filtered-fail',
  isTargetCompany: false, // Fails targetCompaniesOnly
  sourceName: 'Ashby',
  originalPostedAt: freshToday,
  datePosted: freshToday,
};

const filterEvalPass = filterEvaluationEngine.evaluateJob(passingFilteredJob, filterTestCriteria, { maxAgeDays: 7 });
const filterEvalFail = filterEvaluationEngine.evaluateJob(failingFilteredJob, filterTestCriteria, { maxAgeDays: 7 });

assert(filterEvalPass.passes === true, 'Filter Evaluation: Job matching all multi-filters passes');
assert(filterEvalFail.passes === false, 'Filter Evaluation: Job failing target company filter is rejected');

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  VERIFICATION COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('================================================================\n');

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
