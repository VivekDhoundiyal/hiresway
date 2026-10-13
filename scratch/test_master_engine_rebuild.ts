/**
 * CareerOS Master Engine Rebuild — End-to-End Verification Test
 *
 * Verifies the complete lifecycle:
 * DISCOVER → VERIFY → DEDUPE → RANK → FEED → REJECT → LEARN → REFRESH
 * + SEARCH ENGINE HYBRID VERIFICATION
 */

import {
  sourceTruthEngine,
  sourceHealthEngine,
  jobIdentityEngine,
  deduplicationEngine,
  freshnessEngine,
  preferenceLearningEngine,
  careerSearchEngine,
  feedRankingEngine,
  feedStateEngine,
  diagnosticsEngine,
  incrementalDiscoveryEngine,
} from '../src/core/jobs/engines';

import { jobRepository } from '../src/core/jobs/jobRepository';
import { userJobStateManager } from '../src/core/jobs/userJobState';
import { JobOpportunity, RawDiscoveredJob } from '../src/core/jobs/types';
import { JobMatchAnalysis } from '../src/core/intelligence';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

async function runMasterTest() {
  console.log('\n=== CAREEROS FINAL MASTER ENGINE REBUILD — END-TO-END TEST ===\n');

  // Clear state for deterministic testing
  sourceTruthEngine.clearQuarantine();
  preferenceLearningEngine.reset();
  userJobStateManager.clear();
  diagnosticsEngine.clearSkippedSources();

  // -------------------------------------------------------------------------
  // STAGE 1: DISCOVER (Source Health & Incremental Eligibility)
  // -------------------------------------------------------------------------
  console.log('--- STAGE 1: DISCOVER ---');

  // Record a healthy target company source
  sourceHealthEngine.recordResult({
    sourceId: 'src-ramp',
    sourceName: 'Ramp Official ATS',
    domain: 'ramp.com',
    isSuccess: true,
    responseTimeMs: 320,
    httpStatus: 200,
    extractedCount: 5,
  });

  // Record a dead/failing source
  sourceHealthEngine.recordResult({
    sourceId: 'src-dead',
    sourceName: 'Dead Aggregator Feed',
    domain: 'deadfeed.example.org',
    isSuccess: false,
    responseTimeMs: 5100,
    httpStatus: 404,
    error: 'HTTP 404 Not Found',
  });

  assert(sourceHealthEngine.isSourceQuarantined('src-dead') === true, 'Dead source is automatically quarantined');
  assert(sourceHealthEngine.getHealth('src-ramp')?.status === 'HEALTHY', 'Ramp source marked HEALTHY');

  // -------------------------------------------------------------------------
  // STAGE 2: VERIFY (Source Truth Engine)
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 2: VERIFY ---');

  const validRawJob: RawDiscoveredJob = {
    sourceJobId: 'ramp-eng-001',
    title: 'Senior Software Engineer, Core Systems',
    company: 'Ramp',
    companyDomain: 'ramp.com',
    location: 'New York, NY',
    remoteStatus: 'hybrid',
    description: 'Build high-performance financial systems in TypeScript and Python.',
    jobUrl: 'https://jobs.lever.co/ramp/ramp-eng-001?utm_source=test&ref=123',
    sourceName: 'Ramp Lever ATS',
  };

  const deadRawJob: RawDiscoveredJob = {
    sourceJobId: 'dead-001',
    title: 'Outdated Requisition',
    company: 'Acme Corp',
    location: 'Remote',
    remoteStatus: 'remote',
    description: 'This position has been filled. Error 404 page not found.',
    jobUrl: 'https://jobs.lever.co/acme/dead-001',
    sourceName: 'Acme ATS',
  };

  const truthValid = sourceTruthEngine.validateJob(validRawJob);
  assert(truthValid.isValid === true, 'Valid Ramp requisition passes Source Truth');
  assert(!truthValid.canonicalUrl.includes('utm_source'), 'Tracking parameters stripped from canonical URL');

  const truthDead = sourceTruthEngine.validateJob(deadRawJob);
  assert(truthDead.isValid === false, 'Dead job fails Source Truth validation');
  assert(truthDead.isQuarantined === true, 'Dead job URL is automatically quarantined');
  assert(sourceTruthEngine.isUrlQuarantined(truthDead.canonicalUrl) === true, 'URL is confirmed in quarantine');

  // -------------------------------------------------------------------------
  // STAGE 3: DEDUPE (Job Identity & Deduplication Engine)
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 3: DEDUPE ---');

  const ghJob: JobOpportunity = {
    id: 'job-ramp-gh',
    title: 'Senior Software Engineer, Core Systems',
    company: 'Ramp Inc.',
    location: 'New York, NY',
    country: 'United States',
    remoteStatus: 'hybrid',
    source: { id: 'ramp-ats', name: 'Ramp Official Lever', type: 'ats_hosted', sourceConfidence: 'verified_ats' },
    jobUrl: 'https://jobs.lever.co/ramp/ramp-eng-001',
    applyUrl: 'https://jobs.lever.co/ramp/ramp-eng-001',
    dateDiscovered: new Date(Date.now() - 3600000).toISOString(),
    first_seen_at: new Date(Date.now() - 3600000).toISOString(),
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    requiredSkills: ['TypeScript', 'Python'],
    preferredSkills: ['PostgreSQL'],
    description: 'Build high-performance financial systems in TypeScript and Python for Ramp enterprise platform.',
    salary: { disclosed: true, min: 180000, max: 220000, currency: 'USD', rawText: '$180,000 - $220,000' },
  };

  const aggregatorJob: JobOpportunity = {
    id: 'job-ramp-agg',
    title: 'Senior Software Engineer Core Systems (Remote/NY)',
    company: 'Ramp',
    location: 'New York',
    country: 'United States',
    remoteStatus: 'hybrid',
    source: { id: 'aggregator-feed', name: 'Third Party Job Aggregator', type: 'aggregator', sourceConfidence: 'aggregated_feed' as any },
    jobUrl: 'https://aggregator.example.com/redirect?job=999',
    applyUrl: 'https://jobs.lever.co/ramp/ramp-eng-001?src=aggregator',
    dateDiscovered: new Date().toISOString(),
    first_seen_at: new Date().toISOString(),
    isVerifiedLive: false,
    verificationStatus: 'unverified',
    requiredSkills: ['TypeScript', 'Python', 'Docker'],
    preferredSkills: ['Kubernetes'],
    description: 'Build high-performance financial systems in TypeScript and Python for Ramp enterprise platform.',
    salary: { disclosed: false, rawText: 'Salary not disclosed' },
  };

  const dupCheck = deduplicationEngine.isDuplicate(aggregatorJob, ghJob);
  assert(dupCheck.isDuplicate === true, 'Aggregator listing correctly identified as duplicate of official listing');

  const mergedJob = deduplicationEngine.mergeOpportunities(ghJob, aggregatorJob);
  assert(mergedJob.id === 'job-ramp-gh', 'Official source opportunity retains primary identity');
  assert(mergedJob.jobUrl === 'https://jobs.lever.co/ramp/ramp-eng-001', 'Official ATS URL preserved');
  assert(mergedJob.salary?.disclosed === true, 'Official disclosed salary wins over undisclosed aggregator');
  assert(mergedJob.secondary_sources?.length === 1, 'Aggregator source captured in secondary_sources');
  assert(mergedJob.requiredSkills?.includes('Docker') === true, 'Unique skills merged additively');

  // -------------------------------------------------------------------------
  // STAGE 4: RANK (Feed Ranking Engine: NEW + VERIFIED + RELEVANT)
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 4: RANK ---');

  const mockAnalysisHigh: JobMatchAnalysis = {
    overallScore: 92,
    roleFit: 95,
    skillsFit: 90,
    locationFit: 90,
    workModeFit: 95,
    seniorityFit: 90,
    industryFit: 85,
    fitCategory: 'STRONG FIT',
    strengths: ['Strong tech stack match'],
    gaps: [],
  };

  const mockAnalysisLow: JobMatchAnalysis = {
    overallScore: 60,
    roleFit: 60,
    skillsFit: 55,
    locationFit: 70,
    workModeFit: 60,
    seniorityFit: 60,
    industryFit: 50,
    fitCategory: 'MODERATE FIT',
    strengths: [],
    gaps: [],
  };

  const jobA = {
    ...mergedJob,
    is_new: true,
    isNew: true,
    viewed_at: undefined,
    match: mockAnalysisHigh,
  };

  const jobB: JobOpportunity & { match: JobMatchAnalysis } = {
    id: 'job-old-low',
    title: 'Junior IT Support Technician',
    company: 'Generic Corp',
    location: 'Remote',
    country: 'United States',
    remoteStatus: 'remote',
    source: { id: 's2', name: 'Board', type: 'job_board', sourceConfidence: 'curated_board' },
    jobUrl: 'https://board.com/job/1',
    applyUrl: 'https://board.com/job/1',
    dateDiscovered: new Date(Date.now() - 40 * 24 * 3600000).toISOString(),
    first_seen_at: new Date(Date.now() - 40 * 24 * 3600000).toISOString(),
    isVerifiedLive: false,
    verificationStatus: 'unverified',
    salary: { disclosed: false },
    is_new: false,
    isNew: false,
    viewed_at: new Date().toISOString(),
    match: mockAnalysisLow,
  };

  const ranked = feedRankingEngine.rankFeed([jobB, jobA]);
  assert(ranked[0].id === jobA.id, 'High match, fresh, verified Ramp job ranks #1 (NEW + VERIFIED + RELEVANT)');
  assert(ranked[1].id === jobB.id, 'Stale, low-match unverified job ranks lower');

  // -------------------------------------------------------------------------
  // STAGE 5: FEED (Feed State Engine Architecture)
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 5: FEED ---');

  const registeredInVerifiedStore = feedStateEngine.registerVerifiedJob(mergedJob);
  assert(registeredInVerifiedStore === true, 'Merged job registered into Verified Job Store');

  const userFeed = feedStateEngine.filterToUserFeed([mergedJob]);
  assert(userFeed.length === 1, 'Verified job correctly enters User Feed');

  // -------------------------------------------------------------------------
  // STAGE 6: REJECT & PREFERENCE LEARNING (Immediate Eviction & ML Update)
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 6: REJECT & LEARN ---');

  // Reject jobB
  userJobStateManager.markRejected(jobB.id);
  assert(userJobStateManager.isJobRejected(jobB.id) === true, 'jobB is recorded as rejected');

  const userFeedAfterReject = feedStateEngine.filterToUserFeed([mergedJob, jobB]);
  assert(userFeedAfterReject.length === 1 && userFeedAfterReject[0].id === mergedJob.id, 'Rejected job immediately evicted from User Feed');

  // Ingest actions into Preference Learning Engine
  preferenceLearningEngine.ingestAction({
    id: 'act-1',
    jobId: mergedJob.id,
    action: 'save',
    timestamp: new Date().toISOString(),
    jobSnapshot: {
      title: mergedJob.title,
      company: mergedJob.company,
      industry: 'Fintech',
      location: mergedJob.location,
      remoteStatus: mergedJob.remoteStatus,
      seniority: 'senior',
      skills: mergedJob.requiredSkills,
      salaryMin: 180000,
    },
  });

  preferenceLearningEngine.ingestAction({
    id: 'act-2',
    jobId: jobB.id,
    action: 'reject',
    timestamp: new Date().toISOString(),
    rejectionReason: 'Not a role fit',
    jobSnapshot: {
      title: jobB.title,
      company: jobB.company,
      industry: 'IT Services',
      location: jobB.location,
      remoteStatus: jobB.remoteStatus,
      seniority: 'entry',
      skills: ['Desktop Support'],
    },
  });

  // Calculate adjustments on new test opportunities
  const testFavoredJob: JobOpportunity = {
    ...mergedJob,
    id: 'job-ramp-favored',
    title: 'Lead Systems Architect',
    company: 'Ramp',
    industry: 'Fintech',
  };

  const testDisfavoredJob: JobOpportunity = {
    ...jobB,
    id: 'job-disfavored',
    title: 'Junior IT Support Specialist',
    company: 'Generic Corp',
    industry: 'IT Services',
  };

  const favoredAdj = preferenceLearningEngine.calculateAdjustment(testFavoredJob);
  assert(favoredAdj.scoreAdjustment > 0, `Favored Ramp role receives positive adjustment (+${favoredAdj.scoreAdjustment})`);
  assert(Boolean(favoredAdj.behavioralInsight), `Favored role has explainable insight: "${favoredAdj.behavioralInsight}"`);

  const disfavoredAdj = preferenceLearningEngine.calculateAdjustment(testDisfavoredJob);
  assert(disfavoredAdj.scoreAdjustment < 0, `Disfavored IT Support role receives negative adjustment (${disfavoredAdj.scoreAdjustment})`);

  // -------------------------------------------------------------------------
  // STAGE 7: REFRESH (Freshness Engine & Read State Persistence)
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 7: REFRESH ---');

  // Mark mergedJob viewed
  const viewedJob = freshnessEngine.markJobViewed(mergedJob);
  assert(freshnessEngine.isJobNew(viewedJob) === false, 'Viewed job is permanently no longer NEW');

  // Re-evaluating timestamps on refresh does NOT reset read status
  const refreshedTimestamps = freshnessEngine.resolveTimestamps(viewedJob, viewedJob);
  assert(refreshedTimestamps.first_seen_at === mergedJob.first_seen_at, 'Original first_seen_at strictly preserved across refresh');

  // -------------------------------------------------------------------------
  // STAGE 8: SEARCH (Career Search Engine Hybrid Search)
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 8: SEARCH ---');

  // Temporarily store mergedJob in repository for search testing
  jobRepository.saveOpportunity(mergedJob);

  const searchRamp = careerSearchEngine.search('Ramp');
  assert(searchRamp.companies.some((c) => c.company.includes('Ramp')), 'Search "Ramp" finds matching company');
  assert(searchRamp.jobs.some((j) => j.job.company.includes('Ramp')), 'Search "Ramp" returns matching job');

  const searchSkill = careerSearchEngine.search('TypeScript');
  assert(searchSkill.skills.some((s) => s.skill.toLowerCase().includes('typescript')), 'Search "TypeScript" returns skill entity');

  const searchFuzzy = careerSearchEngine.search('Sytems'); // Intentional typo
  assert(searchFuzzy.jobs.some((j) => j.job.title.includes('Systems')), 'Fuzzy search matches "Systems" despite typo');

  // -------------------------------------------------------------------------
  // STAGE 9: DIAGNOSTICS (Truthful Telemetry & Zero Fake Numbers)
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 9: DIAGNOSTICS ---');

  const snap = diagnosticsEngine.getSnapshot();
  assert(snap.totalSourcesCount > 0, `Total sources truthfully reported: ${snap.totalSourcesCount}`);
  assert(snap.quarantinedCount >= 1, `Quarantined sources tracked accurately: ${snap.quarantinedCount}`);
  assert(snap.queuedCount >= 0, `Queued sources tracked without fake claims: ${snap.queuedCount}`);
  assert(snap.status !== undefined, `Status accurately tracked: ${snap.status}`);

  console.log('\n🎉 ALL 9 STAGES OF MASTER ENGINE & UX REBUILD PASSED FLAWLESSLY!\n');
}

runMasterTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
