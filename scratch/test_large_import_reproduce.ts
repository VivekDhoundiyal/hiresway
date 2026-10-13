import * as XLSX from 'xlsx';
import { targetCompaniesExcelImportService } from '../src/core/target-companies/excelImportService';
import { targetCompaniesStore, TargetCompaniesStore } from '../src/core/target-companies/targetCompanyStore';

async function testLargeExcelImport() {
  console.log('--- TEST: 499 rows with 382 unique companies ---');

  // 1. Generate an Excel buffer with 499 rows and 382 unique company names
  const header = ['Companies names'];
  const rows: string[][] = [header];

  // 382 unique company names
  for (let i = 1; i <= 382; i++) {
    rows.push([`Company ${i}`]);
  }
  // Fill remaining rows up to 499 with duplicates and empty/invalid values
  for (let i = 1; i <= 116; i++) {
    rows.push([`Company ${i}`]); // Duplicates
  }
  rows.push(['']); // Blank
  rows.push(['   ']); // Blank

  console.log(`Generated ${rows.length - 1} data rows.`);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Target Companies');
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  console.log('Parsing buffer with targetCompaniesExcelImportService...');
  const existing = targetCompaniesStore.getCompanies();
  const summary = await targetCompaniesExcelImportService.parseAndValidateExcel(buffer, existing);

  console.log(`Summary: totalRowsFound=${summary.totalRowsFound}, readyToAddCount=${summary.readyToAddCount}, duplicateInFileCount=${summary.duplicateInFileCount}`);

  // 2. Perform batch import
  const readyRows = summary.rows.filter((r) => r.status === 'ready_to_add');
  console.log(`Starting import of ${readyRows.length} companies...`);
  const startTime = Date.now();

  const entries = readyRows.map((r) => ({
    name: r.cleanedName,
    tag: r.tag || 'Priority',
  }));

  let lastProgress = 0;
  const result = await targetCompaniesStore.importCompaniesBatch(
    entries,
    (completed, total) => {
      lastProgress = completed;
    }
  );

  const durationMs = Date.now() - startTime;
  console.log(`Import completed in ${durationMs}ms.`);
  console.log(`Added: ${result.added.length}, Skipped: ${result.skippedCount}, Failed: ${result.failedCount}`);

  // 3. Check for malformed records in store
  const allCompanies = targetCompaniesStore.getCompanies();
  console.log(`Total companies in store: ${allCompanies.length}`);

  let malformedCount = 0;
  for (const c of allCompanies) {
    if (!c.id || !c.company_id || !c.name || !c.canonical_name) {
      console.error('Malformed company record:', c);
      malformedCount++;
    }
  }

  if (malformedCount > 0) {
    throw new Error(`Found ${malformedCount} malformed company records!`);
  }

  // 4. Check persistence
  const reloadedStore = new TargetCompaniesStore();
  const reloadedList = reloadedStore.getCompanies();
  console.log(`Reloaded store company count: ${reloadedList.length}`);
  if (reloadedList.length !== allCompanies.length) {
    throw new Error(`Reload mismatch: expected ${allCompanies.length}, got ${reloadedList.length}`);
  }

  console.log('✓ Large import test completed successfully!');
  process.exit(0);
}

testLargeExcelImport().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
