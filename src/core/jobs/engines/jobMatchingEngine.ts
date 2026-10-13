/**
 * CareerOS Job Matching Engine
 *
 * Lightweight Local Multi-Dimensional Scoring Engine:
 * Match Score =
 *   Role Fit (25%) +
 *   Skill Fit (20%) +
 *   Experience Fit (15%) +
 *   Location Fit (10%) +
 *   Remote Fit (10%) +
 *   Industry Fit (5%) +
 *   Salary Fit (5%) +
 *   Company Fit (10%)
 *
 * Key Principles:
 * - Weighted semantic similarity + exact skill/role matching.
 * - Hard exclusions override the score completely (score -> 0 / disqualified).
 * - Stores complete explanation internally, but produces 1–2 concise, impactful match reasons for UI.
 * - Continuous learning feedback loop on Reject, Save, View, Apply, Search, Target Company additions.
 * - Zero external paid AI / API dependencies.
 */

import { JobMatchAnalysis, FitCategory } from '../../intelligence/types';
import { JobOpportunity } from '../types';
import { UserProfile } from '../../profile/types';
import { profileIntelligenceEngine, JobPreferenceVector } from './profileIntelligenceEngine';
import { preferenceLearningEngine } from './preferenceLearningEngine';
import { targetCompaniesStore } from '../../target-companies/targetCompanyStore';
import { roleTaxonomyEngine } from './roleTaxonomyEngine';
import { locationFilterEngine } from './locationFilterEngine';

export interface MultiDimensionalScoreBreakdown {
  roleFit: number;              // 25%
  skillFit: number;             // 20%
  experienceFit: number;        // 15%
  seniorityFit: number;         // 10%
  locationFit: number;          // 10% (Location + Workplace)
  workplaceFit: number;         // 5%
  industryFit: number;          // 5%
  employmentTypeFit: number;    // 5%
  salaryFit: number;            // 5%
  careerDirectionFit: number;   // 5%

  // Structured Levels for UI Explanation (Section 12)
  roleFitLevel: 'Strong' | 'Good' | 'Moderate' | 'Weak';
  experienceFitLevel: 'Strong' | 'Good' | 'Moderate';
  skillsFitLevel: 'Strong' | 'Moderate' | 'Weak';
  careerDirectionLevel: 'Direct Target' | 'Adjacent Path' | 'Transferable';
  locationFitLevel: 'Exact' | 'Eligible' | 'Excluded';
  remoteFitLevel: 'Preferred' | 'Acceptable' | 'Restricted';
  industryFitLevel: 'Direct' | 'Adjacent' | 'General';

  // Legacy compatibility fields
  remoteFit: number;
  companyFit: number;
  locationWorkplaceFit?: number;

  weightedBaseScore: number;
  learningModifier: number;     // -20 to +15 from user behavior (Save/Apply/Dismiss)
  finalScore: number;           // 0 - 100
  isExcluded: boolean;
  exclusionReason?: string;
  allReasons: string[];
  topReasons: string[];         // 3-5 concise, impactful reasons answering "Why this job?"
}

// Semantic Role Equivalence Clusters
const ROLE_SYNONYM_CLUSTERS: string[][] = [
  ['software engineer', 'software developer', 'frontend', 'front end', 'backend', 'full stack', 'fullstack', 'web developer', 'ui engineer'],
  ['lead', 'staff', 'principal', 'architect', 'tech lead'],
  ['engineering manager', 'tech lead manager', 'director of engineering', 'vp engineering'],
  ['product manager', 'technical product manager', 'product lead', 'group product manager', 'head of product'],
  ['product designer', 'ux designer', 'ui designer', 'ux/ui', 'design systems lead'],
  ['data scientist', 'machine learning', 'ml engineer', 'ai engineer', 'data platform', 'analytics engineer'],
  ['sales', 'business development', 'bdr', 'sdr', 'account executive', 'enterprise sales', 'gtm', 'commercial strategy', 'revenue'],
  ['devops', 'sre', 'site reliability', 'cloud engineer', 'infrastructure engineer', 'platform engineer'],
];

function clean(str: string): string {
  return (str || '').toLowerCase().trim();
}

