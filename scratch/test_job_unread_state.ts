/**
 * Comprehensive Automated Verification for Job Unread / "NEW" State Architecture
 * Tests all 19 checkpoints and edge cases specified in the requirements.
 */

import { userJobStateManager, UserJobStateManager } from '../src/core/jobs/userJobState';
import { JobOpportunityRepository } from '../src/core/jobs/jobRepository';
import { mergeJobOpportunities, normalizeRawDiscoveredJob } from '../src/core/jobs/jobPipeline';
import { JobOpportunity, RawDiscoveredJob } from '../src/core/jobs/types';

// Mock localStorage for node environment if needed
if (typeof window === 'undefined' || !global.localStorage) {
  const store = new Map<string, string>();
  global.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] || null,
    length: store.size,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName} ${detail ? `-> ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- STARTING CAREEROS UNREAD / "NEW" SYSTEM TEST SUITE ---\n');

  localStorage.clear();
  userJobStateManager.clear();

  // Test 1: Genuinely newly discovered job has isNew = true and viewedAt = null
  const newJobRecord = userJobStateManager.registerDiscoveredJob('job-1', true);
  assert(newJobRecord.isNew === true, '1. Genuinely discovered job has isNew === true');
  assert(newJobRecord.viewedAt === null, '2. Genuinely discovered job has viewedAt === null');
  assert(userJobStateManager.isJobUnread('job-1') === true, '3. isJobUnread("job-1") returns true');

  // Test 2: Posting date does not affect unread state
  const rawJobOldDate: RawDiscoveredJob = {
    title: 'Senior Staff Engineer',
    company: 'Stripe',
    jobUrl: 'https://stripe.com/jobs/staff-eng-1',
    description: 'Lead payment infrastructure and global scale.',
    datePosted: '2024-01-01T00:00:00.000Z', // Posted long ago
    source: {
      id: 'stripe-direct',
      name: 'Stripe Careers',
      domain: 'stripe.com',
      type: 'direct_career_page',
      sourceUrl: 'https://stripe.com/jobs',
      sourceConfidence: 'direct_employer',
    },
  };
  const normalizedOld = normalizeRawDiscoveredJob(rawJobOldDate);
  assert(normalizedOld.is_new === true && normalizedOld.isNew === true, '4. Normalizing job posted months ago sets is_new === true for first-time discovery');
  assert(normalizedOld.viewed_at === undefined && normalizedOld.viewedAt === undefined, '5. Newly normalized job has viewed_at undefined');

  // Test 3: Viewing a job marks it viewed permanently
  const viewedRecord = userJobStateManager.markViewed('job-1');
  assert(viewedRecord.isNew === false, '6. markViewed sets isNew === false');
  assert(typeof viewedRecord.viewedAt === 'string' && viewedRecord.viewedAt.length > 0, '7. markViewed sets viewedAt timestamp');
  assert(userJobStateManager.isJobUnread('job-1') === false, '8. isJobUnread("job-1") is now false');

  // Test 4: Rediscovery must NOT reset viewed state to NEW
  const rediscoveredRecord = userJobStateManager.registerDiscoveredJob('job-1', true);
  assert(rediscoveredRecord.isNew === false, '9. Subsequent discovery on viewed job preserves isNew === false');
  assert(rediscoveredRecord.viewedAt === viewedRecord.viewedAt, '10. Subsequent discovery preserves original viewedAt timestamp');

  // Test 5: mergeJobOpportunities preserves viewed status
  const existingJob: JobOpportunity = {
    id: 'job-1',
    title: 'Staff Engineer',
    company: 'Stripe',
    location: 'Remote, India',
    industry: 'Fintech',
    remoteStatus: 'remote',
    salary: { disclosed: false, currency: 'INR' },
    requiredSkills: ['TypeScript', 'Node.js'],
    matchReasons: [],
    sourcesHistory: [],
    source: {
      id: 'stripe-direct',
      name: 'Stripe Careers',
      domain: 'stripe.com',
      type: 'direct_career_page',
      sourceUrl: 'https://stripe.com/jobs',
      sourceConfidence: 'direct_employer',
    },
    lifecycleState: 'VIEWED',
    is_new: false,
    isNew: false,
    viewed_at: viewedRecord.viewedAt!,
    viewedAt: viewedRecord.viewedAt!,
  };

  const incomingRediscovered: JobOpportunity = {
    ...existingJob,
    id: 'job-1-incoming',
    is_new: true,
    isNew: true,
    viewed_at: undefined,
    viewedAt: undefined,
  };

  const merged = mergeJobOpportunities(existingJob, incomingRediscovered);
  assert(merged.is_new === false && merged.isNew === false, '11. mergeJobOpportunities retains is_new === false for viewed job');
  assert(merged.viewed_at === viewedRecord.viewedAt && merged.viewedAt === viewedRecord.viewedAt, '12. mergeJobOpportunities retains viewed_at timestamp');

  // Test 6: Repository getActiveOpportunities retains viewed job in the feed
  const repo = new JobOpportunityRepository();
  repo.clearAll();

  const repoJob1: JobOpportunity = {
    ...existingJob,
    id: 'job-repo-1',
    is_new: true,
    isNew: true,
    viewed_at: undefined,
    viewedAt: undefined,
    lifecycleState: 'ACTIVE',
  };
  const repoJob2: JobOpportunity = {
    ...existingJob,
    id: 'job-repo-2',
    title: 'Staff Architect',
    company: 'Razorpay',
    is_new: true,
    isNew: true,
    viewed_at: undefined,
    viewedAt: undefined,
    lifecycleState: 'ACTIVE',
  };

  repo.saveOpportunity(repoJob1);
  repo.saveOpportunity(repoJob2);

  let activeJobs = repo.getActiveOpportunities();
  assert(activeJobs.length === 2, '13. Repository initially has 2 active opportunities');

  let tabCounts = repo.getDatabaseTabCounts();
  assert(tabCounts.newCount === 2, '14. Tab counts initially show 2 NEW jobs', `actual=${tabCounts.newCount}`);

  // Now view job-repo-1
  repo.recordView('job-repo-1');

  activeJobs = repo.getActiveOpportunities();
  assert(activeJobs.length === 2, '15. Viewing job-repo-1 KEEPS it in the active feed (length remains 2)', `actual=${activeJobs.length}`);

  const activeJob1 = activeJobs.find((j) => j.id === 'job-repo-1')!;
  assert(activeJob1.is_new === false && activeJob1.isNew === false, '16. Viewed job in active feed has is_new === false');
  assert(Boolean(activeJob1.viewed_at && activeJob1.viewedAt), '17. Viewed job in active feed has viewed_at timestamp');

  tabCounts = repo.getDatabaseTabCounts();
  assert(tabCounts.newCount === 1, '18. After viewing 1 job, newCount decrements to 1', `actual=${tabCounts.newCount}`);
  assert(tabCounts.viewed >= 1, '19. After viewing 1 job, viewed count increments', `actual=${tabCounts.viewed}`);

  // Test 7: Persistence across restarts
  userJobStateManager.persist();
  const reloadedStateManager = new UserJobStateManager();
  assert(reloadedStateManager.isJobUnread('job-repo-1') === false, '20. Persisted state manager recognizes job-repo-1 as read');
  assert(reloadedStateManager.isJobUnread('job-repo-2') === true, '21. Persisted state manager recognizes job-repo-2 as unread');

  // Test 8: Saving a job preserves unread state until opened (Edge Case J)
  repo.markSaved('job-repo-2');
  const savedJobState = userJobStateManager.getState('job-repo-2');
  assert(Boolean(savedJobState?.savedAt), '22. markSaved records savedAt');
  assert(savedJobState?.viewedAt === null, '23. markSaved preserves viewedAt === null');
  assert(userJobStateManager.isJobUnread('job-repo-2') === true, '24. Saved job remains unread until opened');

  // Test 9: Rejecting a job removes it immediately from active feed
  repo.markRejected('job-repo-2');
  activeJobs = repo.getActiveOpportunities();
  assert(activeJobs.length === 1, '25. Rejected job is removed from active opportunities', `actual=${activeJobs.length}`);
  assert(!activeJobs.some((j) => j.id === 'job-repo-2'), '26. job-repo-2 is not in active feed');

  // Test 10: Unrejecting restores job
  repo.unreject('job-repo-2');
  activeJobs = repo.getActiveOpportunities();
  assert(activeJobs.length === 2, '27. Unrejecting job restores it to active opportunities', `actual=${activeJobs.length}`);

  // Test 11: Ingest batch with brand new jobs
  const batchJobs: JobOpportunity[] = [
    {
      ...existingJob,
      id: 'batch-job-1',
      title: 'VP Engineering',
      company: 'Brex',
      is_new: true,
      isNew: true,
      viewed_at: undefined,
      viewedAt: undefined,
      lifecycleState: 'ACTIVE',
    },
    {
      ...existingJob,
      id: 'batch-job-2',
      title: 'Principal Systems Architect',
      company: 'Datadog',
      is_new: true,
      isNew: true,
      viewed_at: undefined,
      viewedAt: undefined,
      lifecycleState: 'ACTIVE',
    },
  ];

  const ingestRes1 = repo.ingestBatch(batchJobs);
  assert(ingestRes1.added === 2, '28. Batch ingestion registers 2 new jobs');
  assert(userJobStateManager.isJobUnread('batch-job-1') === true, '29. batch-job-1 is registered as unread');
  assert(userJobStateManager.isJobUnread('batch-job-2') === true, '30. batch-job-2 is registered as unread');

  // View batch-job-1
  repo.recordView('batch-job-1');
  assert(userJobStateManager.isJobUnread('batch-job-1') === false, '31. Viewing batch-job-1 marks it read');

  // Test 12: Re-ingest batch where batch-job-1 is already viewed
  const rediscoveryBatch: JobOpportunity[] = [
    {
      ...existingJob,
      id: 'batch-job-1',
      title: 'VP Engineering',
      company: 'Brex',
      is_new: true, // External source claims it's new
      isNew: true,
      viewed_at: undefined,
      viewedAt: undefined,
      lifecycleState: 'ACTIVE',
    },
  ];

  const ingestRes2 = repo.ingestBatch(rediscoveryBatch);
  assert(ingestRes2.merged === 1, '32. Rediscovery batch merges into existing job');
  const batchJob1AfterMerge = repo.getOpportunityById('batch-job-1')!;
  assert(batchJob1AfterMerge.is_new === false && batchJob1AfterMerge.isNew === false, '33. Rediscovery preserves is_new === false on merged job');
  assert(Boolean(batchJob1AfterMerge.viewed_at && batchJob1AfterMerge.viewedAt), '34. Rediscovery preserves viewed_at on merged job');
  assert(userJobStateManager.isJobUnread('batch-job-1') === false, '35. userJobStateManager confirms batch-job-1 remains read');

  // Test 13: Simulated JobFeedPage section filtering
  const allActive = repo.getActiveOpportunities();
  const newSectionJobs = allActive.filter((j) => (j.is_new === true || j.isNew === true) && !j.viewed_at && !j.viewedAt);
  assert(newSectionJobs.every((j) => !j.viewed_at && !j.viewedAt && (j.is_new || j.isNew)), '36. "New" tab strictly contains only unseen jobs');
  assert(!newSectionJobs.some((j) => j.id === 'job-repo-1' || j.id === 'batch-job-1'), '37. Viewed jobs are never in "New" tab');
  assert(allActive.some((j) => j.id === 'job-repo-1'), '38. Viewed jobs remain in "All Jobs" feed');

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
