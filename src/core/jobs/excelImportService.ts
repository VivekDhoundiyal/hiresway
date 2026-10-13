import * as XLSX from 'xlsx';
import {
  JobOpportunity,
  ImportRowValidation,
  ImportRowValidationIssue,
  RemoteType,
  RemoteScope,
  SalaryPeriod,
  SeniorityLevel,
  JobVerificationStatus,
} from './types';
import { jobVerificationEngine } from './jobVerificationEngine';
import { normalizeString } from './jobPipeline';

/**
 * Excel Job Import Column Headers
 */
export const IMPORT_COLUMNS = [
  'job_title *',
  'company *',
  'job_url *',
  'location *',
  'work_arrangement *',
  'remote_scope',
  'employment_type',
  'seniority',
  'department',
  'industry',
  'salary_min',
  'salary_max',
  'salary_currency',
  'salary_period',
  'posting_date',
  'closing_date',
  'description',
  'skills',
  'source_name',
  'source_type',
  'recruiter_name',
  'recruiter_email',
  'recruiter_linkedin',
  'source_job_id',
  'notes',
];

/**
 * Strips dangerous formula injection prefixes from untrusted spreadsheet strings.
 * Disallows leading '=', '+', '-', '@', '\t', '\r'
 */
export function sanitizeCellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Strip formula triggers
  while (/^[=+\-@\t\r]/.test(str)) {
    str = str.substring(1).trim();
  }
  return str;
}

