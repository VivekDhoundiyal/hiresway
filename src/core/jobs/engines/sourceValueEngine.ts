/**
 * CareerOS Source Value Engine
 *
 * Automatically classifies and prioritizes sources based on authenticity and yield:
 * - TIER 1 — HIGH VALUE: Direct company career pages, Greenhouse, Lever, Ashby, Workable, SmartRecruiters, official ATS/job APIs, structured feeds.
 * - TIER 2 — USEFUL: Established job boards and reliable aggregators (Naukri, LinkedIn Jobs, Indeed India/Global, Foundit, Instahyre, Cutshort, iimjobs, Hirist, Shine, TimesJobs, Wellfound, Apna, WorkIndia, Internshala).
 * - TIER 3 — LOW VALUE: Unknown aggregators, duplicated feeds, stale sources, poor extraction sources.
 * - TIER 4 — DEAD: 404, expired, blocked, permanently failing, empty, or generic career pages.
 *
 * Core Principle:
 * Prioritize Tier 1 → Tier 2.
 * Deprioritize Tier 3.
 * Quarantine Tier 4.
 */

import { JobSourceRegistryEntry } from '../types';
import { sourceRegistry } from '../sourceRegistry';
import { sourceHealthEngine } from './sourceHealthEngine';

export type SourceTier = 'TIER_1_HIGH_VALUE' | 'TIER_2_USEFUL' | 'TIER_3_LOW_VALUE' | 'TIER_4_DEAD';

export interface SourceValueEvaluation {
  tier: SourceTier;
  tierScore: number; // 0 - 100
  tierLabel: string;
  isHighValue: boolean;
  isQuarantined: boolean;
  priorityWeight: number; // multiplier for queue ordering
  reason: string;
}

const TIER_LABELS: Record<SourceTier, string> = {
  TIER_1_HIGH_VALUE: 'Tier 1 — High Value ATS / Direct',
  TIER_2_USEFUL: 'Tier 2 — Established Board / Platform',
  TIER_3_LOW_VALUE: 'Tier 3 — Aggregator / Low Yield',
  TIER_4_DEAD: 'Tier 4 — Dead / Quarantined',
};

// Known high-value ATS platforms
const HIGH_VALUE_ATS = new Set([
  'greenhouse',
  'lever',
  'ashby',
  'workable',
  'smartrecruiters',
  'bamboohr',
  'workday',
  'icims',
]);

// Established Tier 2 platforms (India + Global)
const ESTABLISHED_PLATFORMS = new Set([
  'naukri.com',
  'linkedin.com',
  'indeed.com',
  'indeed.co.in',
  'foundit.in',
  'instahyre.com',
  'cutshort.io',
  'iimjobs.com',
  'hirist.com',
  'shine.com',
  'timesjobs.com',
  'wellfound.com',
  'apna.co',
  'workindia.in',
  'internshala.com',
  'ycombinator.com',
  'remoteok.com',
  'weworkremotely.com',
  'himalayas.app',
  'remotive.com',
  'otta.com',
  'glassdoor.com',
  'dice.com',
  'builtin.com',
]);

export class SourceValueEngine {
  private customTierOverrides: Map<string, SourceTier> = new Map();

