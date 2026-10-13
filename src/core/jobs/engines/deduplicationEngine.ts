/**
 * CareerOS Deduplication Engine
 *
 * Multi-Tier Duplicate Resolution & Authoritative Source Consolidation.
 * Duplicate detection combines:
 * - Canonical URL (tracking stripped)
 * - Company + normalized title
 * - Location & Employment Type
 * - Requisition / External ID
 * - Description token Jaccard similarity (> 0.80)
 *
 * Source Authority Hierarchy:
 * Level 1: Official ATS / Employer Portal
 * Level 2: Direct Career Page / Startup Directory
 * Level 3: Curated Remote Boards
 * Level 4: Aggregators / Mirror Feeds
 * Level 5: User Manual Import
 */

import { JobOpportunity } from '../types';
import { jobIdentityEngine } from './jobIdentityEngine';

export class DeduplicationEngine {
  /**
   * Computes token Jaccard similarity between two token sets.
   */
  public calculateJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let intersection = 0;
    for (const t of setA) {
      if (setB.has(t)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Gets source authority rank (lower number = higher authority).
   */
  public getSourceAuthorityLevel(job: JobOpportunity): number {
    const type = job.source?.type;
    const conf = job.source?.sourceConfidence;

    if (type === 'ats_hosted' || conf === 'verified_ats' || conf === 'direct_employer') return 1;
    if (type === 'direct_career_page' || type === 'company_career_portal') return 1;
    if (type === 'yc_startup') return 2;
    if (type === 'remote_community' || type === 'job_board' || conf === 'curated_board') return 3;
    if (type === 'aggregator' || (type as string) === 'aggregated_feed') return 4;
    return 5;
  }

  /**
   * Checks whether incoming job is a duplicate of an existing job.
   */
  public isDuplicate(
    incoming: JobOpportunity,
    existing: JobOpportunity
  ): { isDuplicate: boolean; matchLevel?: string; similarityScore?: number } {
    if (incoming.id === existing.id) {
      return { isDuplicate: true, matchLevel: 'ID_MATCH' };
    }

    const inIdent = jobIdentityEngine.computeCanonicalIdentity(incoming);
    const exIdent = jobIdentityEngine.computeCanonicalIdentity(existing);

    // 1. Canonical URL match
    if (inIdent.canonicalUrl && exIdent.canonicalUrl && inIdent.canonicalUrl === exIdent.canonicalUrl) {
      return { isDuplicate: true, matchLevel: 'CANONICAL_URL' };
    }

    // 2. Requisition ID match
    if (inIdent.requisitionKey && exIdent.requisitionKey && inIdent.requisitionKey === exIdent.requisitionKey) {
      return { isDuplicate: true, matchLevel: 'REQUISITION_ID' };
    }

    // 3. Normalized Company + Normalized Title Match
    if (inIdent.companyTitleKey && exIdent.companyTitleKey && inIdent.companyTitleKey === exIdent.companyTitleKey) {
      // Check location compatibility
      const locMatch =
        inIdent.companyTitleLocKey === exIdent.companyTitleLocKey ||
        incoming.location.toLowerCase().includes('remote') ||
        existing.location.toLowerCase().includes('remote') ||
        !incoming.location ||
        !existing.location;

      if (locMatch) {
        return { isDuplicate: true, matchLevel: 'COMPANY_TITLE_LOCATION' };
      }
    }

    // 4. Description Content Similarity (When company matches)
    const normCompIn = jobIdentityEngine.cleanCompanyName(incoming.company);
    const normCompEx = jobIdentityEngine.cleanCompanyName(existing.company);
    if (normCompIn && normCompIn === normCompEx) {
      const sim = this.calculateJaccardSimilarity(inIdent.descriptionTokens, exIdent.descriptionTokens);
      if (sim >= 0.8) {
        return { isDuplicate: true, matchLevel: 'DESCRIPTION_SIMILARITY', similarityScore: sim };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Merges two matching job opportunities into a single unified opportunity.
   * The stronger authority source keeps the primary listing and URL.
   */
  public mergeOpportunities(
    existing: JobOpportunity,
    incoming: JobOpportunity
  ): JobOpportunity {
    const existingLevel = this.getSourceAuthorityLevel(existing);
    const incomingLevel = this.getSourceAuthorityLevel(incoming);

    const isIncomingHigher = incomingLevel < existingLevel;
    const primary = isIncomingHigher ? incoming : existing;
    const secondary = isIncomingHigher ? existing : incoming;

    // Preserve secondary sources
    const secondarySources = [...(primary.secondary_sources || existing.secondary_sources || [])];
    const secName = secondary.source?.name || secondary.company;
    const secUrl = secondary.source?.sourceUrl || secondary.jobUrl;

    if (!secondarySources.some((s) => s.name === secName || s.url === secUrl)) {
      secondarySources.push({
        name: secName,
        url: secUrl,
        discoveredAt: secondary.dateDiscovered || secondary.first_seen_at || new Date().toISOString(),
        sourceType: secondary.source?.type,
        salaryRaw: secondary.salary?.rawText,
      });
    }

    // Combine skills uniquely
    const combinedRequiredSkills = Array.from(
      new Set([...(primary.requiredSkills || []), ...(secondary.requiredSkills || [])])
    );
    const combinedPreferredSkills = Array.from(
      new Set([...(primary.preferredSkills || []), ...(secondary.preferredSkills || [])])
    );

    // Timestamps: earliest first_seen_at, latest last_verified_at
    const firstSeenAt =
      new Date(primary.first_seen_at || primary.dateDiscovered).getTime() <=
      new Date(secondary.first_seen_at || secondary.dateDiscovered).getTime()
        ? primary.first_seen_at || primary.dateDiscovered
        : secondary.first_seen_at || secondary.dateDiscovered;

    const lastVerified =
      new Date(primary.lastVerified || 0).getTime() >= new Date(secondary.lastVerified || 0).getTime()
        ? primary.lastVerified
        : secondary.lastVerified;

    // Official salary wins if disclosed; fallback to third-party if official undisclosed
    const salary =
      primary.salary?.disclosed
        ? primary.salary
        : secondary.salary?.disclosed
        ? secondary.salary
        : primary.salary;

    return {
      ...primary,
      requiredSkills: combinedRequiredSkills,
      preferredSkills: combinedPreferredSkills,
      secondary_sources: secondarySources,
      salary,
      first_seen_at: firstSeenAt,
      lastVerified,
      // Maintain user state from existing record if set
      lifecycleState: existing.lifecycleState || primary.lifecycleState,
      notes: existing.notes || primary.notes,
      viewedAt: existing.viewedAt || primary.viewedAt,
      viewed_at: existing.viewed_at || primary.viewed_at,
    };
  }
}

export const deduplicationEngine = new DeduplicationEngine();
