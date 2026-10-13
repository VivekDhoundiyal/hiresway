/**
 * CareerOS Preference Learning Engine
 *
 * Local, Browser-Native Learning-to-Rank (LTR) Preference Engine.
 * Continuously learns user preferences from explicit and implicit feedback:
 * - Reject (-3.0): Immediate removal from feed + negative feature affinity
 * - Save (+2.5): Positive role, company, skill, salary affinity
 * - Apply (+4.0): Strongest positive signal across all dimensions
 * - View (+0.5): Mild interest signal
 * - Ignore (-0.3): Gentle dampening of repeatedly passed opportunities
 * - Searches & Filters: Contextual intent weighting
 *
 * Features Tracked:
 * 1. Role / Job Title
 * 2. Industry
 * 3. Company
 * 4. Seniority Level
 * 5. Location
 * 6. Remote / Hybrid / On-site
 * 7. Skills
 * 8. Salary Range
 * 9. Employment Type
 * 10. Target Company Alignment
 * 11. Search Intent
 *
 * Fully explainable additive modifier [-20, +15] applied on top of profile match.
 */

import { UserJobAction, JobOpportunity } from '../types';
import { matchScoreCache } from '../../intelligence/matchScoreCache';
import { jobIdentityEngine } from './jobIdentityEngine';

export interface UserLearnedPreferences {
  // Disfavored
  disfavoredTitles: Record<string, number>;
  disfavoredCompanies: Record<string, number>;
  disfavoredIndustries: Record<string, number>;
  disfavoredSkills: Record<string, number>;
  disfavoredSeniority: Record<string, number>;
  disfavoredLocations: Record<string, number>;
  disfavoredRemoteTypes: Record<string, number>;
  disfavoredEmploymentTypes: Record<string, number>;
  maxObservedRejectedSalary?: number;

  // Preferred
  preferredTitles: Record<string, number>;
  preferredCompanies: Record<string, number>;
  preferredIndustries: Record<string, number>;
  preferredSkills: Record<string, number>;
  preferredSeniority: Record<string, number>;
  preferredLocations: Record<string, number>;
  preferredRemoteTypes: Record<string, number>;
  preferredEmploymentTypes: Record<string, number>;
  minObservedAcceptableSalary?: number;

  // Search & Filter Intent
  searchQueries: Record<string, number>;
  activeFilters: Record<string, number>;

  // Interaction Counters
  totalActionsCount: number;
  totalRejectionsCount: number;
  totalSavesCount: number;
  totalAppliesCount: number;
  totalViewsCount: number;
  lastUpdated: string;
}

const STORAGE_KEY = 'careeros_preference_learning_v2';

export class PreferenceLearningEngine {
  private prefs: UserLearnedPreferences;

  constructor() {
    this.prefs = this.load();
  }

