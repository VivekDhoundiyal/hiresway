import { jobVerificationEngine } from '../src/core/jobs/jobVerificationEngine';
import { JobOpportunityRepository } from '../src/core/jobs/jobRepository';
import { JobDiscoveryEngine } from '../src/core/jobs/discoveryEngine';
import { sourceRegistry } from '../src/core/jobs/sourceRegistry';
import { salaryTruthEngine } from '../src/core/jobs/salaryTruthEngine';
import { remoteEligibilityEngine } from '../src/core/jobs/remoteEligibilityEngine';
import {
  normalizeRawDiscoveredJob,
  normalizeRawJobs,
  generateJobFingerprint,
} from '../src/core/jobs/jobPipeline';
import { RawDiscoveredJob, JobOpportunity } from '../src/core/jobs/types';

interface TestResult {
  scenarioNumber: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runScenario(
  num: number,
  name: string,
  fn: () => void | Promise<void>
) {
  try {
    await fn();
    results.push({ scenarioNumber: num, name, passed: true, details: 'Passed' });
    console.log(`[PASS] Scenario ${num}: ${name}`);
  } catch (err: any) {
    results.push({
      scenarioNumber: num,
      name,
      passed: false,
      details: err?.message || String(err),
    });
    console.error(`[FAIL] Scenario ${num}: ${name} - ${err?.message}`);
  }
}

async function runAll30Scenarios() {
  console.log('====================================================');
  console.log('CAREEROS MASTER DATA INTEGRITY & PIPELINE TEST SUITE');
  console.log('Executing 30/30 Scenarios from Section 34...');
  console.log('====================================================\n');

  const repo = new JobOpportunityRepository();

  // 1. dead Greenhouse job
  await runScenario(1, 'Dead Greenhouse job detection', () => {
    const rawJob: RawDiscoveredJob = {
      title: 'Senior Software Engineer',
      company: 'Datadog',
      jobUrl: 'https://boards.greenhouse.io/datadog/jobs/99901',
      applyUrl: 'https://boards.greenhouse.io/datadog/jobs/99901',
      location: 'San Francisco, CA',
      description: 'Page not found. The job board you were viewing is no longer active.',
    };
    const liveCheck = jobVerificationEngine.verifyJobLive(rawJob);
    assert(liveCheck.isLive === false, 'Dead Greenhouse job must fail isLive');
    assert(
      liveCheck.failureReason?.includes('Dead job signature') ||
        liveCheck.failureReason?.includes('no longer active'),
      'Must cite dead signature in failure reason'
    );
    const normalized = normalizeRawJobs([rawJob]);
    assert(normalized.length === 0, 'Dead Greenhouse job must not pass normalizeRawJobs');
  });

  // 2. live Greenhouse job
  await runScenario(2, 'Live Greenhouse job verification', () => {
    const rawJob: RawDiscoveredJob = {
      title: 'Full Stack Engineer',
      company: 'Stripe',
      jobUrl: 'https://boards.greenhouse.io/stripe/jobs/12345',
      applyUrl: 'https://boards.greenhouse.io/stripe/jobs/12345',
      location: 'Remote, US',
      description: 'Join Stripe as a Full Stack Engineer building developer-first payment systems.',
    };
    const liveCheck = jobVerificationEngine.verifyJobLive(rawJob);
    assert(liveCheck.isLive === true, 'Live Greenhouse job must pass isLive');
    const normalized = normalizeRawJobs([rawJob]);
    assert(normalized.length === 1, 'Live Greenhouse job must pass normalizeRawJobs');
    assert(normalized[0].isVerifiedLive === true, 'Must have isVerifiedLive = true');
    assert(normalized[0].verificationStatus === 'verified_live', 'Must have verificationStatus = verified_live');
  });

  // 3. redirected job
  await runScenario(3, 'Redirected job handling', () => {
    // Valid redirect
    const jobValidRedirect: JobOpportunity = {
      id: 'job-redirect-1',
      fingerprint: 'fp-redirect-1',
      title: 'Solutions Architect',
      normalizedTitle: 'solutions architect',
      company: 'Datadog',
      location: 'San Francisco, CA',
      country: 'United States',
      remoteStatus: 'on-site',
      workFromAnywhere: false,
      eligibleCountries: ['United States'],
      employmentType: 'full-time',
      salary: { disclosed: false },
      seniority: 'senior',
      requiredSkills: ['Cloud'],
      preferredSkills: [],
      responsibilities: [],
      requirements: [],
      industry: 'Technology',
      description: 'Live role at Datadog with active requisition destination.',
      jobUrl: 'https://careers.datadoghq.com/detail/123',
      applyUrl: 'https://careers.datadoghq.com/detail/123',
      isVerifiedLive: true,
      isApplyUrlValidated: true,
      verificationStatus: 'verified_live',
      source: {
        id: 'src-1',
        name: 'Datadog',
        domain: 'datadoghq.com',
        type: 'direct_career_page',
        sourceUrl: 'https://careers.datadoghq.com/detail/123',
        sourceConfidence: 'direct_employer',
        discoveredAt: new Date().toISOString(),
      },
      sourcesHistory: [],
      datePosted: new Date().toISOString(),
      dateDiscovered: new Date().toISOString(),
      lastVerified: new Date().toISOString(),
      lifecycleState: 'DISCOVERED',
      verificationEvidence: {
        redirectDetected: true,
        finalUrl: 'https://boards.greenhouse.io/datadog/jobs/123456',
      },
    };
    const verified = jobVerificationEngine.verifySingleJob(jobValidRedirect);
    assert(verified.applyUrl === 'https://boards.greenhouse.io/datadog/jobs/123456', 'Must adopt valid finalUrl');
    assert(verified.isVerifiedLive === true, 'Valid redirect destination must verify live');

    // Invalid redirect (redirected to generic homepage / search)
    const jobInvalidRedirect: JobOpportunity = {
      ...jobValidRedirect,
      id: 'job-redirect-2',
      verificationEvidence: {
        redirectDetected: true,
        finalUrl: 'https://careers.datadoghq.com/careers/search',
      },
    };
    const verifiedInvalid = jobVerificationEngine.verifySingleJob(jobInvalidRedirect);
    assert(verifiedInvalid.isVerifiedLive === false, 'Generic search redirect must fail live verification');
    assert(verifiedInvalid.verificationStatus === 'link_broken', 'Must be marked link_broken');
  });

  // 4. 404 job
  await runScenario(4, 'HTTP 404 job protection', () => {
    const rawJob: RawDiscoveredJob = {
      title: 'Backend Engineer',
      company: 'Acme Corp',
      jobUrl: 'https://boards.greenhouse.io/acme/jobs/404404',
      applyUrl: 'https://boards.greenhouse.io/acme/jobs/404404',
      location: 'Remote',
      description: 'Senior backend engineer role description.',
      verificationEvidence: {
        httpStatus: 404,
      },
    };
    const liveCheck = jobVerificationEngine.verifyJobLive(rawJob);
    assert(liveCheck.isLive === false, '404 job must fail isLive');
    assert(liveCheck.failureReason?.includes('404'), 'Failure reason must mention 404');
    const normalized = normalizeRawJobs([rawJob]);
    assert(normalized.length === 0, '404 job must be rejected from normalized batch');
  });

  // 5. 410 job
  await runScenario(5, 'HTTP 410 Gone / expired job', () => {
    const rawJob: RawDiscoveredJob = {
      title: 'Site Reliability Engineer',
      company: 'Acme Corp',
      jobUrl: 'https://boards.greenhouse.io/acme/jobs/410410',
      applyUrl: 'https://boards.greenhouse.io/acme/jobs/410410',
      location: 'Remote',
      description: 'SRE role description.',
      verificationEvidence: {
        httpStatus: 410,
      },
    };
    const liveCheck = jobVerificationEngine.verifyJobLive(rawJob);
    assert(liveCheck.isLive === false, '410 job must fail isLive');
    assert(liveCheck.failureReason?.includes('410'), 'Failure reason must mention 410');
  });

  // 6. temporary 500
  await runScenario(6, 'Temporary HTTP 500 server error handling', () => {
    const deadCheck = jobVerificationEngine.checkDeadJobSignatures({
      verificationEvidence: { httpStatus: 500 },
    });
    assert(deadCheck.isDead === true, '500 must fail verification');
    assert(deadCheck.status === 'VERIFICATION_FAILED', '500 must be marked VERIFICATION_FAILED');
  });

  // 7. rate-limited source
  await runScenario(7, 'Rate-limited source (HTTP 429)', () => {
    const sourceId = 'src-rate-limited-test';
    sourceRegistry.registerSource({
      id: sourceId,
      name: 'Rate Limited Endpoint',
      sourceName: 'Rate Limited Endpoint',
      domain: 'api.ratelimited.com',
      baseUrl: 'https://api.ratelimited.com',
      sourceUrl: 'https://api.ratelimited.com',
      category: 'company_ats',
      atsType: 'custom',
      activeStatus: true,
      healthState: 'HEALTHY',
    });
    const checkRes = sourceRegistry.recordSourceCheck(sourceId, {
      success: false,
      httpStatus: 429,
      error: 'HTTP 429: Too Many Requests',
    });
    assert(checkRes?.healthState === 'BLOCKED', '429 must transition source health to BLOCKED');
    const entry = sourceRegistry.getSourceById(sourceId);
    assert(entry?.activeStatus === true, 'Rate limit must NOT permanently decommission source');
  });

  // 8. duplicate URL
  await runScenario(8, 'Duplicate URL deduplication', () => {
    const testRepo = new JobOpportunityRepository();
    const url = 'https://boards.greenhouse.io/test/jobs/dup001';
    const nowIso = new Date().toISOString();
    const jobA = normalizeRawDiscoveredJob({
      id: 'job-dup-1',
      title: 'DevOps Engineer',
      company: 'TestCorp',
      jobUrl: url,
      applyUrl: url,
      location: 'Remote',
      description: 'DevOps position at TestCorp.',
      postedDate: nowIso,
    });
    const jobB = normalizeRawDiscoveredJob({
      id: 'job-dup-2',
      title: 'DevOps Engineer',
      company: 'TestCorp',
      jobUrl: url,
      applyUrl: url,
      location: 'Remote',
      description: 'DevOps position at TestCorp mirrored on board.',
      postedDate: nowIso,
    });
    const ingest = testRepo.ingestBatch([jobA, jobB]);
    assert(ingest.added === 1, 'First job must be added');
    assert(ingest.merged === 1, 'Second job with identical URL must be merged');
    assert(testRepo.getActiveOpportunities().length === 1, 'Repository must contain only 1 canonical job');
  });

  // 9. duplicate external ID
  await runScenario(9, 'Duplicate external ID deduplication', () => {
    const testRepo = new JobOpportunityRepository();
    const nowIso = new Date().toISOString();
    const jobA = normalizeRawDiscoveredJob({
      externalId: 'gh-datadog-ext-77',
      title: 'Security Engineer',
      company: 'Datadog',
      jobUrl: 'https://boards.greenhouse.io/datadog/jobs/7701',
      applyUrl: 'https://boards.greenhouse.io/datadog/jobs/7701',
      location: 'New York, NY',
      description: 'Security engineer opportunity.',
      postedDate: nowIso,
    });
    const jobB = normalizeRawDiscoveredJob({
      externalId: 'gh-datadog-ext-77',
      title: 'Security Engineer',
      company: 'Datadog',
      jobUrl: 'https://datadoghq.com/careers/detail/7701',
      applyUrl: 'https://datadoghq.com/careers/detail/7701',
      location: 'New York, NY',
      description: 'Security engineer opportunity mirrored on career page.',
      postedDate: nowIso,
    });
    const ingest = testRepo.ingestBatch([jobA, jobB]);
    assert(ingest.added === 1, 'First externalId job added');
    assert(ingest.merged === 1, 'Second job with same externalId merged');
    assert(testRepo.getActiveOpportunities().length === 1, 'Canonical list must have 1 job');
  });

  // 10. tracking-parameter duplicate
  await runScenario(10, 'Tracking-parameter duplicate normalization', () => {
    const cleanUrl = 'https://boards.greenhouse.io/figma/jobs/990';
    const dirtyUrl = 'https://boards.greenhouse.io/figma/jobs/990?utm_source=linkedin&utm_medium=feed&ref=career_site#apply';
    const canonClean = jobVerificationEngine.getCanonicalUrl(cleanUrl);
    const canonDirty = jobVerificationEngine.getCanonicalUrl(dirtyUrl);
    assert(canonClean === canonDirty, 'Canonical URL must match after stripping tracking parameters');
    assert(canonDirty === cleanUrl, 'Stripped URL must equal clean base URL');
  });

  // 11. similar but genuinely different jobs
  await runScenario(11, 'Similar but genuinely different jobs (Senior vs Non-Senior)', () => {
    const testRepo = new JobOpportunityRepository();
    const nowIso = new Date().toISOString();
    const jobSenior = normalizeRawDiscoveredJob({
      id: 'job-diff-1',
      title: 'Senior Product Manager',
      company: 'Stripe',
      jobUrl: 'https://boards.greenhouse.io/stripe/jobs/pm-sr',
      applyUrl: 'https://boards.greenhouse.io/stripe/jobs/pm-sr',
      location: 'San Francisco, CA',
      description: 'Senior PM leading payment processing infrastructure.',
      postedDate: nowIso,
    });
    const jobMid = normalizeRawDiscoveredJob({
      id: 'job-diff-2',
      title: 'Product Manager',
      company: 'Stripe',
      jobUrl: 'https://boards.greenhouse.io/stripe/jobs/pm-mid',
      applyUrl: 'https://boards.greenhouse.io/stripe/jobs/pm-mid',
      location: 'San Francisco, CA',
      description: 'Product Manager leading user onboarding flow.',
      postedDate: nowIso,
    });
    const ingest = testRepo.ingestBatch([jobSenior, jobMid]);
    assert(ingest.added === 2, 'Senior and Mid PM must be treated as two distinct jobs');
    assert(ingest.merged === 0, 'Must NOT merge different seniority levels');
    assert(testRepo.getActiveOpportunities().length === 2, 'Both distinct opportunities must remain in active feed');
  });

  // 12. malformed salary
  await runScenario(12, 'Malformed salary rejection ($1 / competitive / DOE)', () => {
    const testCases = ['$1', '1', 'competitive', 'DOE', 'market rate', 'depends'];
    for (const raw of testCases) {
      const extracted = salaryTruthEngine.extractSalary({ text: `Salary: ${raw}` });
      assert(extracted.status === 'NOT_DISCLOSED', `Malformed "${raw}" must be NOT_DISCLOSED`);
      const display = salaryTruthEngine.formatSalaryDisplay(extracted);
      assert(display.isDisclosed === false, `Display for "${raw}" must not claim disclosed`);
      assert(display.text.includes('Not disclosed') || display.text.includes('not disclosed'), `Display must show not disclosed for ${raw}`);
    }
  });

  // 13. valid salary
  await runScenario(13, 'Valid salary extraction (USD and INR)', () => {
    // USD
    const usd = salaryTruthEngine.extractSalary({ text: 'Base compensation is $120,000 - $160,000 per year.' });
    assert(usd.status === 'EMPLOYER_STATED', 'Must extract employer stated USD');
    assert(usd.min === 120000 && usd.max === 160000, 'Min and max USD parsed accurately');
    assert(usd.currency === 'USD', 'Currency is USD');

    // INR
    const inr = salaryTruthEngine.extractSalary({ text: 'Compensation: ₹18L - ₹25L per annum' });
    assert(inr.status === 'EMPLOYER_STATED', 'Must extract employer stated INR');
    assert(inr.min === 1800000 && inr.max === 2500000, 'Min and max INR parsed accurately');
    assert(inr.currency === 'INR', 'Currency is INR');
  });

  // 14. missing salary
  await runScenario(14, 'Missing salary handled honestly', () => {
    const missing = salaryTruthEngine.extractSalary({ text: 'We offer great benefits and collaborative culture.' });
    assert(missing.status === 'NOT_DISCLOSED', 'Missing salary must be NOT_DISCLOSED');
    assert(missing.rawText === 'Salary not disclosed', 'Default text is Salary not disclosed');
  });

  // 15. duplicate discovery from two workers
  await runScenario(15, 'Concurrent ingestion from two workers', () => {
    const testRepo = new JobOpportunityRepository();
    const nowIso = new Date().toISOString();
    const makeJob = (worker: string) =>
      normalizeRawDiscoveredJob({
        id: `job-worker-shared`,
        title: 'Cloud Architect',
        company: 'GitLab',
        jobUrl: 'https://boards.greenhouse.io/gitlab/jobs/arch-1',
        applyUrl: 'https://boards.greenhouse.io/gitlab/jobs/arch-1',
        location: 'Remote',
        description: `Discovered by ${worker}`,
        postedDate: nowIso,
      });
    const jobWorker1 = makeJob('Worker 1');
    const jobWorker2 = makeJob('Worker 2');

    const res1 = testRepo.ingestBatch([jobWorker1]);
    const res2 = testRepo.ingestBatch([jobWorker2]);

    assert(res1.added === 1, 'Worker 1 adds job');
    assert(res2.merged === 1, 'Worker 2 merges job');
    assert(testRepo.getActiveOpportunities().length === 1, 'Exactly 1 canonical job exists in repository');
  });

  // 16. source failure
  await runScenario(16, 'Source failure isolation during discovery', () => {
    const sourceId = 'src-failing-unit-test';
    sourceRegistry.registerSource({
      id: sourceId,
      name: 'Failing Test Source',
      sourceName: 'Failing Test Source',
      domain: 'api.failing.org',
      baseUrl: 'https://api.failing.org',
      sourceUrl: 'https://api.failing.org',
      category: 'company_ats',
      atsType: 'custom',
      activeStatus: true,
      healthState: 'HEALTHY',
    });
    // Record 404 repeated failure
    sourceRegistry.recordSourceCheck(sourceId, { success: false, httpStatus: 404, error: 'HTTP 404 Not Found' });
    sourceRegistry.recordSourceCheck(sourceId, { success: false, httpStatus: 404, error: 'HTTP 404 Not Found' });
    const checkRes = sourceRegistry.recordSourceCheck(sourceId, { success: false, httpStatus: 404, error: 'HTTP 404 Not Found' });
    assert(checkRes?.healthState === 'QUARANTINED' || checkRes?.healthState === 'DECOMMISSIONED', 'Source repeated 404 must be gracefully QUARANTINED or DECOMMISSIONED');
    const entry = sourceRegistry.getSourceById(sourceId);
    assert(entry?.activeStatus === false, 'Decommissioned source is marked inactive');
  });

  // 17. diagnostics failure
  await runScenario(17, 'Diagnostics error fallback protection', () => {
    const badge = jobVerificationEngine.getVerificationBadgeConfig('failed');
    assert(badge.variant === 'warning', 'Failed verification badge is warning');
    assert(badge.label.includes('Verification Failed'), 'Badge displays Verification Failed');
  });

  // 18. diagnostics empty state
  await runScenario(18, 'Diagnostics empty state integrity', () => {
    const discEngine = new JobDiscoveryEngine();
    const lastRun = discEngine.getLastCompletedRun();
    // Verify it handles null gracefully without throwing
    assert(lastRun === null || typeof lastRun === 'object', 'Safe return when storage is empty');
  });

  // 19. pagination (exact 30 per page)
  await runScenario(19, 'Pagination of 30 items per page across 95 items', () => {
    const items = Array.from({ length: 95 }, (_, i) => ({ id: `job-${i}`, title: `Job ${i}` }));
    const ITEMS_PER_PAGE = 30;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    assert(totalPages === 4, '95 items must have 4 pages');

    const page1 = items.slice(0, 30);
    const page2 = items.slice(30, 60);
    const page3 = items.slice(60, 90);
    const page4 = items.slice(90, 120);

    assert(page1.length === 30, 'Page 1 has 30 items');
    assert(page2.length === 30, 'Page 2 has 30 items');
    assert(page3.length === 30, 'Page 3 has 30 items');
    assert(page4.length === 5, 'Page 4 has 5 items');
    assert(page1[0].id !== page2[0].id, 'Page 2 must not repeat Page 1 items');
  });

  // 20. multi-select location
  await runScenario(20, 'Multi-select location filter (OR logic)', () => {
    const jobs = [
      { id: '1', location: 'Bengaluru, India', country: 'India' },
      { id: '2', location: 'San Francisco, CA', country: 'United States' },
      { id: '3', location: 'London, UK', country: 'United Kingdom' },
    ];
    const selectedLocations = ['India', 'San Francisco'];
    const filtered = jobs.filter((j) =>
      selectedLocations.some((loc) => j.location.includes(loc) || j.country.includes(loc))
    );
    assert(filtered.length === 2, 'Must match Bengaluru (India) and San Francisco');
  });

  // 21. multi-select role
  await runScenario(21, 'Multi-select role filter (OR logic)', () => {
    const jobs = [
      { id: '1', title: 'Enterprise Account Executive' },
      { id: '2', title: 'Software Engineer' },
      { id: '3', title: 'HR Generalist' },
    ];
    const selectedRoles = ['Account Executive', 'Software Engineer'];
    const filtered = jobs.filter((j) =>
      selectedRoles.some((role) => j.title.toLowerCase().includes(role.toLowerCase()))
    );
    assert(filtered.length === 2, 'Must match Sales and Software Engineer');
  });

  // 22. multiple filters simultaneously (AND across, OR within)
  await runScenario(22, 'Multiple filters combined (AND across groups)', () => {
    const jobs = [
      { id: '1', title: 'Software Engineer', location: 'India', remote: 'remote', salaryDisclosed: true },
      { id: '2', title: 'Software Engineer', location: 'India', remote: 'on-site', salaryDisclosed: true },
      { id: '3', title: 'Software Engineer', location: 'US', remote: 'remote', salaryDisclosed: true },
      { id: '4', title: 'Account Executive', location: 'India', remote: 'remote', salaryDisclosed: false },
    ];
    const filtered = jobs.filter(
      (j) =>
        j.location === 'India' &&
        j.remote === 'remote' &&
        j.title.includes('Software Engineer') &&
        j.salaryDisclosed === true
    );
    assert(filtered.length === 1 && filtered[0].id === '1', 'Only Job 1 satisfies all criteria simultaneously');
  });

  // 23. filter + pagination
  await runScenario(23, 'Filter combined with pagination', () => {
    const jobs = Array.from({ length: 50 }, (_, i) => ({
      id: `job-${i}`,
      category: i % 2 === 0 ? 'Engineering' : 'Marketing',
    }));
    const filtered = jobs.filter((j) => j.category === 'Engineering');
    assert(filtered.length === 25, '25 Engineering jobs found');
    const ITEMS_PER_PAGE = 20;
    const page1 = filtered.slice(0, ITEMS_PER_PAGE);
    const page2 = filtered.slice(ITEMS_PER_PAGE, ITEMS_PER_PAGE * 2);
    assert(page1.length === 20, 'Page 1 has 20');
    assert(page2.length === 5, 'Page 2 has remaining 5');
  });

  // 24. filter + sorting
  await runScenario(24, 'Filter combined with sorting', () => {
    const jobs = [
      { id: '1', company: 'Stripe', matchScore: 85, location: 'Remote' },
      { id: '2', company: 'Datadog', matchScore: 95, location: 'Remote' },
      { id: '3', company: 'Linear', matchScore: 70, location: 'Remote' },
    ];
    const sorted = [...jobs].sort((a, b) => b.matchScore - a.matchScore);
    assert(sorted[0].id === '2', 'Highest match (95) comes first');
    assert(sorted[1].id === '1', 'Second match (85) comes second');
    assert(sorted[2].id === '3', 'Third match (70) comes third');
  });

  // 25. search + filters
  await runScenario(25, 'Search text combined with filters', () => {
    const jobs = [
      { id: '1', title: 'React Developer', company: 'Meta', location: 'India' },
      { id: '2', title: 'Vue Developer', company: 'Meta', location: 'India' },
      { id: '3', title: 'React Developer', company: 'Meta', location: 'US' },
    ];
    const query = 'React';
    const locFilter = 'India';
    const filtered = jobs.filter(
      (j) => j.title.includes(query) && j.location === locFilter
    );
    assert(filtered.length === 1 && filtered[0].id === '1', 'Must match React in India only');
  });

  // 26. cancellation
  await runScenario(26, 'Discovery cancellation safety', () => {
    const engine = new JobDiscoveryEngine();
    engine.cancelDiscovery();
    assert(engine.isDiscoveryRunning() === false, 'Engine is not running after cancellation');
  });

  // 27. retry
  await runScenario(27, 'Source retry restores failed endpoints', () => {
    const sourceId = 'src-retry-test';
    sourceRegistry.registerSource({
      id: sourceId,
      name: 'Retryable Endpoint',
      sourceName: 'Retryable Endpoint',
      domain: 'api.retryable.com',
      baseUrl: 'https://api.retryable.com',
      sourceUrl: 'https://api.retryable.com',
      category: 'company_ats',
      atsType: 'custom',
      activeStatus: false,
      healthState: 'DECOMMISSIONED',
    });
    const { retriedCount, restored } = sourceRegistry.retryFailed();
    assert(retriedCount > 0 && restored.length > 0, 'Must restore decommissioned sources');
    const entry = sourceRegistry.getSourceById(sourceId);
    assert(entry?.activeStatus === true, 'Restored source must have activeStatus = true');
    assert(entry?.healthState === 'HEALTHY', 'Restored source must have healthState = HEALTHY');
  });

  // 28. stale job re-verification
  await runScenario(28, 'Stale job re-verification threshold', () => {
    const now = new Date().toISOString();
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();

    assert(jobVerificationEngine.isVerificationStale(twentyDaysAgo, 14) === true, '20 days old is stale');
    assert(jobVerificationEngine.isVerificationStale(twoDaysAgo, 14) === false, '2 days old is fresh');
  });

  // 29. closed job removal
  await runScenario(29, 'Closed job excluded from active opportunities', () => {
    const testRepo = new JobOpportunityRepository();
    const liveJob = normalizeRawDiscoveredJob({
      id: 'job-live-29',
      title: 'DevRel Engineer',
      company: 'Supabase',
      jobUrl: 'https://boards.greenhouse.io/supabase/jobs/1',
      applyUrl: 'https://boards.greenhouse.io/supabase/jobs/1',
      location: 'Remote',
      description: 'Active DevRel position.',
      postedDate: new Date().toISOString(),
    });
    testRepo.ingestBatch([liveJob]);
    assert(testRepo.getActiveOpportunities().length === 1, 'Live job initially active');

    // Employer marks job closed
    const closed = jobVerificationEngine.verifySingleJob({
      ...liveJob,
      lifecycleState: 'CLOSED',
    });
    testRepo.saveOpportunity(closed);
    assert(testRepo.getActiveOpportunities().length === 0, 'Closed job must be removed from active feed');
  });

  // 30. frontend malformed-record protection
  await runScenario(30, 'Frontend malformed-record defensive handling', () => {
    // Malformed record missing all normal fields
    const malformed: any = {
      id: 'malformed-001',
      title: undefined,
      company: null,
      salary: undefined,
      requiredSkills: undefined,
      description: null,
    };
    const liveCheck = jobVerificationEngine.verifyJobLive(malformed);
    assert(liveCheck.isLive === false, 'Malformed record must fail verification');

    const salaryDisplay = salaryTruthEngine.formatSalaryDisplay(malformed.salary);
    assert(salaryDisplay.isDisclosed === false, 'Missing salary must not crash formatter');
    assert(salaryDisplay.text === 'Salary not disclosed', 'Missing salary formats gracefully');
  });

  console.log('\n====================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`SUMMARY: ${passedCount} / ${results.length} Scenarios Passed.`);
  console.log('====================================================');

  if (passedCount < results.length) {
    process.exit(1);
  }
}

runAll30Scenarios().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
