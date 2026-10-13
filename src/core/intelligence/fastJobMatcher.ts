/**
 * CareerOs Fast Deterministic Job Matcher
 *
 * Implements a transparent, weighted scoring pipeline (<0.5ms per job) that computes:
 * - Role alignment (30%)
 * - Core skills overlap (20%)
 * - Experience tier match (15%)
 * - Location & remote eligibility (15%)
 * - Industry / domain match (10%)
 * - Target company priority (10%)
 *
 * Designed for precomputation during ingestion, completely eliminating render-path bottlenecks.
 */

import { UserProfile } from '../profile/types';
import { JobOpportunity, FitTier } from '../jobs/types';
import { FitCategory } from './types';
import { remoteEligibilityEngine } from '../jobs/remoteEligibilityEngine';

export interface ProfileIndex {
  targetRoles: string[];
  skills: Set<string>;
  skillList: string[];
  targetCompanies: Set<string>;
  targetIndustries: string[];
  yearsExperience: number;
  workplaceTypes: string[];
}

export interface FastJobMatchResult {
  score: number;
  fitCategory: FitCategory;
  titleScore: number;
  skillsScore: number;
  experienceScore: number;
  workplaceScore: number;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface FastMatchResult {
  overallScore: number;
  fitTier: FitTier;
  matchReasons: string[];
  mismatchReasons: string[];
  breakdown: {
    roleScore: number;
    skillScore: number;
    experienceScore: number;
    locationScore: number;
    industryScore: number;
    targetCompanyScore: number;
  };
}

export class FastJobMatcher {
  /**
   * Builds an indexed lookup structure from a user profile for ultra-fast batch matching.
   */
  public createProfileIndex(profile: UserProfile | undefined | null): ProfileIndex {
    const targetRoles: string[] = [];
    if (profile?.rolePreferences?.targetPrimaryTitle) {
      targetRoles.push(profile.rolePreferences.targetPrimaryTitle.toLowerCase().trim());
    }
    if (profile?.rolePreferences?.targetJobTitles) {
      profile.rolePreferences.targetJobTitles.forEach((t: string) => {
        if (t) targetRoles.push(t.toLowerCase().trim());
      });
    }
    if (profile?.rolePreferences?.currentTitle) {
      targetRoles.push(profile.rolePreferences.currentTitle.toLowerCase().trim());
    }

    const skills = new Set<string>();
    const skillList: string[] = [];
    const addSkills = (arr?: string[]) => {
      if (!arr) return;
      arr.forEach((s) => {
        if (s && s.trim()) {
          const lower = s.toLowerCase().trim();
          skills.add(lower);
          skillList.push(lower);
        }
      });
    };
    addSkills(profile?.skills?.technicalSkills);
    addSkills(profile?.skills?.toolsAndPlatforms);
    addSkills(profile?.skills?.softSkills);

    const targetCompanies = new Set<string>();
    if (profile?.targetMarkets?.targetCompanies) {
      profile.targetMarkets.targetCompanies.forEach((c: string) => {
        if (c) targetCompanies.add(c.toLowerCase().trim());
      });
    }

    const targetIndustries = (profile?.targetMarkets?.targetIndustries || []).map((i: string) =>
      i.toLowerCase().trim()
    );

    const yearsExperience = profile?.rolePreferences?.totalYearsExperience ?? 5;
    const workplaceTypes = (profile?.workPreferences?.workplaceTypes || ['remote']).map((w: string) =>
      w.toLowerCase()
    );

    return {
      targetRoles,
      skills,
      skillList,
      targetCompanies,
      targetIndustries,
      yearsExperience,
      workplaceTypes,
    };
  }

