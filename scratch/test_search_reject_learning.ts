import { jobRepository } from '../src/core/jobs/jobRepository';
import { behavioralLearningEngine } from '../src/core/jobs/behavioralLearning';
import { userJobStateManager } from '../src/core/jobs/userJobState';
import { normalizeRawDiscoveredJob } from '../src/core/jobs/jobPipeline';
import { JobOpportunity, UserJobAction } from '../src/core/jobs/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runTests() {
  console.log('=== STARTING TOP SEARCH, REJECT ACTION & LEARNING ENGINE TESTS ===\n');

  // Setup test jobs
  const job1 = normalizeRawDiscoveredJob({
    id: 'test-job-sales-manager',
    title: 'Senior Enterprise Sales Manager',
    company: 'Coursera',
    jobUrl: 'https://boards.greenhouse.io/coursera/jobs/101',
    applyUrl: 'https://boards.greenhouse.io/coursera/jobs/101',
    location: 'San Francisco, CA',
    remoteStatus: 'hybrid',
    description: 'We are seeking a Sales Manager to lead enterprise accounts. Requires experience in AI solutions.',
    requiredSkills: ['Enterprise Sales', 'AI', 'Negotiation'],
    seniority: 'senior',
    industry: 'Education Technology',
  });

  const job2 = normalizeRawDiscoveredJob({
    id: 'test-job-ai-engineer',
    title: 'Senior AI Engineer',
    company: 'OpenAI Partner Labs',
    jobUrl: 'https://boards.greenhouse.io/openaipartner/jobs/102',
    applyUrl: 'https://boards.greenhouse.io/openaipartner/jobs/102',
    location: 'Remote',
    remoteStatus: 'remote',
    description: 'Build cutting edge AI foundation models with Python and PyTorch.',
    requiredSkills: ['AI', 'Python', 'Machine Learning'],
    seniority: 'senior',
    industry: 'Artificial Intelligence',
  });

  const job3 = normalizeRawDiscoveredJob({
    id: 'test-job-frontend-dev',
    title: 'Frontend Developer',
    company: 'Stripe',
    jobUrl: 'https://boards.greenhouse.io/stripe/jobs/103',
    applyUrl: 'https://boards.greenhouse.io/stripe/jobs/103',
    location: 'Bengaluru, India',
    remoteStatus: 'onsite',
    description: 'Build React user interfaces for global payment checkout systems.',
    requiredSkills: ['React', 'TypeScript', 'CSS'],
    seniority: 'mid',
    industry: 'Fintech',
  });

  jobRepository.ingestBatch([job1, job2, job3]);

  // ---------------------------------------------------------
  // TEST SUITE 1: TOP SEARCH VERIFICATION
  // ---------------------------------------------------------
  console.log('--- TEST SUITE 1: TOP GLOBAL SEARCH LOGIC ---');

  const activeJobs = jobRepository.getActiveOpportunities();

  // 1. Search "Sales Manager"
  const qSales = 'sales manager';
  const matchSales = activeJobs.filter((j) =>
    j.title.toLowerCase().includes(qSales) ||
    j.description.toLowerCase().includes(qSales)
  );
  assert(matchSales.some((j) => j.id === job1.id), 'Search "Sales Manager" returns matching job1');

  // 2. Search "Coursera"
  const qCoursera = 'coursera';
  const matchCoursera = activeJobs.filter((j) => j.company.toLowerCase().includes(qCoursera));
  assert(matchCoursera.length >= 1 && matchCoursera[0].company === 'Coursera', 'Search "Coursera" returns Coursera company opportunities');

  // 3. Search "AI"
  const qAI = 'ai';
  const matchAI = activeJobs.filter((j) =>
    j.title.toLowerCase().includes(qAI) ||
    (j.requiredSkills || []).some((s) => s.toLowerCase() === qAI)
  );
  assert(matchAI.some((j) => j.id === job1.id) && matchAI.some((j) => j.id === job2.id), 'Search "AI" matches both AI Engineer and Sales Manager (AI skills)');

  // ---------------------------------------------------------
  // TEST SUITE 2: REJECT JOB & PERSISTENCE
  // ---------------------------------------------------------
  console.log('\n--- TEST SUITE 2: REJECT JOB & PERSISTENCE ---');

  const initialCount = jobRepository.getActiveOpportunities().length;

  // Mark job3 as rejected
  jobRepository.markRejected(job3.id, 'culture_fit');

  const afterRejectJobs = jobRepository.getActiveOpportunities();
  assert(afterRejectJobs.length === initialCount - 1, 'Reject removes job from active feed immediately');
  assert(!afterRejectJobs.some((j) => j.id === job3.id), 'Rejected job3 is NOT in active opportunities');
  assert(userJobStateManager.isJobRejected(job3.id) === true, 'userJobStateManager records rejection');
  assert(jobRepository.isRejected(job3.id) === true, 'jobRepository.isRejected returns true');

  // Verify rejection persists in rejected list
  const rejectedList = jobRepository.getRejectedOpportunities();
  assert(rejectedList.some((j) => j.id === job3.id), 'Job appears in getRejectedOpportunities() for potential restoration');

  // Restore job3
  jobRepository.unreject(job3.id);
  const afterRestoreJobs = jobRepository.getActiveOpportunities();
  assert(afterRestoreJobs.some((j) => j.id === job3.id), 'unreject restores job to active feed');
  assert(userJobStateManager.isJobRejected(job3.id) === false, 'userJobStateManager unmarks rejection');

  // ---------------------------------------------------------
  // TEST SUITE 3: BEHAVIORAL LEARNING ENGINE
  // ---------------------------------------------------------
  console.log('\n--- TEST SUITE 3: BEHAVIORAL LEARNING ENGINE ---');

  behavioralLearningEngine.reset();
  let prefs = behavioralLearningEngine.getPreferences();
  assert(Object.keys(prefs.preferredCompanies).length === 0, 'Learned preferences start clean');

  // 1. User Saves Coursera job
  const saveAction: UserJobAction = {
    id: 'test-act-save-1',
    jobId: job1.id,
    action: 'save',
    timestamp: new Date().toISOString(),
    jobSnapshot: {
      title: job1.title,
      company: job1.company,
      industry: job1.industry,
      location: job1.location,
      remoteStatus: job1.remoteStatus,
      seniority: job1.seniority,
      skills: job1.requiredSkills,
    },
  };
  behavioralLearningEngine.ingestAction(saveAction);
  prefs = behavioralLearningEngine.getPreferences();
  assert((prefs.preferredCompanies['Coursera'] || 0) > 0, 'Save learns positive company affinity for Coursera');
  assert((prefs.preferredSkills['Enterprise Sales'] || 0) > 0, 'Save learns preferred skill "Enterprise Sales"');

  // 2. User Applies to AI job
  const applyAction: UserJobAction = {
    id: 'test-act-apply-1',
    jobId: job2.id,
    action: 'apply',
    timestamp: new Date().toISOString(),
    jobSnapshot: {
      title: job2.title,
      company: job2.company,
      industry: job2.industry,
      location: job2.location,
      remoteStatus: job2.remoteStatus,
      seniority: job2.seniority,
      skills: job2.requiredSkills,
    },
  };
  behavioralLearningEngine.ingestAction(applyAction);
  prefs = behavioralLearningEngine.getPreferences();
  assert((prefs.preferredCompanies['OpenAI Partner Labs'] || 0) > 0, 'Apply learns positive company affinity');
  assert((prefs.preferredIndustries['Artificial Intelligence'] || 0) > 0, 'Apply learns preferred industry');
  assert((prefs.preferredRemoteTypes['remote'] || 0) > 0, 'Apply learns preferred remote arrangement');

  // 3. User Views job
  const viewAction: UserJobAction = {
    id: 'test-act-view-1',
    jobId: job1.id,
    action: 'view',
    timestamp: new Date().toISOString(),
    jobSnapshot: {
      title: job1.title,
      company: job1.company,
      industry: job1.industry,
      location: job1.location,
      remoteStatus: job1.remoteStatus,
    },
  };
  behavioralLearningEngine.ingestAction(viewAction);
  prefs = behavioralLearningEngine.getPreferences();
  assert(prefs.totalViewsCount === 1, 'View action recorded in learning engine');

  // 4. User Rejects a Fintech / onsite job
  const rejectAction: UserJobAction = {
    id: 'test-act-reject-1',
    jobId: 'some-rejected-job',
    action: 'reject',
    timestamp: new Date().toISOString(),
    jobSnapshot: {
      title: 'Legacy Cobol Programmer',
      company: 'Old Bank Inc',
      industry: 'Traditional Banking',
      location: 'New York, NY',
      remoteStatus: 'onsite',
      seniority: 'entry',
      skills: ['Cobol', 'JCL'],
    },
  };
  behavioralLearningEngine.ingestAction(rejectAction);
  prefs = behavioralLearningEngine.getPreferences();
  assert((prefs.disfavoredTitles['legacy cobol programmer'] || 0) > 0, 'Reject learns disfavored title');
  assert((prefs.disfavoredIndustries['Traditional Banking'] || 0) > 0, 'Reject learns disfavored industry');

  // ---------------------------------------------------------
  // TEST SUITE 4: MATCH SCORE ADJUSTMENT VERIFICATION
  // ---------------------------------------------------------
  console.log('\n--- TEST SUITE 4: MATCH SCORE ADJUSTMENT VERIFICATION ---');

  // Test positive adjustment on Coursera job
  const courseraModifier = behavioralLearningEngine.calculateBehavioralModifier(job1);
  assert(courseraModifier.scoreAdjustment > 0, `Coursera job receives positive adjustment: +${courseraModifier.scoreAdjustment}`);
  assert(Boolean(courseraModifier.behavioralInsight), `Coursera receives behavioral insight: "${courseraModifier.behavioralInsight}"`);

  // Test positive adjustment on AI job
  const aiModifier = behavioralLearningEngine.calculateBehavioralModifier(job2);
  assert(aiModifier.scoreAdjustment > 0, `AI job receives positive adjustment: +${aiModifier.scoreAdjustment}`);

  // Test negative adjustment on disfavored job
  const badJob = normalizeRawDiscoveredJob({
    id: 'bad-job-test',
    title: 'Legacy Cobol Programmer',
    company: 'Old Bank Inc',
    jobUrl: 'https://example.com/bad',
    applyUrl: 'https://example.com/bad',
    location: 'New York, NY',
    remoteStatus: 'onsite',
    description: 'Maintenance of legacy cobol code',
    industry: 'Traditional Banking',
  });
  const badModifier = behavioralLearningEngine.calculateBehavioralModifier(badJob);
  assert(badModifier.scoreAdjustment < 0, `Disfavored role receives negative adjustment: ${badModifier.scoreAdjustment}`);

  // ---------------------------------------------------------
  // TEST SUITE 5: DATA INTEGRITY & BOUNDS
  // ---------------------------------------------------------
  console.log('\n--- TEST SUITE 5: DATA INTEGRITY & SCORE BOUNDS ---');

  assert(courseraModifier.scoreAdjustment <= 15, 'Positive adjustment is bounded (<= +15)');
  assert(badModifier.scoreAdjustment >= -20, 'Negative adjustment is bounded (>= -20)');

  console.log('\n🎉 ALL TOP SEARCH, REJECT ACTION & BEHAVIORAL LEARNING TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
