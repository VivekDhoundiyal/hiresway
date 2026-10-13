/**
 * CareerOs Job Discovery & Intelligence Types
 * Canonical data structures for the 1000+ Source Ecosystem, Ingestion Pipeline,
 * Deduplication Engine, Multi-Dimensional Matching, and Behavioral Learning.
 */

export const MAX_JOB_AGE_DAYS = 7;
export const EXPANDED_JOB_AGE_DAYS = 14;

export type JobLifecycleState =
  | 'DISCOVERED'
  | 'QUALIFIED'
  | 'IN_FEED'
  | 'HISTORICAL'
  | 'VIEWED'
  | 'SAVED'
  | 'REJECTED'
  | 'APPLIED'
  | 'ASSIGNMENT'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'ARCHIVED'
  | 'EXPIRED'
  | 'NEW'
  | 'ACTIVE'
  | 'UPDATED'
  | 'CLOSED'
  | 'REMOVED';

export type RemoteEligibilityStatus =
  | 'WORLDWIDE_REMOTE'
  | 'REMOTE_FROM_INDIA'
  | 'REMOTE_REGION_RESTRICTED'
  | 'REMOTE_COUNTRY_RESTRICTED'
  | 'HYBRID'
  | 'ONSITE'
  | 'UNKNOWN';

export interface RemoteEligibilityRecord {
  status: RemoteEligibilityStatus;
  scope: 'worldwide' | 'india' | 'region_restricted' | 'country_restricted' | 'onsite_hybrid' | 'unknown';
  eligibleCountries: string[];
  excludedCountries: string[];
  locationText: string;
  workAuthRequirement?: string;
  evidence: string;
  confidence: number; // 0 - 100
  isIndiaEligible: boolean;
}

export type SalaryTruthStatus =
  | 'EMPLOYER_STATED'
  | 'NOT_DISCLOSED'
  | 'STRUCTURED_SOURCE_STATED';

export interface SalaryTruthRecord {
  status: SalaryTruthStatus;
  min?: number;
  max?: number;
  currency?: string;
  period?: SalaryPeriod;
  rawText?: string;
  sourceUrl?: string;
  evidence?: string;
  verifiedAt?: string;
}

export type CRMJobStatus =
  | 'Interested'
  | 'Shortlisted'
  | 'Saved'
  | 'Viewed'
  | 'To Apply'
  | 'Applied'
  | 'Application Submitted'
  | 'Assessment'
  | 'Assignment'
  | 'Recruiter Screen'
  | 'HR Interview'
  | 'Hiring Manager Interview'
  | 'Technical Interview'
  | 'Final Interview'
  | 'Offer'
  | 'Negotiation'
  | 'Accepted'
  | 'Rejected'
  | 'Withdrawn'
  | 'On Hold'
  | 'Closed'
  | 'Archived';

export type NextActionType =
  | 'Apply'
  | 'Complete assignment'
  | 'Follow up with recruiter'
  | 'Prepare interview'
  | 'Send thank-you email'
  | 'Negotiate offer'
  | 'Wait for response'
  | 'Review feedback'
  | 'Submit documents'
  | 'Custom';

export interface NextActionRecord {
  action: NextActionType | string;
  dueDate?: string;
  notes?: string;
  completed?: boolean;
}

export interface JobActivityLogEntry {
  id: string;
  timestamp: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  notes?: string;
}

export type SourceOperationalState =
  | 'ACTIVE'
  | 'PENDING'
  | 'CHECKING'
  | 'SUCCESS'
  | 'FAILED'
  | 'QUARANTINED'
  | 'DISABLED'
  | 'SKIPPED'
  | 'REGISTERED'
  | 'ENABLED'
  | 'ELIGIBLE'
  | 'QUEUED'
  | 'QUERYING'
  | 'NO_RESULTS'
  | 'BLOCKED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PARSER_ERROR'
  | 'STALE'
  | 'UNVERIFIED';

export type SourceHealthState =
  | 'HEALTHY'
  | 'TEMPORARILY_FAILED'
  | 'BLOCKED'
  | 'PARSER_ERROR'
  | 'NOT_FOUND'
  | 'DECOMMISSIONED'
  | 'QUARANTINED'
  | 'DISABLED';

export const HIGH_MATCH_THRESHOLD = 80;

export type FitTier =
  | 'EXCELLENT FIT'
  | 'STRONG FIT'
  | 'GOOD FIT'
  | 'POTENTIAL FIT'
  | 'LOW FIT';

export type RemoteType = 'remote' | 'hybrid' | 'on-site';

export type EmploymentType =
  | 'full-time'
  | 'contract'
  | 'part-time'
  | 'internship';

