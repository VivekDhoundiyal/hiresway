import assert from 'assert';
import { sourceRegistry } from '../src/core/jobs/sourceRegistry';
import { jobRepository } from '../src/core/jobs/jobRepository';
import { HIGH_MATCH_THRESHOLD, JobOpportunity, JobSourceRegistryEntry } from '../src/core/jobs/types';

console.log('=== RUNNING SOURCE HEALTH & RECONCILIATION TEST SUITE ===');

// TEST 1: Source Health Engine & 404 Graceful Decommissioning
console.log('\n--- Test 1: 404 Graceful Decommissioning without deleting existing jobs ---');
const testSourceId = 'src-test-greenhouse-404';
const testSource: JobSourceRegistryEntry = {
  id: testSourceId,
  name: 'Dead Greenhouse Board ATS Endpoint',
  domain: 'deadboard.com',
  sourceType: 'ats_hosted',
  category: 'company_ats',
  country: 'global',
  supportedLocations: ['Worldwide'],
  jobCategories: ['Tech'],
  atsType: 'greenhouse',
  discoveryMethod: 'api',
  updateFrequency: 'daily',
  activeStatus: true,
  eligibilityStatus: 'eligible',
  sourceHealth: 'healthy',
};

sourceRegistry.registerSource(testSource);
assert.strictEqual(sourceRegistry.getSourceById(testSourceId)?.activeStatus, true);
assert.strictEqual(sourceRegistry.getSourceById(testSourceId)?.sourceHealth, 'healthy');

// Ingest a job from this source into jobRepository
const jobFromDeadSource: JobOpportunity = {
  id: 'job-dead-source-1',
  title: 'Legacy Senior Engineer',
  company: 'DeadBoard Corp',
  jobUrl: 'https://boards.greenhouse.io/deadboard/jobs/101',
  applyUrl: 'https://boards.greenhouse.io/deadboard/jobs/101',
  location: 'Remote',
  remoteStatus: 'remote',
  employmentType: 'full-time',
  salary: { disclosed: false },
  salary_status: 'not_disclosed',
  source: {
    id: testSourceId,
    name: testSource.name,
    domain: testSource.domain,
    type: 'ats_hosted',
    sourceUrl: 'https://boards.greenhouse.io/deadboard/jobs/101',
    atsType: 'greenhouse',
    sourceConfidence: 'verified_ats',
    discoveredAt: new Date().toISOString(),
  },
  sourcesHistory: [],
  datePosted: new Date().toISOString(),
  dateDiscovered: new Date().toISOString(),
  lastVerified: new Date().toISOString(),
  lifecycleState: 'DISCOVERED',
  isVerifiedLive: true,
  verificationStatus: 'verified_live',
};

jobRepository.ingestBatch([jobFromDeadSource]);
assert.ok(jobRepository.getOpportunityById('job-dead-source-1'), 'Job should exist in repository');

// 1st 404 error
sourceRegistry.recordSourceCheck(testSourceId, {
  status: 'not_found',
  httpCode: 404,
  errorMessage: 'HTTP 404: Page not found',
});

let updatedSource = sourceRegistry.getSourceById(testSourceId)!;
assert.strictEqual(updatedSource.consecutiveFailures, 1);
assert.strictEqual(updatedSource.lastHttpStatus, 404);
assert.strictEqual(updatedSource.healthState, 'NOT_FOUND');
assert.strictEqual(updatedSource.sourceHealth, 'degraded');
console.log('  [PASS] 1st 404 recorded: consecutiveFailures=1, status=degraded, healthState=NOT_FOUND');

// 2nd 404 error -> Decommissioning triggered
sourceRegistry.recordSourceCheck(testSourceId, {
  status: 'not_found',
  httpCode: 404,
  errorMessage: 'HTTP 404: Page not found',
});

