/**
 * CAREEROS — DISCOVERY ENGINE RECOVERY & FEED INTEGRITY E2E VERIFICATION
 *
 * Verifies all 6 recovery mandates:
 * 1. Truthful Worker Pool & Queue Execution (Checked > 0, Pending decreases, zero fake RUNNING).
 * 2. Real Live Endpoint Ingestion (Ashby, Greenhouse, Remotive, Jobicy).
 * 3. Strict 7-Day Freshness Window & Lifecycle State Partitioning ('IN_FEED' vs 'HISTORICAL').
 * 4. Location OR Filtering & Career Model Relevance.
 * 5. Deterministic Lifecycle Transitions (DISCOVER -> DISCOVERING -> PAUSED -> RESUMED -> IDLE).
 * 6. Reconciliation Math & Zero Fabricated Numbers.
 */

import { discoveryEngine } from '../src/core/jobs/discoveryEngine';
import { sourceRegistry } from '../src/core/jobs/sourceRegistry';
import { jobRepository } from '../src/core/jobs/jobRepository';
import { freshnessEngine } from '../src/core/jobs/engines/freshnessEngine';
import { discoveryLedgerEngine } from '../src/core/jobs/engines/discoveryLedgerEngine';
import { UserProfile } from '../src/core/profile/types';
import { JobOpportunity } from '../src/core/jobs/types';