export type SeniorityLevel =
  | 'entry'
  | 'mid'
  | 'senior'
  | 'lead'
  | 'manager'
  | 'director'
  | 'executive';

export type SalaryStatus = 'disclosed' | 'not_disclosed' | 'ambiguous' | 'conflicting';

export type SalarySource =
  | 'official_job_posting'
  | 'official_ats'
  | 'verified_source'
  | 'user_imported'
  | 'third_party_estimate';

export type SalaryPeriod =
  | 'hourly'
  | 'monthly'
  | 'annual'
  | 'yearly'
  | 'unspecified'
  | 'not_disclosed';

export type SalaryType =
  | 'base'
  | 'total_compensation'
  | 'salary_range'
  | 'commission'
  | 'bonus'
  | 'equity'
  | 'unspecified';

export interface MarketSalaryEstimate {
  min?: number;
  max?: number;
  currency?: string;
  period?: string;
  source: string;
  sourceUrl?: string;
  estimatedAt?: string;
  notes?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface CurrencyConversion {
  original_compensation: {
    min?: number;
    max?: number;
    currency: string;
    period: string;
    rawText?: string;
  };
  converted_compensation: {
    min?: number;
    max?: number;
    currency: string;
    period: string;
    rawText?: string;
  };
  exchange_rate: number;
  exchange_rate_timestamp: string;
}

export interface JobCompensation {
  disclosed: boolean;
  salary_status?: SalaryStatus;
  salary_source?: SalarySource;
  salary_raw_text?: string;
  salary_source_excerpt?: string;
  salary_source_url?: string;
  salary_verified_at?: string;
  salary_period?: SalaryPeriod;
  salary_type?: SalaryType;
  min?: number;
  max?: number;
  currency?: string; // Original currency string (e.g. 'USD', 'INR', 'EUR', 'GBP')
  rawText?: string; // Formatted original text, e.g. "₹18,00,000–₹25,00,000" or "$120,000 - $160,000"
  period?: SalaryPeriod;
  market_salary_estimate?: MarketSalaryEstimate;
  currency_conversion?: CurrencyConversion;
  bonus?: string;
  commission?: string;
  equity?: string;
}

export type SourceType =
  | 'direct_career_page'
  | 'ats_hosted'
  | 'job_board'
  | 'remote_community'
  | 'aggregator'
  | 'yc_startup'
  | 'linkedin'
  | 'company_career_portal'
  | 'verified_search';

export type ATSType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'smartrecruiters'
  | 'teamtailor'
  | 'recruitee'
  | 'workday'
  | 'custom'
  | 'none';

export type SourceConfidence =
  | 'verified_ats'
  | 'direct_employer'
  | 'curated_board'
  | 'discovered';

export interface JobSourceMetadata {
  id: string;
  name: string;
  domain: string;
  type: SourceType;
  sourceUrl: string;
  atsType?: ATSType;
  sourceConfidence: SourceConfidence;
  discoveredAt: string; // ISO date
  tier?: number;
  source_type?: string;
  source_name?: string;
}

export interface DiscoveredSourceRecord {
  sourceName: string;
  sourceUrl: string;
  discoveredAt: string;
}

export interface JobVerificationEvidence {
  httpStatus?: number;
  finalUrl?: string;
  redirectDetected?: boolean;
  pageTitle?: string;
  jobTitleFound?: boolean;
  companyNameFound?: boolean;
  activeRequisition?: boolean;
  verifiedTimestamp?: string;
  rawExcerpt?: string;
  checkedCriteria?: string[];
}

export interface RawDiscoveredJob {
  id?: string;
  externalId?: string;
  title: string;
  company: string;
  companyDomain?: string;
  companyLogo?: string;
  companyLogoData?: CompanyLogoData;
  jobUrl?: string;
  url?: string;
  location: string;
  remoteType?: 'remote' | 'hybrid' | 'on-site';
  salaryRaw?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryStatus?: SalaryStatus;
  salarySource?: SalarySource;
  salarySourceExcerpt?: string;
  salaryConfidence?: 'high' | 'medium' | 'low' | 'none';
  salaryIsExplicit?: boolean;
  marketSalaryEstimate?: MarketSalaryEstimate;
  currencyConversion?: CurrencyConversion;
  employmentType?: 'full-time' | 'contract' | 'part-time' | 'internship';
  requiredSkills?: string[];
  preferredSkills?: string[];
  industry?: string;
  description: string;
  postedDate?: string;
  originalPostedAt?: string;
  lastUpdatedAt?: string;
  discoveredAt?: string;
  lastVerifiedAt?: string;
  postedAtRaw?: string;
  postedDatePrecision?: 'exact' | 'date_only' | 'relative' | 'month_only' | 'unknown' | 'not_disclosed';
  sourceId?: string;
  sourceName?: string;
  sourceUrl?: string;
  source?: {
    id?: string;
    name?: string;
    domain?: string;
    type?: string;
    confidence?: string;
    sourceConfidence?: string;
    sourceUrl?: string;
  };
  dateDiscovered?: string;
  applyUrl?: string;
  isVerifiedLive?: boolean;
  lastVerified?: string;
  officialListing?: string;
  isApplyUrlValidated?: boolean;
  applyUrlStatus?: 'valid' | 'unavailable' | 'failed';
  verificationStatus?: JobVerificationStatus;
  verificationEvidence?: JobVerificationEvidence;
  duplicateGroupId?: string;
  atsType?: ATSType;
  isTargetCompany?: boolean;
  targetCompanyTag?: TargetCompanyTag;
  targetCompanyReason?: string;
}

export type JobVerificationStatus =
  | 'LIVE_VERIFIED'
  | 'LIVE_UNVERIFIED'
  | 'STALE'
  | 'EXPIRED'
  | 'REMOVED'
  | 'INVALID_URL'
  | 'SOURCE_ERROR'
  | 'verified_live'
  | 'recently_verified'
  | 'needs_verification'
  | 'link_broken'
  | 'job_closed'
  | 'expired'
  | 'removed'
  | 'duplicate'
  | 'imported_needs_verification'
  | 'verification_failed'
  | 'expired_removed'
  | 'unverified'
  | 'failed';

export type ApplicationPipelineStage =
  | 'not_applied'
  | 'saved'
  | 'ready_to_apply'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'closed'
  | 'withdrawn'
  | 'archived';

export type RemoteScope =
  | 'worldwide'
  | 'india'
  | 'remote_worldwide'
  | 'remote_india_eligible'
  | 'remote_region_restricted'
  | 'remote_country_restricted'
  | 'specific_countries'
  | 'region'
  | 'unknown';

export interface JobOpportunity {
  id: string; // Unique deterministic ID or UUID
  canonical_job_id?: string; // Canonical deduplicated opportunity ID
  externalId?: string; // External ATS or requisition identifier
  sourceJobId?: string; // Alias for externalId
  fingerprint: string; // Hash of normalized (company + title + location + requisitionId)
  canonicalJobHash?: string; // Alias for fingerprint
  title: string;
  normalizedTitle: string;
  company: string;
  companyName?: string; // Canonical alias
  companyDomain?: string;
  companyLogo?: string;
  companyLogoData?: CompanyLogoData;
  department?: string;
  job_family?: string;
  jobUrl: string;
  originalUrl?: string; // Canonical alias
  applyUrl: string; // Guaranteed authentic, verified application URL
  canonicalUrl?: string;
  officialListing?: string; // Verified employer official listing descriptor
  isVerifiedLive: boolean; // Confirmed currently live and reachable
  isApplyUrlValidated: boolean; // Confirmed apply destination is live and non-generic
  applyUrlStatus?: 'valid' | 'unavailable' | 'failed';
  verificationStatus: JobVerificationStatus;
  verifiedAt?: string; // Canonical alias for lastVerified
  verificationMethod?: 'ats_api' | 'html_probe' | 'url_structure' | 'manual_review' | 'import_check';
  verificationReason?: string;
  source: JobSourceMetadata;
  sourceId?: string;
  sourceName?: string;
  sourceType?: SourceType;
  primary_source?: JobSourceMetadata;
  secondary_sources?: Array<{
    name: string;
    url: string;
    discoveredAt: string;
    sourceType?: string;
    salaryRaw?: string;
  }>;
  sourcesHistory: DiscoveredSourceRecord[]; // For deduplication tracking
  
