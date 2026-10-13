/**
 * CareerOS Career Search Engine
 *
 * Hybrid Search Engine across genuine CareerOs entities:
 * - Jobs (Titles, companies, skills, descriptions, locations)
 * - Companies (with open opportunity counts and target status)
 * - Skills (with frequency and matching opportunities)
 * - Target Companies
 * - User Applications
 *
 * Hybrid Algorithm:
 * Exact match (1.0) + Token overlap (0.6) + Fuzzy Levenshtein/Trigram (0.3) + Semantic affinity (0.2)
 *
 * Navigation remains completely separate.
 */

import { JobOpportunity } from '../types';
import { jobRepository } from '../jobRepository';
import { targetCompaniesStore } from '../../target-companies/targetCompanyStore';

export interface MatchingJobResult {
  job: JobOpportunity;
  score: number;
  highlightField: 'title' | 'company' | 'skill' | 'description' | 'location';
}

export interface MatchingCompanyResult {
  company: string;
  domain?: string;
  isTarget: boolean;
  opportunityCount: number;
  score: number;
}

export interface MatchingSkillResult {
  skill: string;
  jobCount: number;
  score: number;
}

export interface SearchResultGroup {
  jobs: MatchingJobResult[];
  companies: MatchingCompanyResult[];
  skills: MatchingSkillResult[];
  targetCompanies: string[];
  totalResults: number;
}

// Semantic synonyms and role/skill expansions
const SEMANTIC_EXPANSIONS: Record<string, string[]> = {
  sales: ['account executive', 'b2b', 'enterprise sales', 'sales manager', 'sdr', 'bdr'],
  ai: ['artificial intelligence', 'machine learning', 'ml', 'deep learning', 'nlp', 'llm', 'computer vision'],
  frontend: ['react', 'vue', 'angular', 'javascript', 'typescript', 'css', 'ui', 'next.js'],
  backend: ['node', 'python', 'java', 'golang', 'go', 'api', 'postgres', 'sql', 'microservices'],
  pm: ['product manager', 'product management', 'product strategy', 'roadmap'],
  cloud: ['aws', 'gcp', 'azure', 'devops', 'kubernetes', 'docker'],
};

