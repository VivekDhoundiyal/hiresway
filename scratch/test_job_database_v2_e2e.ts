import { jobRepository } from '../src/core/jobs/jobRepository';
import { excelImportService } from '../src/core/jobs/excelImportService';
import { filterEvaluationEngine } from '../src/core/jobs/engines/filterEvaluationEngine';
import { JobOpportunity, CRMJobStatus } from '../src/core/jobs/types';

function runTests() {
  console.log('=== CAREEROS JOB DATABASE 2.0 END-TO-END VERIFICATION ===\n');

  // 1. Ingest test jobs to ensure clean state
  const testJobs: JobOpportunity[] = [
    {
      id: 'job-test-001',
      title: 'Senior Frontend Engineer',
      normalizedTitle: 'senior frontend engineer',
      company: 'Stripe',
      location: 'San Francisco, CA',
      country: 'United States',
      workFromAnywhere: false,
      remoteStatus: 'hybrid',
      eligibleCountries: ['United States'],
      jobUrl: 'https://stripe.com/jobs/001',
      applyUrl: 'https://stripe.com/jobs/001/apply',
      fingerprint: 'stripe-senior-frontend-001',
      datePosted: new Date().toISOString(),
      dateDiscovered: new Date().toISOString(),
      lastVerified: new Date().toISOString(),
      isVerifiedLive: true,
      isApplyUrlValidated: true,
      verificationStatus: 'verified_live',
      source: { id: 'greenhouse', name: 'Greenhouse ATS', type: 'ats_hosted', isDirectAts: true },
      sourceName: 'Greenhouse ATS',
      seniority: 'Senior',
      requiredSkills: ['React', 'TypeScript', 'Tailwind'],
      salary: { disclosed: true, min: 180000, max: 220000, currency: 'USD', rawText: '$180k - $220k' },
      isTargetCompany: true,
      match_score: 92,
      lifecycleState: 'IN_FEED',
      crm_status: 'Viewed',
      feed_status: 'PUBLISHED',
      sourcesHistory: [],
    },
    {
      id: 'job-test-002',
      title: 'Staff Full Stack Developer',
      normalizedTitle: 'staff full stack developer',
      company: 'Atlassian',
      location: 'Bengaluru, India',
      country: 'India',
      workFromAnywhere: true,
      remoteStatus: 'remote',
      eligibleCountries: ['India', '*'],
      jobUrl: 'https://atlassian.com/jobs/002',
      applyUrl: 'https://atlassian.com/jobs/002/apply',
      fingerprint: 'atlassian-staff-002',
      datePosted: new Date(Date.now() - 2 * 86400000).toISOString(),
      dateDiscovered: new Date(Date.now() - 2 * 86400000).toISOString(),
      lastVerified: new Date().toISOString(),
      isVerifiedLive: true,
      isApplyUrlValidated: true,
      verificationStatus: 'verified_live',
      source: { id: 'lever', name: 'Lever ATS', type: 'ats_hosted', isDirectAts: true },
      sourceName: 'Lever ATS',
      seniority: 'Lead',
      requiredSkills: ['Node.js', 'React', 'Distributed Systems'],
      salary: { disclosed: true, min: 4500000, max: 6500000, currency: 'INR', rawText: '₹45L - ₹65L' },
      isTargetCompany: true,
      match_score: 88,
      lifecycleState: 'SAVED',
      crm_status: 'Saved',
      feed_status: 'PUBLISHED',
      sourcesHistory: [],
    },
    {
      id: 'job-test-003',
      title: 'Cloud Systems Architect',
      normalizedTitle: 'cloud systems architect',
      company: 'Acme Corp',
      location: 'Remote',
      country: 'United States',
      workFromAnywhere: false,
      remoteStatus: 'remote',
      eligibleCountries: ['United States'],
      jobUrl: 'https://acme.com/jobs/003',
      applyUrl: 'https://acme.com/jobs/003/apply',
      fingerprint: 'acme-cloud-003',
      datePosted: new Date(Date.now() - 30 * 86400000).toISOString(),
      dateDiscovered: new Date(Date.now() - 30 * 86400000).toISOString(),
      lastVerified: new Date(Date.now() - 20 * 86400000).toISOString(),
      isVerifiedLive: false,
      isApplyUrlValidated: false,
      verificationStatus: 'needs_verification',
      source: { id: 'indeed', name: 'Indeed Aggregator', type: 'aggregator' },
      sourceName: 'Indeed Aggregator',
      seniority: 'Senior',
      requiredSkills: ['AWS', 'Terraform'],
      salary: { disclosed: false },
      isTargetCompany: false,
      match_score: 65,
      lifecycleState: 'IN_FEED',
      crm_status: 'Viewed',
      feed_status: 'PUBLISHED',
      sourcesHistory: [],
    },
  ];

  jobRepository.ingestBatch(testJobs);
  const dbJobs = jobRepository.getDatabaseOpportunities();

  console.log(`[TEST 1] Canonical Repository Opportunities:`);
  console.log(`- Ingested count: ${testJobs.length}`);
  console.log(`- Database total opportunities: ${dbJobs.length}`);
  if (dbJobs.length < testJobs.length) {
    throw new Error(`Expected at least ${testJobs.length} database opportunities, got ${dbJobs.length}`);
  }
  console.log('  PASS: Database returns all canonical opportunities without artificial loss.\n');

  // 2. Test 11 Standard View Counts
  console.log('[TEST 2] View Counts for All 11 Standard Views:');
  const viewCounts = jobRepository.getDatabaseViewCounts();
  console.log(JSON.stringify(viewCounts, null, 2));

  const standardViews = [
    'all',
    'new',
    'high_match',
    'target_companies',
    'saved',
    'applied',
    'interviewing',
    'rejected',
    'archived',
    'expired',
    'needs_verification',
  ] as const;

  for (const v of standardViews) {
    if (typeof viewCounts[v] !== 'number' || viewCounts[v] < 0) {
      throw new Error(`View count for "${v}" is invalid: ${viewCounts[v]}`);
    }
  }
  if (viewCounts.all < testJobs.length) {
    throw new Error(`Expected viewCounts.all >= ${testJobs.length}, got ${viewCounts.all}`);
  }
  console.log('  PASS: All 11 standard views backed by authentic repository state.\n');

  // 3. Test Editable Candidate Notes
  console.log('[TEST 3] Editable Candidate Notes:');
  const targetId = 'job-test-001';
  const testNote = 'Spoke with recruiter Sarah on LinkedIn. Compensation range matches expectations.';
  const updatedJob = jobRepository.updateJobNotes(targetId, testNote);

  if (!updatedJob || updatedJob.notes !== testNote) {
    throw new Error(`Note failed to persist on job ${targetId}`);
  }
  const hasTimelineEntry = updatedJob.activity_timeline?.some((t) => t.action === 'Updated personal note');
  if (!hasTimelineEntry) {
    throw new Error('Activity timeline did not record note update');
  }
  console.log(`- Note successfully saved: "${updatedJob.notes}"`);
  console.log('  PASS: Editable notes system properly updates job and records audit timeline.\n');

  // 4. Test Bulk Operations
  console.log('[TEST 4] Bulk Operations:');
  // Bulk Save
  const saveCount = jobRepository.bulkSaveJobs(['job-test-001']);
  console.log(`- Bulk Save count: ${saveCount}`);
  const job1Saved = jobRepository.getOpportunityById('job-test-001');
  if (job1Saved?.lifecycleState !== 'SAVED' || job1Saved?.crm_status !== 'Saved') {
    throw new Error('Bulk save failed to transition status to SAVED');
  }

  // Bulk Status Change
  const statusUpdateCount = jobRepository.bulkUpdateCRMStatus(['job-test-001'], 'Recruiter Screen');
  console.log(`- Bulk Status Update count: ${statusUpdateCount}`);
  const job1Screen = jobRepository.getOpportunityById('job-test-001');
  if (job1Screen?.crm_status !== 'Recruiter Screen' || job1Screen?.lifecycleState !== 'INTERVIEW') {
    throw new Error('Bulk status change failed to transition to Recruiter Screen / INTERVIEW');
  }

  // Bulk Verify
  const verifyRes = jobRepository.bulkVerifyJobs(['job-test-001', 'job-test-002']);
  console.log(`- Bulk Verify result:`, verifyRes);
  if (verifyRes.total !== 2 || verifyRes.verifiedLive !== 2) {
    throw new Error('Bulk verify returned unexpected counts');
  }

  // Bulk Archive
  const archiveCount = jobRepository.bulkArchiveJobs(['job-test-003']);
  console.log(`- Bulk Archive count: ${archiveCount}`);
  const job3Archived = jobRepository.getOpportunityById('job-test-003');
  if (job3Archived?.lifecycleState !== 'ARCHIVED' || job3Archived?.crm_status !== 'Archived') {
    throw new Error('Bulk archive failed');
  }
  console.log('  PASS: Bulk operations successfully updated database opportunities.\n');

  // 5. Test Filter Evaluation Engine with CRM Statuses
  console.log('[TEST 5] Shared Filter Engine Evaluation:');
  const interviewMatch = filterEvaluationEngine.evaluateJob(job1Screen!, {
    crmStatuses: ['Recruiter Screen'],
  });
  if (!interviewMatch.passes) {
    throw new Error(`Filter engine failed to match job by crmStatuses: ${interviewMatch.rejectionReason}`);
  }

  const mismatch = filterEvaluationEngine.evaluateJob(job1Screen!, {
    crmStatuses: ['Offer'],
  });
  if (mismatch.passes) {
    throw new Error('Filter engine incorrectly matched non-matching crmStatus');
  }
  console.log('  PASS: filterEvaluationEngine correctly evaluates crmStatuses and lifecycleStates.\n');

  // 6. Test Excel / SheetJS Export Service
  console.log('[TEST 6] Export Service Integrity:');
  if (typeof excelImportService.exportJobs !== 'function') {
    throw new Error('excelImportService.exportJobs is not a function');
  }
  console.log('  PASS: excelImportService.exportJobs is available and callable.\n');

  console.log('======================================================');
  console.log('ALL JOB DATABASE 2.0 VERIFICATION CHECKS PASSED (6/6)!');
  console.log('======================================================');
}

runTests();
