/**
 * Automated Verification Suite for:
 * CAREEROS — FINAL JOB FRESHNESS + CARD UI FIX
 *
 * Verifies all 12 criteria specified in Mandate 12:
 * 1. Job posted 8 days ago -> excluded from default feed
 * 2. Job posted 6 days ago -> included in default feed
 * 3. Job posted 30 days ago, discovered today -> excluded
 * 4. Job updated today, original post 30 days ago -> excluded
 * 5. Job with unknown post date -> excluded from default feed
 * 6. Job with unknown post date -> retained in historical DB
 * 7. Discovered date formatted string never says 'Discovered Posted today'
 * 8. Card titles truncate cleanly at 2 lines across viewport widths
 * 9. All 3 cards in a row have identical height and button alignment
 * 10. Salary row displays only when real data exists; no blank grey pill
 * 11. Target company badge appears only on confirmed target companies
 * 12. 60% match fallback is completely eliminated
 */

import fs from 'fs';
import path from 'path';

// Provide memory localStorage if undefined in node
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

import { freshnessEngine } from '../src/core/jobs/engines/freshnessEngine';
import { jobRepository } from '../src/core/jobs/jobRepository';
import { fastJobMatcher } from '../src/core/intelligence/fastJobMatcher';
import { classifyOpportunities } from '../src/core/intelligence/careerIntelligenceEngine';
import { JobOpportunity, MAX_JOB_AGE_DAYS, EXPANDED_JOB_AGE_DAYS } from '../src/core/jobs/types';
import { UserProfile } from '../src/core/profile/types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${testName}`);
  } else {
    console.error(`  [FAIL] #${totalTests}: ${testName}${details ? ` -> ${details}` : ''}`);
    throw new Error(`Assertion failed: ${testName} - ${details || ''}`);
  }
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function hoursAgoISO(hours: number): string {
  const d = new Date();
  d.setTime(d.getTime() - hours * 3600 * 1000);
  return d.toISOString();
}

function makeMockJob(overrides: Partial<JobOpportunity> = {}): JobOpportunity {
  const id = overrides.id || `job-test-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    title: overrides.title || `Senior Software Engineer ${id}`,
    company: overrides.company || `TechCorp ${id}`,
    location: overrides.location || 'Bengaluru, India',
    remote_type: overrides.remote_type || 'hybrid',
    description: overrides.description || 'Develop high throughput distributed platforms.',
    salary_range: overrides.salary_range || '₹35L - ₹50L',
    first_seen_at: overrides.first_seen_at || new Date().toISOString(),
    status: overrides.status || 'discovered',
    source: overrides.source || 'greenhouse',
    jobUrl: overrides.jobUrl || `https://example.com/jobs/${id}`,
    applyUrl: overrides.applyUrl || `https://example.com/jobs/${id}/apply`,
    originalPostedAt: overrides.originalPostedAt,
    lastUpdatedAt: overrides.lastUpdatedAt,
    discoveredAt: overrides.discoveredAt || new Date().toISOString(),
    lastVerifiedAt: overrides.lastVerifiedAt || new Date().toISOString(),
    lifecycleState: overrides.lifecycleState || 'ACTIVE_FEED',
    match_score: overrides.match_score,
    match_reasons: overrides.match_reasons,
    isTargetCompany: overrides.isTargetCompany,
    ...overrides,
  };
}

console.log('\n============================================================');
console.log('CAREEROS: FINAL JOB FRESHNESS & CARD UI VERIFICATION SUITE');
console.log('============================================================\n');

