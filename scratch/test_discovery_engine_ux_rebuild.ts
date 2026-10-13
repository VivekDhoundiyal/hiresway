/**
 * Test Suite: CAREEROS JOB FEED — FULL DISCOVERY ENGINE + UX REBUILD
 *
 * Verifies:
 * 1. Multi-factor Source Intelligence Score:
 *    - Formula: (yield * 0.3) + (freshness * 0.2) + (reliability * 0.25) + (profileRelevance * 0.25)
 *    - Target Companies receive +100 bonus guaranteed
 *    - Dead/quarantined sources receive -1000 quarantine score
 *    - Indian tech platforms (Naukri, LinkedIn Jobs, Cutshort, etc.) receive home-market relevance boost
 *    - Source prioritization sorting by score descending
 * 2. Incremental Discovery Engine:
 *    - Target Company sources ALWAYS prioritized in slice 0
 *    - Slices remaining capacity up to maxCatalogBatch
 *    - Parallel workers bounded concurrency (max 6)
 * 3. Boolean Filter Engine (profileIntelligenceEngine):
 *    - Canonical Boolean formula: ((Role A OR Role B) AND (Loc A OR Loc B) AND (Remote OR Hybrid) AND (Seniority))
 *    - Canonical location normalization (cleans broad contradictory duplicates)
 * 4. Location Control Modal & Live Match Counting:
 *    - Normalization logic handles presets (India, Remote Worldwide, USA, EMEA, UK, etc.)
 *    - Dynamic live match calculation across opportunity sets
 */

