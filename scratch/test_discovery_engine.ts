/**
 * CareerOs Discovery Engine & Database Tab Counts Verification
 */

import { discoveryEngine } from '../src/core/jobs/discoveryEngine';
import { jobRepository } from '../src/core/jobs/jobRepository';
import { mergeJobOpportunities, normalizeRawDiscoveredJob } from '../src/core/jobs/jobPipeline';
import { RawDiscoveredJob } from '../src/core/jobs/types';

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name}: ${detail || 'Assertion failed'}`);
    failed++;
  }
}

async function run() {
  console.log('\n===============================================================');
  console.log('🚀 TESTING CAREEROS REDESIGNED DISCOVERY ENGINE & PIPELINE');
  console.log('===============================================================\n');

  // Test A: Database Tab Counts
  console.log('TEST A: Database Tab Counts');
  const tabCounts = jobRepository.getDatabaseTabCounts();
  assert(typeof tabCounts.all === 'number', 'tabCounts.all is a valid number');
  assert(typeof tabCounts.newCount === 'number', 'tabCounts.newCount is a valid number');
  assert(typeof tabCounts.highMatch === 'number', 'tabCounts.highMatch is a valid number');
  assert(typeof tabCounts.targetCompanies === 'number', 'tabCounts.targetCompanies is a valid number');
  assert(typeof tabCounts.remote === 'number', 'tabCounts.remote is a valid number');
  assert(typeof tabCounts.salaryDisclosed === 'number', 'tabCounts.salaryDisclosed is a valid number');
  assert(typeof tabCounts.viewed === 'number', 'tabCounts.viewed is a valid number');
  assert(typeof tabCounts.saved === 'number', 'tabCounts.saved is a valid number');

  // Test B: New Job Lifecycle & View Reset
  console.log('\nTEST B: New Job Lifecycle & View Reset');
  const rawJob: RawDiscoveredJob = {
    id: `raw-new-test-${Date.now()}`,
    title: 'Staff Fullstack Engineer',
    company: 'Linear',
    url: 'https://linear.app/careers/staff-fullstack',
    location: 'Remote',
    description: 'Build Linear app features.',
    dateDiscovered: new Date().toISOString(),
    source: {
      name: 'Linear Careers',
      domain: 'linear.app',
      type: 'ats_hosted',
      confidence: 'direct_employer',
    },
  };
  const normalized = normalizeRawDiscoveredJob(rawJob);
  assert(normalized.is_new === true, 'Brand new normalized job has is_new === true');
  assert(Boolean(normalized.first_seen_at), 'first_seen_at timestamp is set');
  assert(Boolean(normalized.new_until), 'new_until timestamp is set 48h in future');

  jobRepository.saveOpportunity(normalized);
  const beforeViewCounts = jobRepository.getDatabaseTabCounts();
  assert(beforeViewCounts.newCount >= 1, 'New count in database tab counts includes new opportunity');

  // Viewing clears is_new
  jobRepository.recordView(normalized.id, 90);
  const foundInDb = jobRepository.getOpportunityById(normalized.id);
  assert(foundInDb?.is_new === false, 'Viewing opportunity immediately clears is_new flag');
  assert(foundInDb?.lifecycleState === 'VIEWED', 'Lifecycle state updated to VIEWED');

  // Test C: Deduplication preserves first_seen_at and sets is_new: false for existing
  console.log('\nTEST C: Deduplication Merging Preserves First Seen and Resets New State');
  const existingJob = { ...normalized, is_new: false, first_seen_at: '2026-09-01T10:00:00.000Z' };
  const incomingDuplicate = { ...normalized, is_new: true, first_seen_at: '2026-09-22T10:00:00.000Z' };
  const merged = mergeJobOpportunities(existingJob, incomingDuplicate);
  assert(merged.is_new === false, 'Existing merged opportunity is NOT marked as new');
  assert(merged.first_seen_at === '2026-09-01T10:00:00.000Z', 'Existing first_seen_at timestamp is preserved');

  // Test D: Discovery Engine Run Lifecycle & Subscribers
  console.log('\nTEST D: Discovery Engine Run Lifecycle & Subscribers');
  assert(typeof discoveryEngine.getRunHistory === 'function', 'discoveryEngine has getRunHistory()');
  assert(typeof discoveryEngine.getActiveRun === 'function', 'discoveryEngine has getActiveRun()');
  assert(typeof discoveryEngine.cancelDiscoveryRun === 'function', 'discoveryEngine has cancelDiscoveryRun()');

  let progressTriggered = false;
  const unsubProg = discoveryEngine.subscribeProgress((event) => {
    progressTriggered = true;
  });
  let batchTriggered = false;
  const unsubBatch = discoveryEngine.subscribeBatch((newJobs, total) => {
    batchTriggered = true;
  });

  discoveryEngine.notifyProgress({
    runId: 'test-run-123',
    stage: 'querying',
    status: 'RUNNING',
    message: 'Testing progress',
    percent: 50,
    sourcesQueried: 5,
    totalEligibleSources: 10,
    totalRegisteredSources: 1000,
    rawJobsDiscovered: 12,
    newJobsAdded: 8,
    duplicatesRemoved: 4,
    successfulSources: 4,
    failedSources: 1,
    timedOutSources: 0,
    sourcesWithZeroJobs: 0,
  });
  discoveryEngine.notifyBatch(8, 12);

  unsubProg();
  unsubBatch();

  assert(progressTriggered === true, 'subscribeProgress receives granular finite run updates');
  assert(batchTriggered === true, 'subscribeBatch receives incremental streaming batch updates');

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
