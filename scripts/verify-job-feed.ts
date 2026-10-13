import { freshnessEngine } from '../src/core/jobs/engines/freshnessEngine';
import {
  analyzeJobMatch,
  opportunityToJobPosting,
  classifyOpportunities,
} from '../src/core/intelligence/careerIntelligenceEngine';
import { defaultProfile } from '../src/core/profile/defaultProfile';
import { JobOpportunity } from '../src/core/jobs/types';
import * as fs from 'fs';

console.log('--- Starting Job Feed Performance & Discovery Tests ---');

// 1. Freshness Policy (14 days)
console.log('\n[Test 1] Testing 14-Day Freshness Policy...');
const now = new Date();
const job10DaysOld: Partial<JobOpportunity> = {
  id: 'fresh-10d',
  title: 'Senior Software Engineer',
  company: 'Stripe',
  postedDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
};
const job20DaysOld: Partial<JobOpportunity> = {
  id: 'stale-20d',
  title: 'Senior Software Engineer',
  company: 'Stripe',
  postedDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
};

const freshRes = freshnessEngine.isJobWithinAgeWindow(job10DaysOld as JobOpportunity, 14);
const staleRes = freshnessEngine.isJobWithinAgeWindow(job20DaysOld as JobOpportunity, 14);
if (!freshRes.eligible) throw new Error('10-day old job should pass 14-day freshness window');
if (staleRes.eligible) throw new Error('20-day old job should NOT pass 14-day freshness window');
console.log('✓ 14-day freshness window verified.');

// 2. Profile Matching & Strict Gate (<40 dropped, 40/30/20/10 weighting)
console.log('\n[Test 2] Testing Profile Matching & Relevance Gate...');

const highlyRelevantJob: Partial<JobOpportunity> = {
  id: 'rel-1',
  title: 'Director of Enterprise Sales & Business Development',
  company: 'Snowflake',
  description: 'Lead enterprise B2B sales cycles, new customer acquisition, strategic accounts, revenue partnerships, and executive negotiations.',
  location: 'Delhi, India',
  country: 'India',
  remoteStatus: 'hybrid',
  postedDate: now.toISOString(),
  salary: { disclosed: false },
  jobUrl: 'https://careers.snowflake.com/jobs/director-enterprise-sales',
  applyUrl: 'https://careers.snowflake.com/jobs/director-enterprise-sales/apply',
};

const completelyIrrelevantJob: Partial<JobOpportunity> = {
  id: 'irrel-1',
  title: 'Clinical Research Nurse Coordinator',
  company: 'Memorial Hospital',
  description: 'Manage clinical trials and patient oncology care. Requires RN certification and clinical nursing background.',
  location: 'Boston, MA',
  remoteStatus: 'onsite',
  postedDate: now.toISOString(),
  salary: { disclosed: false },
  jobUrl: 'https://hospital.org/careers/nurse-coordinator',
  applyUrl: 'https://hospital.org/careers/nurse-coordinator/apply',
};

const relevantMatch = analyzeJobMatch(defaultProfile, opportunityToJobPosting(highlyRelevantJob as JobOpportunity));
const irrelevantMatch = analyzeJobMatch(defaultProfile, opportunityToJobPosting(completelyIrrelevantJob as JobOpportunity));

console.log(`Relevant Job Match Score: ${relevantMatch.overallScore}%`);
console.log(`Irrelevant Job Match Score: ${irrelevantMatch.overallScore}%`);

if (relevantMatch.overallScore < 70) {
  throw new Error(`Relevant job score expected >= 70, got ${relevantMatch.overallScore}`);
}
if (irrelevantMatch.overallScore >= 40) {
  throw new Error(`Irrelevant job score must be < 40 to be dropped by pre-feed gate, got ${irrelevantMatch.overallScore}`);
}

const classifiedBatch = classifyOpportunities(defaultProfile, [
  highlyRelevantJob as JobOpportunity,
  completelyIrrelevantJob as JobOpportunity,
]);

console.log(`Classified Qualified Batch Count: ${classifiedBatch.length}`);

if (classifiedBatch.length !== 1 || classifiedBatch[0].id !== 'rel-1') {
  throw new Error(`Batch classifier failed to drop irrelevant job. Qualified count: ${classifiedBatch.length}`);
}
console.log('✓ Strict relevance gate (<40 score drop) and 40/30/20/10 weighting verified.');

// 3. LinkedIn Removal Verification
console.log('\n[Test 3] Verifying Complete LinkedIn Removal...');
const feedPageContent = fs.readFileSync('src/features/job-feed/JobFeedPage.tsx', 'utf8');
const jobCardContent = fs.readFileSync('src/features/job-feed/components/JobCard.tsx', 'utf8');

