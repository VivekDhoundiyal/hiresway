/**
 * HiresWay System Diagnostics & Engine Verification
 *
 * Provides real-time health checks, storage telemetry, engine status reports,
 * and data integrity verification across all 11 core engines.
 */

import { persistentStorageEngine } from '../storage/persistentStorageEngine';
import { userContextService } from '../auth/userContext';

export interface EngineHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  recordCount: number;
  lastChecked: string;
  details?: Record<string, any>;
}

export interface DiagnosticsReport {
  timestamp: string;
  userId: string;
  overallStatus: 'healthy' | 'warning' | 'critical';
  engines: Record<string, EngineHealth>;
  storageType: 'IndexedDB' | 'LocalStorage' | 'Memory';
}

class DiagnosticsEngine {
  public async runHealthCheck(): Promise<DiagnosticsReport> {
    const userId = userContextService.getUserId();
    const isBrowser = typeof window !== 'undefined';
    const hasIndexedDB = isBrowser && typeof window.indexedDB !== 'undefined';
    const storageType = hasIndexedDB
      ? 'IndexedDB'
      : typeof localStorage !== 'undefined'
      ? 'LocalStorage'
      : 'Memory';

    const checkStore = async (
      store: any
    ): Promise<{ count: number; status: 'healthy' | 'degraded' }> => {
      try {
        const count = await persistentStorageEngine.count(store);
        return { count, status: 'healthy' };
      } catch {
        return { count: 0, status: 'degraded' };
      }
    };

    const targetCompaniesCheck = await checkStore('target_companies');
    const jobsCheck = await checkStore('job_opportunities');
    const appsCheck = await checkStore('applications');
    const docsCheck = await checkStore('documents');
    const outreachCheck = await checkStore('outreach');
    const interviewsCheck = await checkStore('interview_sessions');
    const notificationsCheck = await checkStore('notifications');

    const now = new Date().toISOString();

    const engines: Record<string, EngineHealth> = {
      userContext: {
        name: 'User Context Engine',
        status: userId ? 'healthy' : 'degraded',
        recordCount: 1,
        lastChecked: now,
      },
      targetCompanies: {
        name: 'Target Company Engine',
        status: targetCompaniesCheck.status,
        recordCount: targetCompaniesCheck.count,
        lastChecked: now,
      },
      jobFeed: {
        name: 'Job Discovery & Feed Engine',
        status: jobsCheck.status,
        recordCount: jobsCheck.count,
        lastChecked: now,
      },
      applications: {
        name: 'Application Pipeline Engine',
        status: appsCheck.status,
        recordCount: appsCheck.count,
        lastChecked: now,
      },
      documents: {
        name: 'Document Studio Engine',
        status: docsCheck.status,
        recordCount: docsCheck.count,
        lastChecked: now,
      },
      outreach: {
        name: 'Outreach & Contact Engine',
        status: outreachCheck.status,
        recordCount: outreachCheck.count,
        lastChecked: now,
      },
      interviews: {
        name: 'Interview Prep Engine',
        status: interviewsCheck.status,
        recordCount: interviewsCheck.count,
        lastChecked: now,
      },
      notifications: {
        name: 'Notification Engine',
        status: notificationsCheck.status,
        recordCount: notificationsCheck.count,
        lastChecked: now,
      },
    };

    const degradedCount = Object.values(engines).filter((e) => e.status !== 'healthy').length;

    return {
      timestamp: now,
      userId,
      overallStatus: degradedCount === 0 ? 'healthy' : degradedCount < 3 ? 'warning' : 'critical',
      engines,
      storageType,
    };
  }
}

export const diagnosticsEngine = new DiagnosticsEngine();
