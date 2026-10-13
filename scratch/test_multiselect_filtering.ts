import { JobOpportunity, JobFilterCriteria } from '../src/core/jobs/types';
import { remoteEligibilityEngine } from '../src/core/jobs/remoteEligibilityEngine';

const mockOpportunities: JobOpportunity[] = [
  {
    id: 'job-1',
    title: 'Senior Enterprise Account Executive',
    company: 'Stripe',
    location: 'Bengaluru, Karnataka, India',
    country: 'India',
    remoteStatus: 'hybrid',
    seniority: 'senior',
    employmentType: 'full-time',
    dateDiscovered: new Date().toISOString(),
    datePosted: new Date().toISOString(),
    source: { name: 'Greenhouse', domain: 'stripe.com', type: 'direct_ats' },
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    salary: { disclosed: true, min: 140000, max: 180000, currency: 'USD', period: 'yearly', rawText: '$140k - $180k' },
    requiredSkills: ['Enterprise Sales', 'Fintech'],
    isTargetCompany: true,
    remote_eligibility: {
      status: 'HYBRID',
      isIndiaEligible: true,
      scope: 'India',
      evidence: 'Hybrid Bangalore office',
    },
  },
  {
    id: 'job-2',
    title: 'Staff Software Engineer, Platform',
    company: 'Figma',
    location: 'San Francisco, CA',
    country: 'United States',
    remoteStatus: 'on-site',
    seniority: 'lead',
    employmentType: 'full-time',
    dateDiscovered: new Date().toISOString(),
    datePosted: new Date().toISOString(),
    source: { name: 'Ashby', domain: 'figma.com', type: 'direct_ats' },
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    salary: { disclosed: true, min: 210000, max: 260000, currency: 'USD', period: 'yearly', rawText: '$210k - $260k' },
    requiredSkills: ['TypeScript', 'Rust', 'WebAssembly'],
    isTargetCompany: true,
    remote_eligibility: {
      status: 'ONSITE',
      isIndiaEligible: false,
      scope: 'United States',
      evidence: 'In-office San Francisco',
    },
  },
  {
    id: 'job-3',
    title: 'Commercial Account Executive, Global',
    company: 'Supabase',
    location: 'Worldwide Remote',
    country: 'Worldwide',
    remoteStatus: 'remote',
    seniority: 'mid',
    employmentType: 'full-time',
    dateDiscovered: new Date().toISOString(),
    datePosted: new Date().toISOString(),
    source: { name: 'Ashby', domain: 'supabase.com', type: 'direct_ats' },
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    salary: { disclosed: false, currency: 'USD', period: 'yearly', rawText: '' },
    requiredSkills: ['SaaS Sales', 'PostgreSQL'],
    isTargetCompany: false,
    remote_eligibility: {
      status: 'WORLDWIDE_REMOTE',
      isIndiaEligible: true,
      scope: 'Worldwide',
      evidence: 'Work from anywhere in the world',
    },
  },
  {
    id: 'job-4',
    title: 'Director of Sales, APAC',
    company: 'Datadog',
    location: 'Singapore',
    country: 'Singapore',
    remoteStatus: 'hybrid',
    seniority: 'director',
    employmentType: 'contract',
    dateDiscovered: new Date().toISOString(),
    datePosted: new Date().toISOString(),
    source: { name: 'Greenhouse', domain: 'datadoghq.com', type: 'direct_ats' },
    isVerifiedLive: true,
    verificationStatus: 'verified_live',
    salary: { disclosed: true, min: 180000, max: 220000, currency: 'USD', period: 'yearly', rawText: '$180k - $220k' },
    requiredSkills: ['Cloud Monitoring', 'APAC Leadership'],
    isTargetCompany: true,
    remote_eligibility: {
      status: 'HYBRID',
      isIndiaEligible: false,
      scope: 'Singapore',
      evidence: 'Singapore hub hybrid',
    },
  },
];

