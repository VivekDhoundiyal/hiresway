import React, { useState, useMemo } from 'react';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import {
  jobDescriptionNormalizer,
  JobDescriptionSection,
} from '@/core/jobs/jobDescriptionNormalizer';
import { jobVerificationEngine } from '@/core/jobs/jobVerificationEngine';
import {
  Building2,
  Briefcase,
  CheckSquare,
  Award,
  Sparkles,
  Gift,
  DollarSign,
  Globe2,
  Layers,
  Copy,
  Check,
  ExternalLink,
  Code2,
  FileText,
} from 'lucide-react';

export interface CleanJobDescriptionViewProps {
  rawDescription?: string;
  companyName: string;
  sourceUrl?: string;
  applyUrl?: string;
}

const SECTION_ICONS: Record<JobDescriptionSection['key'], React.FC<{ className?: string }>> = {
  about_company: Building2,
  role_overview: Briefcase,
  responsibilities: CheckSquare,
  requirements: Award,
  preferred_qualifications: Sparkles,
  benefits: Gift,
  compensation: DollarSign,
  location_workplace: Globe2,
  general: Layers,
};

export const CleanJobDescriptionView: React.FC<CleanJobDescriptionViewProps> = ({
  rawDescription,
  companyName,
  sourceUrl,
  applyUrl,
}) => {
  const [viewMode, setViewMode] = useState<'clean' | 'original'>('clean');
  const [hasCopied, setHasCopied] = useState(false);

  const normalized = useMemo(() => {
    return jobDescriptionNormalizer.normalize(rawDescription, companyName);
  }, [rawDescription, companyName]);

  const handleCopy = async () => {
    try {
      const textToCopy =
        viewMode === 'original'
          ? normalized.rawOriginal
          : jobDescriptionNormalizer.stripToPlain(normalized.cleanedText);
      await navigator.clipboard.writeText(textToCopy);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy description:', e);
    }
  };

  const officialLink = jobVerificationEngine.sanitizeApplyUrl(applyUrl || sourceUrl);

  return (
    <div className="space-y-3">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <Typography as="h4" variant="caption" className="font-bold text-text-primary uppercase tracking-wider">
            Job Description & Specifications
          </Typography>
          {normalized.wordCount > 0 && (
            <span className="text-[11px] text-text-muted bg-surface-subtle px-2 py-0.5 rounded border border-border/50">
              {normalized.wordCount} words
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Toggle between Clean View and Original View */}
          <div className="inline-flex rounded-lg p-0.5 bg-surface-subtle border border-border text-caption">
            <button
              type="button"
              onClick={() => setViewMode('clean')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'clean'
                  ? 'bg-surface text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Clean View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('original')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'original'
                  ? 'bg-surface text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Code2 className="h-3 w-3" />
              <span>Original Source</span>
            </button>
          </div>

          {/* Copy Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs text-text-muted hover:text-text-primary"
            title="Copy description text"
          >
            {hasCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success mr-1" />
                <span className="text-success">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1" />
                <span>Copy</span>
              </>
            )}
          </Button>

          {/* Open Official Source */}
          {officialLink && officialLink !== '#' && (
            <a
              href={officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline h-7 px-2"
              title="Open official posting"
            >
              <span>Official Source</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Mode 1: Clean Structured View */}
      {viewMode === 'clean' && (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {normalized.sections.map((section, idx) => {
            const Icon = SECTION_ICONS[section.key] || Layers;

            return (
              <div
                key={`${section.key}-${idx}`}
                className="p-3.5 rounded-lg bg-surface border border-border/70 shadow-3xs space-y-2"
              >
                <div className="flex items-center gap-2 text-text-primary font-semibold text-body-sm">
                  <div className="p-1 rounded bg-primary-soft/40 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span>{section.title}</span>
                </div>

                {/* Bullets if structured */}
                {section.items && section.items.length > 0 ? (
                  <ul className="space-y-1.5 pl-1 text-body-sm text-text-secondary">
                    {section.items.map((item, itemIdx) => (
                      <li key={itemIdx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-primary mt-1.5 text-xs select-none">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
                    {section.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mode 2: Original Unaltered Source Text */}
      {viewMode === 'original' && (
        <div className="space-y-2">
          <div className="text-[11px] text-text-muted flex items-center justify-between">
            <span>Unaltered raw content received from employer source:</span>
            <span>{normalized.rawOriginal.length} characters</span>
          </div>
          <pre className="p-3.5 rounded-lg bg-surface-subtle/50 border border-border font-mono text-xs text-text-secondary whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed selection:bg-primary/20">
            {normalized.rawOriginal || 'No raw content provided.'}
          </pre>
        </div>
      )}
    </div>
  );
};