  // Canonical Date Data Model (Strict 7-Day Window Mandates 1 & 2)
  originalPostedAt?: string; // ISO date of original employer publication (undefined if unknown)
  lastUpdatedAt?: string;    // ISO date when employer updated posting (only shown when available)
  discoveredAt?: string;     // ISO date when CareerOS discovered the posting
  lastVerifiedAt?: string;   // ISO date when listing was confirmed live and reachable

  datePosted: string; // ISO date or "not_disclosed"
  postingDate?: string; // Canonical alias
  postingDatePrecision?: 'exact' | 'date_only' | 'relative' | 'month_only' | 'unknown' | 'not_disclosed';
  posted_at?: string;
  posted_at_raw?: string;
  posted_date_precision?: 'exact' | 'date_only' | 'relative' | 'month_only' | 'unknown' | 'not_disclosed';
  posting_date_source?: string;
  posting_date_source_url?: string;
  posting_date_verified_at?: string;
  closingDate?: string;
  dateDiscovered: string; // ISO date
  createdAt?: string; // Canonical alias
  updatedAt?: string;
  lastVerified: string; // ISO date when verified live
  location: string;
  country: string; // e.g. 'United States', 'India', 'Germany', 'Global'
  city?: string;
  remoteStatus: RemoteType;
  workArrangement?: RemoteType; // Canonical alias
  remoteScope?: RemoteScope;
  remote_scope?: RemoteScope;
  remote_countries?: string[];
  workFromAnywhere: boolean; // True if candidate can work from anywhere or user country
  eligibleCountries: string[]; // ['*'] for worldwide, or array of ISO/names
  employmentType: EmploymentType;
  salary: JobCompensation;
  salary_status?: SalaryStatus;
  salary_source?: SalarySource;
  salary_raw_text?: string;
  salary_source_excerpt?: string;
  salary_source_url?: string;
  salary_verified_at?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  market_salary_estimate?: MarketSalaryEstimate;
  currency_conversion?: CurrencyConversion;
  conflicting_fields?: Record<string, { official: string; thirdParty: string; source: string }>;
  integrity_score?: number;
  verification_errors?: string[];
  seniority: SeniorityLevel;
  minExperienceYears?: number;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  requirements: string[];
  industry: string;
  visaWorkAuthRequirements?: string;
  educationRequirements?: string;
  description: string;
  lifecycleState: JobLifecycleState;
  applicationStatus?: ApplicationPipelineStage;
  isTargetCompany?: boolean;
  targetCompanyTag?: TargetCompanyTag;
  targetCompanyReason?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterLinkedin?: string;
  importBatchId?: string;
  notes?: string;