export class CareerSearchEngine {
  /**
   * Levenshtein distance for fuzzy matching.
   */
  private levenshtein(a: string, b: string): number {
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));
    for (let i = 0; i <= an; i++) matrix[0][i] = i;
    for (let j = 0; j <= bn; j++) matrix[j][0] = j;

    for (let j = 1; j <= bn; j++) {
      for (let i = 1; i <= an; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    return matrix[bn][an];
  }

  /**
   * Evaluates text match against query with hybrid scoring.
   */
  private scoreField(target: string, query: string): { score: number; matched: boolean } {
    if (!target || !query) return { score: 0, matched: false };
    const t = target.toLowerCase();
    const q = query.toLowerCase();

    // 1. Exact match
    if (t === q) return { score: 1.0, matched: true };

    // 2. Substring match
    if (t.includes(q)) {
      const ratio = q.length / t.length;
      return { score: 0.7 + ratio * 0.25, matched: true };
    }

    // 3. Token match
    const qTokens = q.split(/\s+/).filter(Boolean);
    const tTokens = t.split(/\s+/).filter(Boolean);
    let matchedTokens = 0;
    for (const qt of qTokens) {
      if (tTokens.some((tt) => tt.includes(qt))) {
        matchedTokens++;
      }
    }
    if (matchedTokens > 0) {
      return { score: 0.5 * (matchedTokens / qTokens.length), matched: true };
    }

    // 4. Fuzzy match (for terms >= 4 chars)
    if (q.length >= 4 && tTokens.length > 0) {
      for (const tt of tTokens) {
        if (Math.abs(tt.length - q.length) <= 2) {
          const dist = this.levenshtein(tt, q);
          if (dist <= 1) return { score: 0.45, matched: true };
          if (dist <= 2 && q.length >= 6) return { score: 0.35, matched: true };
        }
      }
    }

    // 5. Semantic Expansion
    for (const [key, synonyms] of Object.entries(SEMANTIC_EXPANSIONS)) {
      if (q === key || q.includes(key)) {
        if (synonyms.some((syn) => t.includes(syn))) {
          return { score: 0.4, matched: true };
        }
      }
    }

    return { score: 0, matched: false };
  }

  /**
   * Executes hybrid search across all authentic CareerOS opportunities and entities.
   */
  public search(
    rawQuery: string,
    options?: { maxJobs?: number; maxCompanies?: number; maxSkills?: number }
  ): SearchResultGroup {
    const q = rawQuery.trim().toLowerCase();
    if (!q) {
      return { jobs: [], companies: [], skills: [], targetCompanies: [], totalResults: 0 };
    }

    const activeJobs = jobRepository.getActiveOpportunities();
    const savedJobs = jobRepository.getSavedOpportunities();

    // Deduplicate
    const opportunityMap = new Map<string, JobOpportunity>();
    activeJobs.forEach((j) => opportunityMap.set(j.id, j));
    savedJobs.forEach((j) => {
      if (!opportunityMap.has(j.id)) opportunityMap.set(j.id, j);
    });
    const allOpportunities = Array.from(opportunityMap.values());

    const targetCompanies = targetCompaniesStore.getCompanies().map((c) => c.name);

    // 1. Score Jobs
    const jobResults: MatchingJobResult[] = [];
    allOpportunities.forEach((job) => {
      let bestScore = 0;
      let highlight: MatchingJobResult['highlightField'] = 'title';

      // Title
      const titleRes = this.scoreField(job.title, q);
      if (titleRes.matched && titleRes.score > bestScore) {
        bestScore = titleRes.score * 1.2;
        highlight = 'title';
      }

      // Company
      const compRes = this.scoreField(job.company, q);
      if (compRes.matched && compRes.score * 1.1 > bestScore) {
        bestScore = compRes.score * 1.1;
        highlight = 'company';
      }

      // Skills
      const allSkills = [...(job.requiredSkills || []), ...(job.preferredSkills || [])];
      for (const skill of allSkills) {
        const skillRes = this.scoreField(skill, q);
        if (skillRes.matched && skillRes.score > bestScore) {
          bestScore = skillRes.score;
          highlight = 'skill';
          break;
        }
      }

      // Location
      if (job.location) {
        const locRes = this.scoreField(job.location, q);
        if (locRes.matched && locRes.score * 0.8 > bestScore) {
          bestScore = locRes.score * 0.8;
          highlight = 'location';
        }
      }

      // Description
      if (job.description && bestScore === 0) {
        const descRes = this.scoreField(job.description, q);
        if (descRes.matched) {
          bestScore = descRes.score * 0.6;
          highlight = 'description';
        }
      }

      if (bestScore > 0.25) {
        jobResults.push({ job, score: bestScore, highlightField: highlight });
      }
    });

    jobResults.sort((a, b) => b.score - a.score);
    const jobs = jobResults.slice(0, options?.maxJobs || 8);

    // 2. Score Companies
    const companyCountMap = new Map<string, { count: number; domain?: string; score: number }>();
    allOpportunities.forEach((job) => {
      if (job.company) {
        const res = this.scoreField(job.company, q);
        if (res.matched) {
          const prev = companyCountMap.get(job.company) || {
            count: 0,
            domain: job.companyDomain,
            score: res.score,
          };
          companyCountMap.set(job.company, {
            count: prev.count + 1,
            domain: prev.domain || job.companyDomain,
            score: Math.max(prev.score, res.score),
          });
        }
      }
    });

    const matchingCompanies: MatchingCompanyResult[] = Array.from(companyCountMap.entries())
      .map(([company, data]) => ({
        company,
        domain: data.domain,
        isTarget: targetCompanies.some((tc) => tc.toLowerCase() === company.toLowerCase()),
        opportunityCount: data.count,
        score: data.score + (targetCompanies.some((tc) => tc.toLowerCase() === company.toLowerCase()) ? 0.3 : 0),
      }))
      .sort((a, b) => b.score - a.score || b.opportunityCount - a.opportunityCount)
      .slice(0, options?.maxCompanies || 4);

    // 3. Score Skills
    const skillCountMap = new Map<string, { count: number; score: number }>();
    allOpportunities.forEach((job) => {
      const allSkills = [...(job.requiredSkills || []), ...(job.preferredSkills || [])];
      allSkills.forEach((s) => {
        if (s) {
          const res = this.scoreField(s, q);
          if (res.matched) {
            const prev = skillCountMap.get(s) || { count: 0, score: res.score };
            skillCountMap.set(s, {
              count: prev.count + 1,
              score: Math.max(prev.score, res.score),
            });
          }
        }
      });
    });

    const matchingSkills: MatchingSkillResult[] = Array.from(skillCountMap.entries())
      .map(([skill, data]) => ({
        skill,
        jobCount: data.count,
        score: data.score,
      }))
      .sort((a, b) => b.score - a.score || b.jobCount - a.jobCount)
      .slice(0, options?.maxSkills || 4);

    // 4. Target Companies
    const matchingTargets = targetCompanies
      .filter((tc) => this.scoreField(tc, q).matched)
      .slice(0, 4);

    const totalResults = jobs.length + matchingCompanies.length + matchingSkills.length;

    return {
      jobs,
      companies: matchingCompanies,
      skills: matchingSkills,
      targetCompanies: matchingTargets,
      totalResults,
    };
  }
}

export const careerSearchEngine = new CareerSearchEngine();