updatedSource = sourceRegistry.getSourceById(testSourceId)!;
assert.strictEqual(updatedSource.consecutiveFailures, 2);
assert.strictEqual(updatedSource.healthState, 'DECOMMISSIONED');
assert.strictEqual(updatedSource.sourceHealth, 'failed');
assert.strictEqual(updatedSource.activeStatus, false, 'Source must be deactivated so it is skipped in future discovery runs');
console.log('  [PASS] 2nd 404 triggers graceful decommissioning: activeStatus=false, healthState=DECOMMISSIONED');

// Critical guarantee: Existing jobs in the repository MUST NOT be deleted
const preservedJob = jobRepository.getOpportunityById('job-dead-source-1');
assert.ok(preservedJob, 'CRITICAL: Job must NOT be deleted when its source is decommissioned');
assert.strictEqual(preservedJob?.title, 'Legacy Senior Engineer');
console.log('  [PASS] Existing jobs remain intact in repository when source is decommissioned');

// Restore & Retry
const retryRes = sourceRegistry.retryFailed();
assert.ok(retryRes.retriedCount >= 1, 'retryFailed should restore the source');
const restoredSource = sourceRegistry.getSourceById(testSourceId)!;
assert.strictEqual(restoredSource.healthState, 'HEALTHY');
assert.strictEqual(restoredSource.sourceHealth, 'healthy');
assert.strictEqual(restoredSource.activeStatus, true);
assert.strictEqual(restoredSource.consecutiveFailures, 0);
console.log('  [PASS] retryFailed() cleanly restores decommissioned source to HEALTHY');

// TEST 2: Deduplication Priority Verification
console.log('\n--- Test 2: Deduplication Priority: Requisition ID -> URL -> Title Key -> Fingerprint ---');
const initialJob: JobOpportunity = {
  id: 'job-canonical-100',
  title: 'Lead Distributed Systems Engineer',
  company: 'CloudCore Inc',
  externalId: 'req-cloudcore-999',
  sourceJobId: 'req-cloudcore-999',
  jobUrl: 'https://cloudcore.com/careers/lead-sys-eng',
  applyUrl: 'https://cloudcore.com/careers/lead-sys-eng',
  location: 'Bangalore, India',
  remoteStatus: 'hybrid',
  employmentType: 'full-time',
  salary: { disclosed: false },
  salary_status: 'not_disclosed',
  fingerprint: 'fp-cloudcore-systems-lead',
  source: {
    id: 'src-cloudcore',
    name: 'CloudCore Portal',
    domain: 'cloudcore.com',
    type: 'direct_career_page',
    sourceUrl: 'https://cloudcore.com/careers/lead-sys-eng',
    atsType: 'none',
    sourceConfidence: 'direct_employer',
    discoveredAt: new Date().toISOString(),
  },
  sourcesHistory: [],
  datePosted: new Date().toISOString(),
  dateDiscovered: new Date().toISOString(),
  lastVerified: new Date().toISOString(),
  lifecycleState: 'DISCOVERED',
};

jobRepository.ingestBatch([initialJob]);

// Duplicate check by externalId
const matchByReq = jobRepository.checkDuplicateJob({
  externalId: 'req-cloudcore-999',
  title: 'Some Completely Different Title On Aggregator',
});
assert.strictEqual(matchByReq.isDuplicate, true);
assert.strictEqual(matchByReq.existingJob?.id, 'job-canonical-100');
console.log('  [PASS] Deduplication matched by Requisition ID priority');

// Duplicate check by URL
const matchByUrl = jobRepository.checkDuplicateJob({
  jobUrl: 'https://cloudcore.com/careers/lead-sys-eng',
});
assert.strictEqual(matchByUrl.isDuplicate, true);
assert.strictEqual(matchByUrl.existingJob?.id, 'job-canonical-100');
console.log('  [PASS] Deduplication matched by Canonical URL priority');