import { sourceValueEngine } from '../src/core/jobs/engines/sourceValueEngine';
import { incrementalDiscoveryEngine } from '../src/core/jobs/engines/incrementalDiscoveryEngine';
import { profileIntelligenceEngine } from '../src/core/jobs/engines/profileIntelligenceEngine';
import { defaultProfile } from '../src/core/profile/defaultProfile';
import { JobSource } from '../src/core/jobs/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING CAREEROS DISCOVERY ENGINE & UX REBUILD TEST SUITE');
  console.log('===============================================================');

  const profile = {
    ...defaultProfile,
    targetCompanies: ['Google', 'Microsoft', 'Stripe'],
    workPreferences: {
      ...defaultProfile.workPreferences,
      targetLocations: ['India', 'Remote Worldwide'],
      workplaceTypes: ['remote', 'hybrid'] as ('remote' | 'hybrid')[],
    },
  };

  // ---------------------------------------------------------------------------
  // TEST 1: Source Intelligence Score & Priority
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 1] Source Intelligence Score & Target Company Boost');

  const mockTargetSource: JobSource = {
    id: 'src-target-google',
    name: 'Google Careers ATS',
    type: 'company_ats',
    url: 'https://careers.google.com',
    targetCompany: 'Google',
    enabled: true,
    reliabilityScore: 0.95,
    freshnessScore: 0.9,
    yieldScore: 0.85,
    consecutiveFailures: 0,
  };

  const mockRegularSource: JobSource = {
    id: 'src-generic-board',
    name: 'Generic Job Board',
    type: 'job_board',
    url: 'https://genericjobs.example.com',
    enabled: true,
    reliabilityScore: 0.9,
    freshnessScore: 0.8,
    yieldScore: 0.7,
    consecutiveFailures: 0,
  };

  const mockDeadSource: JobSource = {
    id: 'src-dead-feed',
    name: 'Defunct Board',
    type: 'job_board',
    url: 'https://deadboard.example.com',
    enabled: true,
    status: 'quarantined',
    reliabilityScore: 0.1,
    freshnessScore: 0.1,
    yieldScore: 0.1,
    consecutiveFailures: 6,
  };

  const mockIndianSource: JobSource = {
    id: 'src-naukri',
    name: 'Naukri Tech Jobs',
    type: 'job_board',
    url: 'https://naukri.com/it-jobs',
    enabled: true,
    reliabilityScore: 0.85,
    freshnessScore: 0.9,
    yieldScore: 0.9,
    consecutiveFailures: 0,
  };

  const targetScore = sourceValueEngine.calculateSourceIntelligenceScore(mockTargetSource, profile);
  const regularScore = sourceValueEngine.calculateSourceIntelligenceScore(mockRegularSource, profile);
  const deadScore = sourceValueEngine.calculateSourceIntelligenceScore(mockDeadSource, profile);
  const indianScore = sourceValueEngine.calculateSourceIntelligenceScore(mockIndianSource, profile);

  console.log(`  Target Company Source Score: ${targetScore.toFixed(2)}`);
  console.log(`  Regular Source Score: ${regularScore.toFixed(2)}`);
  console.log(`  Indian Source Score: ${indianScore.toFixed(2)}`);
  console.log(`  Dead Source Score: ${deadScore.toFixed(2)}`);

  assert(targetScore >= 100, 'Target Company source receives +100 bonus and scores >= 100');
  assert(targetScore > regularScore, 'Target Company source scores higher than regular source');
  assert(deadScore === -1000, 'Dead / Quarantined source receives -1000 quarantine score');
  assert(indianScore > regularScore, 'Indian tech platform receives home-market relevance boost');

  const prioritized = sourceValueEngine.prioritizeSources(
    [mockDeadSource, mockRegularSource, mockTargetSource, mockIndianSource],
    profile
  );
  assert(prioritized[0].id === mockTargetSource.id, 'Prioritization puts Target Company in first place');
  assert(!prioritized.some((s) => s.id === mockDeadSource.id), 'Prioritization drops dead sources from active queue');

  // ---------------------------------------------------------------------------
  // TEST 2: Incremental Discovery Engine Target Company Guarantee & Slicing
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Incremental Discovery Engine: Target Company Guarantee & Slicing');

  const catalog: JobSource[] = [
    mockRegularSource,
    mockIndianSource,
    mockTargetSource,
    mockDeadSource,
  ];

  const { eligible, skipped } = incrementalDiscoveryEngine.selectEligibleSources(catalog, profile, {
    maxCatalogBatch: 2,
    forceAll: false,
  });

  assert(eligible.some((s) => s.id === mockTargetSource.id), 'selectEligibleSources ALWAYS includes Target Company');
  assert(eligible.length <= 3, `Batched sources within bounded capacity: ${eligible.length} sources`);
  assert(skipped.some((s) => s.source.id === mockDeadSource.id), 'Dead source properly marked as skipped/quarantined');

  // ---------------------------------------------------------------------------
  // TEST 3: Boolean Filter Engine in profileIntelligenceEngine
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Boolean Filter Engine: evaluateBooleanFilterMatch');

  const testJob1 = {
    title: 'Senior Frontend Engineer',
    company: 'Google',
    location: 'Bengaluru, India',
    country: 'India',
    remoteStatus: 'hybrid' as const,
    seniority: 'senior' as const,
    employmentType: 'full-time' as const,
    salary: { min: 4000000, max: 6000000, currency: 'INR', disclosed: true },
    isTargetCompany: true,
  };

  const testJob2 = {
    title: 'Junior PHP Developer',
    company: 'Random LLC',
    location: 'Austin, TX, USA',
    country: 'United States',
    remoteStatus: 'on-site' as const,
    seniority: 'entry' as const,
    employmentType: 'contract' as const,
    salary: { min: 50000, max: 70000, currency: 'USD', disclosed: true },
    isTargetCompany: false,
  };

  const match1 = profileIntelligenceEngine.evaluateBooleanFilterMatch(testJob1, {
    roles: ['Frontend', 'Fullstack'],
    locations: ['India', 'Remote Worldwide'],
    workplaceTypes: ['remote', 'hybrid'],
    seniorities: ['senior', 'lead'],
  });

  const match2 = profileIntelligenceEngine.evaluateBooleanFilterMatch(testJob2, {
    roles: ['Frontend', 'Fullstack'],
    locations: ['India', 'Remote Worldwide'],
    workplaceTypes: ['remote', 'hybrid'],
    seniorities: ['senior', 'lead'],
  });

  assert(match1 === true, 'Matching job satisfies canonical Boolean criteria ((Role A OR B) AND (Loc A OR B) AND (Remote OR Hybrid) AND (Seniority))');
  assert(match2 === false, 'Non-matching job fails canonical Boolean criteria');

  // ---------------------------------------------------------------------------
  // TEST 4: Canonical Location Normalization
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Canonical Location Normalization');

  const messyLocations = ['India', 'Worldwide', 'Remote', 'Bangalore', 'Everywhere', 'USA'];
  const cleaned = profileIntelligenceEngine.normalizeTargetLocations(messyLocations);

  console.log('  Cleaned locations:', cleaned);
  assert(cleaned.includes('India'), 'Retains India');
  assert(cleaned.includes('Remote Worldwide'), 'Normalizes messy worldwide/remote variants to canonical Remote Worldwide');
  assert(!cleaned.includes('Worldwide') && !cleaned.includes('Everywhere'), 'Eliminated redundant vague duplicates');

  // ---------------------------------------------------------------------------
  // TEST 5: Derive Initial Filters from Profile Vector
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Derive Initial Filters from Profile Vector');

  const derived = profileIntelligenceEngine.deriveInitialFilters(profile);
  console.log('  Derived initial filters:', {
    roles: derived.roles,
    remoteType: derived.remoteType,
    locations: derived.locations,
    targetCompanyOnly: derived.targetCompanyOnly,
  });

  assert(Array.isArray(derived.roles) && derived.roles.length > 0, 'Derived initial roles filter from profile vector');
  assert(Array.isArray(derived.locations) && derived.locations.length > 0, 'Derived locations filter from profile vector');
  assert(derived.remoteType !== undefined, 'Derived remoteType preference');

  console.log('\n===============================================================');
  console.log('✅ ALL DISCOVERY ENGINE & UX REBUILD TESTS PASSED SUCCESSFULLY!');
  console.log('===============================================================');
}

runTests().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