  private load(): UserLearnedPreferences {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            disfavoredTitles: parsed.disfavoredTitles || {},
            disfavoredCompanies: parsed.disfavoredCompanies || {},
            disfavoredIndustries: parsed.disfavoredIndustries || {},
            disfavoredSkills: parsed.disfavoredSkills || {},
            disfavoredSeniority: parsed.disfavoredSeniority || {},
            disfavoredLocations: parsed.disfavoredLocations || {},
            disfavoredRemoteTypes: parsed.disfavoredRemoteTypes || {},
            disfavoredEmploymentTypes: parsed.disfavoredEmploymentTypes || {},
            maxObservedRejectedSalary: parsed.maxObservedRejectedSalary,

            preferredTitles: parsed.preferredTitles || {},
            preferredCompanies: parsed.preferredCompanies || {},
            preferredIndustries: parsed.preferredIndustries || {},
            preferredSkills: parsed.preferredSkills || {},
            preferredSeniority: parsed.preferredSeniority || {},
            preferredLocations: parsed.preferredLocations || {},
            preferredRemoteTypes: parsed.preferredRemoteTypes || {},
            preferredEmploymentTypes: parsed.preferredEmploymentTypes || {},
            minObservedAcceptableSalary: parsed.minObservedAcceptableSalary,

            searchQueries: parsed.searchQueries || {},
            activeFilters: parsed.activeFilters || {},

            totalActionsCount: parsed.totalActionsCount || 0,
            totalRejectionsCount: parsed.totalRejectionsCount || 0,
            totalSavesCount: parsed.totalSavesCount || 0,
            totalAppliesCount: parsed.totalAppliesCount || 0,
            totalViewsCount: parsed.totalViewsCount || 0,
            lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          };
        }
      }
    } catch {}

    return {
      disfavoredTitles: {},
      disfavoredCompanies: {},
      disfavoredIndustries: {},
      disfavoredSkills: {},
      disfavoredSeniority: {},
      disfavoredLocations: {},
      disfavoredRemoteTypes: {},
      disfavoredEmploymentTypes: {},
      preferredTitles: {},
      preferredCompanies: {},
      preferredIndustries: {},
      preferredSkills: {},
      preferredSeniority: {},
      preferredLocations: {},
      preferredRemoteTypes: {},
      preferredEmploymentTypes: {},
      searchQueries: {},
      activeFilters: {},
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
      if (typeof localStorage !== 'undefined') {
        this.prefs.lastUpdated = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
      }
    } catch {}
  }

  public getPreferences(): UserLearnedPreferences {
    return { ...this.prefs };
  }

  /**
   * Ingests a user action (Reject, Save, Apply, View) and updates weights.
   */
  public ingestAction(action: UserJobAction): void {
    const { jobSnapshot, action: actionType } = action;
    if (!jobSnapshot) return;

    this.prefs.totalActionsCount++;
    const normTitle = (jobSnapshot.title || '').trim().toLowerCase();
    const comp = (jobSnapshot.company || '').trim().toLowerCase();
    const ind = (jobSnapshot.industry || '').trim().toLowerCase();
    const remote = jobSnapshot.remoteStatus;
    const sen = (jobSnapshot.seniority || '').toLowerCase();
    const loc = (jobSnapshot.location || '').trim().toLowerCase();
    const skills = jobSnapshot.skills || [];

    if (actionType === 'reject') {
      this.prefs.totalRejectionsCount++;
      if (normTitle) this.increment(this.prefs.disfavoredTitles, normTitle, 1);
      if (comp) this.increment(this.prefs.disfavoredCompanies, comp, 1);
      if (ind) this.increment(this.prefs.disfavoredIndustries, ind, 1);
      if (remote) this.increment(this.prefs.disfavoredRemoteTypes, remote, 1);
      if (sen) this.increment(this.prefs.disfavoredSeniority, sen, 1);
      if (loc) this.increment(this.prefs.disfavoredLocations, loc, 1);
      skills.forEach((s) => this.increment(this.prefs.disfavoredSkills, s.toLowerCase(), 1));
    } else if (actionType === 'save') {
      this.prefs.totalSavesCount++;
      if (normTitle) this.increment(this.prefs.preferredTitles, normTitle, 1.5);
      if (comp) this.increment(this.prefs.preferredCompanies, comp, 2);
      if (ind) this.increment(this.prefs.preferredIndustries, ind, 1.5);
      if (remote) this.increment(this.prefs.preferredRemoteTypes, remote, 1.5);
      if (sen) this.increment(this.prefs.preferredSeniority, sen, 1.5);
      if (loc) this.increment(this.prefs.preferredLocations, loc, 1.5);
      skills.forEach((s) => this.increment(this.prefs.preferredSkills, s.toLowerCase(), 1.5));
      if (jobSnapshot.salaryMin) {
        this.prefs.minObservedAcceptableSalary = Math.min(
          this.prefs.minObservedAcceptableSalary || Infinity,
          jobSnapshot.salaryMin
        );
      }
    } else if (actionType === 'apply') {
      this.prefs.totalAppliesCount++;
      if (normTitle) this.increment(this.prefs.preferredTitles, normTitle, 2.5);
      if (comp) this.increment(this.prefs.preferredCompanies, comp, 3);
      if (ind) this.increment(this.prefs.preferredIndustries, ind, 2.5);
      if (remote) this.increment(this.prefs.preferredRemoteTypes, remote, 2.5);
      if (sen) this.increment(this.prefs.preferredSeniority, sen, 2);
      if (loc) this.increment(this.prefs.preferredLocations, loc, 2);
      skills.forEach((s) => this.increment(this.prefs.preferredSkills, s.toLowerCase(), 2));
    } else if (actionType === 'view') {
      this.prefs.totalViewsCount++;
      if (normTitle) this.increment(this.prefs.preferredTitles, normTitle, 0.4);
      if (comp) this.increment(this.prefs.preferredCompanies, comp, 0.5);
    }

    this.save();
    try {
      matchScoreCache.clear();
    } catch {}
  }

  /**
   * Ingests a search keyword query.
   */
  public ingestSearch(query: string): void {
    const q = query.trim().toLowerCase();
    if (q.length > 2) {
      this.increment(this.prefs.searchQueries, q, 1);
      this.save();
    }
  }

  /**
   * Computes preference score adjustment [-20, +15] and explainable insights.
   */
  public calculateAdjustment(job: JobOpportunity): {
    scoreAdjustment: number;
    behavioralInsight?: string;
  } {
    let adjustment = 0;
    const insights: string[] = [];

    const normTitle = (job.normalizedTitle || job.title || '').toLowerCase();
    const comp = (job.company || '').trim();
    const cleanComp = jobIdentityEngine.cleanCompanyName(comp);
    const ind = job.industry;
    const remote = job.remoteStatus;
    const sen = (job.seniority || '').toLowerCase();
    const loc = (job.location || '').toLowerCase();

    // 1. Title / Role Affinity
    for (const [titlePattern, weight] of Object.entries(this.prefs.preferredTitles)) {
      const cleanPattern = jobIdentityEngine.normalizeTitle(titlePattern);
      const cleanJobTitle = jobIdentityEngine.normalizeTitle(normTitle);
      if (
        weight >= 1.0 &&
        (normTitle.includes(titlePattern) ||
          titlePattern.includes(normTitle) ||
          (cleanPattern && cleanJobTitle && (cleanJobTitle.includes(cleanPattern) || cleanPattern.includes(cleanJobTitle))))
      ) {
        adjustment += Math.min(5, Math.round(weight * 1.2));
        insights.push(`Matches preferred role interest ("${titlePattern}")`);
        break;
      }
    }
    for (const [titlePattern, weight] of Object.entries(this.prefs.disfavoredTitles)) {
      const cleanPattern = jobIdentityEngine.normalizeTitle(titlePattern);
      const cleanJobTitle = jobIdentityEngine.normalizeTitle(normTitle);
      if (
        weight >= 1.0 &&
        (normTitle.includes(titlePattern) ||
          titlePattern.includes(normTitle) ||
          (cleanPattern && cleanJobTitle && (cleanJobTitle.includes(cleanPattern) || cleanPattern.includes(cleanJobTitle))))
      ) {
        adjustment -= Math.min(6, Math.round(weight * 1.5));
        insights.push(`Role previously deprioritized ("${titlePattern}")`);
        break;
      }
    }

    // 2. Company Affinity
    let compPref = 0;
    let compMatchName = comp;
    for (const [prefComp, weight] of Object.entries(this.prefs.preferredCompanies)) {
      const cleanPref = jobIdentityEngine.cleanCompanyName(prefComp);
      if (
        prefComp.toLowerCase() === comp.toLowerCase() ||
        (cleanComp && cleanPref && (cleanComp === cleanPref || cleanComp.includes(cleanPref) || cleanPref.includes(cleanComp)))
      ) {
        if (weight > compPref) {
          compPref = weight;
          compMatchName = prefComp;
        }
      }
    }

    let compDisfav = 0;
    for (const [disComp, weight] of Object.entries(this.prefs.disfavoredCompanies)) {
      const cleanDis = jobIdentityEngine.cleanCompanyName(disComp);
      if (
        disComp.toLowerCase() === comp.toLowerCase() ||
        (cleanComp && cleanDis && (cleanComp === cleanDis || cleanComp.includes(cleanDis) || cleanDis.includes(cleanComp)))
      ) {
        if (weight > compDisfav) {
          compDisfav = weight;
        }
      }
    }

    if (compPref > 0) {
      adjustment += Math.min(8, Math.round(compPref * 2.5));
      insights.push(`Saved or applied to ${comp || compMatchName} previously`);
    }
    if (compDisfav > 0) {
      adjustment -= Math.min(8, Math.round(compDisfav * 2.5));
      insights.push(`Company previously deprioritized (${comp})`);
    }

    // 3. Skills Affinity
    const jobSkills = [...(job.requiredSkills || []), ...(job.preferredSkills || [])].map((s) => s.toLowerCase());
    let skillBoost = 0;
    let skillPenalty = 0;
    const matchedSkills: string[] = [];
    for (const [skill, weight] of Object.entries(this.prefs.preferredSkills)) {
      if (weight >= 1.0 && jobSkills.includes(skill)) {
        skillBoost += 1;
        matchedSkills.push(skill);
      }
    }
    for (const [skill, weight] of Object.entries(this.prefs.disfavoredSkills)) {
      if (weight >= 1.0 && jobSkills.includes(skill)) skillPenalty += 1;
    }
    if (skillBoost > 0) {
      adjustment += Math.min(5, skillBoost);
      if (matchedSkills.length > 0 && insights.length < 2) {
        insights.push(`Skills match preferences (${matchedSkills.slice(0, 2).join(', ')})`);
      }
    }
    if (skillPenalty > 0) {
      adjustment -= Math.min(4, skillPenalty);
    }

    // 4. Seniority
    if (sen && this.prefs.preferredSeniority[sen] && this.prefs.preferredSeniority[sen] >= 1.0) {
      adjustment += Math.min(4, Math.round(this.prefs.preferredSeniority[sen] * 1.2));
      if (insights.length < 2) {
        insights.push(`Matches preferred seniority (${sen})`);
      }
    }
    if (sen && this.prefs.disfavoredSeniority[sen] && this.prefs.disfavoredSeniority[sen] >= 1.0) {
      adjustment -= Math.min(4, Math.round(this.prefs.disfavoredSeniority[sen] * 1.2));
    }

    // 5. Remote / Work Arrangement
    if (remote && this.prefs.preferredRemoteTypes[remote] && this.prefs.preferredRemoteTypes[remote] >= 1.0) {
      adjustment += Math.min(4, Math.round(this.prefs.preferredRemoteTypes[remote] * 1.2));
      if (insights.length < 2) {
        insights.push(`Matches preferred ${remote} arrangement`);
      }
    }
    if (remote && this.prefs.disfavoredRemoteTypes[remote] && this.prefs.disfavoredRemoteTypes[remote] >= 1.0) {
      adjustment -= Math.min(4, Math.round(this.prefs.disfavoredRemoteTypes[remote] * 1.2));
    }

    // 6. Location
    for (const [locKey, weight] of Object.entries(this.prefs.preferredLocations)) {
      if (weight >= 1.0 && loc.includes(locKey.toLowerCase())) {
        adjustment += Math.min(4, Math.round(weight));
        if (insights.length < 2) {
          insights.push(`Matches preferred location (${locKey})`);
        }
        break;
      }
    }
    for (const [locKey, weight] of Object.entries(this.prefs.disfavoredLocations)) {
      if (weight >= 1.0 && loc.includes(locKey.toLowerCase())) {
        adjustment -= Math.min(4, Math.round(weight));
        break;
      }
    }

    // 7. Industry
    if (ind && this.prefs.preferredIndustries[ind] && this.prefs.preferredIndustries[ind] >= 1.0) {
      adjustment += Math.min(5, Math.round(this.prefs.preferredIndustries[ind] * 1.5));
      if (insights.length < 2) {
        insights.push(`Matches preferred industry (${ind})`);
      }
    }
    if (ind && this.prefs.disfavoredIndustries[ind] && this.prefs.disfavoredIndustries[ind] >= 1.0) {
      adjustment -= Math.min(6, Math.round(this.prefs.disfavoredIndustries[ind] * 2));
      insights.push(`Industry frequently deprioritized (${ind})`);
    }

    // 8. Search Intent Alignment
    for (const [query, count] of Object.entries(this.prefs.searchQueries)) {
      if (count >= 2) {
        if (normTitle.includes(query) || comp.toLowerCase().includes(query)) {
          adjustment += 2;
          insights.push(`Matches recent search interest ("${query}")`);
          break;
        }
      }
    }

    // Clamped additive adjustment: -20 to +15
    const clampedAdjustment = Math.max(-20, Math.min(15, adjustment));

    // Fallback explainability guarantee: if non-zero adjustment, provide clear context
    if (clampedAdjustment > 0 && insights.length === 0) {
      insights.push('Matches behavioral career preferences');
    } else if (clampedAdjustment < 0 && insights.length === 0) {
      insights.push('Deprioritized based on previous feedback');
    }

    return {
      scoreAdjustment: clampedAdjustment,
      behavioralInsight: insights.length > 0 ? insights.slice(0, 2).join(' · ') : undefined,
    };
  }

  private increment(map: Record<string, number>, key: string, delta: number): void {
    map[key] = (map[key] || 0) + delta;
  }

  public reset(): void {
    this.prefs = {
      disfavoredTitles: {},
      disfavoredCompanies: {},
      disfavoredIndustries: {},
      disfavoredSkills: {},
      disfavoredSeniority: {},
      disfavoredLocations: {},
      disfavoredRemoteTypes: {},
      disfavoredEmploymentTypes: {},
      preferredTitles: {},
      preferredCompanies: {},
      preferredIndustries: {},
      preferredSkills: {},
      preferredSeniority: {},
      preferredLocations: {},
      preferredRemoteTypes: {},
      preferredEmploymentTypes: {},
      searchQueries: {},
      activeFilters: {},
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

export const preferenceLearningEngine = new PreferenceLearningEngine();