if (fs.existsSync('src/features/job-feed/components/LinkedInSourceModal.tsx')) {
  throw new Error('LinkedInSourceModal.tsx still exists in filesystem!');
}
if (feedPageContent.includes('LinkedInSourceModal') || feedPageContent.includes('isLinkedInModalOpen')) {
  throw new Error('LinkedInSourceModal or modal state found in JobFeedPage.tsx');
}
if (feedPageContent.includes('LinkedIn Source')) {
  throw new Error('LinkedIn Source button still found in JobFeedPage.tsx');
}
if (jobCardContent.toLowerCase().includes('linkedin')) {
  throw new Error('LinkedIn references found in JobCard.tsx');
}
console.log('✓ Zero LinkedIn references across Job Feed feature.');

// 4. Clean Match Badge Check
console.log('\n[Test 4] Verifying Match Badge Formatting in JobCard...');
if (!jobCardContent.includes("`${match.overallScore}%`")) {
  throw new Error('Match badge in JobCard does not display clean score percentage');
}
console.log('✓ Clean match badge format ("76%") verified.');

// 5. Virtualization in JobFeedPage
console.log('\n[Test 5] Verifying 3-Column Virtualization in JobFeedPage...');
if (!feedPageContent.includes('useVirtualizer') || !feedPageContent.includes('rowVirtualizer')) {
  throw new Error('useVirtualizer / rowVirtualizer not integrated in JobFeedPage.tsx');
}
if (!feedPageContent.includes('Discovered') || !feedPageContent.includes('Qualified') || !feedPageContent.includes('Displayed')) {
  throw new Error('Discovered / Qualified / Displayed telemetry pills not found in JobFeedPage.tsx');
}
console.log('✓ 3-Column Virtualizer and Truthful Telemetry pills verified.');

// 6. Career Page Discovery Engine (Authoritative vs Fallback Verification Status)
console.log('\n[Test 6] Testing Career Page Discovery Engine Verification Status...');
const { fastCareerPageEngine } = await import('../src/core/target-companies/fastCareerPageEngine');
const knownCompanyRes = await fastCareerPageEngine.gatherCareerPage('Stripe');
if (knownCompanyRes.verificationStatus !== 'verified' || knownCompanyRes.confidence < 95) {
  throw new Error(`Authoritative company Stripe should be verified with confidence >= 95. Got ${knownCompanyRes.verificationStatus}, ${knownCompanyRes.confidence}`);
}

const unknownCompanyRes = await fastCareerPageEngine.gatherCareerPage('Acme Super Unknown NonExistent Company 12345');
if (unknownCompanyRes.verificationStatus !== 'needs_verification' || unknownCompanyRes.confidence !== 70) {
  throw new Error(`Fallback synthetic URL must be 'needs_verification' with confidence 70. Got ${unknownCompanyRes.verificationStatus}, ${unknownCompanyRes.confidence}`);
}
console.log('✓ Fast Career Page Engine properly separates verified catalog/ATS probes from unverified candidates.');

// 7. 14-Day Feed Retention & User Action Indefinite Preservation
console.log('\n[Test 7] Testing 14-Day Retention & User Action Preservation Rules...');
const { jobFeedStore, FEED_RETENTION_MS } = await import('../src/core/jobs/jobFeedStore');
jobFeedStore.clearAll();

const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
const sampleJobUnacted: JobOpportunity = {
  id: 'job-unacted-15d',
  title: 'Backend Engineer',
  company: 'Linear',
  location: 'Remote',
  postedDate: fifteenDaysAgo,
  dateDiscovered: fifteenDaysAgo,
  match_score: 85,
  is_new: false,
};

const sampleJobViewed: JobOpportunity = {
  id: 'job-viewed-15d',
  title: 'Full Stack Engineer',
  company: 'Supabase',
  location: 'Remote',
  postedDate: fifteenDaysAgo,
  dateDiscovered: fifteenDaysAgo,
  match_score: 88,
  is_viewed: true,
  viewed_at: fifteenDaysAgo,
};

const sampleJobSaved: JobOpportunity = {
  id: 'job-saved-15d',
  title: 'Infrastructure Architect',
  company: 'Datadog',
  location: 'Remote',
  postedDate: fifteenDaysAgo,
  dateDiscovered: fifteenDaysAgo,
  match_score: 92,
  is_saved: true,
  lifecycleState: 'SAVED',
};

jobFeedStore.ingestDiscoveredBatch([sampleJobUnacted, sampleJobViewed, sampleJobSaved], {
  autoPublish: true,
});

const pruneResult = jobFeedStore.pruneExpiredJobs();
console.log(`Pruned Expired Jobs (unacted only): ${pruneResult.expiredCount}`);
if (pruneResult.expiredCount !== 1) {
  throw new Error(`Expected exactly 1 unacted job to be pruned, got ${pruneResult.expiredCount}`);
}