  /**
   * Ultra-fast (<0.1ms) matcher for indexed profile vs job opportunity (e.g. in JobDatabasePage).
   */
  public fastMatchJob(index: ProfileIndex, job: JobOpportunity): FastJobMatchResult {
    const titleLower = (job.title || '').toLowerCase();
    const descLower = (job.description || '').toLowerCase();
    const jobSkills = (job.requiredSkills || []).map((s) => s.toLowerCase());

    // 1. Title alignment (0 - 100)
    let titleScore = 40;
    if (index.targetRoles.length > 0) {
      const directMatch = index.targetRoles.some((t) => {
        const words = t.split(/\s+/).filter((w) => w.length > 2);
        return words.length > 0 && words.every((w) => titleLower.includes(w));
      });
      if (directMatch) {
        titleScore = 95;
      } else {
        const partialMatch = index.targetRoles.some((t) => {
          const words = t.split(/\s+/).filter((w) => w.length > 2);
          return words.some((w) => titleLower.includes(w));
        });
        if (partialMatch) titleScore = 75;
      }
    }

    // 2. Skills overlap
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    for (const s of index.skillList) {
      if (jobSkills.includes(s) || descLower.includes(s) || titleLower.includes(s)) {
        if (!matchedSkills.includes(s)) matchedSkills.push(s);
      }
    }
    for (const js of jobSkills) {
      if (!index.skills.has(js)) {
        if (!missingSkills.includes(js)) missingSkills.push(js);
      }
    }

    let skillsScore = 50;
    if (matchedSkills.length >= 4) skillsScore = 95;
    else if (matchedSkills.length >= 2) skillsScore = 80;
    else if (matchedSkills.length >= 1) skillsScore = 65;

    // 3. Experience tier
    let experienceScore = 70;
    const reqYears = job.minExperienceYears ?? 0;
    if (index.yearsExperience >= reqYears) {
      experienceScore = 90;
    } else if (index.yearsExperience >= reqYears - 1) {
      experienceScore = 75;
    } else {
      experienceScore = 50;
    }

    // 4. Workplace / Remote
    let workplaceScore = 70;
    const isWorldwide = remoteEligibilityEngine.isWorldwideRemote(job);
    const isIndiaEligible = remoteEligibilityEngine.isEligibleForIndiaFeed(job);
    if (isWorldwide || isIndiaEligible) {
      workplaceScore = 95;
    } else if (job.remoteStatus === 'remote') {
      workplaceScore = 75;
    }

    // Weighted Overall Score
    const overallScore = Math.min(
      99,
      Math.max(
        20,
        Math.round(
          titleScore * 0.35 +
          skillsScore * 0.25 +
          experienceScore * 0.20 +
          workplaceScore * 0.20
        )
      )
    );

    const fitCategory: FitCategory =
      overallScore >= 85
        ? 'Excellent Fit'
        : overallScore >= 70
        ? 'Strong Fit'
        : overallScore >= 50
        ? 'Potential Fit'
        : 'Poor Fit';

    return {
      score: overallScore,
      fitCategory,
      titleScore,
      skillsScore,
      experienceScore,
      workplaceScore,
      matchedSkills,
      missingSkills,
    };
  }