function words(str: string): string[] {
  return clean(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

export class JobMatchingEngine {
  /**
   * Evaluates and scores an opportunity against the user preference vector.
   */
  public evaluateJob(
    job: JobOpportunity,
    profileOrVector: UserProfile | JobPreferenceVector
  ): MultiDimensionalScoreBreakdown {
    const vector =
      'compiledAt' in profileOrVector
        ? profileOrVector
        : profileIntelligenceEngine.getPreferenceVector(profileOrVector);

    const reasons: string[] = [];
    const jobTitleClean = clean(job.title);
    const companyClean = clean(job.company);
    const jobLocClean = clean(job.location);

    // -------------------------------------------------------------------------
    // 1. HARD EXCLUSIONS CHECK
    // -------------------------------------------------------------------------
    const { hardExclusions } = vector;
    if (hardExclusions.excludedCompanies.has(companyClean)) {
      return this.formatDisqualified(job, 'Company explicitly excluded by user preferences');
    }

    for (const exTitle of hardExclusions.excludedTitles) {
      if (jobTitleClean.includes(exTitle)) {
        return this.formatDisqualified(job, `Job title matches excluded role: ${exTitle}`);
      }
    }

    for (const exLoc of hardExclusions.excludedLocations) {
      if (jobLocClean.includes(exLoc)) {
        return this.formatDisqualified(job, `Job location matches excluded market: ${exLoc}`);
      }
    }

    // -------------------------------------------------------------------------
    // 2. ROLE FIT (25%) - Hierarchical Role Taxonomy
    // -------------------------------------------------------------------------
    let roleFit = 0;
    const titleWords = words(jobTitleClean);
    const targetRoles = [vector.primaryRole, ...vector.targetTitles].filter(Boolean);

    const GENERIC_ROLE_WORDS = new Set([
      'business',
      'manager',
      'sales',
      'growth',
      'lead',
      'associate',
      'operations',
      'head',
      'general',
      'vp',
      'director',
      'specialist',
      'representative',
      'consultant',
      'intern',
      'internship',
      'trainee',
      'assistant',
      'coordinator',
      'officer',
      'analyst',
      'entry',
      'junior',
      'senior',
    ]);

    const isPureGenericTitle =
      titleWords.length > 0 && titleWords.every((w) => GENERIC_ROLE_WORDS.has(w));
    const isExactTargetMatch =
      jobTitleClean === vector.primaryRole ||
      vector.targetTitles.some((t) => clean(t) === jobTitleClean);

    const taxonomyMatch = roleTaxonomyEngine.matchesRoleCriteria(job.title, targetRoles);

    if (isPureGenericTitle && !isExactTargetMatch) {
      roleFit = 20;
      reasons.push(`Generic title keywords lack domain specificity for "${job.title}"`);
    } else if (taxonomyMatch.matches && taxonomyMatch.score >= 95) {
      roleFit = 100;
      reasons.push(`Direct target title alignment with "${taxonomyMatch.matchedTitle || job.title}"`);
    } else if (jobTitleClean === vector.primaryRole || vector.targetTitles.some((t) => t === jobTitleClean)) {
      roleFit = 100;
      reasons.push(`Exact target title match for "${job.title}"`);
    } else if (taxonomyMatch.matches && taxonomyMatch.score >= 80) {
      roleFit = taxonomyMatch.score;
      if (taxonomyMatch.isAdjacent) {
        reasons.push(`Adjacent career path: ${taxonomyMatch.matchedTitle || job.title}`);
      } else {
        reasons.push(`Strong taxonomy alignment: ${taxonomyMatch.matchedTitle || job.title}`);
      }
    } else if (vector.targetTitles.some((t) => jobTitleClean.includes(t) || (!isPureGenericTitle && t.includes(jobTitleClean)))) {
      roleFit = 85;
      reasons.push(`Close alignment with target role "${job.title}"`);
    } else {
      // Cluster semantic synonym matching
      let clusterMatch = false;
      for (const cluster of ROLE_SYNONYM_CLUSTERS) {
        const userMatchesCluster = cluster.some((syn) => vector.primaryRole.includes(syn) || vector.targetTitles.some((t) => t.includes(syn)));
        const jobMatchesCluster = cluster.some((syn) => jobTitleClean.includes(syn));
        if (userMatchesCluster && jobMatchesCluster) {
          roleFit = 75;
          clusterMatch = true;
          reasons.push(`Functional domain match for ${job.title}`);
          break;
        }
      }

      if (!clusterMatch) {
        if (taxonomyMatch.matches) {
          roleFit = Math.max(65, taxonomyMatch.score);
          reasons.push(`Transferable role alignment: ${job.title}`);
        } else {
          // Keyword overlap guard: Do NOT match jobs simply because they contain generic words like “business”, “manager”, “sales” or “growth”
          const nonGenericOverlap = titleWords.filter((w) => vector.roleKeywords.includes(w) && !GENERIC_ROLE_WORDS.has(w)).length;
          if (nonGenericOverlap > 0) {
            roleFit = Math.min(65, 30 + nonGenericOverlap * 15);
            reasons.push(`Relevant domain keywords in ${job.title}`);
          } else {
            roleFit = 20;
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. SKILL FIT (20%)
    // -------------------------------------------------------------------------
    let skillFit = 40; // baseline
    const jobSkills = [
      ...(job.requiredSkills || []),
      ...(job.preferredSkills || []),
      ...(job.skills || []),
    ].map(clean).filter(Boolean);

    if (jobSkills.length > 0 && vector.coreSkills.size > 0) {
      let matchedCount = 0;
      const matchedSkillNames: string[] = [];

      jobSkills.forEach((s) => {
        if (vector.coreSkills.has(s) || Array.from(vector.coreSkills).some((cs) => s.includes(cs) || cs.includes(s))) {
          matchedCount++;
          if (matchedSkillNames.length < 3) matchedSkillNames.push(s);
        }
      });

      const skillRatio = matchedCount / Math.max(1, Math.min(jobSkills.length, 6));
      skillFit = Math.min(100, Math.round(skillRatio * 100));

      if (matchedSkillNames.length > 0) {
        reasons.push(`Matches core skills: ${matchedSkillNames.join(', ')}`);
      }
    } else {
      skillFit = 50; // Neutral when skills unstated
    }

    // -------------------------------------------------------------------------
    // 4. EXPERIENCE FIT (15%) - Seniority Level Alignment
    // -------------------------------------------------------------------------
    let experienceFit = 80;
    const jobMinExp = job.minExperienceYears;
    if (jobMinExp !== undefined && jobMinExp !== null) {
      const expDelta = jobMinExp - vector.yearsExperience;
      if (expDelta <= 0) {
        experienceFit = 100; // Fully qualified
        reasons.push(`Seniority level alignment (${vector.yearsExperience}+ years experience)`);
      } else if (expDelta <= 2) {
        experienceFit = 75;  // Slight stretch
        reasons.push(`Seniority alignment (slight stretch: ${jobMinExp} yrs vs ${vector.yearsExperience} yrs)`);
      } else {
        experienceFit = Math.max(25, 60 - expDelta * 10); // Overstretch penalty
      }
    } else {
      reasons.push('Seniority level compatible with career background');
    }

    // -------------------------------------------------------------------------
    // 5. LOCATION FIT (10%) & REMOTE FIT (10%) - Semantic OR Architecture
    // -------------------------------------------------------------------------
    let locationFit = 50;
    let remoteFit = 60;

    const locResult = locationFilterEngine.evaluateEligibility(job, vector.targetLocations, vector.workplaceTypes);
    if (locResult.eligible) {
      if (locResult.matchedConcept === 'WORLDWIDE_REMOTE') {
        locationFit = 100;
        remoteFit = 100;
        reasons.push('Eligible for Worldwide Remote (Location Independent)');
      } else if (locResult.matchedConcept === 'INDIA') {
        locationFit = 95;
        remoteFit = job.remoteStatus === 'remote' ? 95 : 85;
        reasons.push('Based in or eligible for candidates in India');
      } else if (locResult.matchedConcept === 'SPECIFIC_COUNTRY') {
        locationFit = 90;
        remoteFit = 85;
        reasons.push(`Matches target geographical market (${job.location})`);
      } else {
        locationFit = 85;
        remoteFit = 80;
        reasons.push('Compatible work location and arrangement');
      }
    } else {
      if (
        jobLocClean.includes('worldwide') ||
        jobLocClean.includes('anywhere') ||
        job.workFromAnywhere
      ) {
        locationFit = 100;
        remoteFit = 95;
        reasons.push('Location-independent opportunity');
      } else if (vector.targetLocations.some((loc) => jobLocClean.includes(loc.toLowerCase()))) {
        locationFit = 90;
        reasons.push(`Located in preferred market: ${job.location}`);
      } else if (jobLocClean.includes(vector.homeCountry.toLowerCase())) {
        locationFit = 80;
      } else {
        locationFit = 35;
        remoteFit = 40;
      }
    }

    // -------------------------------------------------------------------------
    // 7. INDUSTRY FIT (5%)
    // -------------------------------------------------------------------------
    let industryFit = 50;
    const jobIndustry = clean(job.industry || '');
    if (jobIndustry && vector.targetIndustries.some((ind) => jobIndustry.includes(ind) || ind.includes(jobIndustry))) {
      industryFit = 95;
      reasons.push(`Target industry alignment: ${job.industry}`);
    }

    // -------------------------------------------------------------------------
    // 8. SALARY FIT (5%)
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // 6. CAREER DIRECTION FIT (15%) - Transferable trajectory
    // -------------------------------------------------------------------------
    let careerDirectionFit = 50;
    if (isPureGenericTitle && !isExactTargetMatch) {
      careerDirectionFit = 20;
    } else if (taxonomyMatch.matches && !taxonomyMatch.isAdjacent) {
      careerDirectionFit = 100;
      reasons.push(`Direct alignment with target career direction (${taxonomyMatch.matchedTitle || job.title})`);
    } else if (taxonomyMatch.matches && taxonomyMatch.isAdjacent) {
      careerDirectionFit = 85;
      reasons.push(`Transferable skills aligned with strategic career trajectory (${taxonomyMatch.matchedTitle || job.title})`);
    } else if (titleWords.some((w) => vector.roleKeywords.includes(w) && !GENERIC_ROLE_WORDS.has(w))) {
      careerDirectionFit = 70;
      reasons.push(`Functional overlap with target career domain`);
    }

    // -------------------------------------------------------------------------
    // 7. WORKPLACE FIT (5%) & EMPLOYMENT TYPE FIT (3%)
    // -------------------------------------------------------------------------
    let workplaceFit = 75;
    const isWFA = job.workFromAnywhere || jobLocClean.includes('worldwide') || jobLocClean.includes('anywhere');
    if (isWFA || job.remoteStatus === 'remote') {
      workplaceFit = 100;
    } else if (job.remoteStatus === 'hybrid') {
      workplaceFit = 85;
    } else {
      workplaceFit = 60;
    }

    let employmentTypeFit = 100;
    const empType = (job.employmentType || 'full-time').toLowerCase();
    if (empType !== 'full-time') {
      employmentTypeFit = 80;
    }

    // -------------------------------------------------------------------------
    // 8. SALARY FIT (2%)
    // -------------------------------------------------------------------------
    let salaryFit = 75; // neutral default
    const jobSalMax = job.salary?.max || job.salary_truth?.max;
    if (jobSalMax && vector.minBaseSalary > 0) {
      if (jobSalMax >= vector.minBaseSalary) {
        salaryFit = 100;
        reasons.push('Meets or exceeds compensation expectations');
      } else {
        salaryFit = Math.max(30, Math.round((jobSalMax / vector.minBaseSalary) * 80));
      }
    }

    // -------------------------------------------------------------------------
    // 4b. SENIORITY FIT (10%)
    // -------------------------------------------------------------------------
    let seniorityFit = 80;
    const userSeniority = clean(vector.seniorityLevel || '');
    let jobSeniority = clean(job.seniority || '');
    if (!jobSeniority) {
      if (/\b(intern|internship|trainee|fresher)\b/i.test(jobTitleClean)) {
        jobSeniority = 'intern';
      } else if (/\b(junior|jr|entry|associate)\b/i.test(jobTitleClean)) {
        jobSeniority = 'junior';
      } else if (/\b(lead|principal|staff|architect|tech lead|head)\b/i.test(jobTitleClean)) {
        jobSeniority = 'lead';
      } else if (/\b(director|vp|vice president|c-level|chief|executive)\b/i.test(jobTitleClean)) {
        jobSeniority = 'executive';
      } else if (/\b(senior|sr)\b/i.test(jobTitleClean)) {
        jobSeniority = 'senior';
      } else {
        jobSeniority = 'mid';
      }
    }

    const isSeniorProfile = vector.yearsExperience >= 5 || /senior|lead|director|vp|head|principal|executive/i.test(userSeniority);
    const isJuniorJob = jobSeniority === 'intern' || jobSeniority === 'junior';
    const isJuniorProfile = vector.yearsExperience <= 2 || /intern|junior|entry/i.test(userSeniority);
    const isSeniorJob = jobSeniority === 'senior' || jobSeniority === 'lead' || jobSeniority === 'executive';

    if (isSeniorProfile && isJuniorJob) {
      seniorityFit = jobSeniority === 'intern' ? 10 : 20;
    } else if (isJuniorProfile && isSeniorJob) {
      seniorityFit = 25;
    } else if (jobSeniority === userSeniority || (isSeniorProfile && isSeniorJob)) {
      seniorityFit = 100;
      reasons.push(`Strong seniority alignment (${jobSeniority.toUpperCase() || 'Experienced'})`);
    } else {
      seniorityFit = 85;
    }

    // -------------------------------------------------------------------------
    // 9. COMPANY FIT & TARGET COMPANY PRIORITY
    // -------------------------------------------------------------------------
    let companyFit = 50;
    const isTarget =
      vector.targetCompanies.has(companyClean) ||
      targetCompaniesStore.isTargetCompany(companyClean) ||
      job.isTargetCompany;

    if (isTarget) {
      companyFit = 100;
      reasons.unshift(`Priority Target Company: ${job.company}`);
    }

    // -------------------------------------------------------------------------
    // 10. WEIGHTED COMBINATION WITH EXCLUSION PENALTIES (Production Specification)
    // -------------------------------------------------------------------------
    // Role Fit: 25% | Skill Fit: 20% | Experience: 15% | Seniority: 10%
    // Location + Workplace: 10% | Industry: 5% | Employment: 5% | Salary: 5% | Career Direction: 5%
    // minus exclusion penalties
    let exclusionPenalties = 0;
    if (roleFit < 40) {
      exclusionPenalties += 30; // -30 for non-target roles
    }
    if (seniorityFit < 40) {
      exclusionPenalties += 25; // -25 for mismatched seniority
    }
    if (isSeniorProfile && isJuniorJob) {
      exclusionPenalties += 25; // Additional severe penalty for experienced profile vs intern/junior job
    }
    if (vector.hardExclusions?.excludedTitles && Array.from(vector.hardExclusions.excludedTitles).some((t) => jobTitleClean.includes(t))) {
      exclusionPenalties += 40; // -40 for excluded titles
    }

    const locationWorkplaceFit = Math.round(locationFit * 0.6 + workplaceFit * 0.4);

    const weightedBase =
      roleFit * 0.25 +
      skillFit * 0.20 +
      experienceFit * 0.15 +
      seniorityFit * 0.10 +
      locationWorkplaceFit * 0.10 +
      industryFit * 0.05 +
      employmentTypeFit * 0.05 +
      salaryFit * 0.05 +
      careerDirectionFit * 0.05 -
      exclusionPenalties;

    // Apply online preference learning modifier [-20, +15]
    const learningScore = preferenceLearningEngine.calculateAdjustment(job);
    const learningMod = learningScore.scoreAdjustment;
    if (learningScore.behavioralInsight) {
      reasons.push(learningScore.behavioralInsight);
    }

    const finalScore = Math.max(0, Math.min(99, Math.round(weightedBase + learningMod)));

    // Structured Levels for UI Explanation (Section 12)
    const roleFitLevel: 'Strong' | 'Good' | 'Moderate' | 'Weak' =
      roleFit >= 85 ? 'Strong' : roleFit >= 70 ? 'Good' : roleFit >= 50 ? 'Moderate' : 'Weak';
    const experienceFitLevel: 'Strong' | 'Good' | 'Moderate' =
      experienceFit >= 85 ? 'Strong' : experienceFit >= 70 ? 'Good' : 'Moderate';
    const skillsFitLevel: 'Strong' | 'Moderate' | 'Weak' =
      skillFit >= 70 ? 'Strong' : skillFit >= 45 ? 'Moderate' : 'Weak';
    const careerDirectionLevel: 'Direct Target' | 'Adjacent Path' | 'Transferable' =
      careerDirectionFit >= 85 ? 'Direct Target' : careerDirectionFit >= 65 ? 'Adjacent Path' : 'Transferable';
    const locationFitLevel: 'Exact' | 'Eligible' | 'Excluded' =
      locationFit >= 90 ? 'Exact' : 'Eligible';
    const remoteFitLevel: 'Preferred' | 'Acceptable' | 'Restricted' =
      workplaceFit >= 85 ? 'Preferred' : 'Acceptable';
    const industryFitLevel: 'Direct' | 'Adjacent' | 'General' =
      industryFit >= 80 ? 'Direct' : 'Adjacent';

    // Select 3–5 most impactful explainable reasons
    const topReasons = reasons.length >= 3 ? reasons.slice(0, 5) : reasons.length > 0 ? reasons : [`Relevant ${job.title} opportunity`];

    return {
      roleFit,
      skillFit,
      experienceFit,
      seniorityFit,
      careerDirectionFit,
      locationFit,
      workplaceFit,
      locationWorkplaceFit,
      employmentTypeFit,
      salaryFit,
      roleFitLevel,
      experienceFitLevel,
      skillsFitLevel,
      careerDirectionLevel,
      locationFitLevel,
      remoteFitLevel,
      industryFitLevel,
      remoteFit,
      industryFit,
      companyFit,
      weightedBaseScore: Math.round(weightedBase),
      learningModifier: learningMod,
      finalScore,
      isExcluded: false,
      allReasons: reasons,
      topReasons,
    };
  }

  /**
   * Adapts the evaluation into the canonical JobMatchAnalysis structure.
   */
  public getMatchAnalysis(
    job: JobOpportunity,
    profileOrVector: UserProfile | JobPreferenceVector
  ): JobMatchAnalysis {
    const breakdown = this.evaluateJob(job, profileOrVector);
    const score = breakdown.finalScore;

    let fitCategory: FitCategory = 'Potential Fit';
    if (score >= 85) fitCategory = 'Excellent Fit';
    else if (score >= 70) fitCategory = 'Strong Fit';
    else if (score < 40) fitCategory = 'Poor Fit';

    return {
      overallScore: score,
      fitCategory,
      titleMatchScore: Math.round(breakdown.roleFit * 0.25),
      skillsMatchScore: Math.round(breakdown.skillFit * 0.20),
      experienceMatchScore: Math.round(breakdown.experienceFit * 0.15 + breakdown.seniorityFit * 0.10),
      compensationMatchScore: Math.round(breakdown.salaryFit * 0.05),
      workplaceMatchScore: Math.round(breakdown.locationFit * 0.06 + breakdown.workplaceFit * 0.04),
      strengths: breakdown.topReasons,
      gaps: breakdown.experienceFit < 70 ? ['Higher seniority requirements'] : [],
      recommendations:
        score >= 70
          ? ['Strong background alignment. Recommended to apply.']
          : ['Review requirements and evaluate scope.'],
      trajectoryRelevance: `Verified opportunity at ${job.company}.`,
      learningModifier: breakdown.learningModifier,
      breakdown: {
        roleFit: breakdown.roleFit,
        skillFit: breakdown.skillFit,
        experienceFit: breakdown.experienceFit,
        locationFit: breakdown.locationFit,
        remoteFit: breakdown.workplaceFit,
        companyFit: breakdown.companyFit,
        salaryFit: breakdown.salaryFit,
        industryFit: breakdown.industryFit,
        careerDirectionFit: breakdown.careerDirectionFit,
        workplaceFit: breakdown.workplaceFit,
        employmentTypeFit: breakdown.employmentTypeFit,
        roleFitLevel: breakdown.roleFitLevel,
        experienceFitLevel: breakdown.experienceFitLevel,
        skillsFitLevel: breakdown.skillsFitLevel,
        careerDirectionLevel: breakdown.careerDirectionLevel,
        locationFitLevel: breakdown.locationFitLevel,
        remoteFitLevel: breakdown.remoteFitLevel,
        industryFitLevel: breakdown.industryFitLevel,
      },
      reasons: breakdown.allReasons,
    };
  }

  private formatDisqualified(_job: JobOpportunity, reason: string): MultiDimensionalScoreBreakdown {
    return {
      roleFit: 0,
      experienceFit: 0,
      skillFit: 0,
      seniorityFit: 0,
      careerDirectionFit: 0,
      locationFit: 0,
      workplaceFit: 0,
      employmentTypeFit: 0,
      salaryFit: 0,
      roleFitLevel: 'Weak',
      experienceFitLevel: 'Moderate',
      skillsFitLevel: 'Weak',
      careerDirectionLevel: 'Transferable',
      locationFitLevel: 'Excluded',
      remoteFitLevel: 'Restricted',
      industryFitLevel: 'General',
      remoteFit: 0,
      industryFit: 0,
      companyFit: 0,
      weightedBaseScore: 0,
      learningModifier: 0,
      finalScore: 0,
      isExcluded: true,
      exclusionReason: reason,
      allReasons: [reason],
      topReasons: [reason],
    };
  }
}

export const jobMatchingEngine = new JobMatchingEngine();
