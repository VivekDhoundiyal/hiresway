import * as XLSX from 'xlsx';
import { excelImportService, sanitizeCellValue, IMPORT_COLUMNS } from '../src/core/jobs/excelImportService.ts';
import { jobVerificationEngine } from '../src/core/jobs/jobVerificationEngine.ts';
import { normalizeString } from '../src/core/jobs/jobPipeline.ts';

console.log('====================================================');
console.log('  CAREEROS JOB DATABASE & EXCEL IMPORT TEST SUITE    ');
console.log('====================================================\n');

let failedTests = 0;

// TEST 1: Sanitization & Anti-Formula Injection
console.log('TEST 1: Anti-Formula Injection Sanitization');
const formulaInputs = [
  { raw: '=SUM(A1:B10)', expected: 'SUM(A1:B10)' },
  { raw: '+cmd|"/C calc"!A0', expected: 'cmd|"/C calc"!A0' },
  { raw: '-10% discount', expected: '10% discount' },
  { raw: '@HYPERLINK("evil.com")', expected: 'HYPERLINK("evil.com")' },
  { raw: '\t=1+1', expected: '1+1' },
  { raw: '  Normal Title  ', expected: 'Normal Title' },
];

let sanitizePassed = true;
for (const item of formulaInputs) {
  const clean = sanitizeCellValue(item.raw);
  if (clean !== item.expected) {
    console.error(`  FAIL: sanitizeCellValue("${item.raw}") => "${clean}", expected "${item.expected}"`);
    sanitizePassed = false;
  }
}
if (sanitizePassed) {
  console.log('  PASS: All spreadsheet formula injection attempts neutralized.');
} else {
  failedTests++;
}

// TEST 2: Template Structure & Required Headers
console.log('\nTEST 2: Template Columns & Header Structure');
const requiredColumns = [
  'job_title *',
  'company *',
  'job_url *',
  'location *',
  'work_arrangement *',
  'source_name',
];
const hasAllRequired = requiredColumns.every((col) => IMPORT_COLUMNS.includes(col));
if (hasAllRequired && IMPORT_COLUMNS.length >= 25) {
  console.log(`  PASS: Template defines ${IMPORT_COLUMNS.length} columns including all mandatory headers.`);
} else {
  console.error('  FAIL: Missing required columns in template definition.');
  failedTests++;
}

// TEST 3: Verification Badge Matrix & State Machine
console.log('\nTEST 3: Verification Badge Configurations');
const badgeStates = [
  { status: 'verified_live', expectedLabel: '✓ Verified Live', expectedVariant: 'success' },
  { status: 'recently_verified', expectedLabel: '✓ Recently Verified', expectedVariant: 'success' },
  { status: 'needs_verification', expectedLabel: '⚠ Needs Verification', expectedVariant: 'warning' },
  { status: 'imported_needs_verification', expectedLabel: 'Imported — Needs Verification', expectedVariant: 'warning' },
  { status: 'link_broken', expectedLabel: '× Link Unavailable', expectedVariant: 'error' },
  { status: 'job_closed', expectedLabel: 'Job Closed', expectedVariant: 'error' },
  { status: 'expired', expectedLabel: '✕ Expired / Removed', expectedVariant: 'error' },
];

let badgePassed = true;
for (const b of badgeStates) {
  const config = jobVerificationEngine.getVerificationBadgeConfig(b.status);
  if (config.label !== b.expectedLabel || config.variant !== b.expectedVariant) {
    console.error(`  FAIL for ${b.status}: got "${config.label}" (${config.variant}), expected "${b.expectedLabel}" (${b.expectedVariant})`);
    badgePassed = false;
  }
}
if (badgePassed) {
  console.log('  PASS: All 7 verification states produce correct truth badges and variants.');
} else {
  failedTests++;
}

// TEST 4: Stale Verification Check
console.log('\nTEST 4: Stale Verification Calculation (14-day threshold)');
const nowMs = Date.now();
const freshDate = new Date(nowMs - 2 * 24 * 3600 * 1000).toISOString(); // 2 days ago
const staleDate = new Date(nowMs - 20 * 24 * 3600 * 1000).toISOString(); // 20 days ago

const isFreshStale = jobVerificationEngine.isVerificationStale(freshDate, 14);
const isOldStale = jobVerificationEngine.isVerificationStale(staleDate, 14);

if (!isFreshStale && isOldStale) {
  console.log('  PASS: Correctly flags verification older than 14 days as stale.');
} else {
  console.error('  FAIL: Stale verification logic incorrect', { isFreshStale, isOldStale });
  failedTests++;
}

// TEST 5: ATS Platform Detection
console.log('\nTEST 5: Evidence-Based ATS Platform Detection');
const atsTests = [
  { url: 'https://boards.greenhouse.io/datadog/jobs/123', expectedAts: 'greenhouse', isAts: true },
  { url: 'https://jobs.lever.co/stripe/456', expectedAts: 'lever', isAts: true },
  { url: 'https://jobs.ashbyhq.com/linear/789', expectedAts: 'ashby', isAts: true },
  { url: 'https://myworkdayjobs.com/company/jobs/1', expectedAts: 'workday', isAts: true },
  { url: 'https://stripe.com/jobs/listing/commercial-sales-lead/5892104', expectedAts: 'custom', isAts: false },
];

let atsPassed = true;
for (const t of atsTests) {
  const detected = jobVerificationEngine.detectAtsPlatform(t.url);
  if (detected.atsType !== t.expectedAts || detected.isAts !== t.isAts) {
    console.error(`  FAIL for ${t.url}: got ${detected.atsType}, expected ${t.expectedAts}`);
    atsPassed = false;
  }
}
if (atsPassed) {
  console.log('  PASS: Concrete ATS detection verified without false assertions.');
} else {
  failedTests++;
}

