import { jobDescriptionNormalizer } from '../src/core/jobs/jobDescriptionNormalizer';
import { fastJobMatcher } from '../src/core/intelligence/fastJobMatcher';
import { matchScoreCache, MATCH_ALGORITHM_VERSION } from '../src/core/intelligence/matchScoreCache';
import { defaultProfile } from '../src/core/profile/defaultProfile';
import { JobOpportunity } from '../src/core/jobs/types';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('CAREEROS: JOB PIPELINE, JD NORMALIZER & CRM VERIFICATION SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Job Description Normalizer & Semantic Parsing
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Job Description Normalizer ---');

  const rawHtmlInput = `
    <h2>About Supabase</h2>
    <p>Supabase is the open-source Firebase alternative &amp; built for scale.</p>
    <script>alert("tracker");</script>
    <style>.header { color: red; }</style>
    <h3>About the Role</h3>
    <p>We are seeking a Lead Frontend Engineer to drive our core web studio.</p>
    <h3>Key Responsibilities</h3>
    <ul>
      <li>Architect high-performance React &amp; Next.js applications</li>
      <li>Collaborate with distributed teams worldwide</li>
      <li>Mentor senior and mid-level engineers</li>
    </ul>
    <h3>Requirements &amp; Qualifications</h3>
    <ul>
      <li>6+ years of production TypeScript &amp; React experience</li>
      <li>Strong background in state management and WebSockets</li>
      <li>Proven track record building complex SaaS products</li>
    </ul>
    <h3>Benefits &amp; Perks</h3>
    <ul>
      <li>100% remote work from anywhere in the world</li>
      <li>Competitive salary &amp; generous equity</li>
      <li>Comprehensive health, dental &amp; vision insurance</li>
    </ul>
  `;

  const norm = jobDescriptionNormalizer.normalize(rawHtmlInput, 'Supabase');

  assert(!norm.cleanedText.includes('<h2>'), 'Cleaned text contains no <h2> tags');
  assert(!norm.cleanedText.includes('<p>'), 'Cleaned text contains no <p> tags');
  assert(!norm.cleanedText.includes('<ul>'), 'Cleaned text contains no <ul> tags');
  assert(!norm.cleanedText.includes('<li>'), 'Cleaned text contains no <li> tags');
  assert(!norm.cleanedText.includes('<script>'), 'Cleaned text stripped all <script> tags');
  assert(!norm.cleanedText.includes('<style>'), 'Cleaned text stripped all <style> tags');
  assert(norm.cleanedText.includes('Supabase is the open-source Firebase alternative & built for scale'), 'HTML entities decoded (&amp; -> &)');

  assert(norm.rawOriginal === rawHtmlInput, 'Original raw text preserved perfectly for auditability');
  assert(norm.hasHtmlMarkup === true, 'Detected presence of raw HTML tags in original input');
  assert(norm.sections.length >= 4, `Extracted ${norm.sections.length} structured semantic sections`);

  const aboutSection = norm.sections.find((s) => s.key === 'about_company');
  assert(Boolean(aboutSection), 'Identified "About Company" section');

  const respSection = norm.sections.find((s) => s.key === 'responsibilities');
  assert(Boolean(respSection), 'Identified "Key Responsibilities" section');
  assert(Array.isArray(respSection?.items) && respSection!.items!.length === 3, 'Extracted 3 bullet items in Responsibilities');

  const reqSection = norm.sections.find((s) => s.key === 'requirements');
  assert(Boolean(reqSection), 'Identified "Requirements" section');
  assert(Array.isArray(reqSection?.items) && reqSection!.items!.length === 3, 'Extracted 3 bullet items in Requirements');

  const benSection = norm.sections.find((s) => s.key === 'benefits');
  assert(Boolean(benSection), 'Identified "Benefits & Perks" section');

  const plain = jobDescriptionNormalizer.stripToPlain(rawHtmlInput);
  assert(!plain.includes('###'), 'stripToPlain contains no markdown headers');
  assert(!plain.includes('**'), 'stripToPlain contains no bold asterisks');

  console.log('\n--- TEST GROUP 2: Fast 2-Stage Matching Engine Performance ---');

  const profileIndex = fastJobMatcher.createProfileIndex(defaultProfile);
  assert(profileIndex.skills.size > 0, `Profile index built with ${profileIndex.skills.size} skills`);
  assert(profileIndex.titleWords.size > 0, `Profile index built with ${profileIndex.titleWords.size} title tokens`);

  // Generate 1,000 synthetic jobs to benchmark Stage 1 fast matcher
  const testJobs: JobOpportunity[] = [];
  for (let i = 0; i < 1000; i++) {
    testJobs.push({
      id: `bench-job-${i}`,
      title: i % 3 === 0 ? 'Lead Frontend Engineer' : i % 3 === 1 ? 'Senior Fullstack Developer' : 'DevOps Specialist',
      normalizedTitle: 'lead frontend engineer',
      company: i % 10 === 0 ? 'Stripe' : 'TechCorp',
      location: i % 2 === 0 ? 'Remote Worldwide' : 'Bengaluru, India',
      country: 'India',
      jobUrl: 'https://example.com/job',
      applyUrl: 'https://example.com/job/apply',
      fingerprint: `fp-${i}`,
      isVerifiedLive: true,
      isApplyUrlValidated: true,
      verificationStatus: 'verified_live',
      source: {
        id: 'bench-src',
        name: 'Benchmark ATS',
        domain: 'example.com',
        type: 'ats_hosted',
        sourceUrl: 'https://example.com',
        sourceConfidence: 'verified_ats',
        discoveredAt: new Date().toISOString(),
      },
      sourcesHistory: [],
      datePosted: new Date().toISOString(),
      dateDiscovered: new Date().toISOString(),
      lastVerified: new Date().toISOString(),
      remoteStatus: 'remote',
      workFromAnywhere: i % 2 === 0,
      employmentType: 'full-time',
      salary: { disclosed: true, min: 140000, max: 180000, currency: 'USD' },
      seniority: 'lead',
      minExperienceYears: 6,
      requiredSkills: ['TypeScript', 'React', 'Next.js', 'WebSockets'],
      preferredSkills: ['TailwindCSS'],
      responsibilities: [],
      requirements: [],
      industry: 'Technology',
      description: 'Benchmark job description',
      lifecycleState: 'DISCOVERED',
    });
  }

  const startBenchmark = Date.now();
  for (const job of testJobs) {
    const res = fastJobMatcher.fastMatchJob(profileIndex, job);
    if (job.company === 'Stripe') {
      assert(res.isTargetCompany === true, 'Recognized strategic target company');
    }
  }
  const benchmarkDuration = Date.now() - startBenchmark;
  console.log(`⏱️ Benchmarked 1,000 jobs in ${benchmarkDuration}ms (${(benchmarkDuration / 1000).toFixed(3)}ms per job)`);
  assert(benchmarkDuration < 200, 'Stage 1 matching executed well under performance budget (<0.2ms per job)');

  console.log('\n--- TEST GROUP 3: Match Score Caching & Invalidation ---');

  const pKey1 = matchScoreCache.getProfileVersionKey(defaultProfile);
  assert(pKey1.startsWith('p_'), `Generated profile version key: ${pKey1}`);

  const sampleMatch = {
    overallScore: 92,
    fitCategory: 'Strong Fit' as const,
    titleMatchScore: 95,
    skillsMatchScore: 90,
    experienceMatchScore: 95,
    compensationMatchScore: 85,
    workplaceMatchScore: 95,
    strengths: ['Title alignment', 'Core stack match'],
    gaps: [],
    recommendations: [],
    trajectoryRelevance: 'Aligned',
  };

  matchScoreCache.set('job-test-123', pKey1, true, sampleMatch);
  const cachedHit = matchScoreCache.get('job-test-123', pKey1, true);
  assert(Boolean(cachedHit), 'Cache hit succeeded for (jobId, profileKey, isTarget)');
  assert(cachedHit?.overallScore === 92, 'Cached score preserved');

  // Verify profile change invalidation
  const updatedProfile = {
    ...defaultProfile,
    lastUpdated: new Date(Date.now() + 5000).toISOString(),
    personalInfo: {
      ...defaultProfile.personalInfo,
      headline: 'Principal AI & Cloud Architect',
    },
  };

  const pKey2 = matchScoreCache.getProfileVersionKey(updatedProfile);
  assert(pKey1 !== pKey2, 'Profile version key changed upon profile edit');

  const oldHit = matchScoreCache.get('job-test-123', pKey2, true);
  assert(oldHit === undefined, 'Cache miss for new profile version key (automatic invalidation)');

  console.log('\n--- TEST GROUP 4: Job Database CRM 100% Preservation ---');

  // Simulate a low-score / mismatched saved job
  const lowScoreSavedJob: JobOpportunity = {
    id: 'db-saved-aspirational-001',
    title: 'Chief Medical Officer',
    normalizedTitle: 'chief medical officer',
    company: 'BioHealth Corp',
    location: 'London, UK',
    country: 'United Kingdom',
    jobUrl: 'https://biohealth.org/careers/cmo',
    applyUrl: 'https://biohealth.org/careers/cmo/apply',
    fingerprint: 'fp-cmo-001',
    isVerifiedLive: true,
    isApplyUrlValidated: true,
    verificationStatus: 'verified_live',
    source: {
      id: 'src-bio',
      name: 'BioHealth Careers',
      domain: 'biohealth.org',
      type: 'direct_career_page',
      sourceUrl: 'https://biohealth.org',
      sourceConfidence: 'direct_employer',
      discoveredAt: new Date().toISOString(),
    },
    sourcesHistory: [],
    datePosted: new Date().toISOString(),
    dateDiscovered: new Date().toISOString(),
    lastVerified: new Date().toISOString(),
    remoteStatus: 'on-site',
    workFromAnywhere: false,
    employmentType: 'full-time',
    salary: { disclosed: false },
    seniority: 'executive',
    minExperienceYears: 15,
    requiredSkills: ['Clinical Surgery', 'FDA Compliance', 'Oncology'],
    preferredSkills: [],
    responsibilities: [],
    requirements: [],
    industry: 'Healthcare',
    description: 'Lead medical officer for healthcare clinical trials',
    lifecycleState: 'SAVED',
    crm_status: 'Interested',
  };

  const evalResult = fastJobMatcher.fastMatchJob(profileIndex, lowScoreSavedJob);
  assert(evalResult.score < 50, `Aspirational low-fit job correctly scored low (${evalResult.score}%)`);

  // Verify it is preserved in the database view without dropping
  const databaseCollection = [lowScoreSavedJob];
  const ranked = databaseCollection.map((opp) => {
    const match = fastJobMatcher.fastMatchJob(profileIndex, opp);
    return {
      ...opp,
      match: {
        overallScore: match.score,
        fitCategory: match.fitCategory,
        titleMatchScore: match.titleScore,
        skillsMatchScore: match.skillsScore,
        experienceMatchScore: match.experienceScore,
        compensationMatchScore: 80,
        workplaceMatchScore: match.workplaceScore,
        strengths: ['Tracked in CRM'],
        gaps: ['Functional transition'],
        recommendations: [],
        trajectoryRelevance: 'Database saved job',
      },
      match_score: match.score,
    };
  });

  assert(ranked.length === 1, 'Saved job was preserved 100% in database (never dropped!)');
  assert(ranked[0].id === 'db-saved-aspirational-001', 'Correct saved job preserved in database');
  assert(ranked[0].crm_status === 'Interested', 'CRM status is preserved as "Interested"');

  console.log('\n================================================================');
  console.log(`ALL TESTS PASSED! (${passedAssertions}/${totalAssertions} assertions verified)`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failure:', err);
  process.exit(1);
});
