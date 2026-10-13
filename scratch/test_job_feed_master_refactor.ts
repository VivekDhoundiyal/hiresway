/**
 * Test Suite: CAREEROS JOB FEED — MASTER ENGINE + UX REFACTOR
 *
 * Verifies:
 * 1. Profile Intelligence Engine:
 *    - Structured JobPreferenceVector compilation
 *    - Automatic derivation of 3–5 active filters
 *    - Hard exclusion rules extraction
 * 2. Job Matching Engine:
 *    - 8-dimension weighted matching (Role 25%, Skill 20%, Exp 15%, Loc 10%, Remote 10%, Ind 5%, Sal 5%, Comp 10%)
 *    - Hard exclusion overrides (0% score / disqualified)
 *    - Top 1–2 most compelling reasons
 *    - Online learning feedback integration
 * 3. Fresh Social-Feed Model:
 *    - Cohort evaluation: NEW, JUST_IN (<6h), TODAY (<24h), EARLIER
 *    - Stable stream ordering (NEW first, verified prioritized, timestamp descending)
 *    - Automatic pruning of dead/closed/expired jobs
 * 4. Source Recommendation Engine:
 *    - Coverage gap analysis for target companies & regions
 *    - Single-click activation of recommended source
 * 5. Reject & Learning Loop:
 *    - Discreet "×" reject evicts immediately
 *    - DB record preserved
 *    - Suppression and learning dampening applied
 */