export class ExcelImportService {
  /**
   * Generates and triggers download of the authentic multi-sheet CareerOs Job Import Template.
   */
  public downloadJobImportTemplate(): void {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Jobs with authentic sample rows
    const sampleRows = [
      [
        'Enterprise Account Executive — Strategic Accounts',
        'Datadog',
        'https://careers.datadoghq.com/detail/6129481?gh_jid=6129481',
        'Bengaluru, Karnataka, India',
        'Hybrid',
        'India',
        'full-time',
        'senior',
        'Enterprise Sales',
        'Cloud Monitoring & DevOps SaaS',
        '4500000',
        '6500000',
        'INR',
        'Annual',
        '2026-09-14',
        '',
        'Drive multi-million rupee ARR across Indian enterprise accounts, collaborating with solutions architects and customer success.',
        'Enterprise Sales, B2B SaaS, Cloud Monitoring, MEDDPICC, Deal Closure',
        'Datadog Official Careers',
        'Official Employer ATS',
        'Sarah Jenkins',
        's.jenkins@datadoghq.com',
        'https://linkedin.com/in/sarahjenkins-talent',
        'DD-6129481',
        'Strategic target account hiring in Bengaluru hub',
      ],
      [
        'Director of Strategic Growth & Revenue Partnerships',
        'Supabase',
        'https://boards.greenhouse.io/supabase/jobs/4392019',
        'Worldwide (Work From Anywhere)',
        'Remote',
        'Worldwide',
        'full-time',
        'director',
        'Growth & Ecosystem',
        'Developer Tools & Cloud Infrastructure',
        '160000',
        '210000',
        'USD',
        'Annual',
        '2026-09-15',
        '',
        'Lead global developer ecosystem expansion, cloud partner programs, and high-velocity revenue channels worldwide.',
        'Strategic Partnerships, Revenue Growth, Cloud Ecosystems, Contract Negotiation, GTM Strategy',
        'Supabase Greenhouse Board',
        'Official Employer ATS',
        'Alex Rivera',
        'alex@supabase.io',
        'https://linkedin.com/in/alexrivera-supabase',
        'SUP-4392019',
        'Explicit Work From Anywhere boundary-free eligibility confirmed',
      ],
      [
        'Commercial Business Development Lead',
        'Stripe',
        'https://stripe.com/jobs/listing/commercial-sales-lead/5892104',
        'Dublin, Ireland',
        'Hybrid',
        'Region',
        'full-time',
        'lead',
        'EMEA Sales',
        'Financial Infrastructure & Fintech',
        '95000',
        '135000',
        'EUR',
        'Annual',
        '2026-09-12',
        '',
        'Scale commercial fintech payment adoption across high-growth internet businesses in Northern and Western Europe.',
        'B2B Sales, Commercial Negotiation, Payment APIs, Pipeline Generation, Account Executive',
        'Stripe Official Careers',
        'Company Career Page',
        '',
        '',
        '',
        'STR-5892104',
        'Verified hiring requisition with regional European focus',
      ],
    ];

    const jobsSheetData = [IMPORT_COLUMNS, ...sampleRows];
    const wsJobs = XLSX.utils.aoa_to_sheet(jobsSheetData);

    // Set column widths for Sheet 1
    wsJobs['!cols'] = [
      { wch: 38 }, // job_title
      { wch: 18 }, // company
      { wch: 48 }, // job_url
      { wch: 28 }, // location
      { wch: 18 }, // work_arrangement
      { wch: 16 }, // remote_scope
      { wch: 16 }, // employment_type
      { wch: 14 }, // seniority
      { wch: 20 }, // department
      { wch: 28 }, // industry
      { wch: 14 }, // salary_min
      { wch: 14 }, // salary_max
      { wch: 14 }, // salary_currency
      { wch: 14 }, // salary_period
      { wch: 14 }, // posting_date
      { wch: 14 }, // closing_date
      { wch: 45 }, // description
      { wch: 35 }, // skills
      { wch: 24 }, // source_name
      { wch: 22 }, // source_type
      { wch: 18 }, // recruiter_name
      { wch: 26 }, // recruiter_email
      { wch: 32 }, // recruiter_linkedin
      { wch: 16 }, // source_job_id
      { wch: 35 }, // notes
    ];

    XLSX.utils.book_append_sheet(wb, wsJobs, 'Jobs');

    // Sheet 2: Instructions
    const instructionsData = [
      ['CareerOs Job Import Template Instructions & Field Guidelines'],
      [''],
      ['CRITICAL RULE: CareerOs verifies all job URLs upon import. Imported records enter as "Imported — Needs Verification" until confirmed live at the source. Never input generic search pages or homepage URLs.'],
      [''],
      ['Column Name', 'Required?', 'Allowed Values / Format', 'Description & Examples'],
      ['job_title', 'YES', 'Text (e.g. Enterprise Account Executive)', 'Exact functional job title from employer.'],
      ['company', 'YES', 'Text (e.g. Datadog, Stripe)', 'Name of hiring company.'],
      ['job_url', 'YES', 'Valid HTTP/HTTPS destination URL', 'Direct link to exact job posting. Rejects generic root pages (/careers) and search queries.'],
      ['location', 'YES', 'City, State, Country or "Worldwide"', 'Primary location or work hub (e.g. "Bengaluru, India" or "Remote Worldwide").'],
      ['work_arrangement', 'YES', 'Remote, Hybrid, On-site, Unknown', 'Specifies whether role is remote, hybrid, or on-site.'],
      ['remote_scope', 'Optional', 'Worldwide, India, Specific Countries, Region, Unknown', 'Geographic remote restriction. "Remote" does not imply "Worldwide".'],
      ['employment_type', 'Optional', 'full-time, contract, part-time, internship', 'Defaults to full-time.'],
      ['seniority', 'Optional', 'entry, mid, senior, lead, manager, director, executive', 'Seniority level required for the position.'],
      ['department', 'Optional', 'Text (e.g. Sales, Engineering, Growth)', 'Functional department.'],
      ['industry', 'Optional', 'Text (e.g. Enterprise SaaS, Fintech, AI)', 'Domain or industry category.'],
      ['salary_min', 'Optional', 'Number (e.g. 4500000 or 150000)', 'Minimum base compensation (no symbols or commas).'],
      ['salary_max', 'Optional', 'Number (e.g. 6500000 or 200000)', 'Maximum base compensation (no symbols or commas).'],
      ['salary_currency', 'Optional', 'INR, USD, EUR, GBP, CAD, SGD, AUD', 'Original currency. Preserves authentic compensation without blind conversion.'],
      ['salary_period', 'Optional', 'Annual, Monthly, Hourly, Not disclosed', 'Defaults to Annual.'],
      ['posting_date', 'Optional', 'YYYY-MM-DD (e.g. 2026-09-15)', 'Exact recruiter posted date. Leave empty if source does not disclose date (never guess).'],
      ['closing_date', 'Optional', 'YYYY-MM-DD', 'Expected application closing deadline if stated.'],
      ['description', 'Optional', 'Full job description text', 'Preserves genuine employer text. CareerOs never presents rewritten text as original.'],
      ['skills', 'Optional', 'Comma-separated keywords', 'Key required skills and platform proficiencies.'],
      ['source_name', 'YES', 'Text (e.g. Greenhouse, LinkedIn, Career Page)', 'Name of source where listing was discovered.'],
      ['source_type', 'Optional', 'Official Employer ATS, Company Career Page, Job Board, Recruiter, Manual, Other', 'Provenance category.'],
      ['recruiter_name', 'Optional', 'Text', 'Recruiter or hiring manager contact name.'],
      ['recruiter_email', 'Optional', 'Valid email address', 'Recruiter contact email address.'],
      ['recruiter_linkedin', 'Optional', 'LinkedIn URL', 'Recruiter LinkedIn profile URL.'],
      ['source_job_id', 'Optional', 'Alphanumeric identifier', 'ATS requisition code or external listing ID.'],
      ['notes', 'Optional', 'Text', 'Personal tracking notes or interview prep context.'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    wsInstructions['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 34 }, { wch: 65 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    XLSX.writeFile(wb, 'CareerOs_Job_Import_Template.xlsx');
  }

  /**
   * Parses and validates untrusted spreadsheet data (.xlsx or .csv).
   */
  public async parseAndValidateSpreadsheet(
    data: ArrayBuffer | File,
    existingJobs: JobOpportunity[]
  ): Promise<{
    validRows: ImportRowValidation[];
    warningRows: ImportRowValidation[];
    errorRows: ImportRowValidation[];
    totalRows: number;
  }> {
    let arrayBuffer: ArrayBuffer;
    if (data instanceof File) {
      arrayBuffer = await data.arrayBuffer();
    } else {
      arrayBuffer = data;
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0] || 'Jobs';
    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      throw new Error('Spreadsheet has no readable sheets.');
    }

    // Convert to JSON objects
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      raw: false,
    });

    const validations: ImportRowValidation[] = [];

    rawRows.forEach((row, idx) => {
      const rowNumber = idx + 2; // Excel row numbering (1-based + 1 for header)

      // Normalize keys: lowercased, stripped asterisks, trimmed
      const cleanRow: Record<string, string> = {};
      Object.keys(row).forEach((k) => {
        const cleanKey = k.toLowerCase().replace(/\*/g, '').trim().replace(/\s+/g, '_');
        cleanRow[cleanKey] = sanitizeCellValue(row[k]);
      });

      // Check if entire row is empty
      const hasAnyValue = Object.values(cleanRow).some((v) => v.length > 0);
      if (!hasAnyValue) return;

      const issues: ImportRowValidationIssue[] = [];

      // 1. Mandatory Fields Validation
      const title = cleanRow['job_title'] || '';
      const company = cleanRow['company'] || '';
      const jobUrl = cleanRow['job_url'] || '';
      const location = cleanRow['location'] || '';
      const workArrangementRaw = cleanRow['work_arrangement'] || '';
      const sourceName = cleanRow['source_name'] || '';

      if (!title || title.length < 2) {
        issues.push({
          type: 'error',
          field: 'job_title',
          message: 'Job Title is required and must be at least 2 characters.',
        });
      }

      if (!company || company.length < 2) {
        issues.push({
          type: 'error',
          field: 'company',
          message: 'Company Name is required.',
        });
      }

      if (!jobUrl) {
        issues.push({
          type: 'error',
          field: 'job_url',
          message: 'Job URL is required. Must be the original posting destination.',
        });
      } else {
        const urlCheck = jobVerificationEngine.verifyJobUrl(jobUrl);
        if (!urlCheck.isValid) {
          issues.push({
            type: 'error',
            field: 'job_url',
            message: urlCheck.reason || 'Invalid application URL.',
          });
        }
      }

      if (!location) {
        issues.push({
          type: 'error',
          field: 'location',
          message: 'Location / Market is required (e.g. "Bengaluru, India" or "Worldwide").',
        });
      }

      let remoteStatus: RemoteType = 'on-site';
      if (!workArrangementRaw) {
        issues.push({
          type: 'error',
          field: 'work_arrangement',
          message: 'Work arrangement is required (allowed: Remote, Hybrid, On-site).',
        });
      } else {
        const waLower = workArrangementRaw.toLowerCase();
        if (waLower.includes('remote')) {
          remoteStatus = 'remote';
        } else if (waLower.includes('hybrid')) {
          remoteStatus = 'hybrid';
        } else if (waLower.includes('on-site') || waLower.includes('onsite')) {
          remoteStatus = 'on-site';
        } else {
          issues.push({
            type: 'error',
            field: 'work_arrangement',
            message: `Unsupported work arrangement "${workArrangementRaw}". Allowed: Remote, Hybrid, On-site.`,
          });
        }
      }

      if (!sourceName) {
        issues.push({
          type: 'warning',
          field: 'source_name',
          message: 'Source name is missing; defaulting to "Excel Import".',
        });
      }

      // 2. Format & Type Validations
      const salaryMinRaw = cleanRow['salary_min'];
      const salaryMaxRaw = cleanRow['salary_max'];
      let salaryMin: number | undefined;
      let salaryMax: number | undefined;

      if (salaryMinRaw) {
        const parsedMin = parseFloat(salaryMinRaw.replace(/[^0-9.]/g, ''));
        if (isNaN(parsedMin)) {
          issues.push({
            type: 'error',
            field: 'salary_min',
            message: `Invalid salary minimum "${salaryMinRaw}". Must be numeric.`,
          });
        } else {
          salaryMin = parsedMin;
        }
      }

      if (salaryMaxRaw) {
        const parsedMax = parseFloat(salaryMaxRaw.replace(/[^0-9.]/g, ''));
        if (isNaN(parsedMax)) {
          issues.push({
            type: 'error',
            field: 'salary_max',
            message: `Invalid salary maximum "${salaryMaxRaw}". Must be numeric.`,
          });
        } else {
          salaryMax = parsedMax;
        }
      }

      if (salaryMin && salaryMax && salaryMin > salaryMax) {
        issues.push({
          type: 'error',
          field: 'salary_max',
          message: `Salary minimum (${salaryMin}) cannot exceed maximum (${salaryMax}).`,
        });
      }

      const salaryCurrency = (cleanRow['salary_currency'] || 'INR').toUpperCase();
      const salaryPeriodRaw = (cleanRow['salary_period'] || 'Annual').toLowerCase();
      let salaryPeriod: SalaryPeriod = 'yearly';
      if (salaryPeriodRaw.includes('month')) {
        salaryPeriod = 'monthly';
      } else if (salaryPeriodRaw.includes('hour')) {
        salaryPeriod = 'hourly';
      }

      // Posting Date
      const postingDateRaw = cleanRow['posting_date'];
      let validPostingDate = 'not_disclosed';
      if (postingDateRaw) {
        const parsedDate = new Date(postingDateRaw);
        if (isNaN(parsedDate.getTime())) {
          issues.push({
            type: 'error',
            field: 'posting_date',
            message: `Invalid date format "${postingDateRaw}". Use YYYY-MM-DD.`,
          });
        } else {
          validPostingDate = parsedDate.toISOString().split('T')[0];
        }
      } else {
        issues.push({
          type: 'warning',
          field: 'posting_date',
          message: 'Posting date not disclosed in spreadsheet.',
        });
      }

      // Recruiter email validation
      const recruiterEmail = cleanRow['recruiter_email'];
      if (recruiterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recruiterEmail)) {
        issues.push({
          type: 'error',
          field: 'recruiter_email',
          message: `Malformed recruiter email "${recruiterEmail}".`,
        });
      }

      // 3. Duplicate Detection Check
      let duplicateStatus: 'new' | 'exact_duplicate' | 'possible_duplicate' = 'new';
      let matchedJob: JobOpportunity | undefined;
      let duplicateReason: string | undefined;

      const normComp = normalizeString(company);
      const normTitle = normalizeString(title);
      const sourceJobId = cleanRow['source_job_id'];

      for (const existing of existingJobs) {
        // Direct URL match
        if (jobUrl && (existing.jobUrl === jobUrl || existing.canonicalUrl === jobUrl)) {
          duplicateStatus = 'exact_duplicate';
          matchedJob = existing;
          duplicateReason = `Exact match on job URL (${jobUrl})`;
          break;
        }

        // External ID match
        if (sourceJobId && existing.externalId && existing.externalId === sourceJobId) {
          duplicateStatus = 'exact_duplicate';
          matchedJob = existing;
          duplicateReason = `Exact match on source job ID "${sourceJobId}"`;
          break;
        }

        // Company + Title + Location match
        const existingComp = normalizeString(existing.company);
        const existingTitle = normalizeString(existing.title);
        if (normComp === existingComp && normTitle === existingTitle) {
          duplicateStatus = 'possible_duplicate';
          matchedJob = existing;
          duplicateReason = `Existing opportunity found for "${existing.title}" at ${existing.company}`;
          break;
        }
      }

      const hasErrors = issues.some((i) => i.type === 'error');
      const hasWarnings = issues.some((i) => i.type === 'warning');

      let rowStatus: 'valid' | 'warning' | 'error' = 'valid';
      if (hasErrors) {
        rowStatus = 'error';
      } else if (hasWarnings) {
        rowStatus = 'warning';
      }

      // Construct parsed Job Opportunity if no blocking errors
      let parsedJob: Partial<JobOpportunity> | undefined;
      if (!hasErrors) {
        const skillsArray = (cleanRow['skills'] || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const remoteScopeRaw = (cleanRow['remote_scope'] || '').toLowerCase();
        let remoteScope: RemoteScope = 'unknown';
        if (remoteScopeRaw.includes('worldwide') || remoteScopeRaw.includes('wfa')) {
          remoteScope = 'worldwide';
        } else if (remoteScopeRaw.includes('india')) {
          remoteScope = 'india';
        } else if (remoteScopeRaw.includes('specific')) {
          remoteScope = 'specific_countries';
        } else if (remoteScopeRaw.includes('region')) {
          remoteScope = 'region';
        }

        const isWFA = remoteStatus === 'remote' && remoteScope === 'worldwide';

        const country = location.toLowerCase().includes('india')
          ? 'India'
          : isWFA
          ? 'Worldwide'
          : 'Global';

        parsedJob = {
          id: `job-imported-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title,
          normalizedTitle: normTitle,
          company,
          jobUrl,
          applyUrl: jobUrl,
          canonicalUrl: jobUrl,
          officialListing: `${company} Listing`,
          location,
          country,
          remoteStatus,
          workArrangement: remoteStatus,
          remoteScope,
          workFromAnywhere: isWFA,
          eligibleCountries: isWFA ? ['*'] : [country],
          employmentType: 'full-time',
          seniority: (cleanRow['seniority']?.toLowerCase() || 'mid') as SeniorityLevel,
          department: cleanRow['department'] || undefined,
          industry: cleanRow['industry'] || 'Technology & Services',
          salary: {
            disclosed: Boolean(salaryMin || salaryMax),
            min: salaryMin,
            max: salaryMax,
            currency: salaryMin || salaryMax ? salaryCurrency : undefined,
            period: salaryPeriod,
            rawText:
              salaryMin && salaryMax
                ? `${salaryCurrency === 'INR' ? '₹' : salaryCurrency === 'EUR' ? '€' : '$'}${salaryMin.toLocaleString()} – ${salaryCurrency === 'INR' ? '₹' : salaryCurrency === 'EUR' ? '€' : '$'}${salaryMax.toLocaleString()}`
                : undefined,
          },
          salary_status: salaryMin || salaryMax ? 'disclosed' : 'not_disclosed',
          salary_source: 'user_imported',
          salary_raw_text:
            salaryMin && salaryMax
              ? `${salaryCurrency === 'INR' ? '₹' : salaryCurrency === 'EUR' ? '€' : '$'}${salaryMin.toLocaleString()} – ${salaryCurrency === 'INR' ? '₹' : salaryCurrency === 'EUR' ? '€' : '$'}${salaryMax.toLocaleString()}`
              : undefined,
          currency_conversion:
            (salaryMin || salaryMax) && salaryCurrency !== 'INR'
              ? jobVerificationEngine.calculateCurrencyConversion({
                  min: salaryMin,
                  max: salaryMax,
                  currency: salaryCurrency,
                  period: salaryPeriod,
                })
              : undefined,
          salaryMin,
          salaryMax,
          salaryCurrency: salaryMin || salaryMax ? salaryCurrency : undefined,
          salaryPeriod,
          primary_source: {
            id: `src-import-${Date.now()}`,
            name: sourceName || 'Excel Import',
            domain: new URL(jobUrl).hostname,
            type: 'job_board',
            sourceConfidence: 'discovered',
            discoveredAt: new Date().toISOString(),
            tier: 5,
            source_type: 'user_import',
            source_name: sourceName || 'Excel Import',
            sourceUrl: jobUrl,
          },
          secondary_sources: [],
          datePosted: validPostingDate,
          postingDate: validPostingDate,
          postingDatePrecision: validPostingDate !== 'not_disclosed' ? 'exact' : 'not_disclosed',
          closingDate: cleanRow['closing_date'] || undefined,
          dateDiscovered: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastVerified: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          verificationStatus: 'imported_needs_verification' as JobVerificationStatus,
          verificationMethod: 'import_check',
          verificationReason: 'Imported from spreadsheet; pending live source check',
          isVerifiedLive: false,
          isApplyUrlValidated: true,
          applyUrlStatus: 'valid',
          requiredSkills: skillsArray.slice(0, 10),
          preferredSkills: skillsArray.slice(10, 15),
          responsibilities: [],
          requirements: [],
          description: cleanRow['description'] || `${title} role at ${company}.`,
          lifecycleState: 'SAVED',
          source: {
            id: `src-import-${Date.now()}`,
            name: sourceName || 'Excel Import',
            domain: new URL(jobUrl).hostname,
            type: 'job_board',
            sourceUrl: jobUrl,
            sourceConfidence: 'discovered',
            discoveredAt: new Date().toISOString(),
          },
          sourceName: sourceName || 'Excel Import',
          sourcesHistory: [
            {
              sourceName: sourceName || 'Excel Import',
              sourceUrl: jobUrl,
              discoveredAt: new Date().toISOString(),
            },
          ],
          recruiterName: cleanRow['recruiter_name'] || undefined,
          recruiterEmail: cleanRow['recruiter_email'] || undefined,
          recruiterLinkedin: cleanRow['recruiter_linkedin'] || undefined,
          sourceJobId: cleanRow['source_job_id'] || undefined,
          notes: cleanRow['notes'] || undefined,
        };
      }

      validations.push({
        rowNumber,
        rawData: cleanRow,
        parsedJob,
        status: rowStatus,
        issues,
        duplicateStatus,
        matchedJob,
        duplicateReason,
        userDecision:
          duplicateStatus === 'exact_duplicate'
            ? 'skip'
            : duplicateStatus === 'possible_duplicate'
            ? 'keep_existing'
            : 'import_new',
      });
    });

    const validRows = validations.filter((v) => v.status === 'valid');
    const warningRows = validations.filter((v) => v.status === 'warning');
    const errorRows = validations.filter((v) => v.status === 'error');

    return {
      validRows,
      warningRows,
      errorRows,
      totalRows: validations.length,
    };
  }

  /**
   * Generates a downloadable CSV report of rejected rows.
   */
  public downloadErrorReport(
    rejectedRows: ImportRowValidation[],
    originalFilename: string = 'Import'
  ): void {
    const reportData = [
      ['Row Number', 'Job Title', 'Company', 'Status', 'Error Reasons'],
      ...rejectedRows.map((r) => [
        r.rowNumber.toString(),
        sanitizeCellValue(r.rawData['job_title'] || 'Unknown'),
        sanitizeCellValue(r.rawData['company'] || 'Unknown'),
        r.status.toUpperCase(),
        r.issues
          .filter((i) => i.type === 'error')
          .map((i) => i.message)
          .join('; '),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(reportData);
    const csvContent = XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${originalFilename.replace(/\.[^/.]+$/, '')}_Errors.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exports filtered or selected job opportunities as CSV or XLSX.
   */
  public exportJobs(
    jobs: JobOpportunity[],
    filename: string = 'CareerOs_Job_Database',
    format: 'csv' | 'xlsx' = 'csv'
  ): void {
    const headers = [
      'Job Title',
      'Company',
      'Location',
      'Workplace Type',
      'Match Score',
      'Seniority',
      'Salary Min',
      'Salary Max',
      'Currency',
      'Salary Period',
      'Salary Status',
      'CRM Status',
      'Source',
      'Date Posted',
      'Date Discovered',
      'Verification Status',
      'Job URL',
      'Apply URL',
      'Personal Notes',
    ];

    const rows = jobs.map((j) => [
      j.title,
      j.company,
      j.location || '',
      j.workplace_type || j.remoteStatus || '',
      j.profile_match_score || j.match_score || (j as any).match?.overallScore || 0,
      j.seniority || '',
      j.salary?.min ?? '',
      j.salary?.max ?? '',
      j.salary?.currency || j.currency || '',
      j.salary?.period || '',
      j.salary?.disclosed ? 'Disclosed' : 'Undisclosed',
      j.crm_status || j.lifecycleState || '',
      j.sourceName || j.source?.name || '',
      j.originalPostedAt || j.datePosted || '',
      j.discoveredAt || j.dateDiscovered || '',
      j.verificationStatus || '',
      j.jobUrl || '',
      j.applyUrl || '',
      j.notes || '',
    ]);

    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-fit column widths
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...rows.slice(0, 100).map((r) => String(r[i] ?? '').length)
      );
      return { wch: Math.min(40, Math.max(12, maxLen + 2)) };
    });
    ws['!cols'] = colWidths;

    const cleanFilename = filename.replace(/[^a-zA-Z0-9_\-]/g, '_');

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Jobs');
      XLSX.writeFile(wb, `${cleanFilename}.xlsx`);
    } else {
      const csvContent = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${cleanFilename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }
}

export const excelImportService = new ExcelImportService();