  // Canonical Job Record & Provenance (Section 1)
  job_id?: string;
  canonical_job_url?: string;
  official_company?: string;
  official_company_domain?: string;
  job_title?: string;
  original_job_description?: string;
  source_name?: string;
  source_url?: string;
  source_type?: SourceType;
  recruiter_posted_at?: string;
  first_seen_at?: string;
  last_verified_at?: string;
  job_status?: JobLifecycleState;
  location_raw?: string;
  normalized_locations?: string[];
  salary_raw?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: SalaryPeriod;
  salary_confidence?: 'high' | 'medium' | 'low' | 'none';
  salary_is_explicit?: boolean;
  skills?: string[];
  application_url?: string;
  verification_status?: JobVerificationStatus;
  verification_evidence?: JobVerificationEvidence;
  duplicate_group_id?: string;
  match_score?: number;
  match_reasons?: string[];
  mismatch_reasons?: string[];

  // Dedicated Remote, Salary, and CRM Extensions
  remote_eligibility?: RemoteEligibilityRecord;
  salary_truth?: SalaryTruthRecord;
  salary_verified?: boolean;
  salary_confirmed?: boolean;
  source_status?: SourceHealthState;
  crm_status?: CRMJobStatus;
  next_action?: NextActionRecord;
  activity_timeline?: JobActivityLogEntry[];
  viewed_at?: string;
  viewedAt?: string;
  last_seen_at?: string;
  new_until?: string;
  is_new?: boolean;
  isNew?: boolean;
  is_viewed?: boolean;
  is_saved?: boolean;
  is_hidden?: boolean;
  is_target_company?: boolean;

  // Canonical Schema Properties (Requirement 15)
  source_job_id?: string;
  canonical_url?: string;
  workplace_type?: RemoteType;
  employment_type?: EmploymentType;
  experience?: string | number;
  currency?: string;
  expires_at?: string;
  target_company?: boolean;
  profile_match_score?: number;
  dedupe_hash?: string;
  feed_status?: FeedStatus;

