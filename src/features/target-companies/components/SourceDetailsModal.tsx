import React from 'react';
import { TargetCompany } from '@/core/jobs/types';
import { CompanyLogo } from '@/components/company-logo';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Clock,
  ShieldCheck,
  Server,
  AlertCircle,
} from 'lucide-react';

interface SourceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: TargetCompany | null;
  onRetryDiscovery: (id: string) => void;
  onOpenManualEdit?: (company: TargetCompany) => void;
}

export const SourceDetailsModal: React.FC<SourceDetailsModalProps> = ({
  isOpen,
  onClose,
  company,
  onRetryDiscovery,
  onOpenManualEdit,
}) => {
  if (!company) return null;

  const confidence = company.verificationConfidence || (company.verificationStatus === 'verified' ? 95 : 50);
  const evidence = company.verificationEvidence || [];
  const discoveryLog = company.discoveryLog || [];

  const getStatusPill = () => {
    switch (company.verificationStatus) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Verified Career Source
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Needs Review
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
            Source Unavailable
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Needs Verification
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Career Source & Verification Evidence"
      size="2xl"
    >
      <div className="space-y-6 pt-1">
        {/* Company Header */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-200">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-12 w-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center p-2 shrink-0">
              <CompanyLogo
                company={company.name}
                domain={company.officialDomain || company.domain}
                logoUrl={company.logoUrl}
                logoData={company.logo}
                size="md"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">
                  {company.name}
                </h3>
                {getStatusPill()}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                <span>{company.officialDomain}</span>
                <span>•</span>
                <span>{company.industry}</span>
                {company.headquarters && (
                  <>
                    <span>•</span>
                    <span>{company.headquarters}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Verification Confidence & ATS Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-500 uppercase tracking-wider text-[11px]">
                Confidence Score
              </span>
              <span className="font-bold text-gray-900 text-sm">
                {confidence} / 100
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  confidence >= 90
                    ? 'bg-emerald-500'
                    : confidence >= 75
                    ? 'bg-blue-500'
                    : confidence >= 60
                    ? 'bg-amber-500'
                    : 'bg-red-400'
                }`}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              {confidence >= 90
                ? 'High confidence: Official employer identity & endpoint confirmed.'
                : confidence >= 75
                ? 'Strong confidence: Domain and career portal matched.'
                : 'Verification pending: Candidate endpoint requires review.'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-1.5">
            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[11px] block">
              Recruiting Platform / ATS
            </span>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-gray-900 text-sm capitalize">
                {company.careersPlatform === 'custom'
                  ? 'Official Corporate Portal'
                  : company.careersPlatform}
              </span>
            </div>
            <div className="text-[11px] text-gray-500 truncate">
              {company.careersUrl ? (
                <a
                  href={company.careersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <span className="truncate">{company.careersUrl}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                'No endpoint configured yet'
              )}
            </div>
          </div>
        </div>

        {/* Verification Evidence Checklist */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-gray-900">Verification Evidence</h4>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            {evidence.length > 0 ? (
              evidence.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 italic">
                No formal evidence generated yet. Click "Run Discovery Again" to gather multi-signal verification evidence.
              </p>
            )}
          </div>
        </div>

        {/* Discovery & Audit Log */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <h4 className="text-sm font-bold text-gray-900">Discovery Timeline Log</h4>
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 max-h-48 overflow-y-auto space-y-2.5 font-mono text-xs">
            {discoveryLog.length > 0 ? (
              discoveryLog.map((log, idx) => (
                <div key={idx} className="flex items-start gap-3 text-gray-700">
                  <span className="text-gray-400 shrink-0 text-[11px]">{log.timestamp}</span>
                  <span className="text-blue-600 font-semibold shrink-0">[{log.stage}]</span>
                  <span className="text-gray-800">{log.message}</span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 italic font-sans text-xs">
                Discovery log will populate upon next verification pass.
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
          {onOpenManualEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onOpenManualEdit(company);
              }}
              className="text-xs"
            >
              Manual Override
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Close
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => {
                onRetryDiscovery(company.id);
                onClose();
              }}
              className="text-xs font-semibold"
            >
              Run Discovery Again
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
