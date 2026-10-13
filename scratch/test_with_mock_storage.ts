// Set up a mock localStorage on globalThis before importing
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

import { TargetCompaniesStore } from '../src/core/target-companies/targetCompanyStore';

async function testWithStorage() {
  console.log('--- TEST 1: Initial load ---');
  const store1 = new TargetCompaniesStore();
  console.log('store1 count:', store1.getCompanies().length);

  console.log('--- TEST 2: Import companies ---');
  const res = await store1.importCompaniesBatch([
    { name: 'Airbnb' },
    { name: 'Uber' },
    { name: 'Spotify' },
  ]);
  console.log('Import added:', res.added.length);
  console.log('store1 count after import:', store1.getCompanies().length);

  // Check what is in localStorage right now:
  const rawSaved = (globalThis as any).localStorage.getItem('careeros_target_companies_v5');
  console.log('localStorage has raw data? length:', rawSaved ? JSON.parse(rawSaved).length : 0);

  console.log('--- TEST 3: Fresh instantiate (simulating browser reload) ---');
  const store2 = new TargetCompaniesStore();
  const companies2 = store2.getCompanies();
  console.log('store2 count after reload:', companies2.length);
  const names2 = companies2.map(c => c.name);
  console.log('Companies in store2:', names2);

  const hasAirbnb = names2.includes('Airbnb');
  console.log('Airbnb retained?', hasAirbnb);
}

testWithStorage().catch(console.error);