// -----------------------------------------------------------------------------
// Mandate 12 - Test 1: Job posted 8 days ago -> excluded from default feed
// -----------------------------------------------------------------------------
console.log('--- Mandate 12.1: Job posted 8 days ago excluded from default feed ---');
{
  const job8d = makeMockJob({
    id: 'job-8-days-old',
    originalPostedAt: daysAgoISO(8),
    discoveredAt: new Date().toISOString(),
  });

  const freshnessResult = freshnessEngine.isJobWithinAgeWindow(job8d, MAX_JOB_AGE_DAYS);
  assert(freshnessResult.eligible === false, 'Freshness engine rejects 8-day old job for default 7-day feed');
  assert(freshnessResult.ageDays === 8, 'Calculated age in days is correctly 8');

  // Verify in job repository query
  jobRepository.saveOpportunity(job8d);
  const activeFeedJobs = jobRepository.getActiveOpportunities(MAX_JOB_AGE_DAYS);
  const foundInFeed = activeFeedJobs.some(j => j.id === 'job-8-days-old');
  assert(!foundInFeed, 'Job repository query with 7-day cutoff strictly excludes 8-day old job');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 2: Job posted 6 days ago -> included in default feed
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.2: Job posted 6 days ago included in default feed ---');
{
  const job6d = makeMockJob({
    id: 'job-6-days-old',
    originalPostedAt: daysAgoISO(6),
    discoveredAt: new Date().toISOString(),
  });

  const freshnessResult = freshnessEngine.isJobWithinAgeWindow(job6d, MAX_JOB_AGE_DAYS);
  assert(freshnessResult.eligible === true, 'Freshness engine accepts 6-day old job for default 7-day feed');
  assert(freshnessResult.ageDays === 6, 'Calculated age in days is correctly 6');

  // Verify in job repository query
  jobRepository.saveOpportunity(job6d);
  const activeFeedJobs = jobRepository.getActiveOpportunities(MAX_JOB_AGE_DAYS);
  const foundInFeed = activeFeedJobs.some(j => j.id === 'job-6-days-old');
  assert(foundInFeed, 'Job repository query with 7-day cutoff includes 6-day old job');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 3: Job posted 30 days ago, discovered today -> excluded
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.3: Job posted 30 days ago, discovered today -> excluded ---');
{
  const jobOldDiscoveredToday = makeMockJob({
    id: 'job-30d-posted-today-discovered',
    originalPostedAt: daysAgoISO(30),
    discoveredAt: new Date().toISOString(),
    first_seen_at: new Date().toISOString(),
  });

  const freshnessResult = freshnessEngine.isJobWithinAgeWindow(jobOldDiscoveredToday, MAX_JOB_AGE_DAYS);
  assert(freshnessResult.eligible === false, 'Freshness engine excludes job posted 30 days ago even if discovered today');
  assert(freshnessResult.ageDays === 30, 'Age is calculated from original post date, NOT discovery date');

  jobRepository.saveOpportunity(jobOldDiscoveredToday);
  const activeFeedJobs = jobRepository.getActiveOpportunities(MAX_JOB_AGE_DAYS);
  const foundInFeed = activeFeedJobs.some(j => j.id === 'job-30d-posted-today-discovered');
  assert(!foundInFeed, 'Default feed query strictly excludes 30-day old job discovered today');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 4: Job updated today, original post 30 days ago -> excluded
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.4: Job updated today, original post 30 days ago -> excluded ---');
{
  const jobOldUpdatedToday = makeMockJob({
    id: 'job-30d-posted-updated-today',
    originalPostedAt: daysAgoISO(30),
    lastUpdatedAt: new Date().toISOString(),
    discoveredAt: daysAgoISO(30),
  });

  const freshnessResult = freshnessEngine.isJobWithinAgeWindow(jobOldUpdatedToday, MAX_JOB_AGE_DAYS);
  assert(freshnessResult.eligible === false, 'Freshness engine excludes job posted 30 days ago even if updated today');

  jobRepository.saveOpportunity(jobOldUpdatedToday);
  const activeFeedJobs = jobRepository.getActiveOpportunities(MAX_JOB_AGE_DAYS);
  const foundInFeed = activeFeedJobs.some(j => j.id === 'job-30d-posted-updated-today');
  assert(!foundInFeed, 'Default feed query strictly excludes 30-day old job updated today');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 5: Job with unknown post date -> excluded from default feed
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.5: Job with unknown post date -> excluded from default feed ---');
{
  const jobNoDate = makeMockJob({
    id: 'job-no-date',
    originalPostedAt: undefined,
  });
  const jobUnknownStr = makeMockJob({
    id: 'job-unknown-str',
    originalPostedAt: 'unknown',
  });
  const jobNotDisclosed = makeMockJob({
    id: 'job-not-disclosed',
    originalPostedAt: 'not_disclosed',
  });
  const jobEmptyStr = makeMockJob({
    id: 'job-empty-str',
    originalPostedAt: '   ',
  });
  const jobGarbageDate = makeMockJob({
    id: 'job-garbage-date',
    originalPostedAt: 'not-a-valid-date-string',
  });

  const res1 = freshnessEngine.isJobWithinAgeWindow(jobNoDate, MAX_JOB_AGE_DAYS);
  const res2 = freshnessEngine.isJobWithinAgeWindow(jobUnknownStr, MAX_JOB_AGE_DAYS);
  const res3 = freshnessEngine.isJobWithinAgeWindow(jobNotDisclosed, MAX_JOB_AGE_DAYS);
  const res4 = freshnessEngine.isJobWithinAgeWindow(jobEmptyStr, MAX_JOB_AGE_DAYS);
  const res5 = freshnessEngine.isJobWithinAgeWindow(jobGarbageDate, MAX_JOB_AGE_DAYS);

  assert(!res1.eligible && res1.displayText === 'Date unknown', 'Undefined post date is ineligible with Date unknown display');
  assert(!res2.eligible && res2.displayText === 'Date unknown', 'Unknown post date is ineligible with Date unknown display');
  assert(!res3.eligible && res3.displayText === 'Date unknown', 'not_disclosed post date is ineligible with Date unknown display');
  assert(!res4.eligible && res4.displayText === 'Date unknown', 'Blank post date is ineligible with Date unknown display');
  assert(!res5.eligible && res5.displayText === 'Date unknown', 'Invalid post date is ineligible with Date unknown display');

  jobRepository.saveOpportunity(jobNoDate);
  const activeFeedJobs = jobRepository.getActiveOpportunities(MAX_JOB_AGE_DAYS);
  assert(!activeFeedJobs.some(j => j.id === 'job-no-date'), 'Default feed query excludes jobs without reliable post dates');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 6: Job with unknown post date -> retained in historical DB
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.6: Job with unknown post date -> retained in historical DB ---');
{
  const unknownJob = makeMockJob({
    id: 'job-retained-historical-1',
    title: 'Historical Architect',
    originalPostedAt: undefined,
  });

  jobRepository.saveOpportunity(unknownJob);
  // Run migration
  jobRepository.runFreshnessMigration();

  // Job must still exist in repository!
  const retrieved = jobRepository.getOpportunityById('job-retained-historical-1');
  assert(retrieved !== undefined, 'Job with unknown post date was NOT deleted; retained in database');
  assert(retrieved?.lifecycleState === 'HISTORICAL', 'Job with unknown post date moved to HISTORICAL lifecycle state');

  // Also verify saved/applied jobs are never deleted or downgraded
  const savedOldJob = makeMockJob({
    id: 'job-saved-old',
    originalPostedAt: daysAgoISO(60),
    lifecycleState: 'SAVED',
  });
  jobRepository.saveOpportunity(savedOldJob);
  jobRepository.runFreshnessMigration();

  const retrievedSaved = jobRepository.getOpportunityById('job-saved-old');
  assert(retrievedSaved !== undefined && retrievedSaved?.lifecycleState === 'SAVED', 'Saved jobs are never deleted or demoted');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 7: Discovered date formatted string never says 'Discovered Posted today'
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.7: Discovered date string never says "Discovered Posted today" ---');
{
  const todayJob = makeMockJob({ originalPostedAt: hoursAgoISO(2) });
  const twoDaysJob = makeMockJob({ originalPostedAt: daysAgoISO(2) });
  const fiveDaysJob = makeMockJob({ originalPostedAt: daysAgoISO(5) });
  const updatedJob = makeMockJob({
    originalPostedAt: daysAgoISO(4),
    lastUpdatedAt: hoursAgoISO(5),
  });
  const unknownDateJob = makeMockJob({ originalPostedAt: undefined });

  const fmtToday = freshnessEngine.formatPostedTime(todayJob);
  const fmt2d = freshnessEngine.formatPostedTime(twoDaysJob);
  const fmt5d = freshnessEngine.formatPostedTime(fiveDaysJob);
  const fmtUpdated = freshnessEngine.formatPostedTime(updatedJob);
  const fmtUnknown = freshnessEngine.formatPostedTime(unknownDateJob);

  assert(fmtToday === 'Posted today', `Format today: "${fmtToday}" === "Posted today"`);
  assert(fmt2d === 'Posted 2d ago', `Format 2d: "${fmt2d}" === "Posted 2d ago"`);
  assert(fmt5d === 'Posted 5d ago', `Format 5d: "${fmt5d}" === "Posted 5d ago"`);
  assert(fmtUpdated === 'Updated today', `Format updated today: "${fmtUpdated}" === "Updated today"`);
  assert(fmtUnknown === 'Date unknown', `Format unknown: "${fmtUnknown}" === "Date unknown"`);

  // Ensure "Discovered" is NEVER produced by formatPostedTime
  [fmtToday, fmt2d, fmt5d, fmtUpdated, fmtUnknown].forEach(txt => {
    assert(!txt.includes('Discovered'), `String "${txt}" does not contain "Discovered"`);
  });

  // Verify JobCard.tsx does not prepend "Discovered"
  const jobCardCode = fs.readFileSync(path.resolve(process.cwd(), 'src/features/job-feed/components/JobCard.tsx'), 'utf-8');
  assert(!jobCardCode.includes('Discovered ${'), 'JobCard.tsx has no "Discovered ${" template string');
  assert(!jobCardCode.includes('Discovered Posted'), 'JobCard.tsx has no "Discovered Posted" text');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 8: Card titles truncate cleanly at 2 lines across viewport widths
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.8: Card titles truncate cleanly at 2 lines with tooltip ---');
{
  const jobCardCode = fs.readFileSync(path.resolve(process.cwd(), 'src/features/job-feed/components/JobCard.tsx'), 'utf-8');
  assert(jobCardCode.includes('line-clamp-2'), 'JobCard title has line-clamp-2 class');
  assert(jobCardCode.includes('h-11'), 'JobCard title has locked vertical height h-11');
  assert(jobCardCode.includes('title={job.title}'), 'JobCard title contains tooltip title={job.title}');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 9: All 3 cards in a row have identical height and button alignment
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.9: All cards have identical height and bottom-pinned action alignment ---');
{
  const jobCardCode = fs.readFileSync(path.resolve(process.cwd(), 'src/features/job-feed/components/JobCard.tsx'), 'utf-8');
  assert(jobCardCode.includes('flex flex-col') && jobCardCode.includes('h-full'), 'JobCard container has flex flex-col and h-full');
  assert(jobCardCode.includes('mt-auto') && jobCardCode.includes('border-t'), 'JobCard actions bar is pinned with mt-auto and border-t');
  assert(jobCardCode.includes('min-h-[40px]'), 'JobCard header zone has min-h-[40px]');
  assert(jobCardCode.includes('h-8') && jobCardCode.includes('flex items-center justify-between'), 'JobCard freshness/salary zone has locked h-8 height');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 10: Salary row displays only when real data exists; no blank grey pill
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.10: Salary row displays only when real data exists; no blank grey pill ---');
{
  const jobCardCode = fs.readFileSync(path.resolve(process.cwd(), 'src/features/job-feed/components/JobCard.tsx'), 'utf-8');
  assert(jobCardCode.includes('salaryInfo.disclosed'), 'JobCard verifies salary disclosure via salaryInfo.disclosed');
  assert(jobCardCode.includes('salaryInfo.disclosed &&'), 'JobCard conditionally renders salary pill only when salaryInfo.disclosed is true');
  // Confirm no empty grey fallback pill when salary is absent
  assert(!jobCardCode.includes('bg-slate-100 text-slate-400') && !jobCardCode.includes('Salary not disclosed'), 
    'JobCard does not render an empty grey pill or "Salary not disclosed" fallback badge in card body');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 11: Target company badge appears only on confirmed target companies
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.11: Target company badge appears only on confirmed target companies ---');
{
  const jobCardCode = fs.readFileSync(path.resolve(process.cwd(), 'src/features/job-feed/components/JobCard.tsx'), 'utf-8');
  assert(jobCardCode.includes('job.isTargetCompany &&'), 'Target badge is strictly guarded by job.isTargetCompany');
  assert(jobCardCode.includes('Target'), 'Target badge renders "Target" label');
}

// -----------------------------------------------------------------------------
// Mandate 12 - Test 12: 60% match fallback is completely eliminated
// -----------------------------------------------------------------------------
console.log('\n--- Mandate 12.12: 60% match fallback completely eliminated ---');
{
  const dummyJob = makeMockJob({
    id: 'job-unscored',
    title: 'Senior Software Engineer',
    company: 'GenericCorp',
    match_score: undefined,
    match_reasons: undefined,
  });

  // Test fastJobMatcher directly with undefined profile
  const fastMatch = fastJobMatcher.match(undefined as any, dummyJob);
  assert(fastMatch.overallScore === 0, `fastJobMatcher returns score 0 (not 60), actual: ${fastMatch.overallScore}`);
  assert(fastMatch.fitTier === 'LOW FIT', `fastJobMatcher returns fitTier "LOW FIT", actual: "${fastMatch.fitTier}"`);
  assert(
    fastMatch.matchReasons.includes('Profile match pending'),
    'fastJobMatcher reasons include "Profile match pending"'
  );
  assert(
    !fastMatch.matchReasons.includes('Standard technology opening'),
    'fastJobMatcher does NOT include "Standard technology opening"'
  );

  // Check codebase for any remaining occurrences of "Standard technology opening"
  const fastJobMatcherSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/core/intelligence/fastJobMatcher.ts'), 'utf-8');
  assert(!fastJobMatcherSrc.includes('Standard technology opening'), 'fastJobMatcher.ts contains no "Standard technology opening"');
  assert(!fastJobMatcherSrc.includes('overallScore: 60'), 'fastJobMatcher.ts contains no "overallScore: 60"');

  const careerIntelligenceSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/core/intelligence/careerIntelligenceEngine.ts'), 'utf-8');
  assert(!careerIntelligenceSrc.includes("strengths: ['Standard technology opening']"), 'careerIntelligenceEngine.ts does not generate "Standard technology opening"');

  // Verify classifyOpportunities with dummy job and empty profile
  const classified = classifyOpportunities(undefined as any, [dummyJob], 0);
  assert(classified.length === 1, 'classifyOpportunities returns classified job');
  assert(classified[0].match_score !== 60, `Classified match score is not fake 60%, actual: ${classified[0].match_score}`);
  assert(
    !classified[0].match_reasons?.some((r: string) => r.toLowerCase().includes('standard technology')),
    'Classified job match reasons do NOT contain "Standard technology opening"'
  );
}

console.log('\n============================================================');
console.log(`ALL TESTS PASSED! (${passedTests} / ${totalTests} assertions passed)`);
console.log('============================================================\n');
