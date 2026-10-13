import { targetCompaniesStore } from '../src/core/target-companies/targetCompanyStore';

async function testImport() {
  console.log('Initial count:', targetCompaniesStore.getCompanies().length);

  // Generate 200 test companies
  const entries = Array.from({ length: 200 }, (_, i) => ({
    name: `Enterprise Company ${i + 1}`,
    domain: `company${i + 1}.io`,
    tag: (i % 2 === 0 ? 'Dream' : 'Priority') as any,
  }));

  const res = await targetCompaniesStore.importCompaniesBatch(entries);
  console.log('Imported count:', res.importedCount);
  console.log('After import count in store:', targetCompaniesStore.getCompanies().length);

  // Check the size of JSON stringified companies
  const serialized = JSON.stringify(targetCompaniesStore.getCompanies());
  console.log('Serialized length (bytes):', serialized.length);

  // Simulate reload by creating a fresh instance or reading storage
  const storageVal = (globalThis as any).__careeros_company_storage__['careeros_canonical_target_companies_v6'];
  console.log('Storage key exists:', Boolean(storageVal));
  if (storageVal) {
    const parsed = JSON.parse(storageVal);
    console.log('Parsed count from storage key:', parsed.length);
  }
}

testImport().catch(console.error);