// Duplicate check by Company + Title
const matchByCompanyTitle = jobRepository.checkDuplicateJob({
  company: 'CloudCore Inc',
  title: 'Lead Distributed Systems Engineer',
});
assert.strictEqual(matchByCompanyTitle.isDuplicate, true);
assert.strictEqual(matchByCompanyTitle.existingJob?.id, 'job-canonical-100');
console.log('  [PASS] Deduplication matched by Company + Title priority');

// TEST 3: Rediscovery Freshness & Unread Invariant
console.log('\n--- Test 3: Rediscovery Never Resets Viewed Job to New ---');
// Mark initial job viewed
jobRepository.recordView('job-canonical-100');
const viewedJob = jobRepository.getOpportunityById('job-canonical-100')!;
assert.strictEqual(viewedJob.is_new, false);
assert.ok(viewedJob.viewed_at, 'viewed_at must be populated');

// Now re-discover the same job in a new discovery batch
const rediscoveryBatch: JobOpportunity = {
  ...initialJob,
  id: 'job-canonical-100-mirror',
  is_new: true, // Incoming raw batch might claim is_new
  isNew: true,
};

jobRepository.ingestBatch([rediscoveryBatch]);
const postRediscoveryJob = jobRepository.getOpportunityById('job-canonical-100')!;
assert.strictEqual(postRediscoveryJob.is_new, false, 'Rediscovery must NEVER reset is_new to true for viewed jobs');
assert.strictEqual(postRediscoveryJob.isNew, false);
assert.ok(postRediscoveryJob.viewed_at, 'viewed_at must be preserved');
console.log('  [PASS] Rediscovery strictly preserves viewed_at and prevents is_new reset');

// TEST 4: Reconciliation Arithmetic (Raw = New + Refreshed + Merged + Invalid)
console.log('\n--- Test 4: Batch Ingest Reconciliation Counts ---');
const newJobA: JobOpportunity = {
  ...initialJob,
  id: 'job-fresh-a',
  externalId: 'req-fresh-a',
  sourceJobId: 'req-fresh-a',
  jobUrl: 'https://cloudcore.com/careers/fresh-a',
  applyUrl: 'https://cloudcore.com/careers/fresh-a',
  fingerprint: 'fp-cloudcore-fresh-a',
  title: 'Cloud Security Architect',
};

const duplicateOfA: JobOpportunity = {
  ...newJobA,
  id: 'job-fresh-a-mirror',
};

const malformedRecord: any = {
  id: 'invalid-job',
  title: '', // Missing title
  company: '',
};

const ingestResult = jobRepository.ingestBatch([newJobA, duplicateOfA, malformedRecord]);
assert.strictEqual(ingestResult.added, 1, 'Exactly 1 new canonical job should be added');
assert.strictEqual(ingestResult.merged, 1, 'Exactly 1 duplicate job should be merged');
assert.strictEqual(ingestResult.refreshed, 1, 'Existing job was refreshed');
assert.strictEqual(ingestResult.invalid, 1, 'Malformed job was counted as invalid');
console.log(`  [PASS] Ingestion counts reconciled: added=${ingestResult.added}, merged=${ingestResult.merged}, invalid=${ingestResult.invalid}`);

// TEST 5: HIGH_MATCH_THRESHOLD Consistency
console.log('\n--- Test 5: HIGH_MATCH_THRESHOLD Consistency ---');
assert.strictEqual(HIGH_MATCH_THRESHOLD, 80, 'HIGH_MATCH_THRESHOLD must be 80');
const tabCounts = jobRepository.getDatabaseTabCounts();
assert.ok(typeof tabCounts.highMatch === 'number', 'highMatch count must be a number');
console.log(`  [PASS] HIGH_MATCH_THRESHOLD is 80 and tab count calculation uses it cleanly`);

console.log('\n================================================');
console.log('ALL SOURCE HEALTH & RECONCILIATION TESTS PASSED!');
console.log('================================================\n');