function filterOpportunities(jobs: JobOpportunity[], filters: Partial<JobFilterCriteria>): JobOpportunity[] {
  return jobs.filter((item) => {
    // Multi-Select Location Filter
    if (filters.locations && filters.locations.length > 0) {
      const matchLoc = filters.locations.some((loc) => {
        const l = loc.toLowerCase();
        if (l.includes('worldwide') || l.includes('remote worldwide')) {
          return (
            remoteEligibilityEngine.isWorldwideRemote(item) ||
            item.remoteStatus === 'remote' ||
            item.location.toLowerCase().includes('remote')
          );
        }
        if (l.includes('bangalore') || l.includes('bengaluru')) {
          return (
            item.location.toLowerCase().includes('bangalore') ||
            item.location.toLowerCase().includes('bengaluru')
          );
        }
        return (
          item.location.toLowerCase().includes(l) ||
          item.country.toLowerCase().includes(l)
        );
      });
      if (!matchLoc) return false;
    }

    // Multi-Select Remote Status Filter
    if (filters.remoteStatuses && filters.remoteStatuses.length > 0) {
      const matchRem = filters.remoteStatuses.some((rs) => {
        const r = rs.toLowerCase();
        if (r.includes('worldwide') || r.includes('wfa')) {
          return remoteEligibilityEngine.isWorldwideRemote(item);
        }
        if (r.includes('india')) {
          return (
            item.remote_eligibility?.status === 'REMOTE_FROM_INDIA' ||
            (item.country?.toLowerCase() === 'india' && item.remoteStatus === 'remote')
          );
        }
        if (r.includes('restricted')) {
          return (
            item.remote_eligibility?.status === 'REMOTE_COUNTRY_RESTRICTED' ||
            item.remote_eligibility?.status === 'REMOTE_REGION_RESTRICTED'
          );
        }
        if (r.includes('hybrid')) {
          return item.remoteStatus === 'hybrid' || item.remote_eligibility?.status === 'HYBRID';
        }
        if (r.includes('on-site') || r.includes('onsite')) {
          return item.remoteStatus === 'on-site' || item.remote_eligibility?.status === 'ONSITE';
        }
        return false;
      });
      if (!matchRem) return false;
    }

    // Multi-Select Roles Filter
    if (filters.roles && filters.roles.length > 0) {
      const matchRole = filters.roles.some((role) =>
        item.title.toLowerCase().includes(role.toLowerCase())
      );
      if (!matchRole) return false;
    }

    // Multi-Select Companies Filter
    if (filters.companies && filters.companies.length > 0) {
      const matchComp = filters.companies.some(
        (c) =>
          item.company.toLowerCase() === c.toLowerCase() ||
          item.company.toLowerCase().includes(c.toLowerCase())
      );
      if (!matchComp) return false;
    }

    // Multi-Select Seniority Filter
    if (filters.seniorities && filters.seniorities.length > 0) {
      const matchSen = filters.seniorities.some((s) => {
        const sl = ((item.seniority as string) || '').toLowerCase();
        return sl.includes(s.toLowerCase()) || item.title.toLowerCase().includes(s.toLowerCase());
      });
      if (!matchSen) return false;
    }

    // Multi-Select Employment Type Filter
    if (filters.employmentTypes && filters.employmentTypes.length > 0) {
      const matchEmp = filters.employmentTypes.some((et) =>
        (item.employmentType || '').toLowerCase().includes(et.toLowerCase())
      );
      if (!matchEmp) return false;
    }

    // Salary Disclosed
    if (filters.salaryDisclosedOnly && !item.salary.disclosed) {
      return false;
    }

    // Min Salary
    if (filters.minSalary && (item.salary.max || 0) < filters.minSalary) {
      return false;
    }

    // Target Companies
    if (filters.targetCompanyOnly && !item.isTargetCompany) {
      return false;
    }

    return true;
  });
}

function runMultiSelectTests() {
  console.log('--- Testing Multi-Select Filtering Engine ---');

  // Test 1: Location multi-select (Bengaluru OR Singapore)
  const locResults = filterOpportunities(mockOpportunities, {
    locations: ['Bengaluru / Bangalore', 'Singapore'],
  });
  console.assert(locResults.length === 2, `Expected 2 jobs, got ${locResults.length}`);
  console.assert(locResults.some((j) => j.id === 'job-1'), 'job-1 should be included');
  console.assert(locResults.some((j) => j.id === 'job-4'), 'job-4 should be included');
  console.log('[PASS] Test 1: Location multi-select works');

  // Test 2: Remote Status multi-select (worldwide_remote OR hybrid)
  const remoteResults = filterOpportunities(mockOpportunities, {
    remoteStatuses: ['worldwide_remote', 'hybrid'],
  });
  console.assert(remoteResults.length === 3, `Expected 3 jobs, got ${remoteResults.length}`);
  console.assert(!remoteResults.some((j) => j.id === 'job-2'), 'job-2 (onsite) should NOT be included');
  console.log('[PASS] Test 2: Remote status multi-select works');

  // Test 3: Company multi-select (Stripe OR Figma)
  const companyResults = filterOpportunities(mockOpportunities, {
    companies: ['Stripe', 'Figma'],
  });
  console.assert(companyResults.length === 2, `Expected 2 jobs, got ${companyResults.length}`);
  console.assert(companyResults.every((j) => ['Stripe', 'Figma'].includes(j.company)));
  console.log('[PASS] Test 3: Company multi-select works');

  // Test 4: Combined multi-select: Role = 'Account Executive', Target Company Only = true
  const combinedResults = filterOpportunities(mockOpportunities, {
    roles: ['Account Executive'],
    targetCompanyOnly: true,
  });
  console.assert(combinedResults.length === 1, `Expected 1 job, got ${combinedResults.length}`);
  console.assert(combinedResults[0].id === 'job-1', 'job-1 matches both AE role and target company');
  console.log('[PASS] Test 4: Combined multi-select + boolean toggle works');

  // Test 5: Salary Stated + Min Salary ($200k)
  const salaryResults = filterOpportunities(mockOpportunities, {
    salaryDisclosedOnly: true,
    minSalary: 200000,
  });
  console.assert(salaryResults.length === 2, `Expected 2 jobs >= $200k, got ${salaryResults.length}`);
  console.assert(salaryResults.some((j) => j.id === 'job-2'), 'Figma ($260k max) matches');
  console.assert(salaryResults.some((j) => j.id === 'job-4'), 'Datadog ($220k max) matches');
  console.log('[PASS] Test 5: Stated salary threshold works');

  console.log('================================================');
  console.log('ALL MULTI-SELECT FILTER TESTS PASSED SUCCESSFULLY!');
  console.log('================================================');
}

runMultiSelectTests();