  /**
   * Fast, deterministic matching between user profile and job opportunity.
   */
  public match(profile: UserProfile | undefined | null, job: JobOpportunity): FastMatchResult {
    const reasons: string[] = [];
    const mismatchReasons: string[] = [];

    // Fallback if profile is not configured yet (Mandate 8: Never invent a score)
    if (!profile) {
      return {
        overallScore: 0,
        fitTier: 'LOW FIT',
        matchReasons: ['Profile match pending'],
        mismatchReasons: [],
        breakdown: {
          roleScore: 0,
          skillScore: 0,
          experienceScore: 0,
          locationScore: 0,
          industryScore: 0,
          targetCompanyScore: 0,
        },
      };
    }

    const index = this.createProfileIndex(profile);
    const titleLower = (job.title || '').toLowerCase();
    const descLower = (job.description || '').toLowerCase();
    const jobSkills = new Set((job.requiredSkills || []).map((s) => s.toLowerCase()));

    // 1. Target Company Match (10 pts)
    let targetScore = 0;
    const isTarget =
      Boolean(job.isTargetCompany) ||
      index.targetCompanies.has((job.company || '').toLowerCase().trim());
    if (isTarget) {
      targetScore = 10;
      reasons.push(`Target company: ${job.company}`);
    }

    // 2. Role Alignment (30 pts)
    let roleScore = 10; // Baseline
    const isDirectRoleMatch = index.targetRoles.some((target) => {
      const tWords = target.split(/\s+/).filter((w) => w.length > 2);
      return tWords.length > 0 && tWords.every((w) => titleLower.includes(w));
    });

    if (isDirectRoleMatch) {
      roleScore = 30;
      reasons.push('Direct role title alignment');
    } else {
      const anyWordMatch = index.targetRoles.some((target) => {
        const tWords = target.split(/\s+/).filter((w) => w.length > 2);
        return tWords.some((w) => titleLower.includes(w));
      });
      if (anyWordMatch) {
        roleScore = 20;
        reasons.push('Related career function');
      }
    }

    // 3. Core Skills Overlap (20 pts)
    let skillScore = 4;
    const matchedSkillNames: string[] = [];

    for (const skill of index.skillList) {
      if (jobSkills.has(skill) || descLower.includes(skill) || titleLower.includes(skill)) {
        if (!matchedSkillNames.includes(skill)) {
          matchedSkillNames.push(skill);
        }
      }
    }

    if (matchedSkillNames.length >= 4) {
      skillScore = 20;
      reasons.push(`Strong skills overlap: ${matchedSkillNames.slice(0, 3).join(', ')}`);
    } else if (matchedSkillNames.length >= 2) {
      skillScore = 14;
      reasons.push(`Relevant skills: ${matchedSkillNames.slice(0, 2).join(', ')}`);
    } else if (matchedSkillNames.length >= 1) {
      skillScore = 8;
      reasons.push(`Skill match: ${matchedSkillNames[0]}`);
    }

    // 4. Location & Remote Eligibility (15 pts)
    let locationScore = 0;
    const isIndiaEligible = remoteEligibilityEngine.isEligibleForIndiaFeed(job);
    const isWorldwide = remoteEligibilityEngine.isWorldwideRemote(job);

    if (isWorldwide) {
      locationScore = 15;
      reasons.push('Worldwide Remote — work from anywhere');
    } else if (isIndiaEligible) {
      locationScore = 15;
      reasons.push('Eligible for candidates in India');
    } else if (job.remoteStatus === 'remote') {
      locationScore = 8;
      mismatchReasons.push('Regional remote restriction may apply');
    } else {
      locationScore = 5;
      mismatchReasons.push('Onsite location outside primary preferences');
    }

    // 5. Experience Tier Fit (15 pts)
    let experienceScore = 10;
    const candidateYears = index.yearsExperience;
    const jobMinYears = job.minExperienceYears || 0;

    if (candidateYears >= jobMinYears) {
      experienceScore = 15;
      if (jobMinYears > 0) {
        reasons.push(`Meets experience requirement (${jobMinYears}+ years)`);
      }
    } else if (candidateYears >= jobMinYears - 1) {
      experienceScore = 10;
    } else {
      experienceScore = 5;
      mismatchReasons.push(`Requires ${jobMinYears}+ years; candidate has ${candidateYears} years`);
    }

    // 6. Industry / Domain Fit (10 pts)
    let industryScore = 7;
    const jobIndustry = (job.industry || '').toLowerCase();
    if (index.targetIndustries.some((d) => jobIndustry.includes(d) || descLower.includes(d))) {
      industryScore = 10;
      reasons.push(`Target industry match: ${job.industry || 'Technology'}`);
    }

    const totalRaw =
      targetScore +
      roleScore +
      skillScore +
      locationScore +
      experienceScore +
      industryScore;

    const overallScore = Math.min(99, Math.max(15, totalRaw));

    const fitTier: FitTier =
      overallScore >= 85
        ? 'EXCELLENT FIT'
        : overallScore >= 70
        ? 'STRONG FIT'
        : overallScore >= 50
        ? 'GOOD FIT'
        : 'POTENTIAL FIT';

    return {
      overallScore,
      fitTier,
      matchReasons: reasons.slice(0, 4),
      mismatchReasons: mismatchReasons.slice(0, 2),
      breakdown: {
        roleScore,
        skillScore,
        experienceScore,
        locationScore,
        industryScore,
        targetCompanyScore: targetScore,
      },
    };
  }
}

export const fastJobMatcher = new FastJobMatcher();