  /**
   * Classifies a source into one of the 4 strict tiers.
   */
  public evaluateSource(source: JobSourceRegistryEntry): SourceValueEvaluation {
    // 1. Manual override check
    if (this.customTierOverrides.has(source.id)) {
      const tier = this.customTierOverrides.get(source.id)!;
      return this.formatEvaluation(tier, 'Manually specified tier override');
    }

    // 2. Health & Dead Check: Check for persistent dead signatures
    const isQuarantined =
      sourceHealthEngine.isSourceQuarantined(source.id) ||
      source.sourceHealth === 'quarantined' ||
      (source.consecutiveFailures !== undefined && source.consecutiveFailures >= 3) ||
      (source.errorCount !== undefined && source.errorCount >= 3);

    if (isQuarantined) {
      return this.formatEvaluation(
        'TIER_4_DEAD',
        'Source has persistent failures, dead endpoint, or is quarantined'
      );
    }

    // Check last error for explicit dead signatures
    const lastErr = (source.last_error || source.ineligibilityReason || '').toLowerCase();
    if (
      lastErr.includes('404') ||
      lastErr.includes('410') ||
      lastErr.includes('page not found') ||
      lastErr.includes('expired') ||
      lastErr.includes('no longer active')
    ) {
      return this.formatEvaluation('TIER_4_DEAD', `Dead endpoint signature detected: ${lastErr}`);
    }

    // 3. Tier 1: Direct Company Career Pages & Structured ATS Feeds
    const domain = (source.domain || '').toLowerCase().replace(/^www\./, '');
    const atsType = (source.atsType || '').toLowerCase();
    const isCompanyAts =
      HIGH_VALUE_ATS.has(atsType) ||
      source.category === 'company_ats' ||
      source.sourceType === 'company_career_portal';

    if (isCompanyAts) {
      return this.formatEvaluation(
        'TIER_1_HIGH_VALUE',
        `Official ATS (${atsType || 'Direct Portal'}) verified company endpoint`
      );
    }

    if (source.category === 'target_company' as any) {
      return this.formatEvaluation('TIER_1_HIGH_VALUE', 'User Target Company career pipeline');
    }

    if (source.discoveryMethod === 'api' || source.discoveryMethod === 'feed') {
      if (source.category === 'remote_first' || source.category === 'startup_vc') {
        return this.formatEvaluation(
          'TIER_1_HIGH_VALUE',
          'Structured high-freshness API/Feed from verified network'
        );
      }
    }

    // 4. Tier 2: Established Job Boards & Reliable Regional Networks (India + Global)
    const isEstablished =
      ESTABLISHED_PLATFORMS.has(domain) ||
      Array.from(ESTABLISHED_PLATFORMS).some((p) => domain.includes(p)) ||
      source.category === 'regional_portal' ||
      source.category === 'remote_first' ||
      source.category === 'startup_vc';

    if (isEstablished) {
      return this.formatEvaluation(
        'TIER_2_USEFUL',
        'Established regional or global job network with verified listings'
      );
    }

    // 5. Tier 3: Unknown / Generic Aggregators & Low-Yield Sources
    if (
      source.category === 'major_aggregator' ||
      source.sourceType === 'aggregator' ||
      source.discoveryMethod === 'crawl'
    ) {
      return this.formatEvaluation(
        'TIER_3_LOW_VALUE',
        'Third-party aggregator or secondary crawl source with potential duplicate listings'
      );
    }

    // Default: Useful if healthy, otherwise Low Value
    return source.sourceHealth === 'healthy'
      ? this.formatEvaluation('TIER_2_USEFUL', 'Standard verified directory')
      : this.formatEvaluation('TIER_3_LOW_VALUE', 'Unverified or low-yield secondary source');
  }

  private formatEvaluation(tier: SourceTier, reason: string): SourceValueEvaluation {
    const isQuarantined = tier === 'TIER_4_DEAD';
    const isHighValue = tier === 'TIER_1_HIGH_VALUE';

    let tierScore = 50;
    let priorityWeight = 1.0;

    switch (tier) {
      case 'TIER_1_HIGH_VALUE':
        tierScore = 95;
        priorityWeight = 3.5;
        break;
      case 'TIER_2_USEFUL':
        tierScore = 75;
        priorityWeight = 2.0;
        break;
      case 'TIER_3_LOW_VALUE':
        tierScore = 35;
        priorityWeight = 0.5;
        break;
      case 'TIER_4_DEAD':
        tierScore = 0;
        priorityWeight = 0.0;
        break;
    }

    return {
      tier,
      tierScore,
      tierLabel: TIER_LABELS[tier],
      isHighValue,
      isQuarantined,
      priorityWeight,
      reason,
    };
  }

