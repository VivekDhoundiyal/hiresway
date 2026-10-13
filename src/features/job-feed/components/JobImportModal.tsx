import React, { useState } from 'react';
import { Modal } from '@/components/modal';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { JobOpportunity } from '@/core/jobs';
import { Link2, CheckCircle2 } from 'lucide-react';
import { CompanyLogo } from '@/components/company-logo';

export interface JobImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (params: {
    rawText: string;
    title?: string;
    company?: string;
    url?: string;
    location?: string;
    sourceName?: string;
  }) => JobOpportunity;
}

export const JobImportModal: React.FC<JobImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [rawText, setRawText] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleReset = () => {
    setUrl('');
    setTitle('');
    setCompany('');
    setLocation('');
    setRawText('');
    setSuccessNotice(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim() && !title.trim()) return;

    const imported = onImport({
      rawText: rawText.trim() || `${title} at ${company}. ${location}`,
      title: title.trim() || undefined,
      company: company.trim() || undefined,
      url: url.trim() || undefined,
      location: location.trim() || undefined,
      sourceName: url ? 'Direct Web Import' : 'Manual Paste',
    });

    setSuccessNotice(
      `Successfully ingested "${imported.title}" at ${imported.company}! It is now matched against your profile.`
    );

    setTimeout(() => {
      handleReset();
      onClose();
    }, 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Import Opportunity to CareerOs"
      description="Paste a real job posting URL or job description to ingest and match against your profile"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {successNotice ? (
          <div className="p-4 rounded-xl bg-success-soft border border-success/40 text-body-sm text-success font-medium flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{successNotice}</span>
          </div>
        ) : (
          <>
            <Input
              label="Job Posting URL (Optional)"
              placeholder="e.g. https://boards.greenhouse.io/company/jobs/12345"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              leftIcon={<Link2 className="h-4 w-4" />}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Job Title (Optional if in text)"
                placeholder="e.g. Staff Frontend Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium text-text-secondary">Company Name (Optional)</span>
                  {company.trim() && (
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <CompanyLogo company={company} size="xs" />
                      <span className="truncate max-w-[120px]">{company}</span>
                    </div>
                  )}
                </div>
                <Input
                  placeholder="e.g. Stripe, Linear, Datadog..."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>

            <Input
              label="Location & Remote Policy (Optional)"
              placeholder="e.g. Remote (Worldwide) or San Francisco, CA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="text-caption font-medium text-text-secondary block">
                Job Description / Posting Text *
              </label>
              <textarea
                required
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the raw job description, requirements, and responsibilities here. CareerOs will automatically extract competencies, detect seniority, and evaluate match..."
                className="w-full px-3 py-2 text-body-sm bg-surface rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-text-muted"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                type="submit"
                disabled={!rawText.trim() && !title.trim()}
              >
                Ingest & Match Opportunity
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
