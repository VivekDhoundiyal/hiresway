import React from 'react';
import { TargetCompany, TargetCompanyTag } from '@/core/jobs/types';
import { CompanyLogo } from '@/components/company-logo';
import { Button } from '@/components/button';
import {
  ExternalLink,
  Briefcase,
  Play,
  Pause,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Settings2,
} from 'lucide-react';

interface TargetCompanyCardProps {
  company: TargetCompany;
  onEdit: (company: TargetCompany) => void;
  onDelete: (id: string, name: string) => void;
  onToggleMonitoring: (id: string) => void;
  onRetryDiscovery: (id: string) => void;
  onViewInFeed: (name: string) => void;
  onViewSourceDetails?: (company: TargetCompany) => void;
  onEditManualSource?: (company: TargetCompany) => void;
}

export const TargetCompanyCard: React.FC<TargetCompanyCardProps> = React.memo<TargetCompanyCardProps>(({
  company,
  onEdit,
  onDelete,
  onToggleMonitoring,
  onRetryDiscovery,
  onViewInFeed,
  onViewSourceDetails,
  onEditManualSource,
}) => {
  // Format last checked relative time
  const formatTimeAgo = (isoDate?: string): string => {
    if (!isoDate) return 'Just now';
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getTagBadge = (tag: TargetCompanyTag) => {
    switch (tag) {
      case 'Dream':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            ★ Dream Company
          </span>
        );
      case 'Priority':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Priority Target
          </span>
        );
      case 'Watchlist':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            Watchlist
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active Pipeline
          </span>
        );
    }
  };

  const getDiscoveryStatus = (): {
    label: 'Active' | 'Discovering' | 'Paused' | 'Failed' | 'No careers page found' | 'Needs configuration';
    badgeClass: string;
    dotClass: string;
    icon?: React.ReactNode;
  } => {
    const raw = String(company.discovery_status || '').toLowerCase();
    if (!company.discovery_enabled || company.monitoringStatus === 'paused' || raw === 'paused') {
      return {
        label: 'Paused',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
        dotClass: 'bg-gray-400',
      };
    }

    const isDiscovering =
      raw === 'discovering' ||
      (company.discoveryStatus &&
        company.discoveryStatus !== 'idle' &&
        company.discoveryStatus !== 'complete' &&
        company.discoveryStatus !== 'failed');

    if (isDiscovering) {
      return {
        label: 'Discovering',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        dotClass: 'bg-blue-500',
        icon: <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />,
      };
    }

    if (raw === 'failed' || company.verificationStatus === 'failed') {
      return {
        label: 'Failed',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        dotClass: 'bg-red-500',
      };
    }

    if (raw.includes('no career') || (!company.career_page_url && !company.careersUrl)) {
      return {
        label: 'No careers page found',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500',
      };
    }

    if (raw.includes('needs config') || company.careersPlatform === 'unverified') {
      return {
        label: 'Needs configuration',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        dotClass: 'bg-purple-500',
      };
    }

    return {
      label: 'Active',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  };

  const getMonitoringBadge = () => {
    const status = getDiscoveryStatus();
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${status.badgeClass}`}>
        {status.icon || <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />}
        {status.label}
      </span>
    );
  };

  const isVerified = company.verificationStatus === 'verified';
  const atsName = company.careersPlatform && company.careersPlatform !== 'unverified'
    ? (company.careersPlatform === 'custom' ? 'Direct Portal' : company.careersPlatform.toUpperCase())
    : '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-blue-300 hover:shadow-[0_4px_16px_rgba(37,99,235,0.04)] transition-all flex flex-col justify-between h-full group">
      <div className="space-y-4">
        {/* Top Header Row: Logo, Name, Domain, Tag, Controls */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            {/* Real Logo Container: Neutral/White background, contain */}
            <div className="h-11 w-11 rounded-lg bg-white border border-gray-200/90 shadow-3xs flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
              <CompanyLogo
                company={company.name || company.display_name || 'Company'}
                domain={company.officialDomain || company.domain}
                logoUrl={company.logoUrl || company.logo_url}
                logoData={company.logo}
                size="md"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h3 className="font-bold text-gray-900 text-base leading-tight truncate">
                  {company.name || company.display_name || 'Company'}
                </h3>
                {getTagBadge(company.tag || company.target_status || 'Priority')}
              </div>

              <p className="text-xs text-gray-500 flex items-center gap-1.5 truncate">
                <span>{company.officialDomain || company.domain || 'domain.com'}</span>
                <span>•</span>
                <span>{company.industry || 'Technology & Internet'}</span>
                {(company.headquarters || company.location) && (
                  <>
                    <span>•</span>
                    <span className="truncate">{company.headquarters || company.location}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Card Controls: Source Details, Edit & Delete */}
          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            {onViewSourceDetails && (
              <button
                type="button"
                onClick={() => onViewSourceDetails(company)}
                className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="View verification evidence & audit log"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(company)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Edit notes & tags"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(company.id || company.company_id, company.name || company.display_name || 'Company')}
              className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Remove company"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Monitoring State & Openings Count Strip */}
        <div className="p-3 rounded-lg bg-gray-50/70 border border-gray-150 flex items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Monitoring
            </span>
            {getMonitoringBadge()}
          </div>

          <div className="text-right space-y-0.5 shrink-0">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Opportunities
            </span>
            <span className="text-xs font-semibold text-gray-900">
              {isVerified ? (
                (company.matchingOpeningsCount || 0) > 0 ? (
                  <span className="text-blue-700 font-bold">
                    {company.matchingOpeningsCount} matching openings
                  </span>
                ) : (company.totalOpeningsCount || 0) > 0 ? (
                  <span>{company.totalOpeningsCount} openings in feed</span>
                ) : (
                  <span className="text-gray-500">0 in feed</span>
                )
              ) : (
                <span className="text-amber-700 font-medium">Source not verified</span>
              )}
            </span>
          </div>
        </div>

        {/* Careers & Source Provenance Row */}
        <div className="space-y-2 pt-0.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium text-gray-500 shrink-0">Career Source:</span>
              <span className="text-gray-900 font-medium truncate">
                {company.name} Careers {atsName ? `(${atsName})` : ''}
              </span>
              {isVerified ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                  Unverified
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(company.careersUrl || company.career_page_url) ? (
                <a
                  href={company.careersUrl || company.career_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  <span>Open</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => onRetryDiscovery(company.id)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              )}
            </div>
          </div>

          {/* Real Discovery Telemetry Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-gray-50/90 border border-gray-150 text-[11px]">
            <div>
              <span className="text-gray-400 block font-medium">Discovered</span>
              <span className="font-bold text-gray-800">
                {company.jobs_discovered ?? company.totalOpeningsCount ?? 0} jobs
              </span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">Live Jobs</span>
              <span className="font-bold text-blue-700">
                {company.live_jobs ?? company.matchingOpeningsCount ?? 0} active
              </span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">Failed</span>
              <span className={`font-bold ${(company.failed_attempts || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {company.failed_attempts || 0} attempts
              </span>
            </div>
          </div>

          {/* Last Checked, Evidence link & Provenance Info */}
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
            <span>Checked {formatTimeAgo(company.last_checked_at || company.lastCheckedAt)}</span>
            {company.last_successful_discovery_at ? (
              <span className="text-emerald-700 font-medium">
                Synced {formatTimeAgo(company.last_successful_discovery_at)}
              </span>
            ) : onViewSourceDetails ? (
              <button
                type="button"
                onClick={() => onViewSourceDetails(company)}
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <span>Evidence</span>
              </button>
            ) : null}
          </div>

          {company.notes && (
            <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded border border-gray-100">
              "{company.notes}"
            </p>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onToggleMonitoring(company.id || company.company_id)}
            leftIcon={
              company.monitoringStatus === 'active' ? (
                <Pause className="h-3 w-3 text-gray-500" />
              ) : (
                <Play className="h-3 w-3 text-blue-600" />
              )
            }
            className="text-xs h-7 px-2.5"
          >
            {company.monitoringStatus === 'active' ? 'Pause' : 'Resume'}
          </Button>

          {onEditManualSource && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditManualSource(company)}
              leftIcon={<Settings2 className="h-3 w-3 text-gray-500" />}
              className="text-xs h-7 px-2"
              title="Manual career source configuration"
            >
              Configure
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onViewInFeed(company.name || company.display_name || '')}
          leftIcon={<Briefcase className="h-3.5 w-3.5" />}
          className="text-xs h-7 px-3 font-semibold"
        >
          View in Feed
        </Button>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.company.id === next.company.id &&
    prev.company.company_id === next.company.company_id &&
    prev.company.verificationStatus === next.company.verificationStatus &&
    prev.company.monitoringStatus === next.company.monitoringStatus &&
    prev.company.discoveryStatus === next.company.discoveryStatus &&
    prev.company.discovery_status === next.company.discovery_status &&
    prev.company.totalOpeningsCount === next.company.totalOpeningsCount &&
    prev.company.matchingOpeningsCount === next.company.matchingOpeningsCount &&
    prev.company.jobs_discovered === next.company.jobs_discovered &&
    prev.company.live_jobs === next.company.live_jobs &&
    prev.company.failed_attempts === next.company.failed_attempts &&
    prev.company.tag === next.company.tag &&
    prev.company.target_status === next.company.target_status &&
    prev.company.notes === next.company.notes &&
    prev.company.lastCheckedAt === next.company.lastCheckedAt &&
    prev.company.last_checked_at === next.company.last_checked_at &&
    prev.company.last_successful_discovery_at === next.company.last_successful_discovery_at
  );
});