  /**
   * Calculates the multi-factor Source Intelligence Score:
   * SourceIntelligenceScore = (yieldScore * 0.3) + (freshnessScore * 0.2) + (reliabilityScore * 0.25) + (profileRelevance * 0.25)
   * With Target Companies receiving a mandatory +100 priority bonus.
   */
  public calculateSourceIntelligenceScore(
    source: JobSourceRegistryEntry,
    options?:
      | {
          isTargetCompany?: boolean;
          userHomeCountry?: string;
          targetRoles?: string[];
          recentJobChanges?: boolean;
          userAffinity?: number;
        }
      | {
          targetCompanies?: string[];
          workPreferences?: { targetLocations?: string[] };
        }
  ): number {
    const sAny = source as any;
    const evaluation = this.evaluateSource(source);
    if (evaluation.tier === 'TIER_4_DEAD' || evaluation.isQuarantined || sAny.status === 'quarantined') {
      return -1000;
    }

    const health = sourceHealthEngine.getHealth(source.id);

    // Options extraction
    let isTarget = false;
    let userHomeCountry = 'India';
    let userAffinity: number | undefined = undefined;
    let optRecentJobChanges: boolean | undefined = undefined;

    if (options && 'targetCompanies' in options) {
      const profile = options as { targetCompanies?: string[]; workPreferences?: { targetLocations?: string[] } };
      const targets = (profile.targetCompanies || []).map((t: string) => t.toLowerCase().trim());
      const sName = (source.name || '').toLowerCase().trim();
      const sCompany = (sAny.targetCompany || source.companyName || '').toLowerCase().trim();
      isTarget =
        source.category === 'target_company' ||
        Boolean(sCompany && targets.includes(sCompany)) ||
        targets.includes(sName);
      userHomeCountry = profile.workPreferences?.targetLocations?.[0] || 'India';
    } else if (options) {
      const opts = options as {
        isTargetCompany?: boolean;
        userHomeCountry?: string;
        targetRoles?: string[];
        recentJobChanges?: boolean;
        userAffinity?: number;
      };
      isTarget =
        Boolean(opts.isTargetCompany) ||
        source.category === 'target_company' ||
        Boolean(sAny.targetCompany);
      userHomeCountry = opts.userHomeCountry || 'India';
      userAffinity = opts.userAffinity;
      optRecentJobChanges = opts.recentJobChanges;
    } else {
      isTarget = source.category === 'target_company' || Boolean(sAny.targetCompany);
    }

    // 1. Yield Score (0 - 100): based on verified extracted jobs or preconfigured score
    let yieldScore = 50;
    if (sAny.yieldScore !== undefined) {
      yieldScore = sAny.yieldScore <= 1 ? sAny.yieldScore * 100 : sAny.yieldScore;
    } else if (health) {
      const extracted = health.totalJobsExtracted || 0;
      yieldScore = Math.min(100, Math.max(10, extracted * 10));
    } else if (source.jobs_verified !== undefined && source.jobs_verified > 0) {
      yieldScore = Math.min(100, 40 + source.jobs_verified * 5);
    } else if (evaluation.tier === 'TIER_1_HIGH_VALUE') {
      yieldScore = 80;
    } else if (evaluation.tier === 'TIER_2_USEFUL') {
      yieldScore = 65;
    } else {
      yieldScore = 30;
    }

    // 2. Freshness Score (0 - 100): how recently new jobs were detected or preconfigured score
    let freshnessScore = 60;
    if (sAny.freshnessScore !== undefined) {
      freshnessScore = sAny.freshnessScore <= 1 ? sAny.freshnessScore * 100 : sAny.freshnessScore;
    } else if (health?.lastSuccessfulCheck) {
      const elapsedHours = (Date.now() - new Date(health.lastSuccessfulCheck).getTime()) / (1000 * 60 * 60);
      if (elapsedHours < 6) freshnessScore = 100;
      else if (elapsedHours < 24) freshnessScore = 85;
      else if (elapsedHours < 72) freshnessScore = 60;
      else freshnessScore = 40;
    } else if (optRecentJobChanges) {
      freshnessScore = 95;
    }

    // 3. Reliability Score (0 - 100): success rate, response time, failure penalties
    let reliabilityScore = 70;
    if (sAny.reliabilityScore !== undefined) {
      reliabilityScore = sAny.reliabilityScore <= 1 ? sAny.reliabilityScore * 100 : sAny.reliabilityScore;
    } else if (health) {
      reliabilityScore = health.healthScore;
      if (health.consecutiveFailures > 0) {
        reliabilityScore = Math.max(0, reliabilityScore - health.consecutiveFailures * 20);
      }
    } else if (source.consecutiveFailures) {
      reliabilityScore = Math.max(0, 70 - source.consecutiveFailures * 25);
    }

    // 4. Profile Relevance (0 - 100): domain, country, ATS match
    let profileRelevance = 50;
    const isIndiaTarget = (userHomeCountry || 'India').toLowerCase().includes('india');
    const domainLower = (source.domain || sAny.url || source.endpointUrl || source.name || '').toLowerCase();

    if (isTarget) {
      profileRelevance = 100;
    } else if (
      isIndiaTarget &&
      (domainLower.endsWith('.in') ||
        domainLower.includes('naukri') ||
        domainLower.includes('instahyre') ||
        domainLower.includes('cutshort') ||
        domainLower.includes('iimjobs') ||
        domainLower.includes('hirist') ||
        domainLower.includes('foundit') ||
        domainLower.includes('shine') ||
        domainLower.includes('timesjobs') ||
        domainLower.includes('internshala') ||
        domainLower.includes('apna'))
    ) {
      profileRelevance = 90;
    } else if (evaluation.tier === 'TIER_1_HIGH_VALUE') {
      profileRelevance = 80;
    } else if (evaluation.tier === 'TIER_2_USEFUL') {
      profileRelevance = 65;
    } else {
      profileRelevance = 30;
    }

    // Mathematical formula
    let totalScore =
      yieldScore * 0.3 +
      freshnessScore * 0.2 +
      reliabilityScore * 0.25 +
      profileRelevance * 0.25;

    // Target Companies are ALWAYS first-class sources: guaranteed +100 bonus
    if (isTarget) {
      totalScore += 100;
    }

    if (userAffinity) {
      totalScore += Math.max(-20, Math.min(25, userAffinity));
    }

    return Math.round(totalScore);
  }

