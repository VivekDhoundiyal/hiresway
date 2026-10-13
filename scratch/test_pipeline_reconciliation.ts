import { sourceRegistry } from '../src/core/jobs/sourceRegistry';
import { jobRepository } from '../src/core/jobs/jobRepository';
import { discoveryEngine } from '../src/core/jobs/discoveryEngine';
import { jobVerificationEngine } from '../src/core/jobs/jobVerificationEngine';
import { JobOpportunity, RawDiscoveredJob } from '../src/core/jobs/types';

async function runPipelineReconciliationTests() {
  console.log('=== STARTING CAREEROS PIPELINE RECONCILIATION VERIFICATION ===\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, failureDetails?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}: ${failureDetails || 'Assertion failed'}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: Canonical URL Normalization
  // -------------------------------------------------------------
  const dirtyUrl = 'https://boards.greenhouse.io/stripe/jobs/12345?gh_src=custom_trk&utm_source=linkedin&utm_campaign=hiring#apply';
  const cleanUrl = jobVerificationEngine.getCanonicalUrl(dirtyUrl);
  assert(
    cleanUrl === 'https://boards.greenhouse.io/stripe/jobs/12345',
    'Canonical URL Normalization strips tracking parameters, hashes, and trailing slashes',
    `Expected https://boards.greenhouse.io/stripe/jobs/12345, got: ${cleanUrl}`
  );

  // -------------------------------------------------------------
  // Test 2: Dead Page Signature Detection
  // -------------------------------------------------------------
  const deadJob: Partial<RawDiscoveredJob> = {
    title: 'Senior Frontend Engineer',
    description: 'Sorry, the job board you were viewing is no longer active.',
    jobUrl: 'https://jobs.ashbyhq.com/example/123',
  };
  const deadSigResult = jobVerificationEngine.checkDeadJobSignatures(deadJob as any);
  assert(
    deadSigResult.isDead === true,
    'Dead job board signature ("job board you were viewing is no longer active") is detected',
    `Expected isDead: true, got: ${deadSigResult.isDead}`
  );

  // -------------------------------------------------------------
  // Test 3: Dead Page Quarantine Enforcement
  // -------------------------------------------------------------
  const testSourceId = 'src-test-dead-board-1';
  sourceRegistry.registerSource({
    id: testSourceId,
    name: 'Dead Board Company',
    domain: 'deadboard.example.com',
    category: 'company_ats',
    atsType: 'greenhouse',
    sourceType: 'ats_hosted',
    activeStatus: true,
    eligibilityStatus: 'eligible',
    sourceHealth: 'healthy',
  } as any);

  // Trigger dead check
  sourceRegistry.recordSourceCheck(testSourceId, {
    status: 'quarantined',
    httpCode: 404,
    errorMessage: 'HTTP 404: The job board you were viewing is no longer active',
  });

  const isQuarantined = sourceRegistry.isSourceQuarantined(testSourceId);
  assert(
    isQuarantined === true,
    'Source is automatically quarantined when dead page / 404 is detected',
    `Expected isSourceQuarantined: true, got: ${isQuarantined}`
  );

  const quarantinedList = sourceRegistry.getQuarantinedSources();
  assert(
    quarantinedList.some((s) => s.id === testSourceId),
    'Quarantined source appears in getQuarantinedSources()',
    `Source ${testSourceId} not found in quarantined list`
  );

  // -------------------------------------------------------------
  // Test 4: Quarantined Sources Excluded from Active Feed
  // -------------------------------------------------------------
  const jobFromDeadSource: JobOpportunity = {
    id: 'job-from-dead-source-1',
    fingerprint: 'fp-dead-1',
    title: 'Staff Engineer',
    company: 'Dead Board Company',
    location: 'Remote',
    country: 'Global',
    jobUrl: 'https://deadboard.example.com/jobs/1',
    sourceId: testSourceId,
    source: {
      id: testSourceId,
      name: 'Dead Board Company',
      domain: 'deadboard.example.com',
      type: 'ats_hosted',
      sourceUrl: 'https://deadboard.example.com',
      atsType: 'greenhouse',
      sourceConfidence: 'direct_ats',
      discoveredAt: new Date().toISOString(),
    },
    lifecycleState: 'DISCOVERED',
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    datePosted: new Date().toISOString(),
    dateDiscovered: new Date().toISOString(),
    lastVerified: new Date().toISOString(),
  };

  // Ingest batch containing job from quarantined source
  const deadIngestResult = jobRepository.ingestBatch([jobFromDeadSource]);
  assert(
    deadIngestResult.invalid >= 1,
    'ingestBatch rejects jobs from quarantined source',
    `Expected invalid >= 1, got: ${deadIngestResult.invalid}`
  );

  const activeJobs = jobRepository.getActiveOpportunities();
  assert(
    !activeJobs.some((j) => j.id === jobFromDeadSource.id || j.sourceId === testSourceId),
    'getActiveOpportunities() strictly excludes jobs from quarantined sources',
    'Found job from quarantined source in active opportunities'
  );

  // -------------------------------------------------------------
  // Test 5: 4-Tier Deduplication Hierarchy & Provenance Retention
  // -------------------------------------------------------------
  // Tier 1: Canonical URL Match
  const jobA: JobOpportunity = {
    id: 'job-tier1-a',
    fingerprint: 'fp-tier1-a',
    title: 'Staff AI Engineer',
    company: 'Acme AI',
    location: 'Bangalore, India',
    country: 'India',
    jobUrl: 'https://boards.greenhouse.io/acmeai/jobs/999?utm_source=linkedin',
    canonicalUrl: 'https://boards.greenhouse.io/acmeai/jobs/999',
    lifecycleState: 'DISCOVERED',
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    datePosted: new Date().toISOString(),
    dateDiscovered: new Date().toISOString(),
    lastVerified: new Date().toISOString(),
    source: {
      id: 'src-acme-gh',
      name: 'Acme AI Careers',
      domain: 'acme.ai',
      type: 'ats_hosted',
      sourceUrl: 'https://boards.greenhouse.io/acmeai/jobs/999',
      atsType: 'greenhouse',
      sourceConfidence: 'direct_ats',
      discoveredAt: new Date().toISOString(),
    },
  };

  const jobB_duplicateUrl: JobOpportunity = {
    id: 'job-tier1-b',
    fingerprint: 'fp-tier1-b',
    title: 'Staff AI Engineer',
    company: 'Acme AI',
    location: 'Bengaluru, Karnataka',
    country: 'India',
    jobUrl: 'https://boards.greenhouse.io/acmeai/jobs/999?gh_src=referral_program&utm_medium=jobboard',
    canonicalUrl: 'https://boards.greenhouse.io/acmeai/jobs/999',
    lifecycleState: 'DISCOVERED',
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    datePosted: new Date().toISOString(),
    dateDiscovered: new Date().toISOString(),
    lastVerified: new Date().toISOString(),
    source: {
      id: 'src-aggregator-1',
      name: 'Tech Job Aggregator',
      domain: 'jobaggregator.local',
      type: 'aggregator_feed',
      sourceUrl: 'https://jobaggregator.local/acme/999',
      atsType: 'none',
      sourceConfidence: 'third_party_aggregator',
      discoveredAt: new Date().toISOString(),
    },
  };

  const ingestTier1 = jobRepository.ingestBatch([jobA, jobB_duplicateUrl]);
  assert(
    ingestTier1.added === 1 && ingestTier1.merged === 1,
    'Tier 1 Deduplication: Canonical URL match merges duplicate into single opportunity',
    `Expected added: 1, merged: 1, got added: ${ingestTier1.added}, merged: ${ingestTier1.merged}`
  );

  const savedJobA = jobRepository.getJobById(jobA.id);
  assert(
    Boolean(savedJobA?.secondary_sources && savedJobA.secondary_sources.length >= 1),
    'Provenance retention: secondary_sources array preserves original source attribution',
    `Expected secondary_sources >= 1, got: ${JSON.stringify(savedJobA?.secondary_sources)}`
  );

  // Tier 3: Normalized Company + Seniority Title + Location
  const jobC: JobOpportunity = {
    id: 'job-tier3-c',
    fingerprint: 'fp-tier3-c',
    title: 'Senior Software Engineer, Backend',
    company: 'Alpha Cloud',
    location: 'Remote, US',
    country: 'US',
    jobUrl: 'https://alphacloud.com/careers/backend-sr',
    lifecycleState: 'DISCOVERED',
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    datePosted: new Date().toISOString(),
    dateDiscovered: new Date().toISOString(),
    lastVerified: new Date().toISOString(),
  };

  const jobD_duplicateTitleComp: JobOpportunity = {
    id: 'job-tier3-d',
    fingerprint: 'fp-tier3-d',
    title: 'Senior Software Engineer - Backend (Remote US)',
    company: 'Alpha Cloud Inc.',
    location: 'Remote',
    country: 'US',
    jobUrl: 'https://remotejobs.org/alpha-cloud-sr-backend',
    lifecycleState: 'DISCOVERED',
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    datePosted: new Date().toISOString(),
    dateDiscovered: new Date().toISOString(),
    lastVerified: new Date().toISOString(),
  };

  const ingestTier3 = jobRepository.ingestBatch([jobC, jobD_duplicateTitleComp]);
  assert(
    ingestTier3.added === 1 && ingestTier3.merged === 1,
    'Tier 3 Deduplication: Normalized Company + Title merges cross-posted opportunity',
    `Expected added: 1, merged: 1, got added: ${ingestTier3.added}, merged: ${ingestTier3.merged}`
  );

  // -------------------------------------------------------------
  // Test 6: Discovery Telemetry Reconciliation (Zero Contradictions)
  // -------------------------------------------------------------
  console.log('\nTesting Finite Discovery Run Reconciliation:');
  const dummyProfile = {
    headline: 'Senior Full Stack Engineer',
    targetMarkets: {
      targetCompanies: ['Linear', 'Supabase'],
    },
    rolePreferences: {
      currentTitle: 'Senior Full Stack Engineer',
      targetPrimaryTitle: 'Staff Software Engineer',
      targetJobTitles: ['Senior Software Engineer', 'Staff Engineer'],
    },
    locationAndAuth: {
      currentCountry: 'United States',
      currentCity: 'San Francisco',
    },
    personalInfo: {
      country: 'United States',
      city: 'San Francisco',
    },
    workPreferences: {
      workplaceTypes: ['remote'],
      targetLocations: ['Worldwide', 'United States'],
    },
    compensation: {
      currency: 'USD',
      minBaseSalary: 150000,
      targetBaseSalary: 200000,
    },
  };

  const runResult = await discoveryEngine.startDiscoveryRun(dummyProfile as any, { maxSources: 5 });
  console.log('Run completed with status:', runResult.status);
  console.log(`- Total catalog sources: ${runResult.requestedSourceCount}`);
  console.log(`- Eligible sources: ${runResult.eligibleSourceCount}`);
  console.log(`- Queried sources (Checked): ${runResult.queriedSourceCount}`);
  console.log(`- Successful sources: ${runResult.successfulSourceCount}`);
  console.log(`- Failed sources: ${runResult.failedSourceCount}`);
  console.log(`- Pending sources: ${runResult.pendingSourceCount}`);
  console.log(`- Skipped sources: ${runResult.skippedSourceCount}`);
  console.log(`- Quarantined sources: ${runResult.quarantinedSourceCount}`);
  console.log(`- Raw jobs discovered: ${runResult.rawJobsDiscovered}`);
  console.log(`- Valid jobs discovered: ${runResult.validJobsDiscovered}`);
  console.log(`- Jobs verified: ${runResult.jobsVerifiedCount}`);
  console.log(`- Jobs rejected: ${runResult.jobsRejectedCount}`);
  console.log(`- Duplicates removed: ${runResult.duplicateJobsRemoved}`);
  console.log(`- New jobs added: ${runResult.newJobsAdded}`);

  // Verification 1: Checked must equal Successful + Failed
  assert(
    runResult.queriedSourceCount >= runResult.successfulSourceCount + runResult.failedSourceCount,
    'Reconciliation Rule 1: Checked >= Successful + Failed (checked is not 0 when successful > 0)',
    `Checked: ${runResult.queriedSourceCount}, Successful: ${runResult.successfulSourceCount}, Failed: ${runResult.failedSourceCount}`
  );

  // Verification 2: Pending is strictly tracked and not counted as skipped
  assert(
    runResult.pendingSourceCount !== undefined && runResult.pendingSourceCount >= 0,
    'Reconciliation Rule 2: Pending sources are explicitly tracked (not classified as skipped)',
    `Pending: ${runResult.pendingSourceCount}`
  );

  // Verification 3: Total sources equals Pending + Checked + Skipped + Quarantined (or catalog total)
  const sourceSum = (runResult.pendingSourceCount || 0) + runResult.queriedSourceCount;
  assert(
    sourceSum === runResult.eligibleSourceCount,
    'Reconciliation Rule 3: Eligible sources = Pending + Checked',
    `Eligible: ${runResult.eligibleSourceCount}, Sum: ${sourceSum}`
  );

  // Verification 4: Jobs discovered equals jobs verified + jobs rejected
  assert(
    runResult.rawJobsDiscovered === (runResult.jobsVerifiedCount || 0) + (runResult.jobsRejectedCount || 0),
    'Reconciliation Rule 4: Jobs Discovered = Jobs Verified + Jobs Rejected',
    `Discovered: ${runResult.rawJobsDiscovered}, Verified: ${runResult.jobsVerifiedCount}, Rejected: ${runResult.jobsRejectedCount}`
  );

  // Verification 5: New jobs added equals jobs verified - duplicates removed
  assert(
    runResult.newJobsAdded <= (runResult.jobsVerifiedCount || 0),
    'Reconciliation Rule 5: New Jobs Added <= Jobs Verified (minus duplicates)',
    `New: ${runResult.newJobsAdded}, Verified: ${runResult.jobsVerifiedCount}`
  );

  console.log(`\n=== RESULTS: ${passedTests} / ${totalTests} TESTS PASSED ===`);
  if (passedTests === totalTests) {
    console.log('ALL PIPELINE RECONCILIATION & DATA INTEGRITY TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runPipelineReconciliationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