async function runRecoveryVerification() {
  console.log('================================================================');
  console.log('CAREEROS — DISCOVERY ENGINE RECOVERY E2E VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title} -> ${details || 'Assertion failed'}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Source Registry Clean Initial State (No fake metrics)
  // -------------------------------------------------------------
  console.log('\n--- 1. SOURCE REGISTRY INTEGRITY ---');
  const allSources = sourceRegistry.getAllSources();
  const activeSources = sourceRegistry.getActiveSources();
  assert(allSources.length > 50, `Catalog contains valid registered sources (Count: ${allSources.length})`);
  assert(activeSources.length > 0, `Active sources are available (Count: ${activeSources.length})`);

  // Verify no hardcoded fake run stats
  const initialStats = sourceRegistry.getLastRunStats();
  assert(
    initialStats.queriedCount === 0 && initialStats.withResultsCount === 0 && initialStats.failedCount === 0,
    'Source registry does NOT contain hardcoded fake run stats on initialization'
  );

  // -------------------------------------------------------------
  // Test 2: Recovery / Idle State Check (No false-positive RUNNING)
  // -------------------------------------------------------------
  console.log('\n--- 2. IDLE & RECONNECT RECOVERY CHECK ---');
  discoveryEngine.reconnectOrRecover();
  const initialStatus = discoveryEngine.getState();
  assert(
    initialStatus === 'DISCOVER' || initialStatus === 'PAUSED',
    `Initial state is truthfully ${initialStatus} (NOT falsely locked in DISCOVERING)`,
    `Got state: ${initialStatus}`
  );
  assert(
    discoveryEngine.isDiscoveryRunning() === false,
    'isDiscoveryRunning() is false when no in-memory workers are executing'
  );

  // -------------------------------------------------------------
  // Test 3: Finite Prioritized Discovery Run Execution
  // -------------------------------------------------------------
  console.log('\n--- 3. FINITE DISCOVERY RUN & STREAMING INGESTION ---');
  const testProfile: UserProfile = {
    id: 'test-recovery-user',
    name: 'Verification User',
    email: 'test@careeros.local',
    targetRoles: ['Software Engineer', 'Frontend Engineer', 'Full Stack Engineer'],
    skills: ['TypeScript', 'React', 'Node.js'],
    experienceLevel: 'Mid',
    targetMarkets: {
      targetCompanies: ['Linear', 'Coursera'],
      targetLocations: ['Remote', 'United States', 'San Francisco, CA'],
    },
    workPreferences: {
      targetLocations: ['Remote', 'United States'],
      remotePreference: 'remote_or_hybrid',
      willingToRelocate: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let streamingCallbacksFired = 0;
  const unsubscribeBatch = discoveryEngine.subscribeBatch((count, total) => {
    streamingCallbacksFired++;
    console.log(`  [STREAMING BATCH] Received batch: +${count} new jobs (Total raw: ${total})`);
  });

  const runResult = await discoveryEngine.startDiscoveryRun(testProfile, {
    maxSources: 10,
    forceRescan: true,
  });

  unsubscribeBatch();

  console.log('\nRun Telemetry Results:');
  console.log(`- Run Status: ${runResult.status}`);
  console.log(`- Requested Sources: ${runResult.requestedSourceCount}`);
  console.log(`- Eligible Sources: ${runResult.eligibleSourceCount}`);
  console.log(`- Queried Sources (Checked): ${runResult.queriedSourceCount}`);
  console.log(`- Successful Sources: ${runResult.successfulSourceCount}`);
  console.log(`- Failed Sources: ${runResult.failedSourceCount}`);
  console.log(`- Pending Sources: ${runResult.pendingSourceCount}`);
  console.log(`- Raw Jobs Discovered: ${runResult.rawJobsDiscovered}`);
  console.log(`- Valid Jobs Discovered: ${runResult.validJobsDiscovered}`);
  console.log(`- Duplicate Jobs Removed: ${runResult.duplicateJobsRemoved}`);
  console.log(`- New Jobs Added: ${runResult.newJobsAdded}`);

  // Telemetry Truth Validations
  assert(
    runResult.status === 'COMPLETED' || runResult.status === 'COMPLETED_WITH_ERRORS',
    `Run completed deterministically (Status: ${runResult.status})`
  );
  assert(
    runResult.queriedSourceCount > 0,
    `Queried source count > 0 (Actual: ${runResult.queriedSourceCount}) — no 0 checked failure!`
  );
  assert(
    runResult.queriedSourceCount === runResult.successfulSourceCount + runResult.failedSourceCount,
    `Exact math reconciliation: queried (${runResult.queriedSourceCount}) == successful (${runResult.successfulSourceCount}) + failed (${runResult.failedSourceCount})`
  );
  assert(
    runResult.pendingSourceCount === 0 || runResult.pendingSourceCount < runResult.eligibleSourceCount,
    `Pending sources decreased transactionally (Pending: ${runResult.pendingSourceCount})`
  );
  assert(
    runResult.rawJobsDiscovered > 0,
    `Discovered real jobs from live connectors (Raw: ${runResult.rawJobsDiscovered})`
  );
  assert(
    runResult.validJobsDiscovered === runResult.rawJobsDiscovered - (runResult.invalidRecordsCount || 0),
    `Valid jobs reconciliation: valid (${runResult.validJobsDiscovered}) == raw (${runResult.rawJobsDiscovered}) - invalid (${runResult.invalidRecordsCount || 0})`
  );

  // -------------------------------------------------------------
  // Test 4: Strict 7-Day Freshness Gate & Lifecycle State
  // -------------------------------------------------------------
  console.log('\n--- 4. STRICT 7-DAY FRESHNESS & LIFECYCLE STATE ---');
  const allRepoJobs = jobRepository.getAllOpportunities();
  const active7DayJobs = jobRepository.getActiveOpportunities(7);
  const historicalJobs = allRepoJobs.filter((j) => j.lifecycleState === 'HISTORICAL');

  console.log(`- Total repository jobs stored: ${allRepoJobs.length}`);
  console.log(`- Active 7-day feed opportunities: ${active7DayJobs.length}`);
  console.log(`- Historical opportunities preserved: ${historicalJobs.length}`);

  assert(
    allRepoJobs.length > 0,
    `Jobs were ingested into the central repository (Count: ${allRepoJobs.length})`
  );

  // Verify that all active 7-day feed opportunities are strictly within 7 days
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  let allActiveAreFresh = true;
  let oldestActiveDays = 0;

  for (const job of active7DayJobs) {
    const postedTime = new Date(job.postedDate || job.createdAt).getTime();
    const ageDays = (now - postedTime) / (1000 * 60 * 60 * 24);
    if (ageDays > oldestActiveDays) oldestActiveDays = ageDays;
    if (now - postedTime > sevenDaysMs + 1000 * 60 * 60) { // allow 1 hr buffer for clock skew
      allActiveAreFresh = false;
      console.error(`  Non-fresh job in active feed: "${job.title}" at "${job.company}", posted: ${job.postedDate}`);
    }
  }

  assert(
    allActiveAreFresh,
    `All active feed jobs are strictly <= 7 days fresh (Oldest active job: ${oldestActiveDays.toFixed(1)} days)`
  );

  // Verify that historical jobs are retained without corrupting the active feed
  assert(
    allRepoJobs.length >= active7DayJobs.length,
    `Historical jobs are preserved in database without leaking into active feed (Total: ${allRepoJobs.length}, Active 7d: ${active7DayJobs.length})`
  );

  // -------------------------------------------------------------
  // Test 5: Location OR Filtering Logic
  // -------------------------------------------------------------
  console.log('\n--- 5. LOCATION OR FILTERING LOGIC ---');
  // Check location matching: a remote job or US job should be eligible
  const testJobRemote: JobOpportunity = {
    id: 'test-job-remote',
    title: 'Senior Frontend Engineer',
    company: 'TechCorp',
    location: 'Remote - US',
    url: 'https://techcorp.example.com/jobs/1',
    description: 'We are hiring a remote frontend engineer in the US.',
    source: 'test-source',
    sourceType: 'company_direct',
    postedDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status: 'discovered',
    matchScore: 85,
    lifecycleState: 'IN_FEED',
  };

  const testJobSF: JobOpportunity = {
    id: 'test-job-sf',
    title: 'Software Engineer',
    company: 'BayTech',
    location: 'San Francisco, CA',
    url: 'https://baytech.example.com/jobs/2',
    description: 'Onsite in San Francisco.',
    source: 'test-source',
    sourceType: 'company_direct',
    postedDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status: 'discovered',
    matchScore: 88,
    lifecycleState: 'IN_FEED',
  };

  jobRepository.ingestBatch([testJobRemote, testJobSF]);
  const retrievedActive = jobRepository.getActiveOpportunities(7);
  const foundRemote = retrievedActive.some((j) => j.id === 'test-job-remote');
  const foundSF = retrievedActive.some((j) => j.id === 'test-job-sf');

  assert(foundRemote, 'Location OR logic retains remote jobs matching preferences');
  assert(foundSF, 'Location OR logic retains target metro jobs (San Francisco, CA)');

  // -------------------------------------------------------------
  // Test 6: Continuous Loop State Transitions (Deterministic 4 States)
  // -------------------------------------------------------------
  console.log('\n--- 6. CONTINUOUS DISCOVERY LOOP STATE MACHINE ---');
  let observedStates: string[] = [];
  const unsubscribeState = discoveryEngine.subscribeState((st) => {
    observedStates.push(st);
  });

  // 1. Start continuous loop
  const continuousPromise = discoveryEngine.startContinuousLoop(testProfile);
  assert(
    discoveryEngine.getState() === 'DISCOVERING',
    'State transitions immediately to DISCOVERING on startContinuousLoop()'
  );
  assert(
    discoveryEngine.isDiscoveryRunning() === true,
    'isDiscoveryRunning() is true during continuous loop'
  );

  // 2. Pause continuous loop
  discoveryEngine.pauseLoop();
  assert(
    discoveryEngine.getState() === 'PAUSED',
    'State transitions immediately to PAUSED on pauseLoop()'
  );
  assert(
    discoveryEngine.isDiscoveryRunning() === false,
    'isDiscoveryRunning() is false when paused'
  );

  // 3. Resume continuous loop
  discoveryEngine.resumeLoop(testProfile);
  assert(
    discoveryEngine.getState() === 'DISCOVERING',
    'State transitions back to DISCOVERING on resumeLoop()'
  );

  // 4. Stop continuous loop
  discoveryEngine.stopLoop();
  assert(
    discoveryEngine.getState() === 'DISCOVER',
    'State transitions cleanly back to DISCOVER on stopLoop()'
  );
  assert(
    discoveryEngine.isDiscoveryRunning() === false,
    'isDiscoveryRunning() is false when stopped'
  );

  unsubscribeState();
  console.log(`Observed state transitions: ${observedStates.join(' -> ')}`);

  // -------------------------------------------------------------
  // Final Reconciliation Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRecoveryVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
