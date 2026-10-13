/**
 * CareerOS Source Recommendation Engine
 *
 * Recommends Useful Sources to Expand Job Coverage:
 * - Analyzes user profile preferences (geography, roles, skills, target companies).
 * - Analyzes current coverage gaps across active sources.
 * - Filters for healthy, high-yield sources.
 * - Never recommends sources that are already active or marked dead.
 * - Formulates actionable recommendation cards with one-click activation.
 */

import { JobSourceRegistryEntry } from '../types';
import { UserProfile } from '../../profile/types';
import { sourceRegistry } from '../sourceRegistry';
import { profileIntelligenceEngine } from './profileIntelligenceEngine';

export interface RecommendedSourceInsight {
  source: JobSourceRegistryEntry;
  headlineReason: string;
  categoryTag: string;
  expectedYieldScore: number; // 0 - 100
}

export interface SourceCoverageRecommendation {
  coverageTitle: string;
  coverageDescription: string;
  recommendations: RecommendedSourceInsight[];
}

export class SourceRecommendationEngine {
  /**
   * Generates tailored source recommendations based on user profile and coverage gaps.
   */
  public getRecommendations(
    profile: UserProfile,
    allSources?: JobSourceRegistryEntry[]
  ): SourceCoverageRecommendation | null {
    const vector = profileIntelligenceEngine.getPreferenceVector(profile);
    const sources = allSources || sourceRegistry.getAllSources();

    // 1. Filter out sources already active, quarantined, or failing
    const inactiveCandidates = sources.filter((s) => {
      if (s.activeStatus) return false;
      if (s.sourceHealth === 'quarantined' || s.sourceHealth === 'failed') return false;
      if (s.consecutiveFailures && s.consecutiveFailures >= 3) return false;
      return true;
    });

    if (inactiveCandidates.length === 0) return null;

    const insights: RecommendedSourceInsight[] = [];
    const isIndiaTarget =
      vector.homeCountry.includes('india') ||
      vector.targetLocations.some((l) => l.includes('india'));

    // Check for target company sources that are not yet active
    for (const source of inactiveCandidates) {
      const sourceNameLower = source.name.toLowerCase();
      const domainLower = source.domain.toLowerCase();

      for (const targetComp of vector.targetCompanies) {
        if (sourceNameLower.includes(targetComp) || domainLower.includes(targetComp)) {
          insights.push({
            source,
            headlineReason: `Official career pipeline for target company ${source.name}`,
            categoryTag: 'Target Company',
            expectedYieldScore: 95,
          });
          break;
        }
      }
      if (insights.length >= 2) break;
    }

    // Check for regional/remote coverage expansion
    if (isIndiaTarget) {
      const indiaSources = inactiveCandidates.filter(
        (s) =>
          s.country.toLowerCase().includes('india') ||
          s.supportedLocations.some((loc) => loc.toLowerCase().includes('india')) ||
          s.domain.endsWith('.in') ||
          s.domain.includes('naukri') ||
          s.domain.includes('instahyre') ||
          s.domain.includes('cutshort') ||
          s.domain.includes('iimjobs')
      );

      for (const src of indiaSources) {
        if (!insights.some((item) => item.source.id === src.id)) {
          insights.push({
            source: src,
            headlineReason: `High-yield verified Indian tech portal matching ${vector.primaryRole}`,
            categoryTag: 'Regional Expansion',
            expectedYieldScore: 85,
          });
        }
        if (insights.length >= 4) break;
      }
    }

    // Check for worldwide remote tech portals
    if (vector.isOpenToWorldwideRemote) {
      const remoteSources = inactiveCandidates.filter(
        (s) =>
          s.category === 'remote_first' ||
          s.category === 'startup_vc' ||
          s.domain.includes('remoteok') ||
          s.domain.includes('weworkremotely') ||
          s.domain.includes('ycombinator')
      );

      for (const src of remoteSources) {
        if (!insights.some((item) => item.source.id === src.id)) {
          insights.push({
            source: src,
            headlineReason: 'Curated global remote tech listings matching your profile',
            categoryTag: 'Worldwide Remote',
            expectedYieldScore: 80,
          });
        }
        if (insights.length >= 4) break;
      }
    }

    if (insights.length === 0) return null;

    const topInsights = insights.slice(0, 3);
    const scopeLabel = isIndiaTarget ? 'India & Remote' : 'Global Tech';

    return {
      coverageTitle: `${topInsights.length} sources may improve your ${scopeLabel} coverage`,
      coverageDescription: `Connecting these verified pipelines directly surfaces more live requisitions tailored to ${vector.primaryRole}.`,
      recommendations: topInsights,
    };
  }

  /**
   * Activates a recommended source with one click.
   */
  public activateRecommendedSource(sourceId: string): boolean {
    sourceRegistry.toggleSourceActive(sourceId, true);
    return true;
  }
}

export const sourceRecommendationEngine = new SourceRecommendationEngine();
