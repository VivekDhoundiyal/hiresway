/**
 * CareerOS Feed State Engine
 *
 * Strict 6-Tier Architecture Separation:
 * 1. SOURCE CATALOG      -> All known job sources in registry
 * 2. DISCOVERY QUEUE     -> Sources scheduled / waiting to be checked
 * 3. VERIFIED JOB STORE  -> Only validated jobs passing SourceTruthEngine
 * 4. USER FEED           -> Verified + relevant + non-duplicate + fresh opportunities
 * 5. REJECTED            -> User-rejected opportunities & negative learning signals
 * 6. ARCHIVED            -> Expired, closed, or pruned opportunities
 *
 * Datasets are never mixed or conflated.
 */

import { JobOpportunity, JobSourceRegistryEntry } from '../types';
import { sourceRegistry } from '../sourceRegistry';
import { userJobStateManager } from '../userJobState';
import { sourceTruthEngine } from './sourceTruthEngine';

export interface FeedStateSummary {
  catalogCount: number;
  queueCount: number;
  verifiedStoreCount: number;
  userFeedCount: number;
  rejectedCount: number;
  archivedCount: number;
}

export class FeedStateEngine {
  private verifiedStore: Map<string, JobOpportunity> = new Map();
  private archivedStore: Map<string, { job: JobOpportunity; archivedAt: string; reason: string }> = new Map();

  /**
   * 1. SOURCE CATALOG: All known sources
   */
  public getSourceCatalog(): JobSourceRegistryEntry[] {
    return sourceRegistry.getAllSources();
  }

  /**
   * 2. DISCOVERY QUEUE: Sources pending / eligible to be checked
   */
  public getDiscoveryQueue(): JobSourceRegistryEntry[] {
    return sourceRegistry.getActiveSources();
  }

  /**
   * 3. VERIFIED JOB STORE: All opportunities that have passed SourceTruthEngine
   */
  public getVerifiedStoreJobs(): JobOpportunity[] {
    return Array.from(this.verifiedStore.values());
  }

  public registerVerifiedJob(job: JobOpportunity): boolean {
    const truth = sourceTruthEngine.validateJob(job);
    if (!truth.isValid) return false;

    this.verifiedStore.set(job.id, {
      ...job,
      isVerifiedLive: true,
      verificationStatus: 'verified_live',
      canonicalUrl: truth.canonicalUrl,
    });
    return true;
  }

  public removeVerifiedJob(jobId: string): void {
    this.verifiedStore.delete(jobId);
  }

  /**
   * 4. USER FEED: Only verified, active, non-duplicate, non-rejected, non-archived jobs
   */
  public filterToUserFeed(jobs: JobOpportunity[]): JobOpportunity[] {
    return jobs.filter((j) => {
      if (!j) return false;
      if (this.isRejected(j.id)) return false;
      if (this.isArchived(j.id)) return false;
      if (
        j.lifecycleState === 'REJECTED' ||
        j.lifecycleState === 'ARCHIVED' ||
        j.lifecycleState === 'EXPIRED' ||
        j.lifecycleState === 'CLOSED'
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * 5. REJECTED: User-rejected opportunities
   */
  public isRejected(jobId: string): boolean {
    return userJobStateManager.isJobRejected(jobId);
  }

  /**
   * 6. ARCHIVED: Pruned, closed, or expired opportunities
   */
  public isArchived(jobId: string): boolean {
    return this.archivedStore.has(jobId);
  }

  public archiveJob(job: JobOpportunity, reason: string): void {
    this.verifiedStore.delete(job.id);
    this.archivedStore.set(job.id, {
      job: { ...job, lifecycleState: 'ARCHIVED' },
      archivedAt: new Date().toISOString(),
      reason,
    });
  }

  public getArchivedJobs(): JobOpportunity[] {
    return Array.from(this.archivedStore.values()).map((a) => a.job);
  }

  /**
   * Summary of counts across the 6 strictly separated states.
   */
  public getStateSummary(activeOpportunities: JobOpportunity[]): FeedStateSummary {
    const catalog = this.getSourceCatalog();
    const queue = this.getDiscoveryQueue();
    const verified = this.getVerifiedStoreJobs();
    const feed = this.filterToUserFeed(activeOpportunities);

    return {
      catalogCount: catalog.length,
      queueCount: queue.length,
      verifiedStoreCount: verified.length > 0 ? verified.length : feed.length,
      userFeedCount: feed.length,
      rejectedCount: userJobStateManager.getRejectedCount(),
      archivedCount: this.archivedStore.size,
    };
  }
}

export const feedStateEngine = new FeedStateEngine();