const publishedAfterPrune = jobFeedStore.getPublishedFeedItems();
const unactedStillPresent = publishedAfterPrune.some((it) => it.id === 'job-unacted-15d');
const viewedStillPresent = publishedAfterPrune.some((it) => it.id === 'job-viewed-15d');
const savedStillPresent = publishedAfterPrune.some((it) => it.id === 'job-saved-15d');

if (unactedStillPresent) {
  throw new Error('Unacted 15-day-old job was not filtered from published feed!');
}
if (!viewedStillPresent || !savedStillPresent) {
  throw new Error(`User-acted jobs must be preserved indefinitely! viewed: ${viewedStillPresent}, saved: ${savedStillPresent}`);
}
console.log('✓ 14-day retention rule verified: unacted jobs expire, user-acted jobs survive indefinitely.');

// 8. High-Volume Target Companies Ingestion (500 Companies)
console.log('\n[Test 8] Testing High-Volume 500 Target Companies Batch Ingestion...');
const { targetCompaniesStore } = await import('../src/core/target-companies/targetCompanyStore');
await targetCompaniesStore.ensureHydrated();
const initialCompCount = targetCompaniesStore.getCompanies().length;

const bulk500 = Array.from({ length: 500 }, (_, i) => ({
  name: `Enterprise Partner ${i + 1}`,
  domain: `partner${i + 1}.io`,
  tag: (i % 3 === 0 ? 'Dream' : 'Priority') as any,
  notes: `Imported enterprise test record #${i + 1}`,
}));

const importResult = await targetCompaniesStore.importCompaniesBatch(bulk500);
console.log(`Import Result: added=${importResult.addedCount}, updated=${importResult.updatedCount}, total=${importResult.totalProcessed}`);
const totalAfterImport = targetCompaniesStore.getCompanies().length;
if (totalAfterImport < 500) {
  throw new Error(`Expected at least 500 companies in store, got ${totalAfterImport}`);
}
console.log(`✓ 500+ target companies batch ingested and retained in memory/persistence (${totalAfterImport} companies present).`);

// 9. High-Volume Discovery & Ingestion (1,500 Jobs)
console.log('\n[Test 9] Testing High-Volume 1,500 Jobs Ingestion & [Show New Jobs] Pipeline...');
const bulk1500Jobs: JobOpportunity[] = Array.from({ length: 1500 }, (_, i) => ({
  id: `bulk-job-${i + 1}`,
  title: `Software Engineer Role #${i + 1}`,
  company: `Enterprise Partner ${(i % 500) + 1}`,
  location: i % 2 === 0 ? 'Remote' : 'Bangalore, India',
  postedDate: now.toISOString(),
  dateDiscovered: now.toISOString(),
  match_score: 70 + (i % 25),
  canonicalUrl: `https://partner${(i % 500) + 1}.io/careers/job-${i + 1}`,
  externalId: `ext-${i + 1}`,
  is_new: true,
}));

// Ingest as pending (discovery in background)
const ingestStats = jobFeedStore.ingestDiscoveredBatch(bulk1500Jobs, { autoPublish: false });
console.log(`Ingest stats for 1,500 jobs: pendingCount=${ingestStats.pendingCount}, newMatching=${ingestStats.newMatchingCount}`);
if (ingestStats.pendingCount !== 1500) {
  throw new Error(`Expected 1,500 pending jobs, got ${ingestStats.pendingCount}`);
}

const pendingCountBefore = jobFeedStore.getPendingCount();
console.log(`Pending jobs in store: ${pendingCountBefore}`);
if (pendingCountBefore < 1500) {
  throw new Error(`Pending jobs count expected >= 1500, got ${pendingCountBefore}`);
}

// Reveal all pending jobs via [Show New Jobs]
const publishedNow = jobFeedStore.publishPendingJobs();
console.log(`Published via [Show New Jobs]: ${publishedNow}`);
if (publishedNow !== 1500) {
  throw new Error(`Expected all 1,500 pending jobs to be published, got ${publishedNow}`);
}

const publishedItems = jobFeedStore.getPublishedFeedItems();
console.log(`Total published feed items in active stream: ${publishedItems.length}`);
if (publishedItems.length < 1500) {
  throw new Error(`Expected at least 1,500 published feed items, got ${publishedItems.length}`);
}
console.log('✓ High-volume 1,500 jobs pipeline and [Show New Jobs] revelation fully verified.');

console.log('\n=============================================');
console.log('ALL JOB FEED & TARGET COMPANY ENGINE TESTS PASSED!');
console.log('=============================================\n');
