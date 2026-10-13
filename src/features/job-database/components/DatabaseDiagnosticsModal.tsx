import React, { useState, useMemo } from 'react';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import {
  X,
  Activity,
  Database,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Cpu,
  Layers,
} from 'lucide-react';
import { jobRepository } from '@/core/jobs/jobRepository';

interface DatabaseDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const DatabaseDiagnosticsModal: React.FC<DatabaseDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const jobs = useMemo(() => {
    return jobRepository.getDatabaseOpportunities();
  }, [isOpen, actionMessage]);

  const stats = useMemo(() => {
    const sources: Record<string, number> = {};
    const verification: Record<string, number> = {};
    const crmStatus: Record<string, number> = {};
    const workplace: Record<string, number> = {};
    let totalIntegrity = 0;
    let targetCount = 0;

    for (const j of jobs) {
      const src = j.sourceName || j.source?.name || 'Direct';
      sources[src] = (sources[src] || 0) + 1;

      const ver = j.verificationStatus || 'unverified';
      verification[ver] = (verification[ver] || 0) + 1;

      const crm = j.crm_status || j.lifecycleState || 'Viewed';
      crmStatus[crm] = (crmStatus[crm] || 0) + 1;

      const wp = j.remoteStatus || 'unspecified';
      workplace[wp] = (workplace[wp] || 0) + 1;

      totalIntegrity += j.integrity_score || 80;
      if (j.isTargetCompany) targetCount++;
    }

    const avgIntegrity = jobs.length > 0 ? Math.round(totalIntegrity / jobs.length) : 0;

    return {
      total: jobs.length,
      avgIntegrity,
      targetCount,
      sources,
      verification,
      crmStatus,
      workplace,
    };
  }, [jobs]);

  if (!isOpen) return null;

  const handleRunVerificationSweep = () => {
    setIsActionRunning(true);
    setTimeout(() => {
      const res = jobRepository.verifyAllDatabaseJobs();
      setActionMessage(
        `Verification sweep complete: Checked ${res.total} jobs (${res.verifiedLive} verified live, ${res.broken} broken, ${res.closed} closed).`
      );
      setIsActionRunning(false);
      if (onDataChanged) onDataChanged();
      setTimeout(() => setActionMessage(null), 5000);
    }, 400);
  };

  const handlePruneExpired = () => {
    setIsActionRunning(true);
    setTimeout(() => {
      const pruned = jobRepository.pruneExpiredJobs();
      setActionMessage(`Pruned ${pruned} expired opportunities from canonical repository.`);
      setIsActionRunning(false);
      if (onDataChanged) onDataChanged();
      setTimeout(() => setActionMessage(null), 5000);
    }, 300);
  };

  const handleRebuildIndexes = () => {
    setIsActionRunning(true);
    setTimeout(() => {
      jobRepository.rebuildAllIndexes();
      setActionMessage('All canonical indexes, hash tables, and memoization caches successfully rebuilt.');
      setIsActionRunning(false);
      if (onDataChanged) onDataChanged();
      setTimeout(() => setActionMessage(null), 5000);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-3xl rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary-soft text-primary border border-primary/20">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <Typography as="h3" variant="h3" className="font-bold text-text-primary">
                  Database Engine & Telemetry Diagnostics
                </Typography>
                <p className="text-caption text-text-muted">
                  Truthful in-memory and persistent statistics for CareerOs Job Database 2.0
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {actionMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-body-sm text-emerald-800 dark:text-emerald-200 flex items-center justify-between animate-in fade-in">
              <span>{actionMessage}</span>
              <button
                type="button"
                onClick={() => setActionMessage(null)}
                className="text-caption underline ml-2 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border/70 space-y-1">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
                Total Canonical Jobs
              </span>
              <span className="text-2xl font-bold text-text-primary">
                {stats.total.toLocaleString()}
              </span>
              <span className="text-[10px] text-text-muted block">In-Memory Canonical Records</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border/70 space-y-1">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
                Target Companies
              </span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.targetCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-text-muted block">Priority Target Matched</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border/70 space-y-1">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
                Avg Integrity Score
              </span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.avgIntegrity} / 100
              </span>
              <span className="text-[10px] text-text-muted block">Data Provenance Health</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border/70 space-y-1">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
                Active Sources
              </span>
              <span className="text-2xl font-bold text-primary">
                {Object.keys(stats.sources).length}
              </span>
              <span className="text-[10px] text-text-muted block">Ingested & Merged Channels</span>
            </div>
          </div>

          {/* Breakdown Tabs / Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-caption">
            {/* Sources Breakdown */}
            <div className="p-4 rounded-xl border border-border bg-surface-subtle/30 space-y-2.5">
              <span className="font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Database className="h-3.5 w-3.5 text-primary" />
                Ingestion Sources Distribution
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {Object.entries(stats.sources).map(([src, count]) => (
                  <div key={src} className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-text-primary font-medium truncate max-w-[200px]" title={src}>
                      {src}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {count} ({Math.round((count / Math.max(1, stats.total)) * 100)}%)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Status Breakdown */}
            <div className="p-4 rounded-xl border border-border bg-surface-subtle/30 space-y-2.5">
              <span className="font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Verification Status Breakdown
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {Object.entries(stats.verification).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-text-primary font-medium capitalize">
                      {status.replace(/_/g, ' ')}
                    </span>
                    <Badge
                      variant={
                        status === 'verified_live' || status === 'recently_verified'
                          ? 'success'
                          : status === 'needs_verification'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {count} ({Math.round((count / Math.max(1, stats.total)) * 100)}%)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* CRM Lifecycle Stages */}
            <div className="p-4 rounded-xl border border-border bg-surface-subtle/30 space-y-2.5">
              <span className="font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Layers className="h-3.5 w-3.5 text-blue-600" />
                CRM Lifecycle Pipeline Stages
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {Object.entries(stats.crmStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-text-primary font-medium">{status}</span>
                    <Badge variant="primary" size="sm">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Workplace Types */}
            <div className="p-4 rounded-xl border border-border bg-surface-subtle/30 space-y-2.5">
              <span className="font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Cpu className="h-3.5 w-3.5 text-purple-600" />
                Workplace & Remote Distribution
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {Object.entries(stats.workplace).map(([wp, count]) => (
                  <div key={wp} className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-text-primary font-medium capitalize">{wp}</span>
                    <Badge variant="neutral" size="sm">
                      {count} ({Math.round((count / Math.max(1, stats.total)) * 100)}%)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Maintenance Actions */}
          <div className="p-4 rounded-xl border border-border/80 bg-surface space-y-3">
            <span className="font-bold text-text-primary block uppercase tracking-wider text-[11px]">
              Repository Maintenance & Health Ops
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunVerificationSweep}
                disabled={isActionRunning}
                leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isActionRunning ? 'animate-spin' : ''}`} />}
              >
                Run Verification Sweep
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRebuildIndexes}
                disabled={isActionRunning}
                leftIcon={<Layers className="h-3.5 w-3.5" />}
              >
                Rebuild Indexes & Caches
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePruneExpired}
                disabled={isActionRunning}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Prune Expired Listings
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end pt-2 border-t border-border/60">
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
