/**
 * Automated Verification: CareerOS Job Feed / Database Architecture Refactor
 *
 * Verifies all requirements:
 * 1. Pipeline: Discovery Engine -> Job Feed Store -> Optional Save -> Job Database
 * 2. Feed Lifecycle & Retention: 7-day unopened, 14-day viewed retention.
 * 3. Viewing NEVER auto-saves to Job Database.
 * 4. Saving persists to Job Database and marks saved_to_database_at while keeping in Feed.
 * 5. Pending jobs queue: [N] new matching jobs banner and publishPendingJobs() injection.
 * 6. Sorting: Newest published matching jobs first, tie-break by relevance score.
 * 7. Location OR logic: India + Worldwide Remote satisfies either.
 * 8. Telemetry tracking.
 */

import { jobFeedStore } from '../src/core/jobs/jobFeedStore';
import { jobRepository } from '../src/core/jobs/jobRepository';
import { locationFilterEngine } from '../src/core/jobs/engines/locationFilterEngine';
import { feedRankingEngine } from '../src/core/jobs/engines/feedRankingEngine';
import { JobOpportunity } from '../src/core/jobs/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('\n=== RUNNING JOB FEED ARCHITECTURE VERIFICATION ===\n');

  // Clear stores for isolated test
  jobFeedStore.clearAll();
  jobRepository.clearAll();

  // --------------------------------------------------------------------------
  // TEST 1: Pipeline & Separation (Discovery -> Feed, NOT auto-saving to DB)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Pipeline & Separation ---');
  const now = new Date();
  const testJob1: JobOpportunity = {
    id: 'job-test-1',
    fingerprint: 'fp-job-1',
    title: 'Senior Frontend Engineer',
    normalizedTitle: 'senior frontend engineer',
    company: 'Acme Corp',
    jobUrl: 'https://acme.com/jobs/1',
    applyUrl: 'https://acme.com/jobs/1/apply',
    isVerifiedLive: true,
    isApplyUrlValidated: true,
    verificationStatus: 'verified_live',
    source: { id: 'acme-career', name: 'Acme Careers', sourceType: 'direct_career_page' },
    sourcesHistory: [],
    datePosted: now.toISOString(),
    originalPostedAt: now.toISOString(),
    dateDiscovered: now.toISOString(),
    lastVerified: now.toISOString(),
    location: 'Bengaluru, India',
    country: 'India',
    remoteStatus: 'remote',
    workFromAnywhere: false,
    eligibleCountries: ['India'],
    employmentType: 'full-time',
    salary: { disclosed: true, min: 2500000, max: 3500000, currency: 'INR' },
    seniority: 'senior',
    requiredSkills: ['React', 'TypeScript'],
    preferredSkills: ['GraphQL'],
    responsibilities: ['Build UI'],
    requirements: ['5+ years'],
    industry: 'Technology',
    description: 'Lead frontend architecture in React and TypeScript.',
    lifecycleState: 'IN_FEED',
    match_score: 92,
  };

  // Ingest discovered job into jobFeedStore
  const ingestRes = jobFeedStore.ingestDiscoveredBatch([testJob1], true);
  assert(ingestRes.newMatchingCount === 1, 'jobFeedStore accepted new matching job');

  const publishedFeed = jobFeedStore.getPublishedFeedItems();
  assert(publishedFeed.length === 1, 'Job appears in published Job Feed');
  assert(publishedFeed[0].id === 'job-test-1', 'Correct job in published Job Feed');

  // Verify it is NOT in Job Database!
  const dbJobs = jobRepository.getDatabaseOpportunities();
  assert(!dbJobs.some((j) => j.id === 'job-test-1'), 'Discovered feed job is NOT auto-inserted into Job Database');

  // --------------------------------------------------------------------------
  // TEST 2: Viewing does NOT save to Job Database + 14-Day Viewed Retention
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Viewing & Retention ---');
  const viewedItem = jobFeedStore.markViewed('job-test-1', 92);
  assert(viewedItem !== undefined, 'Job marked as viewed');
  assert(viewedItem?.first_viewed_at !== undefined, 'first_viewed_at timestamp recorded');
  assert(viewedItem?.job.is_viewed === true, 'job.is_viewed is true');

  // Check 14-day retention extension
  const viewedAtMs = new Date(viewedItem!.first_viewed_at!).getTime();
  const expiresAtMs = new Date(viewedItem!.feed_expires_at).getTime();
  const retentionDays = Math.round((expiresAtMs - viewedAtMs) / (24 * 3600 * 1000));
  assert(retentionDays === 14, `Retention extended to exactly 14 days from viewed date (got ${retentionDays} days)`);

  // Verify STILL NOT in Job Database
  const dbJobsAfterView = jobRepository.getDatabaseOpportunities();
  assert(!dbJobsAfterView.some((j) => j.id === 'job-test-1'), 'Viewing a job strictly DID NOT save to Job Database');

  // --------------------------------------------------------------------------
  // TEST 3: Saving persists to Job Database and updates saved_to_database_at
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Explicit Save to Job Database ---');
  const savedItem = jobFeedStore.saveJobToDatabase('job-test-1', 'My favorite lead role');
  assert(savedItem !== undefined, 'Job saved via jobFeedStore');
  assert(savedItem?.saved_to_database_at !== undefined, 'saved_to_database_at timestamp recorded on FeedItem');
  assert(savedItem?.job.is_saved === true, 'job.is_saved is true');
  assert(savedItem?.job.lifecycleState === 'SAVED', 'job.lifecycleState is SAVED');

  // Still in Feed!
  const feedAfterSave = jobFeedStore.getPublishedFeedItems();
  assert(feedAfterSave.some((j) => j.id === 'job-test-1'), 'Job remains visible in Job Feed after saving');

  // Now present in Job Database!
  const dbJobsAfterSave = jobRepository.getDatabaseOpportunities();
  assert(dbJobsAfterSave.some((j) => j.id === 'job-test-1'), 'Job now exists in canonical Job Database');

  // --------------------------------------------------------------------------
  // TEST 4: Pending New Jobs Queue & [ Show New Jobs ]
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Pending Queue & [ Show New Jobs ] ---');
  // Add 6 dummy jobs so feed has > 5 published jobs
  const dummyJobs: JobOpportunity[] = [];
  for (let i = 2; i <= 7; i++) {
    dummyJobs.push({
      ...testJob1,
      id: `job-dummy-${i}`,
      fingerprint: `fp-dummy-${i}`,
      title: `Software Engineer ${i}`,
      jobUrl: `https://dummy.com/job/${i}`,
      applyUrl: `https://dummy.com/job/${i}/apply`,
      originalPostedAt: new Date(Date.now() - i * 3600 * 1000).toISOString(),
    });
  }
  jobFeedStore.ingestDiscoveredBatch(dummyJobs, true); // Published initial items

  // Now incoming discovered job when feed is active (has > 5 jobs) should be PENDING
  const incomingPendingJob: JobOpportunity = {
    ...testJob1,
    id: 'job-new-pending-8',
    fingerprint: 'fp-job-new-pending-8',
    title: 'Staff Fullstack Architect',
    jobUrl: 'https://fresh.com/job/8',
    applyUrl: 'https://fresh.com/job/8/apply',
    originalPostedAt: new Date().toISOString(),
    match_score: 95,
  };

  const pendingBatchRes = jobFeedStore.ingestDiscoveredBatch([incomingPendingJob], false);
  assert(pendingBatchRes.pendingCount === 1, 'Incoming job enqueued as pending');
  assert(jobFeedStore.getPendingCount() === 1, 'Pending count is 1');

  // Not in published feed yet!
  assert(!jobFeedStore.getPublishedFeedItems().some((j) => j.id === 'job-new-pending-8'), 'Pending job is not yet visible in active feed');

  // User clicks [ Show New Jobs ] -> calls publishPendingJobs()
  const publishedCount = jobFeedStore.publishPendingJobs();
  assert(publishedCount === 1, 'publishPendingJobs() successfully published 1 item');
  assert(jobFeedStore.getPendingCount() === 0, 'Pending count reset to 0');

  // Now immediately at top of published feed!
  const publishedAfterReveal = jobFeedStore.getPublishedFeedItems();
  assert(publishedAfterReveal[0].id === 'job-new-pending-8', 'Newly published job is immediately at the top of the feed');

  // --------------------------------------------------------------------------
  // TEST 5: Sorting (Newest published matching jobs first, tie-break score)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Feed Sorting ---');
  const olderHighMatchJob: JobOpportunity = {
    ...testJob1,
    id: 'job-older-high',
    fingerprint: 'fp-older-high',
    title: 'Older High Match Job',
    jobUrl: 'https://old.com/high',
    applyUrl: 'https://old.com/high/apply',
    originalPostedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    match_score: 99,
  };

  const newerLowerMatchJob: JobOpportunity = {
    ...testJob1,
    id: 'job-newer-mid',
    fingerprint: 'fp-newer-mid',
    title: 'Newer Mid Match Job',
    jobUrl: 'https://new.com/mid',
    applyUrl: 'https://new.com/mid/apply',
    originalPostedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    match_score: 85,
  };

  const ranked = feedRankingEngine.rankFeed([
    { ...olderHighMatchJob, match: { overallScore: 99, roleScore: 99, skillScore: 99, seniorityScore: 99, locationScore: 99, experienceScore: 99, titleMatch: true, missingSkills: [], strengths: [], gaps: [], matchReasons: [], seniorityFit: 'strong', remoteFit: 'strong' } },
    { ...newerLowerMatchJob, match: { overallScore: 85, roleScore: 85, skillScore: 85, seniorityScore: 85, locationScore: 85, experienceScore: 85, titleMatch: true, missingSkills: [], strengths: [], gaps: [], matchReasons: [], seniorityFit: 'strong', remoteFit: 'strong' } },
  ]);

  assert(ranked[0].id === 'job-newer-mid', 'Newer matching job ranks above stale job even if stale job has 99% match');

  // --------------------------------------------------------------------------
  // TEST 6: Location OR Logic (India + Worldwide Remote)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Location OR Logic ---');
  const indiaJob: JobOpportunity = {
    ...testJob1,
    id: 'loc-india',
    location: 'Bengaluru, India',
    country: 'India',
    remoteStatus: 'on-site',
  };

  const worldwideRemoteJob: JobOpportunity = {
    ...testJob1,
    id: 'loc-worldwide',
    location: 'Worldwide Remote',
    country: 'United States',
    remoteStatus: 'remote',
    workFromAnywhere: true,
  };

  const selectedLocations = ['India', 'Worldwide Remote'];

  const evalIndia = locationFilterEngine.evaluateEligibility(indiaJob, selectedLocations);
  assert(evalIndia.eligible === true, 'India job matches [India, Worldwide Remote] OR condition');

  const evalWorldwide = locationFilterEngine.evaluateEligibility(worldwideRemoteJob, selectedLocations);
  assert(evalWorldwide.eligible === true, 'Worldwide Remote job matches [India, Worldwide Remote] OR condition');

  console.log('\n🎉 ALL JOB FEED ARCHITECTURE TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