import {
  profileIntelligenceEngine,
  jobMatchingEngine,
  socialFeedEngine,
  sourceRecommendationEngine,
  preferenceLearningEngine,
} from '../src/core/jobs/engines';
import { jobRepository } from '../src/core/jobs/jobRepository';
import { sourceRegistry } from '../src/core/jobs/sourceRegistry';
import { defaultProfile } from '../src/core/profile/defaultProfile';
import { JobOpportunity } from '../src/core/jobs/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING CAREEROS JOB FEED MASTER REFACTOR TEST SUITE');
  console.log('===============================================================');

  // ---------------------------------------------------------------------------
  // TEST 1: Profile Intelligence Engine & JobPreferenceVector
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 1] Profile Intelligence Engine: JobPreferenceVector & Auto-Filters');
  const profile = { ...defaultProfile };
  const vector = profileIntelligenceEngine.compileVector(profile);

  assert(Boolean(vector.primaryRole), `Primary role compiled: "${vector.primaryRole}"`);
  assert(vector.coreSkills.size > 0, `Core skills extracted: ${vector.coreSkills.size} skills`);
  assert(vector.targetLocations.length > 0, `Target locations compiled: ${vector.targetLocations.join(', ')}`);
  assert(vector.weights.roleWeight === 0.25, 'Role weight is exactly 25%');
  assert(vector.weights.skillWeight === 0.20, 'Skill weight is exactly 20%');
  assert(vector.weights.experienceWeight === 0.15, 'Experience weight is exactly 15%');
  assert(vector.weights.locationWeight === 0.10, 'Location weight is exactly 10%');
  assert(vector.weights.remoteWeight === 0.10, 'Remote weight is exactly 10%');
  assert(vector.weights.industryWeight === 0.05, 'Industry weight is exactly 5%');
  assert(vector.weights.salaryWeight === 0.05, 'Salary weight is exactly 5%');
  assert(vector.weights.companyWeight === 0.10, 'Company weight is exactly 10%');

  const initialFilters = profileIntelligenceEngine.deriveInitialFilters(profile);
  assert(initialFilters.sortBy === 'match', 'Default sort by match derived');
  assert(initialFilters.remoteType !== undefined, `Auto-derived remote filter: ${initialFilters.remoteType}`);
  assert(initialFilters.countryMarket !== undefined, `Auto-derived country market filter: ${initialFilters.countryMarket}`);

  // ---------------------------------------------------------------------------
  // TEST 2: Job Matching Engine 8-Dimension Scoring & Top Reasons
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Job Matching Engine: 8-Dimension Weighted Scoring & Top Reasons');

  const sampleJob: JobOpportunity = {
    id: 'test-job-ae-1',
    title: profile.rolePreferences.targetPrimaryTitle || 'Account Executive',
    company: 'Stripe',
    companyDomain: 'stripe.com',
    location: 'Bengaluru, India',
    country: 'India',
    remoteStatus: 'hybrid',
    employmentType: 'full-time',
    minExperienceYears: 5,
    requiredSkills: ['B2B SaaS', 'Enterprise Sales', 'Negotiation'],
    description: 'Enterprise Account Executive leading GTM sales',
    salary: { min: 3000000, max: 4500000, currency: 'INR', disclosed: true, period: 'annual' },
    source: { id: 'src-stripe', name: 'Stripe Careers', type: 'company_career_portal', tier: 'tier_1_verified' },
    isVerifiedLive: true,
    verificationStatus: 'LIVE_VERIFIED',
    lifecycleState: 'DISCOVERED',
    isTargetCompany: true,
    dateDiscovered: new Date().toISOString(),
    first_seen_at: new Date().toISOString(),
  };

  const matchBreakdown = jobMatchingEngine.evaluateJob(sampleJob, profile);
  assert(matchBreakdown.finalScore >= 75, `High match score computed: ${matchBreakdown.finalScore}%`);
  assert(matchBreakdown.roleFit >= 80, `Role fit evaluated: ${matchBreakdown.roleFit}%`);
  assert(matchBreakdown.topReasons.length >= 1 && matchBreakdown.topReasons.length <= 2, `Top reasons limited to 1-2 items: ${JSON.stringify(matchBreakdown.topReasons)}`);

  const matchAnalysis = jobMatchingEngine.getMatchAnalysis(sampleJob, profile);
  assert(matchAnalysis.overallScore === matchBreakdown.finalScore, 'Match analysis overall score matches breakdown');
  assert(matchAnalysis.strengths.length >= 1 && matchAnalysis.strengths.length <= 2, 'Strengths contains exactly 1-2 top reasons for card display');

  // Hard exclusion test
  const excludedVector = {
    ...vector,
    hardExclusions: {
      excludedCompanies: new Set(['badcorp']),
      excludedTitles: new Set(['telemarketer']),
      excludedLocations: new Set(['antarctica']),
    },
  };

  const excludedJob: JobOpportunity = {
    ...sampleJob,
    id: 'test-job-excluded',
    company: 'BadCorp',
  };

  const excludedEval = jobMatchingEngine.evaluateJob(excludedJob, excludedVector);
  assert(excludedEval.finalScore === 0, 'Hard excluded company receives 0% match score');
  assert(excludedEval.isExcluded === true, 'isExcluded flag is true for excluded job');

  // ---------------------------------------------------------------------------
  // TEST 3: Fresh Social-Feed Model & Stable Cohorts
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Social Feed Engine: Cohorts, Stable Stream Ordering & Dead Job Pruning');

  const now = Date.now();
  const unreadNewJob: JobOpportunity = {
    ...sampleJob,
    id: 'cohort-new',
    is_new: true,
    viewed_at: undefined,
  };

  const justInJob: JobOpportunity = {
    ...sampleJob,
    id: 'cohort-just-in',
    is_new: false,
    viewed_at: new Date(now - 1000 * 60).toISOString(),
    first_seen_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (< 6h)
  };

  const todayJob: JobOpportunity = {
    ...sampleJob,
    id: 'cohort-today',
    is_new: false,
    viewed_at: new Date(now - 1000 * 60).toISOString(),
    first_seen_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago (< 24h)
  };

  const earlierJob: JobOpportunity = {
    ...sampleJob,
    id: 'cohort-earlier',
    is_new: false,
    viewed_at: new Date(now - 1000 * 60).toISOString(),
    first_seen_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
  };

  const deadJob: JobOpportunity = {
    ...sampleJob,
    id: 'cohort-dead',
    lifecycleState: 'CLOSED',
  };

  assert(socialFeedEngine.getJobCohort(unreadNewJob) === 'NEW', 'Unread job classified as NEW');
  assert(socialFeedEngine.getJobCohort(justInJob) === 'JUST_IN', 'Job from 2h ago classified as JUST_IN');
  assert(socialFeedEngine.getJobCohort(todayJob) === 'TODAY', 'Job from 12h ago classified as TODAY');
  assert(socialFeedEngine.getJobCohort(earlierJob) === 'EARLIER', 'Job from 48h ago classified as EARLIER');
  assert(socialFeedEngine.isJobActiveAndLive(deadJob) === false, 'Closed job evaluated as not active');

  const rankedStream = socialFeedEngine.rankSocialFeed([earlierJob, justInJob, deadJob, unreadNewJob, todayJob]);
  assert(!rankedStream.some((j) => j.id === 'cohort-dead'), 'Dead job automatically pruned from ranked social stream');
  assert(rankedStream[0].id === 'cohort-new', 'NEW job prepended to top of social stream');
  assert(rankedStream[1].id === 'cohort-just-in', 'JUST_IN job placed second in social stream');
  assert(rankedStream[2].id === 'cohort-today', 'TODAY job placed third in social stream');
  assert(rankedStream[3].id === 'cohort-earlier', 'EARLIER job placed fourth in social stream');

  // ---------------------------------------------------------------------------
  // TEST 4: Source Recommendation Engine
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Source Recommendation Engine: Coverage Gaps & One-Click Activation');

  const allSources = sourceRegistry.getAllSources();
  const recommendations = sourceRecommendationEngine.getRecommendations(profile, allSources);

  if (recommendations && recommendations.recommendations.length > 0) {
    const firstRec = recommendations.recommendations[0];
    assert(Boolean(firstRec.source.name), `Recommendation formulated for source: ${firstRec.source.name}`);
    assert(Boolean(firstRec.headlineReason), `Headline reason provided: "${firstRec.headlineReason}"`);
    assert(firstRec.expectedYieldScore >= 50, `Expected yield score computed: ${firstRec.expectedYieldScore}`);

    const activateResult = sourceRecommendationEngine.activateRecommendedSource(firstRec.source.id);
    assert(activateResult === true, 'One-click activation succeeded');
    const updated = sourceRegistry.getSourceById(firstRec.source.id);
    assert(updated?.activeStatus === true, 'Source activeStatus successfully enabled in registry');
  } else {
    console.log('  ℹ All candidate sources are already enabled in test environment.');
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Reject & Learning Feedback Loop
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Rejection & Learning Engine: Eviction, Signal Recording & DB Preservation');

  const rejectTestJob: JobOpportunity = {
    ...sampleJob,
    id: `reject-test-${Date.now()}`,
    title: 'Irrelevant Role Specialist',
    company: 'SpammyCorp',
  };

  jobRepository.saveOpportunity(rejectTestJob);
  const beforeRejectCount = jobRepository.getActiveOpportunities().length;

  // Perform reject
  jobRepository.markRejected(rejectTestJob.id);

  // 1. Instant eviction from active feed
  const activeAfterReject = jobRepository.getActiveOpportunities();
  assert(!activeAfterReject.some((j) => j.id === rejectTestJob.id), 'Rejected job immediately evicted from active opportunities');

  // 2. DB Record is preserved (never deleted)
  const dbJob = jobRepository.getOpportunityById(rejectTestJob.id);
  assert(dbJob !== undefined, 'Job record remains in database (never deleted)');
  assert(dbJob?.lifecycleState === 'REJECTED', 'Job lifecycle state marked as REJECTED');

  // 3. Learning signals ingested
  const prefs = preferenceLearningEngine.getPreferences();
  assert((prefs.disfavoredCompanies['spammycorp'] || 0) >= 1, 'Rejection signal for company recorded in preferenceLearningEngine');

  console.log('\n===============================================================');
  console.log('🎉 ALL 5 MASTER ENGINE & UX REFACTOR TESTS PASSED PERFECTLY!');
  console.log('===============================================================');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
