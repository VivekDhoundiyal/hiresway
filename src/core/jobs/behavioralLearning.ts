import { UserJobAction, LearnedPreferences, JobOpportunity } from './types';
import { matchScoreCache } from '../intelligence/matchScoreCache';
import { preferenceLearningEngine } from './engines/preferenceLearningEngine';

const LEARNED_PREFS_KEY = 'careeros_learned_preferences_v1';

export class BehavioralLearningEngine {
  private preferences: LearnedPreferences;

  constructor() {
    this.preferences = this.loadPreferences();
  }

  private loadPreferences(): LearnedPreferences {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(LEARNED_PREFS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            disfavoredIndustries: parsed.disfavoredIndustries || {},
            disfavoredTitles: parsed.disfavoredTitles || {},
            disfavoredCompanies: parsed.disfavoredCompanies || {},
            disfavoredSkills: parsed.disfavoredSkills || {},
            disfavoredSeniority: parsed.disfavoredSeniority || {},
            disfavoredLocations: parsed.disfavoredLocations || {},
            disfavoredRemoteTypes: parsed.disfavoredRemoteTypes || {},
            minObservedAcceptableSalary: parsed.minObservedAcceptableSalary,
            maxObservedRejectedSalary: parsed.maxObservedRejectedSalary,
            preferredIndustries: parsed.preferredIndustries || {},
            preferredTitles: parsed.preferredTitles || {},
            preferredSkills: parsed.preferredSkills || {},
            preferredCompanies: parsed.preferredCompanies || {},
            preferredSeniority: parsed.preferredSeniority || {},
            preferredLocations: parsed.preferredLocations || {},
            preferredRemoteTypes: parsed.preferredRemoteTypes || {},
            totalActionsCount: parsed.totalActionsCount || 0,
            totalRejectionsCount: parsed.totalRejectionsCount || 0,
            totalSavesCount: parsed.totalSavesCount || 0,
            totalAppliesCount: parsed.totalAppliesCount || 0,
            totalViewsCount: parsed.totalViewsCount || 0,
            lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          };
        }
      }
    } catch {
      // Fallback
    }

    return {
      disfavoredIndustries: {},
      disfavoredTitles: {},
      disfavoredCompanies: {},
      disfavoredSkills: {},
      disfavoredSeniority: {},
      disfavoredLocations: {},
      disfavoredRemoteTypes: {},
      preferredIndustries: {},
      preferredTitles: {},
      preferredSkills: {},
      preferredCompanies: {},
      preferredSeniority: {},
      preferredLocations: {},
      preferredRemoteTypes: {},
      totalActionsCount: 0,
      totalRejectionsCount: 0,
      totalSavesCount: 0,
      totalAppliesCount: 0,
      totalViewsCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  private save(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      this.preferences.lastUpdated = new Date().toISOString();
      localStorage.setItem(LEARNED_PREFS_KEY, JSON.stringify(this.preferences));
    } catch (e) {
      console.error('Failed to save learned preferences:', e);
    }
  }

  public getPreferences(): LearnedPreferences {
    return { ...this.preferences };
  }

  /**
   * Updates behavioral model based on user interactions:
   * Reject (negative signal), Save (positive signal), Apply (strong positive signal), View (mild curiosity).
   * Single rejections do not permanently blacklist unrelated roles; repeated signals strengthen the pattern.
   */
  public ingestAction(action: UserJobAction): void {
    const { jobSnapshot, rejectionReason, action: actionType } = action;
    if (!jobSnapshot) return;

    try {
      preferenceLearningEngine.ingestAction(action);
    } catch {}

    this.preferences.totalActionsCount = (this.preferences.totalActionsCount || 0) + 1;

    const normTitle = (jobSnapshot.title || '').trim().toLowerCase();
    const comp = (jobSnapshot.company || '').trim();
    const ind = (jobSnapshot.industry || '').trim();
    const remote = jobSnapshot.remoteStatus;
    const sen = (jobSnapshot.seniority || '').toLowerCase();
    const loc = (jobSnapshot.location || '').trim();
    const skills = jobSnapshot.skills || [];

    if (actionType === 'reject') {
      this.preferences.totalRejectionsCount = (this.preferences.totalRejectionsCount || 0) + 1;

      // Disfavor title / role pattern
      if (normTitle) {
        this.preferences.disfavoredTitles[normTitle] = (this.preferences.disfavoredTitles[normTitle] || 0) + 2;
      }
      // Disfavor company
      if (comp) {
        this.preferences.disfavoredCompanies[comp] = (this.preferences.disfavoredCompanies[comp] || 0) + 2;
      }
      // Disfavor industry
      if (ind) {
        this.preferences.disfavoredIndustries[ind] = (this.preferences.disfavoredIndustries[ind] || 0) + 1.5;
      }
      // Disfavor remote arrangement
      if (remote) {
        this.preferences.disfavoredRemoteTypes[remote] = (this.preferences.disfavoredRemoteTypes[remote] || 0) + 1;
      }
      // Disfavor seniority
      if (sen) {
        this.preferences.disfavoredSeniority[sen] = (this.preferences.disfavoredSeniority[sen] || 0) + 1;
      }
      // Disfavor location
      if (loc && loc !== 'Remote' && loc !== 'Location not disclosed') {
        this.preferences.disfavoredLocations[loc] = (this.preferences.disfavoredLocations[loc] || 0) + 1;
      }
      // Disfavor skills (mild penalty)
      skills.slice(0, 5).forEach((sk) => {
        if (sk) {
          this.preferences.disfavoredSkills[sk] = (this.preferences.disfavoredSkills[sk] || 0) + 0.5;
        }
      });
      // Salary rejection
      if (rejectionReason === 'salary_low' && jobSnapshot.salaryMax) {
        this.preferences.minObservedAcceptableSalary = Math.max(
          this.preferences.minObservedAcceptableSalary || 0,
          jobSnapshot.salaryMax
        );
      }
      if (jobSnapshot.salaryMax) {
        this.preferences.maxObservedRejectedSalary = Math.max(
          this.preferences.maxObservedRejectedSalary || 0,
          jobSnapshot.salaryMax
        );
      }
    } else if (actionType === 'save') {
      this.preferences.totalSavesCount = (this.preferences.totalSavesCount || 0) + 1;

      if (normTitle) {
        this.preferences.preferredTitles[normTitle] = (this.preferences.preferredTitles[normTitle] || 0) + 2;
      }
      if (comp) {
        this.preferences.preferredCompanies[comp] = (this.preferences.preferredCompanies[comp] || 0) + 2.5;
      }
      if (ind) {
        this.preferences.preferredIndustries[ind] = (this.preferences.preferredIndustries[ind] || 0) + 2;
      }
      if (remote) {
        this.preferences.preferredRemoteTypes[remote] = (this.preferences.preferredRemoteTypes[remote] || 0) + 1.5;
      }
      if (sen) {
        this.preferences.preferredSeniority[sen] = (this.preferences.preferredSeniority[sen] || 0) + 1.5;
      }
      if (loc && loc !== 'Location not disclosed') {
        this.preferences.preferredLocations[loc] = (this.preferences.preferredLocations[loc] || 0) + 1.5;
      }
      skills.forEach((sk) => {
        if (sk) {
          this.preferences.preferredSkills[sk] = (this.preferences.preferredSkills[sk] || 0) + 1;
        }
      });
      if (jobSnapshot.salaryMin) {
        if (!this.preferences.minObservedAcceptableSalary || jobSnapshot.salaryMin > this.preferences.minObservedAcceptableSalary) {
          this.preferences.minObservedAcceptableSalary = jobSnapshot.salaryMin;
        }
      }
    } else if (actionType === 'apply') {
      this.preferences.totalAppliesCount = (this.preferences.totalAppliesCount || 0) + 1;

      // Strongest positive signal
      if (normTitle) {
        this.preferences.preferredTitles[normTitle] = (this.preferences.preferredTitles[normTitle] || 0) + 4;
      }
      if (comp) {
        this.preferences.preferredCompanies[comp] = (this.preferences.preferredCompanies[comp] || 0) + 4;
      }
      if (ind) {
        this.preferences.preferredIndustries[ind] = (this.preferences.preferredIndustries[ind] || 0) + 3;
      }
      if (remote) {
        this.preferences.preferredRemoteTypes[remote] = (this.preferences.preferredRemoteTypes[remote] || 0) + 2.5;
      }
      if (sen) {
        this.preferences.preferredSeniority[sen] = (this.preferences.preferredSeniority[sen] || 0) + 2.5;
      }
      if (loc && loc !== 'Location not disclosed') {
        this.preferences.preferredLocations[loc] = (this.preferences.preferredLocations[loc] || 0) + 2;
      }
      skills.forEach((sk) => {
        if (sk) {
          this.preferences.preferredSkills[sk] = (this.preferences.preferredSkills[sk] || 0) + 2;
        }
      });
      if (jobSnapshot.salaryMin) {
        this.preferences.minObservedAcceptableSalary = Math.max(
          this.preferences.minObservedAcceptableSalary || 0,
          jobSnapshot.salaryMin
        );
      }
    } else if (actionType === 'view') {
      this.preferences.totalViewsCount = (this.preferences.totalViewsCount || 0) + 1;

      // Mild positive interest
      if (normTitle) {
        this.preferences.preferredTitles[normTitle] = (this.preferences.preferredTitles[normTitle] || 0) + 0.5;
      }
      if (comp) {
        this.preferences.preferredCompanies[comp] = (this.preferences.preferredCompanies[comp] || 0) + 0.5;
      }
      if (ind) {
        this.preferences.preferredIndustries[ind] = (this.preferences.preferredIndustries[ind] || 0) + 0.5;
      }
    }

    this.save();
    try {
      matchScoreCache.clear();
    } catch {
      // safe fallback
    }
  }

  /**
   * Computes an additive score modifier (-20 to +15) based on accumulated behavioral evidence
   * across roles/titles, companies, skills, seniority, locations, remote/hybrid, salary, and industries.
   */
  public calculateBehavioralModifier(job: JobOpportunity): {
    scoreAdjustment: number;
    behavioralInsight?: string;
  } {
    let adjustment = 0;
    const insights: string[] = [];

    const normTitle = (job.normalizedTitle || job.title || '').toLowerCase();
    const comp = job.company;
    const ind = job.industry;
    const remote = job.remoteStatus;
    const sen = (job.seniority || '').toLowerCase();
    const loc = (job.location || '').toLowerCase();

    // 1. Roles / Job Titles
    for (const [titlePattern, weight] of Object.entries(this.preferences.preferredTitles || {})) {
      if (weight >= 2 && normTitle.includes(titlePattern.toLowerCase())) {
        const boost = Math.min(5, Math.round(weight * 1.2));
        adjustment += boost;
        insights.push(`Matches preferred role interest ("${titlePattern}")`);
        break;
      }
    }
    for (const [titlePattern, weight] of Object.entries(this.preferences.disfavoredTitles || {})) {
      if (weight >= 2 && normTitle.includes(titlePattern.toLowerCase())) {
        const penalty = Math.min(6, Math.round(weight * 1.5));
        adjustment -= penalty;
        break;
      }
    }

    // 2. Company Affinity
    const compPref = this.preferences.preferredCompanies?.[comp] || 0;
    const compDisfav = this.preferences.disfavoredCompanies?.[comp] || 0;
    if (compPref > 0) {
      const boost = Math.min(8, Math.round(compPref * 2.5));
      adjustment += boost;
      insights.push(`Saved or applied to ${comp} previously`);
    }
    if (compDisfav > 0) {
      const penalty = Math.min(8, Math.round(compDisfav * 2.5));
      adjustment -= penalty;
    }

    // 3. Skills Affinity
    const jobSkills = [...(job.requiredSkills || []), ...(job.preferredSkills || [])].map((s) => s.toLowerCase());
    let skillBoost = 0;
    let skillPenalty = 0;
    for (const [skill, weight] of Object.entries(this.preferences.preferredSkills || {})) {
      if (weight >= 2 && jobSkills.includes(skill.toLowerCase())) {
        skillBoost += 1;
      }
    }
    for (const [skill, weight] of Object.entries(this.preferences.disfavoredSkills || {})) {
      if (weight >= 2 && jobSkills.includes(skill.toLowerCase())) {
        skillPenalty += 1;
      }
    }
    adjustment += Math.min(5, skillBoost);
    adjustment -= Math.min(4, skillPenalty);

    // 4. Seniority
    if (sen && this.preferences.preferredSeniority?.[sen]) {
      adjustment += Math.min(4, Math.round(this.preferences.preferredSeniority[sen] * 1.2));
    }
    if (sen && this.preferences.disfavoredSeniority?.[sen] && this.preferences.disfavoredSeniority[sen] >= 2) {
      adjustment -= Math.min(4, Math.round(this.preferences.disfavoredSeniority[sen] * 1.2));
    }

    // 5. Remote / Work Arrangement
    if (remote && this.preferences.preferredRemoteTypes?.[remote]) {
      adjustment += Math.min(4, Math.round(this.preferences.preferredRemoteTypes[remote] * 1.2));
    }
    if (remote && this.preferences.disfavoredRemoteTypes?.[remote] && this.preferences.disfavoredRemoteTypes[remote] >= 2) {
      adjustment -= Math.min(4, Math.round(this.preferences.disfavoredRemoteTypes[remote] * 1.2));
    }

    // 6. Location
    for (const [locKey, weight] of Object.entries(this.preferences.preferredLocations || {})) {
      if (weight >= 2 && loc.includes(locKey.toLowerCase())) {
        adjustment += Math.min(4, Math.round(weight));
        break;
      }
    }
    for (const [locKey, weight] of Object.entries(this.preferences.disfavoredLocations || {})) {
      if (weight >= 2 && loc.includes(locKey.toLowerCase())) {
        adjustment -= Math.min(4, Math.round(weight));
        break;
      }
    }

    // 7. Industry
    if (ind && this.preferences.preferredIndustries?.[ind]) {
      adjustment += Math.min(5, Math.round(this.preferences.preferredIndustries[ind] * 1.5));
    }
    if (ind && this.preferences.disfavoredIndustries?.[ind] && this.preferences.disfavoredIndustries[ind] >= 2) {
      adjustment -= Math.min(6, Math.round(this.preferences.disfavoredIndustries[ind] * 2));
      insights.push(`Industry frequently deprioritized (${ind})`);
    }

    // 8. Salary Threshold
    if (this.preferences.minObservedAcceptableSalary && job.salary) {
      const maxSalary = job.salary.max || job.salary.min;
      if (maxSalary && maxSalary < this.preferences.minObservedAcceptableSalary) {
        adjustment -= 4;
      } else if (job.salary.min && job.salary.min >= this.preferences.minObservedAcceptableSalary) {
        adjustment += 3;
      }
    }

    // Clamped additive adjustment: -20 to +15
    const clampedAdjustment = Math.max(-20, Math.min(15, adjustment));

    return {
      scoreAdjustment: clampedAdjustment,
      behavioralInsight: insights.length > 0 ? insights.slice(0, 2).join(' · ') : undefined,
    };
  }

  public reset(): void {
    this.preferences = {
      disfavoredIndustries: {},
      disfavoredTitles: {},
      disfavoredCompanies: {},
      disfavoredSkills: {},
      disfavoredSeniority: {},
      disfavoredLocations: {},
      disfavoredRemoteTypes: {},
      preferredIndustries: {},
      preferredTitles: {},
      preferredSkills: {},
      preferredCompanies: {},
      preferredSeniority: {},
      preferredLocations: {},
      preferredRemoteTypes: {},
      totalActionsCount: 0,
      totalRejectionsCount: 0,
      totalSavesCount: 0,
      totalAppliesCount: 0,
      totalViewsCount: 0,
      lastUpdated: new Date().toISOString(),
    };
    this.save();
    try {
      matchScoreCache.clear();
    } catch {}
  }
}

export const behavioralLearningEngine = new BehavioralLearningEngine();
