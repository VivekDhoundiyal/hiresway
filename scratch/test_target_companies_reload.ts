import { targetCompaniesStore, TargetCompaniesStore } from '../src/core/target-companies/targetCompanyStore';

async function testPersistence() {
  console.log('Initial companies count:', targetCompaniesStore.getCompanies().length);

  // Import 3 test companies
  const res = await targetCompaniesStore.importCompaniesBatch([
    { name: 'Airbnb' },
    { name: 'Uber' },
    { name: 'Spotify' },
  ]);

  console.log('Added count:', res.added.length);
  console.log('Current companies count:', targetCompaniesStore.getCompanies().length);

  // Now simulate page reload by instantiating a fresh store instance
  const freshStore = new TargetCompaniesStore();
  const loadedCompanies = freshStore.getCompanies();
  console.log('After fresh instantiate (page reload simulation):', loadedCompanies.length);
  const names = loadedCompanies.map(c => c.name);
  console.log('Company names in fresh store:', names);

  const hasAirbnb = names.includes('Airbnb');
  const hasUber = names.includes('Uber');
  const hasSpotify = names.includes('Spotify');

  console.log('Airbnb retained?', hasAirbnb);
  console.log('Uber retained?', hasUber);
  console.log('Spotify retained?', hasSpotify);
}

testPersistence().catch(console.error);