  /**
   * Computes a dynamic sorting score for discovery queue ordering.
   */
  public calculatePriorityScore(
    source: JobSourceRegistryEntry,
    options?: {
      isTargetCompany?: boolean;
      userHomeCountry?: string;
      recentJobChanges?: boolean;
      userAffinity?: number;
    }
  ): number {
    return this.calculateSourceIntelligenceScore(source, options);
  }

  /**
   * Sorts sources strictly favoring Target Companies (slice 0) → Tier 1 → Tier 2,
   * deprioritizing Tier 3, and excluding Tier 4 Dead.
   */
  public prioritizeSources(
    sources: JobSourceRegistryEntry[],
    targetCompanyNamesOrProfile:
      | string[]
      | { targetCompanies?: string[]; workPreferences?: { targetLocations?: string[] } } = [],
    userHomeCountry: string = 'India'
  ): JobSourceRegistryEntry[] {
    let targetCompanyNames: string[] = [];
    if (Array.isArray(targetCompanyNamesOrProfile)) {
      targetCompanyNames = targetCompanyNamesOrProfile;
    } else if (targetCompanyNamesOrProfile && 'targetCompanies' in targetCompanyNamesOrProfile) {
      targetCompanyNames = targetCompanyNamesOrProfile.targetCompanies || [];
      if (targetCompanyNamesOrProfile.workPreferences?.targetLocations?.[0]) {
        userHomeCountry = targetCompanyNamesOrProfile.workPreferences.targetLocations[0];
      }
    }

    const targetSet = new Set(targetCompanyNames.map((t) => t.toLowerCase().trim()));

    // Filter out Tier 4 Dead & quarantined
    const valid = sources.filter((s) => {
      const evalResult = this.evaluateSource(s);
      return (
        evalResult.tier !== 'TIER_4_DEAD' &&
        !evalResult.isQuarantined &&
        (s as any).status !== 'quarantined'
      );
    });

    return valid.sort((a, b) => {
      const sAnyA = a as any;
      const sAnyB = b as any;
      const isTargetA =
        targetSet.has(a.name.toLowerCase().trim()) ||
        a.category === 'target_company' ||
        (sAnyA.targetCompany ? targetSet.has(sAnyA.targetCompany.toLowerCase().trim()) : false);
      const isTargetB =
        targetSet.has(b.name.toLowerCase().trim()) ||
        b.category === 'target_company' ||
        (sAnyB.targetCompany ? targetSet.has(sAnyB.targetCompany.toLowerCase().trim()) : false);

      const scoreA = this.calculateSourceIntelligenceScore(a, {
        isTargetCompany: isTargetA,
        userHomeCountry,
      });
      const scoreB = this.calculateSourceIntelligenceScore(b, {
        isTargetCompany: isTargetB,
        userHomeCountry,
      });

      return scoreB - scoreA;
    });
  }

  /**
   * Manually sets or overrides a source's tier.
   */
  public setTierOverride(sourceId: string, tier: SourceTier): void {
    this.customTierOverrides.set(sourceId, tier);
  }

  public setManualOverride(sourceId: string, tier: SourceTier): void {
    this.setTierOverride(sourceId, tier);
  }

  public getTier(source: JobSourceRegistryEntry): SourceTier {
    return this.evaluateSource(source).tier;
  }

  public evaluateTier(source: JobSourceRegistryEntry): SourceTier {
    return this.getTier(source);
  }

  /**
   * Clears custom overrides.
   */
  public clearTierOverrides(): void {
    this.customTierOverrides.clear();
  }

  /**
   * Returns aggregate counts per tier across the catalog.
   */
  public getTierStats(sources: JobSourceRegistryEntry[]): Record<SourceTier, number> {
    const stats: Record<SourceTier, number> = {
      TIER_1_HIGH_VALUE: 0,
      TIER_2_USEFUL: 0,
      TIER_3_LOW_VALUE: 0,
      TIER_4_DEAD: 0,
    };

    for (const source of sources) {
      const evalResult = this.evaluateSource(source);
      stats[evalResult.tier]++;
    }

    return stats;
  }

  public getCatalogTierStats(sources?: JobSourceRegistryEntry[]) {
    const all = sources && sources.length > 0 ? sources : sourceRegistry.getAllSources();
    const stats = this.getTierStats(all);
    return {
      ...stats,
      tier1: stats.TIER_1_HIGH_VALUE,
      tier2: stats.TIER_2_USEFUL,
      tier3: stats.TIER_3_LOW_VALUE,
      tier4: stats.TIER_4_DEAD,
    };
  }
}

export const sourceValueEngine = new SourceValueEngine();