  clean_description?: string;
  original_description?: string;
  official_job_url?: string;
  source_id?: string;
  company_id?: string;
  normalized_title?: string;
  locations?: string[];
  remote_type?: RemoteType;
  experience_min?: number;
  experience_max?: number;
  status?: JobLifecycleState;
  job_hash?: string;
  canonical_hash?: string;
}

export type FeedStatus =
  | 'PUBLISHED'
  | 'PENDING'
  | 'REJECTED'
  | 'EXPIRED'
  | 'HISTORICAL'
  | 'ARCHIVED';

export interface FeedItem {
  id: string;
  job: JobOpportunity;
  discovered_at: string;
  published_to_feed_at: string;
  first_viewed_at?: string;
  feed_expires_at: string;
  saved_to_database_at?: string;
  application_status?: CRMJobStatus;
  dismissed_at?: string;
  is_pending?: boolean;
}

export interface DiscoveryTelemetryMetrics {
  discovered: number;
  verified: number;
  rejected: number;
  duplicates: number;
  profileMatched: number;
  publishedToFeed: number;
  saved: number;
}

export type PerSourceDiscoveryStatus =
  | 'queued'
  | 'fetching'
  | 'parsed'
  | 'verified'
  | 'rejected'
  | 'published';

export interface ImportRowValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

export type JobImportDecision = 'keep_existing' | 'update_existing' | 'import_new' | 'skip';

export interface ImportRowValidation {
  rowNumber: number;
  rawData: Record<string, unknown>;
  parsedJob?: Partial<JobOpportunity>;
  status: 'valid' | 'warning' | 'error';
  issues: ImportRowValidationIssue[];
  duplicateStatus: 'new' | 'exact_duplicate' | 'possible_duplicate';
  matchedJob?: JobOpportunity;
  duplicateReason?: string;
  userDecision?: JobImportDecision;
}

export interface ImportBatchRecord {
  id: string;
  filename: string;
  importedAt: string; // ISO timestamp
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  rejectedCount: number;
  results: {
    rowNumber: number;
    title: string;
    company: string;
    status: 'imported' | 'updated' | 'skipped' | 'rejected';
    verificationStatus: JobVerificationStatus;
    reason?: string;
  }[];
}

export interface CompanyLogoData {
  url: string;
  source: 'official' | 'trusted_provider' | 'favicon' | 'initial_fallback';
  type: 'svg' | 'png' | 'webp' | 'ico' | 'monogram';
  isVerified: boolean;
  fetchedAt: string;
}

export type TargetCompanyTag = 'Dream' | 'Priority' | 'Watchlist' | 'Active Pipeline';

export type TargetCompanyMonitoringStatus =
  | 'active'
  | 'temporarily_unavailable'
  | 'retrying'
  | 'needs_review'
  | 'needs_attention'
  | 'paused'
  | 'failed';

export type TargetCompanyVerificationStatus =
  | 'verified'
  | 'needs_review'
  | 'needs_verification'
  | 'unverified'
  | 'failed';

export type TargetCompanyDiscoveryStage =
  | 'idle'
  | 'resolving_identity'
  | 'discovering_careers'
  | 'detecting_ats'
  | 'verifying_source'
  | 'checking_jobs'
  | 'fetching_jobs'
  | 'complete'
  | 'failed';

export interface DiscoveryLogEntry {
  timestamp: string;
  stage: string;
  message: string;
}

export type CareersPlatformType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'smartrecruiters'
  | 'workable'
  | 'custom'
  | 'unverified';

export type CompanyDiscoveryStatus =
  | 'Active'
  | 'Discovering'
  | 'Paused'
  | 'Failed'
  | 'No careers page found'
  | 'Needs configuration'
  | 'active'
  | 'discovering'
  | 'paused'
  | 'failed'
  | 'no_careers_page'
  | 'needs_configuration';

export interface TargetCompanyCareerSource {
  sourceId: string;
  companyId: string;
  companyName: string;
  officialDomain: string;
  careerUrl: string;
  canonicalUrl: string;
  sourceType: SourceType;
  atsProvider: CareersPlatformType;
  atsOrganizationId?: string;
  discoveryMethod:
    | 'official_domain'
    | 'ats_detection'
    | 'search_discovery'
    | 'redirect_chain'
    | 'manual_override'
    | 'authoritative_catalog';
  verificationStatus: TargetCompanyVerificationStatus;
  verificationConfidence: number; // 0-100
  verificationEvidence: string[];
  active: boolean;
  monitoringEnabled: boolean;
  lastCheckedAt: string;
  lastSuccessfulSyncAt?: string;
  nextCheckAt?: string;
  jobCount: number;
  newJobCount: number;
  errorCount: number;
  lastError?: string;
  discoveryLog: DiscoveryLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TargetCompany {
  // Canonical model fields (spec compliant)
  company_id: string;
  canonical_name: string;
  display_name: string;
  aliases: string[];
  website: string;
  domain: string;
  logo_url: string;
  career_page_url?: string;
  linkedin_url?: string;
  industry: string;
  company_size?: string;
  location: string;
  target_status: TargetCompanyTag;
  created_at: string;
  updated_at: string;
  source: string; // 'excel_import' | 'manual' | 'profile_sync'
  discovery_enabled: boolean;

  // Real Discovery Source Telemetry fields
  discovery_status: CompanyDiscoveryStatus;
  discovery_source_id?: string;
  last_checked_at: string;
  last_successful_discovery_at?: string;
  jobs_discovered: number;
  live_jobs: number;
  failed_attempts: number;
  discovery_error?: string;

  // Existing property aliases for complete backward compatibility
  id: string;
  canonicalCompanyId: string;
  name: string;
  normalizedName: string;
  tag: TargetCompanyTag;
  officialDomain: string;
  officialWebsite: string;
  logoUrl?: string;
  logo?: CompanyLogoData;
  headquarters: string;
  careersUrl?: string;
  careersPlatform: CareersPlatformType;
  sourceType: SourceType;
  verificationStatus: TargetCompanyVerificationStatus;
  monitoringStatus: TargetCompanyMonitoringStatus;
  discoveryStatus?: TargetCompanyDiscoveryStage;
  verificationConfidence?: number;
  verificationEvidence?: string[];
  discoveryLog?: DiscoveryLogEntry[];
  atsOrganizationId?: string;
  lastSuccessfulSyncAt?: string;
  lastCheckedAt: string;
  nextCheckAt?: string;
  lastDiscoveryAt?: string;
  matchingOpeningsCount: number;
  totalOpeningsCount: number;
  addedVia: 'manual' | 'excel_import' | 'profile_sync';
  createdAt: string;
  updatedAt: string;
  notes?: string;
  hiringActivity: 'very_high' | 'active' | 'moderate' | 'low';
  careerSource?: TargetCompanyCareerSource;
  websiteUrl?: string;
  careerPageUrl?: string;
  linkedinUrl?: string;
  lastCheckedDate?: string;
  openRolesCount?: number;
  matchingRolesCount?: number;
  dateAdded?: string;
}

export interface ExcelCompanyImportResult {
  importedCount: number;
  addedCount?: number;
  totalRequested?: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  finalPersistentCount?: number;
  added: TargetCompany[];
  updated: TargetCompany[];
  errors: Array<{ rowNumber?: number; companyName: string; reason: string }>;
  // Backward compatibility
  careerPagesFoundCount: number;
  logosFoundCount: number;
  currentlyMonitoredCount: number;
  failedCompanies: Array<{ name: string; reason: string }>;
}

export type TargetCompanyEntry = TargetCompany;

export interface CompanySuggestionItem {
  name: string;
  canonicalName: string;
  domain: string;
  industry: string;
  headquarters: string;
  logoUrl?: string;
  logoData?: CompanyLogoData;
  careersUrl?: string;
  careersPlatform?: CareersPlatformType;
  isVerified: boolean;
  confidence: number;
}

export interface CompanyDisambiguationChoice {
  id: string;
  name: string;
  domain: string;
  industry: string;
  headquarters: string;
  logoUrl?: string;
  logoData?: CompanyLogoData;
  careersUrl?: string;
  careersPlatform?: CareersPlatformType;
  description?: string;
}

export interface ExcelCompanyImportRow {
  rowNumber: number;
  rawName: string;
  cleanedName: string;
  status: 'ready_to_add' | 'already_monitored' | 'duplicate_in_file' | 'needs_review';
  reason?: string;
  tag?: TargetCompanyTag;
  resolvedCompany?: CompanySuggestionItem;
}

export interface ExcelImportPreviewSummary {
  totalRowsFound: number;
  readyToAddCount: number;
  alreadyMonitoredCount: number;
  duplicateInFileCount: number;
  needsReviewCount: number;
  rows: ExcelCompanyImportRow[];
}

export type EnrichmentStage =
  | 'queued'
  | 'identifying_company'
  | 'finding_logo'
  | 'finding_careers'
  | 'verifying_source'
  | 'completed'
  | 'failed';

export interface EnrichmentProgressEvent {
  companyId: string;
  companyName: string;
  stage: EnrichmentStage;
  message: string;
  isComplete: boolean;
  isSuccess: boolean;
}

export type SourceCategory =
  | 'company_ats'
  | 'startup_vc'
  | 'remote_first'
  | 'major_aggregator'
  | 'regional_portal'
  | 'target_company';

export type SourceEligibilityStatus =
  | 'eligible'
  | 'already_active'
  | 'unavailable'
  | 'requires_configuration'
  | 'unsupported';

export interface JobSourceRegistryEntry {
  id: string;
  name: string;
  domain: string;
  sourceType: SourceType;
  category?: SourceCategory;
  country: string; // 'global' or country name
  supportedLocations: string[];
  jobCategories: string[];
  atsType: ATSType;
  discoveryMethod: 'api' | 'feed' | 'crawl' | 'search_index' | 'user_imported';
  lastSuccessfulFetch?: string; // ISO date
  lastCheckedAt?: string; // ISO date
  lastFailureAt?: string; // ISO date
  sourceHealth: 'healthy' | 'degraded' | 'failed' | 'never_checked' | 'rate_limited' | 'inactive' | 'failing' | 'quarantined';
  healthState?: SourceHealthState;
  lastHttpStatus?: number;
  updateFrequency: 'hourly' | 'daily' | 'weekly';
  activeStatus: boolean;
  eligibilityStatus?: SourceEligibilityStatus;
  ineligibilityReason?: string;
  quarantineReason?: string;
  skipReason?: string;
  endpointUrl?: string;
  description?: string;
  jobs_found?: number;
  jobs_verified?: number;
  jobs_rejected?: number;
  dead_urls?: number;
  duplicate_rate?: number;
  data_completeness?: number;
  last_error?: string;
  operationalStatus?: SourceOperationalState;
  connectorType?: string;
  companyName?: string;
  nextScheduledCheck?: string;
  jobsDiscoveredCount?: number;
  jobsAcceptedCount?: number;
  jobsRejectedCount?: number;
  jobsCurrentlyLiveCount?: number;
  errorCount?: number;
  consecutiveFailures?: number;
  responseTimeMs?: number;
  verificationState?: 'verified' | 'unverified' | 'failed' | 'checking';
  extractionStrategy?: string;
}

export type UserActionType =
  | 'view'
  | 'open'
  | 'save'
  | 'reject'
  | 'skip'
  | 'apply'
  | 'interview'
  | 'offer'
  | 'not_now';

export type RejectionReasonTag =
  | 'salary_low'
  | 'wrong_seniority'
  | 'unwanted_industry'
  | 'location_unwanted'
  | 'skills_mismatch'
  | 'culture_fit'
  | 'other';

export interface UserJobAction {
  id: string;
  jobId: string;
  action: UserActionType;
  timestamp: string; // ISO date
  jobSnapshot: {
    title: string;
    company: string;
    industry: string;
    location: string;
    remoteStatus: RemoteType;
    seniority?: SeniorityLevel;
    skills?: string[];
    salaryMin?: number;
    salaryMax?: number;
    currency?: string;
  };
  rejectionReason?: RejectionReasonTag;
  notes?: string;
}

export interface LearnedPreferences {
  disfavoredIndustries: Record<string, number>; // industry -> count/weight
  disfavoredTitles: Record<string, number>;
  disfavoredCompanies: Record<string, number>;
  disfavoredSkills: Record<string, number>;
  disfavoredSeniority: Record<string, number>;
  disfavoredLocations: Record<string, number>;
  disfavoredRemoteTypes: Record<string, number>;
  minObservedAcceptableSalary?: number;
  maxObservedRejectedSalary?: number;
  preferredIndustries: Record<string, number>;
  preferredTitles: Record<string, number>;
  preferredSkills: Record<string, number>;
  preferredCompanies: Record<string, number>;
  preferredSeniority: Record<string, number>;
  preferredLocations: Record<string, number>;
  preferredRemoteTypes: Record<string, number>;
  totalActionsCount?: number;
  totalRejectionsCount?: number;
  totalSavesCount?: number;
  totalAppliesCount?: number;
  totalViewsCount?: number;
  lastUpdated: string;
}

export interface MultiDimensionalMatch {
  overallScore: number; // 0 - 100
  tier: FitTier;
  roleRelevanceScore: number; // 0 - 100
  skillsMatchScore: number; // 0 - 100
  seniorityExperienceScore: number; // 0 - 100
  locationEligibilityScore: number; // 0 - 100
  compensationScore: number; // 0 - 100
  industryPreferenceScore: number; // 0 - 100
  whyYouMatch: string[];
  potentialConcerns: string[];
  skillsYouHave: string[];
  skillsMissingOrUncertain: string[];
  remoteEligibilityNote: string;
  calculatedAt: string;
}

export interface LocationPreferenceModel {
  allowRemoteWorldwide: boolean;
  allowRemoteIndiaEligible: boolean;
  allowIndiaHybrid: boolean;
  allowIndiaOnsite: boolean;
  selectedCountries: string[];
  selectedCities: string[];
}

export interface ConnectorRunTelemetry {
  sourceId: string;
  sourceName: string;
  category: SourceCategory;
  atsType: ATSType;
  status: 'active' | 'success' | 'failed' | 'rate_limited' | 'blocked' | 'disabled';
  durationMs: number;
  jobsDiscovered: number;
  jobsVerified: number;
  errorMessage?: string;
  timestamp: string;
}

export type DiscoveryRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED';

export interface SourceRunTelemetry {
  sourceId: string;
  sourceName: string;
  domain: string;
  category?: SourceCategory | string;
  atsType?: ATSType;
  status: 'SUCCESS' | 'NO_RESULTS' | 'FAILED' | 'TIMEOUT' | 'BLOCKED' | 'PARSER_ERROR';
  durationMs: number;
  jobsDiscovered: number;
  newJobs: number;
  duplicates: number;
  errorMessage?: string;
  timestamp: string;
}

export interface DiscoveryRunRecord {
  id: string;
  runId?: string;
  startedAt: string;
  completedAt?: string;
  status: DiscoveryRunStatus;
  requestedSourceCount: number;
  eligibleSourceCount: number;
  queriedSourceCount: number;
  successfulSourceCount: number;
  failedSourceCount: number;
  timedOutSourceCount: number;
  sourcesReturningZeroJobs: number;
  sourcesReturningJobs: number;
  rawJobsDiscovered: number;
  validJobsDiscovered: number;
  duplicateJobsRemoved: number;
  newJobsAdded: number;
  existingJobsRefreshed: number;
  invalidRecordsCount?: number;
  decommissionedSourceCount?: number;
  rejectedJobs: number;
  durationMs?: number;
  errorMessage?: string;
  sourceBreakdown: SourceRunTelemetry[];
  connectors?: ConnectorRunTelemetry[];
  // Telemetry & compatibility fields
  sourcesEligibleCount?: number;
  sourcesTimedOutCount?: number;
  sourcesZeroResultsCount?: number;
  newOpportunitiesCount?: number;
  normalizedCount?: number;
  rejectedCount?: number;
  sourceTelemetry?: Record<string, SourceRunTelemetry>;
  sourcesQueriedCount?: number;
  sourcesSucceededCount?: number;
  sourcesFailedCount?: number;
  sourcesWithResultsCount?: number;
  rawDiscoveredCount?: number;
  duplicatesRemovedCount?: number;
  invalidRemovedCount?: number;
  verifiedOpportunitiesCount?: number;
  pendingSourceCount?: number;
  skippedSourceCount?: number;
  quarantinedSourceCount?: number;
  jobsVerifiedCount?: number;
  jobsRejectedCount?: number;
  profileMatchedCount?: number;
  publishedToFeedCount?: number;
  savedCount?: number;
  error?: string;
}

export type DiscoveryRun = DiscoveryRunRecord;

export type JobSortOption =
  | 'best_match'
  | 'newest'
  | 'recently_updated'
  | 'highest_match'
  | 'salary_high_low'
  | 'salary_low_high'
  | 'target_companies'
  | 'closing_soon'
  // Legacy aliases
  | 'match'
  | 'freshness'
  | 'salary'
  | 'company'
  | 'match_percent';

export interface JobFilterCriteria {
  searchQuery: string;
  fitTier: 'all' | FitTier;
  remoteType: 'all' | RemoteType | 'wfa';
  countryMarket: 'all' | 'home' | 'global_remote' | 'wfa' | 'india_global';
  salaryDisclosedOnly: boolean;
  minSalary?: number;
  seniority: 'all' | SeniorityLevel;
  industry: 'all' | string;
  targetCompanyOnly?: boolean;
  sortBy: JobSortOption;
  roleFilter?: string;
  locationFilter?: string;
  experienceMin?: number;
  companyFilter?: string;
  jobType?: string;
  postedWithinDays?: number;
  verifiedOnly?: boolean;

