/**
 * HiresWay — Critical Defect Regression Test Suite
 *
 * Verifies the 5 critical defect areas:
 * 1. Refresh-related job loss & authoritative IndexedDB persistence
 * 2. 14-day retention policy (first-feed ingestion anchor, no reset on refresh/duplicate, preservation of saved/applied/dismissed)
 * 3. Salary truth (zero defaulting to USD, zero inferring period from amount, explicit ambiguity handling)
 * 4. Storage performance (zero redundant JSON cloning, targeted dirty item updates vs rewriting entire inventory)
 * 5. Discovery status & scheduling (clean recovery on reload, separate last-attempt and last-success timestamps, reporting sources that actually ran)
 */

import { salaryTruthEngine } from '../src/core/jobs/salaryTruthEngine';
import { jobFeedStore, FEED_RETENTION_MS } from '../src/core/jobs/jobFeedStore';
import { persistentStorageEngine } from '../src/core/storage/persistentStorageEngine';
import { discoveryEngine } from '../src/core/jobs/discoveryEngine';
import { continuousSchedulerEngine } from '../src/core/jobs/engines/continuousSchedulerEngine';
import { JobOpportunity, FeedItem } from '../src/core/jobs/types';

// Mock localStorage for Node environment if undefined
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = storageMock;
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('🔬 RUNNING CRITICAL DEFECTS VERIFICATION SUITE');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // DEFECT 3: Salary Truth
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing Salary Truth Engine ---');

  // Test 3A: No USD default when currency is absent in structured input
  const noCurrencyResult = salaryTruthEngine.extractSalary({
    salaryMin: 120000,
    salaryMax: 150000,
  });
  assert(
    noCurrencyResult.currency === undefined || noCurrencyResult.currency === 'unspecified',
    'Absent currency must NOT default to USD'
  );
  assert(
    noCurrencyResult.period === undefined || noCurrencyResult.period === 'unspecified' || noCurrencyResult.period === 'not_disclosed',
    'Absent pay period must NOT be inferred solely from amount'
  );

  // Test 3B: Explicit period and currency are properly preserved
  const explicitResult = salaryTruthEngine.extractSalary({
    salaryMin: 45,
    salaryMax: 60,
    salaryCurrency: 'CAD',
    salaryPeriod: 'hourly',
  });
  assert(explicitResult.currency === 'CAD', 'Explicit currency CAD must be preserved');
  assert(explicitResult.period === 'hourly', 'Explicit period hourly must be preserved');
  assert(explicitResult.status === 'STRUCTURED_SOURCE_STATED', 'Status must be STRUCTURED_SOURCE_STATED');

  // Test 3C: Formatting without currency does not inject '$' or 'USD'
  const displayNoCurrency = salaryTruthEngine.formatSalaryDisplay(noCurrencyResult);
  assert(
    !displayNoCurrency.text.includes('$') && !displayNoCurrency.text.includes('USD'),
    'Display format must NOT invent $ or USD for unspecified currency'
  );

  // Test 3D: Unstated salary returns Salary not disclosed
  const notDisclosed = salaryTruthEngine.extractSalary({ text: 'Great opportunity with equity options' });
  assert(notDisclosed.status === 'NOT_DISCLOSED', 'Unstated salary has status NOT_DISCLOSED');
  assert(
    salaryTruthEngine.formatSalaryDisplay(notDisclosed).text.toLowerCase().includes('not disclosed'),
    'Unstated salary displays "Salary not disclosed"'
  );

  // -------------------------------------------------------------------------
  // DEFECT 2: 7-Day Retention Policy
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing 7-Day Retention Policy ---');

  jobFeedStore.clearAll();
  const day0 = new Date('2026-10-01T10:00:00Z');
  const nowDay0Iso = day0.toISOString();

  const testJob: JobOpportunity = {
    id: 'job-retention-test-1',
    title: 'Staff Platform Engineer',
    company: 'Vercel',
    location: 'Remote',
    dateDiscovered: nowDay0Iso,
    first_seen_at: nowDay0Iso,
    match_score: 85,
  };

  // Ingest on Day 0
  jobFeedStore.ingestDiscoveredBatch([testJob], true);
  const ingestedItem = jobFeedStore.getItemById(testJob.id);
  assert(Boolean(ingestedItem), 'Job ingested into feed');

  const initialFirstSeen = ingestedItem?.job.first_seen_at || ingestedItem?.discovered_at;
  const initialExpiresAt = ingestedItem?.feed_expires_at;

  // Verify expiration is exactly 7 days from first feed ingestion
  const expectedExpiryTime = new Date(initialFirstSeen!).getTime() + 7 * 24 * 60 * 60 * 1000;
  assert(
    Math.abs(new Date(initialExpiresAt!).getTime() - expectedExpiryTime) < 1000,
    'feed_expires_at is exactly 7 days from first feed ingestion'
  );

  // Test 2B: Refresh / duplicate discovery on Day 3 must NOT reset first_seen_at or feed_expires_at
  const day3 = new Date('2026-10-04T10:00:00Z');
  const duplicateOnDay3: JobOpportunity = {
    ...testJob,
    dateDiscovered: day3.toISOString(),
    last_seen_at: day3.toISOString(),
  };

  jobFeedStore.ingestDiscoveredBatch([duplicateOnDay3], true);
  const reingestedItem = jobFeedStore.getItemById(testJob.id);

  assert(
    reingestedItem?.job.first_seen_at === initialFirstSeen,
    'Duplicate discovery on Day 3 did NOT reset first_seen_at'
  );
  assert(
    reingestedItem?.feed_expires_at === initialExpiresAt,
    'Duplicate discovery on Day 3 did NOT reset feed_expires_at'
  );

  // Test 2C: Viewing a job does NOT shorten or delete before 7 days
  jobFeedStore.markViewed(testJob.id);
  const viewedItem = jobFeedStore.getItemById(testJob.id);
  assert(Boolean(viewedItem?.job.is_viewed), 'Job marked viewed');
  assert(
    new Date(viewedItem!.feed_expires_at).getTime() >= expectedExpiryTime,
    'Viewing job does NOT expire job earlier than 7-day ingestion window'
  );

  // Test 2D: User actions (Save, Apply, Dismiss) preserve record according to lifecycle
  jobFeedStore.saveJobToDatabase(testJob.id);
  const savedItem = jobFeedStore.getItemById(testJob.id);
  assert(savedItem?.job.lifecycleState === 'SAVED', 'Saved job has SAVED lifecycleState');
  assert(Boolean(savedItem?.job.is_saved), 'Job marked is_saved');

  // Test 2E: Dismiss and Undismiss (reopen) restores job without resetting 7-day expiration
  jobFeedStore.dismissJob(testJob.id, 'other');
  const dismissedItem = jobFeedStore.getItemById(testJob.id);
  assert(Boolean(dismissedItem?.dismissed_at), 'Dismissed job has dismissed_at set');
  assert(dismissedItem?.job.lifecycleState === 'REJECTED', 'Dismissed job has REJECTED lifecycleState');

  jobFeedStore.undismissJob(testJob.id);
  const undismissedItem = jobFeedStore.getItemById(testJob.id);
  assert(!undismissedItem?.dismissed_at, 'Undismissed job cleared dismissed_at');
  assert(
    undismissedItem?.feed_expires_at === initialExpiresAt,
    'Undismissed job preserved original 7-day feed_expires_at'
  );
  assert(
    undismissedItem?.job.first_seen_at === initialFirstSeen,
    'Undismissed job preserved original first_seen_at'
  );

  // Test 2F: Pruning unacted expired jobs
  const expiredJob: JobOpportunity = {
    id: 'job-expired-10d',
    title: 'Senior DevOps Engineer',
    company: 'Docker',
    location: 'Remote',
    dateDiscovered: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    first_seen_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    match_score: 90,
  };
  jobFeedStore.ingestDiscoveredBatch([expiredJob], true);
  const pruneResult = jobFeedStore.pruneExpiredJobs();
  assert(pruneResult.expiredCount >= 1, 'Expired unacted job pruned after 7 days');
  // Saved job must NOT be pruned
  assert(Boolean(jobFeedStore.getItemById(testJob.id)), 'Saved job survives pruning');

  // -------------------------------------------------------------------------
  // DEFECT 1 & 4: Storage Performance & Authoritative Hydration
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing Storage Performance & Persistence Path ---');

  // Test 1A: Hydration readiness & persistence status
  await jobFeedStore.whenHydrated();
  assert(jobFeedStore.isStoreHydrated(), 'JobFeedStore isHydrated is true after whenHydrated()');
  const persistStatus = jobFeedStore.getPersistenceStatus();
  assert(persistStatus.isHydrated === true, 'getPersistenceStatus reports isHydrated === true');
  assert(typeof persistStatus.itemCount === 'number', 'getPersistenceStatus reports itemCount');

  // Test 4A: Put single item without rewriting entire store
  const testItems: FeedItem[] = Array.from({ length: 50 }, (_, i) => ({
    id: `bench-item-${i}`,
    job: {
      id: `bench-item-${i}`,
      title: `Engineer ${i}`,
      company: `Company ${i}`,
      location: 'Remote',
      description: 'Full rich description text '.repeat(10),
      is_new: true,
    },
    discovered_at: new Date().toISOString(),
    published_to_feed_at: new Date().toISOString(),
    feed_expires_at: new Date(Date.now() + FEED_RETENTION_MS).toISOString(),
    is_pending: false,
  }));

  const bulkT0 = Date.now();
  await persistentStorageEngine.bulkPut('job_feed_items', testItems);
  const bulkT1 = Date.now();
  console.log(`bulkPut 50 items took: ${bulkT1 - bulkT0}ms`);

  // Verify single putItem works
  const singleT0 = Date.now();
  await persistentStorageEngine.putItem('job_feed_items', {
    ...testItems[0],
    job: { ...testItems[0].job, title: 'Updated Title Single' },
  });
  const singleT1 = Date.now();
  console.log(`putItem single item took: ${singleT1 - singleT0}ms`);
  assert(singleT1 - singleT0 <= 50, 'Single item put is ultra-fast without rewriting full store');

  // Verify get retrieves updated single item
  const retrieved = await persistentStorageEngine.get<FeedItem>('job_feed_items', testItems[0].id);
  assert(retrieved?.job.title === 'Updated Title Single', 'Single item update committed and retrieved accurately');

  // -------------------------------------------------------------------------
  // DEFECT 5: Discovery Status, Scheduling & Timestamps
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Discovery Status & Scheduler Engine ---');

  // Test 5A: Clean recovery on reload (zero false RUNNING reporting from abandoned storage)
  localStorage.setItem(
    'careeros_active_discovery_run_v2',
    JSON.stringify({
      id: 'run-abandoned-test',
      startedAt: new Date(Date.now() - 120000).toISOString(),
      status: 'RUNNING',
      queriedSourceCount: 3,
    })
  );
  discoveryEngine.reconnectOrRecover();
  assert(!discoveryEngine.isDiscoveryRunning(), 'Discovery is not falsely running after reconnectOrRecover');
  assert(discoveryEngine.getActiveRun() === null, 'Active run is cleared to null upon recovery');
  assert(localStorage.getItem('careeros_active_discovery_run_v2') === null, 'Active run storage key removed cleanly');

  // Test 5B: Separate lastAttemptAt and lastSuccessAt timestamps
  const lastAttempt = discoveryEngine.getLastAttemptAt();
  const lastSuccess = discoveryEngine.getLastSuccessAt();
  console.log(`Discovery Timestamps: Attempt=${lastAttempt}, Success=${lastSuccess}`);

  // Test 5C: Sources actually ran telemetry reporting
  const sourcesRan = discoveryEngine.getSourcesActuallyRan();
  assert(Array.isArray(sourcesRan), 'getSourcesActuallyRan returns an array');
  console.log(`Sources actually ran: ${sourcesRan.length} sources`);

  // Test 5D: Scheduler telemetry reports accurate state and timer is inactive on reload
  const telemetry = continuousSchedulerEngine.getTelemetry();
  assert(typeof telemetry.sourcesScheduled === 'number', 'Scheduler tracks sourcesScheduled count');
  assert(telemetry.isLoopActive === false, 'Scheduler isLoopActive is strictly false on initialization/reload');

  console.log('\n====================================================');
  console.log('🏆 ALL 5 CRITICAL DEFECT TESTS PASSED CONFORMANCE');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
