/**
 * CareerOS Emergency Optimization & Master Discovery Engine Verification Test Suite
 *
 * Validates:
 * 1. Source Value Engine (4 Tiers: Tier 1, 2, 3, 4)
 * 2. Source Fingerprint Algorithm & Strategy Caching
 * 3. Authoritative Discovery Ledger (Mathematical Reconciliation & Zero Fake Numbers)
 * 4. Incremental & Continuous Discovery Engine (4 States: DISCOVER, DISCOVERING, PAUSED, ERROR)
 * 5. Full Source Coverage (India Platforms + Indian Tech Companies + Global ATS = 1,248 sources)
 * 6. 5-Option Source Management Registration
 */

import { sourceValueEngine, SourceTier } from '../src/core/jobs/engines/sourceValueEngine';
import { sourceFingerprintEngine } from '../src/core/jobs/engines/sourceFingerprintEngine';
import { discoveryLedgerEngine } from '../src/core/jobs/engines/discoveryLedgerEngine';
import { incrementalDiscoveryEngine } from '../src/core/jobs/engines/incrementalDiscoveryEngine';
import { sourceRegistry } from '../src/core/jobs/sourceRegistry';
import { jobRepository } from '../src/core/jobs/jobRepository';
import { sourceTruthEngine } from '../src/core/jobs/engines/sourceTruthEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('CAREEROS EMERGENCY DISCOVERY ENGINE VERIFICATION');
  console.log('===============================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: SOURCE VALUE ENGINE (4 TIERS)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Source Value Engine (4 Tiers) ---');
  
  // Tier 1: ATS / Direct
  const ghSource = {
    id: 'gh-stripe',
    name: 'Stripe Careers',
    domain: 'stripe.com',
    sourceUrl: 'https://boards.greenhouse.io/stripe',
    category: 'company_ats' as const,
    activeStatus: true,
    extractionStrategy: 'greenhouse_ats',
  };
  const t1 = sourceValueEngine.evaluateTier(ghSource);
  assert(t1 === 'TIER_1_HIGH_VALUE', `Greenhouse source classified as TIER_1_HIGH_VALUE (got ${t1})`);

  // Tier 2: Established Job Board
  const jbSource = {
    id: 'jb-naukri',
    name: 'Naukri India',
    domain: 'naukri.com',
    sourceUrl: 'https://www.naukri.com/tech-jobs',
    category: 'regional_portal' as const,
    activeStatus: true,
    extractionStrategy: 'naukri_api',
  };
  const t2 = sourceValueEngine.evaluateTier(jbSource);
  assert(t2 === 'TIER_2_USEFUL', `Naukri India classified as TIER_2_USEFUL (got ${t2})`);

  // Tier 4: Dead / Quarantined
  const deadSource = {
    id: 'dead-source',
    name: 'Old Dead Page',
    domain: 'defunct.example.org',
    sourceUrl: 'https://defunct.example.org/jobs',
    category: 'major_aggregator' as const,
    activeStatus: true,
    extractionStrategy: 'web_scrape_fallback',
    consecutiveFailures: 5,
  };
  const t4 = sourceValueEngine.evaluateTier(deadSource);
  assert(t4 === 'TIER_4_DEAD', `5-consecutive-failures source classified as TIER_4_DEAD (got ${t4})`);

  // Custom Override
  sourceValueEngine.setManualOverride('custom-src-1', 'TIER_1_HIGH_VALUE');
  const customTier = sourceValueEngine.getTier({
    id: 'custom-src-1',
    name: 'Custom',
    domain: 'custom.com',
    sourceUrl: 'https://custom.com/jobs',
    category: 'major_aggregator',
    activeStatus: true,
    extractionStrategy: 'web_scrape_fallback',
  });
  assert(customTier === 'TIER_1_HIGH_VALUE', 'Custom manual override correctly returns TIER_1_HIGH_VALUE');

  // Catalog Tier Stats
  const catalogStats = sourceValueEngine.getCatalogTierStats();
  assert(catalogStats.tier1 > 0, `Catalog contains Tier 1 sources: ${catalogStats.tier1}`);
  assert(catalogStats.tier2 > 0, `Catalog contains Tier 2 sources: ${catalogStats.tier2}`);
  console.log(`  Tier distribution: Tier 1: ${catalogStats.tier1}, Tier 2: ${catalogStats.tier2}, Tier 3: ${catalogStats.tier3}, Tier 4: ${catalogStats.tier4}`);

  // ---------------------------------------------------------------------------
  // TEST 2: SOURCE FINGERPRINT ENGINE & STRATEGY CACHING
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Source Fingerprint Algorithm & Strategy Caching ---');

  const fp1 = sourceFingerprintEngine.generateFingerprint({
    domain: 'boards.greenhouse.io',
    endpointUrl: 'https://boards.greenhouse.io/airbnb/jobs',
    atsType: 'greenhouse',
  });
  assert(fp1.includes('GREENHOUSE_API'), `Fingerprint generated with platform signature: ${fp1}`);

  const fpAshby = sourceFingerprintEngine.generateFingerprint({
    domain: 'jobs.ashbyhq.com',
    endpointUrl: 'https://jobs.ashbyhq.com/openai',
    atsType: 'ashby',
  });
  assert(fpAshby.includes('ASHBY_API'), `Ashby fingerprint resolves correctly: ${fpAshby}`);

  const strategy = sourceFingerprintEngine.resolveStrategy({
    id: 'gh-test',
    name: 'Airbnb',
    domain: 'boards.greenhouse.io',
    sourceUrl: 'https://boards.greenhouse.io/airbnb/jobs',
    category: 'company_ats',
    activeStatus: true,
    extractionStrategy: 'greenhouse_ats',
    atsType: 'greenhouse',
  });
  assert(strategy.patternType === 'GREENHOUSE_API', 'Resolved strategy patternType === GREENHOUSE_API');

  // Cache hit test
  sourceFingerprintEngine.learnStrategy(fp1, strategy);
  const cachedStrategy = sourceFingerprintEngine.resolveStrategy({
    id: 'gh-test-2',
    name: 'Stripe',
    domain: 'boards.greenhouse.io',
    sourceUrl: 'https://boards.greenhouse.io/stripe/jobs',
    category: 'company_ats',
    activeStatus: true,
    extractionStrategy: 'greenhouse_ats',
  });
  assert(cachedStrategy.patternType === 'GREENHOUSE_API', 'Cached extraction strategy retrieved by fingerprint');

  // ---------------------------------------------------------------------------
  // TEST 3: TELEMETRY TRUTH (AUTHORITATIVE EVENT LEDGER)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Telemetry Truth & Mathematical Reconciliation ---');

  discoveryLedgerEngine.initRun('test-run-101', 10, 1248);
  
  // Record 3 successes
  discoveryLedgerEngine.markSuccess({
    sourceId: 'src-1',
    sourceName: 'Source 1',
    domain: 'source1.com',
    durationMs: 250,
    jobsDiscovered: 15,
    jobsVerified: 10,
    duplicates: 2,
    rejectedDead: 3,
  });

  discoveryLedgerEngine.markSuccess({
    sourceId: 'src-2',
    sourceName: 'Source 2',
    domain: 'source2.com',
    durationMs: 310,
    jobsDiscovered: 8,
    jobsVerified: 5,
    duplicates: 1,
    rejectedDead: 2,
  });

  discoveryLedgerEngine.markSuccess({
    sourceId: 'src-3',
    sourceName: 'Source 3',
    domain: 'source3.com',
    durationMs: 180,
    jobsDiscovered: 12,
    jobsVerified: 12,
    duplicates: 0,
    rejectedDead: 0,
  });

  // Record 2 failures
  discoveryLedgerEngine.markFailed({
    sourceId: 'src-4',
    sourceName: 'Source 4',
    domain: 'source4.com',
    durationMs: 400,
    failureReason: '404 Endpoint Not Found',
    httpStatus: 404,
  });

  discoveryLedgerEngine.markFailed({
    sourceId: 'src-5',
    sourceName: 'Source 5',
    domain: 'source5.com',
    durationMs: 1200,
    failureReason: 'Gateway Timeout (504)',
    httpStatus: 504,
  });

  // Record 1 quarantine and 1 backoff
  discoveryLedgerEngine.markQuarantined({
    sourceId: 'src-6',
    sourceName: 'Source 6',
    domain: 'source6.com',
    reason: 'Repeated 404s',
  });

  discoveryLedgerEngine.markBackoff({
    sourceId: 'src-7',
    sourceName: 'Source 7',
    domain: 'source7.com',
    remainingSeconds: 60,
  });

  const tel = discoveryLedgerEngine.getReconciledTelemetry(1248);

  // Exact Mathematical Invariant 1: sourcesChecked === sourcesSuccess + sourcesFailed
  assert(
    tel.sourcesChecked === tel.sourcesSuccess + tel.sourcesFailed,
    `Sources check invariant: ${tel.sourcesChecked} === ${tel.sourcesSuccess} + ${tel.sourcesFailed}`
  );
  assert(tel.sourcesSuccess === 3, `sourcesSuccess === 3 (got ${tel.sourcesSuccess})`);
  assert(tel.sourcesFailed === 2, `sourcesFailed === 2 (got ${tel.sourcesFailed})`);
  assert(tel.sourcesChecked === 5, `sourcesChecked === 5 (got ${tel.sourcesChecked})`);

  // Exact Mathematical Invariant 2: jobsDiscovered === jobsVerified + duplicatesRemoved + deadJobsRejected
  assert(
    tel.jobsDiscovered === tel.jobsVerified + tel.duplicatesRemoved + tel.deadJobsRejected,
    `Jobs check invariant: ${tel.jobsDiscovered} === ${tel.jobsVerified} + ${tel.duplicatesRemoved} + ${tel.deadJobsRejected}`
  );
  assert(tel.jobsDiscovered === 35, `jobsDiscovered === 35 (15 + 8 + 12)`);
  assert(tel.jobsVerified === 27, `jobsVerified === 27 (10 + 5 + 12)`);
  assert(tel.duplicatesRemoved === 3, `duplicatesRemoved === 3 (2 + 1 + 0)`);
  assert(tel.deadJobsRejected === 5, `deadJobsRejected === 5 (3 + 2 + 0)`);

  // Check failed sources audit list
  const failedList = discoveryLedgerEngine.getFailedSources();
  assert(failedList.length === 2, `Failed sources list count === 2 (got ${failedList.length})`);
  assert(failedList[0].failureReason.includes('404'), 'Failed source recorded 404 reason correctly');

  // Check skipped sources audit list
  const skippedList = discoveryLedgerEngine.getSkippedSources();
  assert(skippedList.length === 2, `Skipped sources list count === 2 (got ${skippedList.length})`);

  // ---------------------------------------------------------------------------
  // TEST 4: INCREMENTAL & CONTINUOUS DISCOVERY ENGINE (4 BUTTON STATES)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Incremental & Continuous Loop Controller ---');

  // Verify initial state
  assert(incrementalDiscoveryEngine.getState() === 'DISCOVER', 'Initial continuous state is DISCOVER');

  // Track state transitions via subscription
  const stateTransitions: string[] = [];
  const unsubState = incrementalDiscoveryEngine.subscribeState((st) => {
    stateTransitions.push(st);
  });

  // Start continuous loop
  incrementalDiscoveryEngine.startContinuousLoop();
  assert(incrementalDiscoveryEngine.getState() === 'DISCOVERING', 'State transitions to DISCOVERING on start');
  assert(incrementalDiscoveryEngine.isDiscoveryRunning() === true, 'isDiscoveryRunning() returns true');

  // Pause continuous loop
  const jobsBeforePause = jobRepository.getActiveOpportunities().length;
  incrementalDiscoveryEngine.pauseLoop();
  assert(incrementalDiscoveryEngine.getState() === 'PAUSED', 'State transitions to PAUSED on pauseLoop');
  const jobsAfterPause = jobRepository.getActiveOpportunities().length;
  assert(jobsBeforePause === jobsAfterPause, 'Pausing loop does NOT wipe existing feed jobs');

  // Resume continuous loop
  incrementalDiscoveryEngine.resumeLoop();
  assert(incrementalDiscoveryEngine.getState() === 'DISCOVERING', 'State transitions back to DISCOVERING on resumeLoop');

  // Stop loop
  incrementalDiscoveryEngine.stopLoop();
  assert(incrementalDiscoveryEngine.getState() === 'DISCOVER', 'State transitions to DISCOVER on stopLoop');

  unsubState();
  assert(stateTransitions.includes('DISCOVERING'), 'Recorded DISCOVERING transition');
  assert(stateTransitions.includes('PAUSED'), 'Recorded PAUSED transition');
  assert(stateTransitions.includes('DISCOVER'), 'Recorded DISCOVER transition');

  // Early Rejection in SourceTruthEngine
  const deadJobNoTitle = {
    id: 'test-dead-1',
    sourceUrl: 'https://example.com/job/1',
    company: 'Acme',
    title: '', // Missing title
  };
  const truth1 = sourceTruthEngine.validateJob(deadJobNoTitle);
  assert(truth1.isValid === false, 'SourceTruthEngine rejects job with missing title');

  const deadJobPlaceholder = {
    id: 'test-dead-2',
    sourceUrl: 'https://example.com/job/2',
    company: 'Test Co',
    title: 'Page Not Found - 404',
  };
  const truth2 = sourceTruthEngine.validateJob(deadJobPlaceholder);
  assert(truth2.isValid === false, 'SourceTruthEngine rejects 404 placeholder title');

  // ---------------------------------------------------------------------------
  // TEST 5: SOURCE COVERAGE (INDIA + GLOBAL ATS)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Full Source Coverage (India + Global ATS) ---');

  const allSources = sourceRegistry.getAllSources();
  assert(allSources.length === 1248, `Total source catalog count strictly preserved at 1,248 (got ${allSources.length})`);

  // Verify Indian Tech Companies
  const indianCompanies = [
    'Flipkart',
    'Zerodha',
    'PhonePe',
    'Groww',
    'Meesho',
    'Ola',
    'Paytm',
    'Ather Energy',
    'Delhivery',
    'Nykaa',
    'Pine Labs',
    'Juspay',
    'Darwinbox',
    'Clevertap',
    'Urban Company',
  ];

  for (const comp of indianCompanies) {
    const found = allSources.some((s) => s.name.toLowerCase().includes(comp.toLowerCase()));
    assert(found, `Indian company source present in catalog: ${comp}`);
  }

  // Verify Indian Portals
  const indianPortals = [
    'Naukri',
    'LinkedIn Jobs India',
    'Indeed India',
    'iimjobs',
    'Hirist',
    'Cutshort',
    'Instahyre',
    'Shine',
    'TimesJobs',
    'Wellfound India',
    'Apna',
    'WorkIndia',
    'Internshala',
  ];

  for (const portal of indianPortals) {
    const found = allSources.some((s) => s.name.toLowerCase().includes(portal.toLowerCase()));
    assert(found, `Indian portal present in catalog: ${portal}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: SOURCE REGISTRATION (5 ADD SOURCE OPTIONS)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: 5 Add Source Options Registration ---');

  // 1. Add URL
  const srcUrl = sourceRegistry.registerCustomSource({
    name: 'Single URL Source',
    sourceUrl: 'https://company.com/jobs/staff-eng',
    domain: 'company.com',
    category: 'company_ats',
    extractionStrategy: 'web_scrape_fallback',
  });
  assert(srcUrl !== null, 'Registered source option 1: + Add URL');

  // 2. Add Company Career Page
  const srcAts = sourceRegistry.registerCustomSource({
    name: 'Brex Greenhouse Board',
    sourceUrl: 'https://boards.greenhouse.io/brex',
    domain: 'boards.greenhouse.io',
    category: 'company_ats',
    extractionStrategy: 'greenhouse_ats',
  });
  assert(srcAts !== null, 'Registered source option 2: + Add Company Career Page');

  // 3. Add Job Board
  const srcJb = sourceRegistry.registerCustomSource({
    name: 'Custom Job Board',
    sourceUrl: 'https://myjobboard.dev/api/jobs',
    domain: 'myjobboard.dev',
    category: 'regional_portal',
    extractionStrategy: 'api_direct',
  });
  assert(srcJb !== null, 'Registered source option 3: + Add Job Board');

  // 4. Add RSS / Feed
  const srcRss = sourceRegistry.registerCustomSource({
    name: 'Tech Jobs RSS Feed',
    sourceUrl: 'https://hnrss.org/jobs',
    domain: 'hnrss.org',
    category: 'major_aggregator',
    extractionStrategy: 'rss_atom_feed',
  });
  assert(srcRss !== null, 'Registered source option 4: + Add RSS / Feed');

  // 5. Import Sources (Bulk)
  const bulkSources = [
    {
      name: 'Bulk Imported Source 1',
      sourceUrl: 'https://imported1.io/careers',
      domain: 'imported1.io',
      category: 'company_ats' as const,
      extractionStrategy: 'web_scrape_fallback',
    },
    {
      name: 'Bulk Imported Source 2',
      sourceUrl: 'https://imported2.io/careers',
      domain: 'imported2.io',
      category: 'company_ats' as const,
      extractionStrategy: 'web_scrape_fallback',
    },
  ];
  let bulkAdded = 0;
  for (const s of bulkSources) {
    if (sourceRegistry.registerCustomSource(s)) bulkAdded++;
  }
  assert(bulkAdded === 2, 'Registered source option 5: + Import Sources (Bulk import 2 sources)');

  console.log('\n===============================================================');
  console.log('🎉 ALL 6 CRITICAL SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