  // Multi-Select Filter Arrays (Requirement 7: All 22 Filters)
  roles?: string[];
  roleFamilies?: string[];
  locations?: string[];
  workplaces?: string[];
  remoteStatuses?: string[];
  remoteEligibilities?: string[];
  worldwideRemoteOnly?: boolean;
  countries?: string[];
  regions?: string[];
  seniorities?: string[];
  experiences?: string[];
  employmentTypes?: string[];
  salaryRanges?: string[];
  currencies?: string[];
  companies?: string[];
  industries?: string[];
  skills?: string[];
  postedWithinDate?: string;
  updatedWithinDate?: string;
  targetCompaniesOnly?: boolean;
  salaryDisclosed?: boolean;
  verifiedLiveOnly?: boolean;
  matchPercentageMin?: number;
  sources?: string[];
  crmStatuses?: CRMJobStatus[];
  lifecycleStates?: string[];
  verificationStatus?: JobVerificationStatus;
}

export type JobDatabaseStandardView =
  | 'all'
  | 'new'
  | 'high_match'
  | 'target_companies'
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'rejected'
  | 'archived'
  | 'expired'
  | 'needs_verification';

export interface SavedDatabaseViewRecord {
  id: string;
  name: string;
  standardView?: JobDatabaseStandardView;
  searchQuery?: string;
  filters: Partial<JobFilterCriteria>;
  sortBy?: string;
  createdAt: string;
}


