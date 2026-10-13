import { WorkExperienceItem } from '../profile/types';

export type FitCategory =
  'Excellent Fit' | 'Strong Fit' | 'Potential Fit' | 'Stretch Opportunity' | 'Poor Fit';

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  locationType: 'remote' | 'hybrid' | 'on-site';
  employmentType: 'full-time' | 'contract' | 'part-time' | 'internship';
  industry: string;
  seniority: 'entry' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | 'executive';
  minExperienceYears: number;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  requiredSkills: string[];
  preferredTools: string[];
  responsibilities: string[];
  requirements: string[];
  description: string;
  postedDate: string;
  sourceUrl?: string;
  isTargetCompany?: boolean;
}

export interface JobMatchAnalysis {
  overallScore: number; // 0 - 100
  fitCategory: FitCategory;
  titleMatchScore: number;
  skillsMatchScore: number;
  experienceMatchScore: number;
  compensationMatchScore: number;
  workplaceMatchScore: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  trajectoryRelevance: string;
  learningModifier?: number;
  isExcluded?: boolean;
  exclusionReason?: string;
  breakdown?: {
    roleFit: number;
    skillFit: number;
    experienceFit: number;
    locationFit: number;
    remoteFit: number;
    companyFit: number;
    salaryFit: number;
    industryFit: number;
    careerDirectionFit?: number;
    workplaceFit?: number;
    employmentTypeFit?: number;
    roleFitLevel?: string;
    experienceFitLevel?: string;
    skillsFitLevel?: string;
    careerDirectionLevel?: string;
    locationFitLevel?: string;
    remoteFitLevel?: string;
    industryFitLevel?: string;
  };
  reasons?: string[];
}

export interface StrategicCompany {
  id: string;
  name: string;
  industry: string;
  headquarters: string;
  openRolesCount: number;
  matchScore: number;
  whyRelevant: string[];
  strategicAlignment: string;
  isManualTarget: boolean;
  sampleOpenRoles: string[];
}

export interface TailoredResumeBlueprint {
  jobId: string;
  jobTitle: string;
  targetCompany: string;
  customHeadline: string;
  customSummary: string;
  prioritizedExperiences: {
    experience: WorkExperienceItem;
    relevanceScore: number;
    highlightedAchievements: string[];
    emphasizedSkills: string[];
  }[];
  highlightedSkills: string[];
  highlightedTools: string[];
  coverLetterHook: string;
}

export interface OutreachBlueprint {
  jobId?: string;
  jobTitle: string;
  companyName: string;
  contactName: string;
  contactTitle: string;
  subjectLine: string;
  bodyText: string;
  citedAchievement: string;
  valueProposition: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  category: 'behavioral' | 'technical' | 'strategy' | 'culture';
  whyAsked: string;
  recommendedStory: {
    situation: string;
    actionFromProfile: string;
    achievementQuote: string;
  };
  keySkillsToEmphasize: string[];
}

export interface InterviewBrief {
  jobTitle: string;
  companyName: string;
  predictedQuestions: InterviewQuestion[];
  strategicQuestionsToAsk: string[];
  weaknessMitigation: {
    gap: string;
    honestFraming: string;
  }[];
}

export interface CareerGrowthGap {
  targetRole: string;
  currentEstimatedLevel: string;
  benchmarkedReadinessScore: number;
  missingHighDemandSkills: string[];
  experienceGaps: string[];
  recommendedMilestones: {
    title: string;
    impact: 'high' | 'medium';
    description: string;
  }[];
}

export interface IntelligenceTierInfo {
  tier: 1 | 2 | 3 | 4;
  tierName: string;
  unlockedCapabilities: string[];
  nextTierMilestones: string[];
  completionPercentage: number;
}