// TEST 6: Spreadsheet Parser, Validation & Duplicate Engine
console.log('\nTEST 6: Spreadsheet Parsing, Validation, and Duplicate Engine');

async function testSpreadsheetEngine() {
  const existingMockJobs = [
    {
      id: 'existing-1',
      title: 'Senior Enterprise Account Executive',
      company: 'Datadog',
      jobUrl: 'https://careers.datadoghq.com/detail/6129481',
      canonicalUrl: 'https://careers.datadoghq.com/detail/6129481',
      externalId: 'DD-6129481',
      location: 'Bengaluru, India',
      remoteStatus: 'hybrid',
      workFromAnywhere: false,
      eligibleCountries: ['India'],
      employmentType: 'full-time',
      seniority: 'senior',
      salary: { disclosed: true, min: 4500000, max: 6500000, currency: 'INR', period: 'yearly' },
      datePosted: '2026-09-14',
      dateDiscovered: new Date().toISOString(),
      lastVerified: new Date().toISOString(),
      isVerifiedLive: true,
      isApplyUrlValidated: true,
      verificationStatus: 'verified_live',
      source: { id: 'src-1', name: 'Datadog Careers', domain: 'datadoghq.com', type: 'ats_hosted', sourceUrl: 'https://careers.datadoghq.com', sourceConfidence: 'verified_ats', discoveredAt: new Date().toISOString() },
      sourcesHistory: [],
      industry: 'SaaS',
      requiredSkills: ['B2B Sales', 'MEDDPICC'],
      preferredSkills: [],
      responsibilities: [],
      requirements: [],
      description: 'Senior AE role',
      lifecycleState: 'SAVED',
      fingerprint: 'datadog::enterpriseaccountexecutive::bengaluru',
      normalizedTitle: 'senior enterprise account executive',
    },
  ];

  // Construct test workbook with valid row, warning row, error row, and duplicate row
  const testWb = XLSX.utils.book_new();
  const testRows = [
    IMPORT_COLUMNS,
    // Row 1: Valid new job
    [
      'Commercial Director of Growth',
      'Supabase',
      'https://boards.greenhouse.io/supabase/jobs/4392019',
      'Worldwide',
      'Remote',
      'Worldwide',
      'full-time',
      'director',
      'Growth',
      'Developer Tools',
      '160000',
      '210000',
      'USD',
      'Annual',
      '2026-09-15',
      '',
      'Growth leadership role',
      'Growth, B2B Sales',
      'Supabase Greenhouse',
      'Official Employer ATS',
      'Alex Rivera',
      'alex@supabase.io',
      'https://linkedin.com/in/alexrivera',
      'SUP-4392019',
      'WFA role',
    ],
    // Row 2: Exact duplicate of existing-1
    [
      'Senior Enterprise Account Executive',
      'Datadog',
      'https://careers.datadoghq.com/detail/6129481',
      'Bengaluru, India',
      'Hybrid',
      'India',
      'full-time',
      'senior',
      'Sales',
      'Cloud SaaS',
      '4500000',
      '6500000',
      'INR',
      'Annual',
      '2026-09-14',
      '',
      'Datadog AE',
      'B2B Sales',
      'Datadog Official',
      'Official Employer ATS',
      '',
      '',
      '',
      'DD-6129481',
      '',
    ],
    // Row 3: Blocking error (Missing company and invalid URL)
    [
      'Invalid Job Opportunity',
      '', // Missing company
      'not-a-valid-url', // Invalid URL
      'Mumbai, India',
      'Remote',
      'India',
      'full-time',
      'mid',
      '',
      '',
      '500000',
      '300000', // min > max!
      'INR',
      'Annual',
      'invalid-date', // bad date
      '',
      '',
      '',
      'Import',
      '',
      '',
      'bad-email-format', // bad email
      '',
      '',
      '',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(testRows);
  XLSX.utils.book_append_sheet(testWb, ws, 'Jobs');
  const buffer = XLSX.write(testWb, { type: 'array', bookType: 'xlsx' });

  const result = await excelImportService.parseAndValidateSpreadsheet(buffer, existingMockJobs);

  console.log(`  Parsed: ${result.totalRows} rows (${result.validRows.length} valid, ${result.warningRows.length} warnings, ${result.errorRows.length} errors)`);

  if (result.validRows.length !== 2) {
    console.error(`  FAIL: Expected 2 valid rows (1 new + 1 duplicate), got ${result.validRows.length}`);
    failedTests++;
  } else {
    console.log('  PASS: Valid rows accurately recognized.');
  }

  if (result.errorRows.length !== 1) {
    console.error(`  FAIL: Expected 1 error row, got ${result.errorRows.length}`);
    failedTests++;
  } else {
    console.log('  PASS: Invalid row accurately identified with blocking errors.');
    const errIssues = result.errorRows[0].issues;
    console.log(`  Identified ${errIssues.length} specific validation issues on rejected row:`);
    errIssues.forEach((iss) => console.log(`    - [${iss.type}] ${iss.field}: ${iss.message}`));
  }

  const dupRow = result.validRows.find((r) => r.duplicateStatus === 'exact_duplicate');
  if (dupRow) {
    console.log(`  PASS: Exact duplicate matched: "${dupRow.duplicateReason}"`);
  } else {
    console.error('  FAIL: Exact duplicate was not detected!');
    failedTests++;
  }
}

await testSpreadsheetEngine();

console.log('\n====================================================');
if (failedTests === 0) {
  console.log('  ALL JOB DATABASE & IMPORT ENGINE TESTS PASSED!   ');
} else {
  console.error(`  TOTAL FAILURES: ${failedTests}`);
}
console.log('====================================================\n');

process.exit(failedTests === 0 ? 0 : 1);
