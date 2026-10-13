/**
 * Canonical CareerOs User Profile Types
 * Central single source of truth for the user's professional identity,
 * referenced by Dashboard, Job Feed, Job Database, Target Companies,
 * Applications, Resume Studio, Outreach, Interviews, Growth, and AI modules.
 */

export interface PersonalInfo {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  stateProvince: string;
  country: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  websiteUrl: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface ProfessionalSummary {
  summaryText: string;
  keyHighlights: string[];
}

export interface RolePreferences {
  currentTitle: string;
  currentCompany: string;
  targetPrimaryTitle: string;
  targetJobTitles: string[];
  experienceLevel:
    'entry' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | 'executive';
  totalYearsExperience: number;
}

export interface LanguageSkill {
  id: string;
  language: string;
  proficiency: 'basic' | 'conversational' | 'fluent' | 'native';
}

export interface SkillsData {
  technicalSkills: string[];
  softSkills: string[];
  toolsAndPlatforms: string[];
  languages: LanguageSkill[];
}

export interface WorkExperienceItem {
  id: string;
  company: string;
  title: string;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';
  location: string;
  locationType: 'remote' | 'hybrid' | 'on-site';
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM or empty if current
  isCurrent: boolean;
  description: string;
  keyAchievements: string[];
  skillsUsed: string[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string; // YYYY
  endDate: string; // YYYY
  gradeGpa: string;
  activitiesAndHonors: string;
}

export interface CertificationItem {
  id: string;
  name: string;
  issuingOrganization: string;
  issueDate: string; // YYYY-MM
  expirationDate: string; // YYYY-MM
  doesNotExpire: boolean;
  credentialId: string;
  credentialUrl: string;
}

export interface LocationAndAuthorization {
  currentCity: string;
  currentCountry: string;
  openToRelocation: boolean;
  preferredRelocationLocations: string[];
  citizenship: string;
  workAuthorizationStatus:
    | 'citizen'
    | 'permanent_resident'
    | 'work_visa'
    | 'student_visa'
    | 'requires_sponsorship'
    | 'other';
  requiresSponsorshipNow: boolean;
  requiresSponsorshipFuture: boolean;
}

export interface WorkPreferences {
  workplaceTypes: ('remote' | 'hybrid' | 'on-site')[];
  employmentTypes: ('full-time' | 'contract' | 'part-time' | 'internship')[];
  preferredRemoteLocations: string[];
  targetLocations?: string[]; // Configured target markets e.g. ['India', 'Remote Worldwide / Work From Anywhere']
}

export interface TargetMarkets {
  targetIndustries: string[];
  targetCompanies: string[];
}

export interface CompensationExpectations {
  currency: string;
  minBaseSalary: number;
  targetBaseSalary: number;
  expectedBonusPercent: number;
  openToEquity: boolean;
  compensationNotes: string;
}

export type AvailabilityStatus =
  | 'actively_interviewing'
  | 'open_to_offers'
  | 'casually_browsing'
  | 'not_looking';

export interface NoticePeriodAndAvailability {
  availabilityStatus: AvailabilityStatus;
  noticePeriod:
    'immediate' | '1_week' | '2_weeks' | '1_month' | '2_months' | '3_months' | 'custom';
  customAvailabilityDate: string; // YYYY-MM-DD
}

export interface CareerGoals {
  shortTermGoals: string;
  longTermVision: string;
  primaryMotivation: string;
}

/**
 * Public Portfolio & Recruiter Share Extensibility
 * Future capability enabling users to publish shareable portfolios and recruiter links
 * directly from canonical profile data with fine-grained visibility controls.
 * (No UI or active routes at this stage; data model ready for future extension).
 */
export interface PublicPortfolioPrivacyConfig {
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  showCompensation: boolean;
  showAvailabilityStatus: boolean;
  showWorkHistory: boolean;
  showEducation: boolean;
  showCertifications: boolean;
  showLanguages: boolean;
}

export interface PublicPortfolioThemeConfig {
  themeId: 'modern-minimal' | 'executive' | 'technical' | 'creative' | 'editorial';
  accentColor?: string;
  customHeadline?: string;
  customBioMarkdown?: string;
  featuredWorkExperienceIds?: string[];
  featuredSkillNames?: string[];
}

export interface PublicPortfolioVersionConfig {
  id: string;
  versionName: string; // e.g. "General Portfolio", "Fintech Targeted", "Google Recruiter Share"
  slug: string; // e.g. "alex-morgan", "alex-morgan-lead-fe"
  isPublished: boolean;
  targetCompanyContext?: string; // Optional context for company/job-specific share link
  privacy: PublicPortfolioPrivacyConfig;
  theme: PublicPortfolioThemeConfig;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPortfolioProfileConfig {
  isEnabled: boolean;
  primarySlug?: string;
  versions: PublicPortfolioVersionConfig[];
}

export interface UserProfile {
  version: string;
  lastUpdated: string;
  personalInfo: PersonalInfo;
  professionalSummary: ProfessionalSummary;
  rolePreferences: RolePreferences;
  skills: SkillsData;
  workExperience: WorkExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  locationAndAuth: LocationAndAuthorization;
  workPreferences: WorkPreferences;
  targetMarkets: TargetMarkets;
  compensation: CompensationExpectations;
  availability: NoticePeriodAndAvailability;
  careerGoals: CareerGoals;
  publicPortfolio?: PublicPortfolioProfileConfig;
}

export interface SectionCompleteness {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  percentage: number;
  isComplete: boolean;
}

export interface ProfileCompletenessDetails {
  totalScore: number;
  sections: Record<string, SectionCompleteness>;
  recommendations: string[];
  contradictions?: string[];
}
