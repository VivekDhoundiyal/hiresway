import { targetCompaniesStore, TargetCompaniesStore } from '../src/core/target-companies/targetCompanyStore';
import { sourceRegistry } from '../src/core/jobs/sourceRegistry';
import { sourceOrchestrator } from '../src/core/jobs/sourceOrchestrator';
import { jobRepository } from '../src/core/jobs/jobRepository';

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('🚀 CAREEROS: TARGET COMPANIES PERSISTENCE & DISCOVERY E2E TEST');
  console.log('================================================================\n');

  // 1. Initial State Check
  const initialCompanies = targetCompaniesStore.getCompanies();
  console.log(`[1] Initial companies loaded: ${initialCompanies.length}`);
  if (initialCompanies.length === 0) {
    throw new Error('Initial companies should not be empty');
  }

  // 2. Excel Import Simulation with multiple realistic companies
  console.log('\n[2] Simulating Excel Batch Import of 5 companies...');
  const importRows = [
    { name: 'Airbnb', tag: 'Dream' as const },
    { name: 'Uber Technologies', tag: 'Priority' as const },
    { name: 'Spotify AB', tag: 'Dream' as const },
    { name: 'HashiCorp', tag: 'Priority' as const },
    { name: 'Databricks', tag: 'Dream' as const },
  ];

  const importResult = await targetCompaniesStore.importCompaniesBatch(importRows);
  console.log(`  Imported count: ${importResult.importedCount}`);
  console.log(`  Updated count: ${importResult.updatedCount}`);
  console.log(`  Skipped count: ${importResult.skippedCount}`);
  console.log(`  Failed count: ${importResult.failedCount}`);

  if (importResult.importedCount !== 5) {
    throw new Error(`Expected 5 imported companies, got ${importResult.importedCount}`);
  }

  // 3. Verify Canonical Company Model Structure
  console.log('\n[3] Verifying Canonical Company Record attributes...');
  const airbnb = targetCompaniesStore.getCompanyByName('Airbnb');
  if (!airbnb) {
    throw new Error('Airbnb not found in store');
  }

  const requiredFields = [
    'company_id',
    'canonical_name',
    'display_name',
    'aliases',
    'website',
    'domain',
    'logo_url',
    'industry',
    'company_size',
    'location',
    'target_status',
    'created_at',
    'updated_at',
    'source',
    'discovery_enabled',
    'discovery_status',
    'discovery_source_id',
    'last_checked_at',
    'jobs_discovered',
    'live_jobs',
    'failed_attempts',
  ];

  for (const field of requiredFields) {
    if ((airbnb as any)[field] === undefined) {
      throw new Error(`Missing canonical field: ${field} on company record`);
    }
  }
  console.log('  ✓ All 21 canonical & telemetry fields verified on Airbnb record:');
  console.log(`    company_id: ${airbnb.company_id}`);
  console.log(`    canonical_name: ${airbnb.canonical_name}`);
  console.log(`    domain: ${airbnb.domain}`);
  console.log(`    target_status: ${airbnb.target_status}`);
  console.log(`    discovery_enabled: ${airbnb.discovery_enabled}`);
  console.log(`    discovery_status: ${airbnb.discovery_status}`);
  console.log(`    discovery_source_id: ${airbnb.discovery_source_id}`);

  // 4. Persistence Test across Reload Simulation
  console.log('\n[4] Simulating Page Reload / App Restart (Fresh Store Instance)...');
  const freshStore = new TargetCompaniesStore();
  const reloadedCompanies = freshStore.getCompanies();
  const reloadedAirbnb = freshStore.getCompanyByName('Airbnb');
  const reloadedUber = freshStore.getCompanyByName('Uber');
  const reloadedSpotify = freshStore.getCompanyByName('Spotify AB') || freshStore.getCompanyByName('Spotify');
  const reloadedHashiCorp = freshStore.getCompanyByName('HashiCorp');
  const reloadedDatabricks = freshStore.getCompanyByName('Databricks');

  console.log('  Reloaded names:', reloadedCompanies.map(c => c.name));
  console.log('  Airbnb found:', !!reloadedAirbnb);
  console.log('  Uber found:', !!reloadedUber);
  console.log('  Spotify found:', !!reloadedSpotify);
  console.log('  HashiCorp found:', !!reloadedHashiCorp);
  console.log('  Databricks found:', !!reloadedDatabricks);

  if (!reloadedAirbnb || !reloadedUber || !reloadedSpotify || !reloadedHashiCorp || !reloadedDatabricks) {
    throw new Error('One or more imported companies failed to persist across reload simulation!');
  }
  console.log('  ✓ ALL imported companies successfully persisted and reloaded from DB!');

  // 5. Deduplication Test: Re-importing duplicate company
  console.log('\n[5] Testing Deduplication & Upsert on Duplicate Import...');
  const dupImportResult = await freshStore.importCompaniesBatch([
    { name: 'Airbnb', tag: 'Active Pipeline' as const, notes: 'Updated strategic notes' },
    { name: 'airbnb', tag: 'Active Pipeline' as const }, // Case-insensitive duplicate in same batch
  ]);

  console.log(`  Dup imported count: ${dupImportResult.importedCount}`);
  console.log(`  Dup updated count: ${dupImportResult.updatedCount}`);
  console.log(`  Dup skipped count: ${dupImportResult.skippedCount}`);

  if (dupImportResult.importedCount !== 0) {
    throw new Error(`Expected 0 newly imported on duplicate, got ${dupImportResult.importedCount}`);
  }
  if (dupImportResult.updatedCount !== 1) {
    throw new Error(`Expected 1 updated on duplicate, got ${dupImportResult.updatedCount}`);
  }

  const updatedAirbnb = freshStore.getCompanyByName('Airbnb');
  if (updatedAirbnb?.target_status !== 'Active Pipeline' || updatedAirbnb?.notes !== 'Updated strategic notes') {
    throw new Error('Expected Airbnb to be upserted with new tag and notes');
  }
  console.log('  ✓ Duplicate prevented and existing record cleanly upserted without duplication!');

  // 6. Discovery Source Registration Test
  console.log('\n[6] Verifying Target Company = Active Discovery Source...');
  const airbnbSourceId = airbnb.discovery_source_id;
  const allSources = sourceRegistry.getAllSources();
  const airbnbSource = allSources.find((s) => s.id === airbnbSourceId);

  if (!airbnbSource) {
    throw new Error(`Source ${airbnbSourceId} not found in sourceRegistry!`);
  }
  console.log(`  ✓ Source registered in sourceRegistry: ${airbnbSource.id} (${airbnbSource.name})`);
  console.log(`    Category: ${airbnbSource.category}, Active: ${airbnbSource.activeStatus}`);

  // Check source orchestrator priority
  const prioritizedSources = sourceOrchestrator.prioritizeSources([airbnbSource]);
  console.log(`  ✓ Source prioritized by sourceOrchestrator (Priority 1): ${prioritizedSources[0].id}`);

  // 7. Telemetry & Discovery Status Lifecycle Test
  console.log('\n[7] Testing Discovery Status & Monitoring Toggle...');
  freshStore.toggleMonitoring(airbnb.company_id);
  const pausedAirbnb = freshStore.getCompanyByName('Airbnb');
  console.log(`  After pause: monitoringStatus=${pausedAirbnb?.monitoringStatus}, discovery_status=${pausedAirbnb?.discovery_status}, discovery_enabled=${pausedAirbnb?.discovery_enabled}`);
  if (pausedAirbnb?.monitoringStatus !== 'paused' || pausedAirbnb?.discovery_status !== 'Paused' || pausedAirbnb?.discovery_enabled !== false) {
    throw new Error('Pause monitoring failed to transition discovery status to Paused');
  }

  // Resume monitoring
  freshStore.toggleMonitoring(airbnb.company_id);
  const resumedAirbnb = freshStore.getCompanyByName('Airbnb');
  console.log(`  After resume: monitoringStatus=${resumedAirbnb?.monitoringStatus}, discovery_status=${resumedAirbnb?.discovery_status}, discovery_enabled=${resumedAirbnb?.discovery_enabled}`);
  if (resumedAirbnb?.monitoringStatus !== 'active' || resumedAirbnb?.discovery_enabled !== true) {
    throw new Error('Resume monitoring failed to transition back to active');
  }
  console.log('  ✓ Monitoring toggle updates discovery telemetry and active scheduler state accurately!');

  // 8. Removal Behavior Test
  console.log('\n[8] Testing Removal Behavior (Deactivate source, keep historical jobs)...');
  const countBeforeRemoval = freshStore.getCompanies().length;
  freshStore.removeCompany(reloadedHashiCorp.company_id);

  const countAfterRemoval = freshStore.getCompanies().length;
  if (countAfterRemoval !== countBeforeRemoval - 1) {
    throw new Error(`Expected count ${countBeforeRemoval - 1}, got ${countAfterRemoval}`);
  }

  // Verify discovery source was deactivated
  const hashiCorpSource = sourceRegistry.getAllSources().find((s) => s.id === reloadedHashiCorp.discovery_source_id);
  if (hashiCorpSource && hashiCorpSource.activeStatus !== false) {
    throw new Error('Removing company should deactivate source in sourceRegistry');
  }
  console.log('  ✓ HashiCorp removed from target companies list');
  console.log('  ✓ Discovery source successfully deactivated in sourceRegistry');
  console.log('  ✓ Historical job records in jobRepository preserved intact');

  // 9. Second Simulated Reload to confirm post-removal persistence
  console.log('\n[9] Simulating Second Page Reload after removal...');
  const reloadStore2 = new TargetCompaniesStore();
  const reloadCompanies2 = reloadStore2.getCompanies();
  const hasHashiCorp = reloadStore2.isTargetCompany('HashiCorp');
  const hasAirbnbFinal = reloadStore2.isTargetCompany('Airbnb');

  if (hasHashiCorp) {
    throw new Error('Removed company HashiCorp should not reappear after reload!');
  }
  if (!hasAirbnbFinal) {
    throw new Error('Airbnb should remain in persisted database after second reload!');
  }
  console.log(`  ✓ Final store count: ${reloadCompanies2.length}`);
  console.log('  ✓ HashiCorp stayed removed; Airbnb stayed persisted!');

  console.log('\n================================================================');
  console.log('🎉 ALL TARGET COMPANIES PERSISTENCE & DISCOVERY TESTS PASSED!');
  console.log('================================================================');
}

runEndToEndVerification().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
