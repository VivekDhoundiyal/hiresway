import React, { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { sourceRegistry } from '@/core/jobs/sourceRegistry';
import { sourceTruthEngine } from '@/core/jobs/engines/sourceTruthEngine';
import { sourceValueEngine } from '@/core/jobs/engines/sourceValueEngine';
import { JobSourceRegistryEntry, ATSType } from '@/core/jobs/types';
import {
  Link2,
  Building2,
  Globe,
  Rss,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';

export type AddSourceType = 'url' | 'career_page' | 'job_board' | 'rss_feed' | 'import';

export interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSourceAdded?: (source: JobSourceRegistryEntry) => void;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onSourceAdded,
}) => {
  const [selectedType, setSelectedType] = useState<AddSourceType>('url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [atsType, setAtsType] = useState<ATSType>('none');
  const [country, setCountry] = useState('global');
  const [importText, setImportText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setUrl('');
    setDomain('');
    setAtsType('none');
    setCountry('global');
    setImportText('');
    setError(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const parseDomainFromUrl = (rawUrl: string): string => {
    try {
      const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (selectedType === 'import') {
        // Handle bulk import
        if (!importText.trim()) {
          throw new Error('Please paste source URLs or JSON list.');
        }

        let importedSources: JobSourceRegistryEntry[] = [];
        try {
          // Attempt JSON parse
          const parsed = JSON.parse(importText);
          if (Array.isArray(parsed)) {
            importedSources = parsed.map((item, idx) => ({
              id: item.id || `custom-imp-${Date.now()}-${idx}`,
              name: item.name || `Imported Source ${idx + 1}`,
              domain: item.domain || parseDomainFromUrl(item.url || item.endpointUrl || ''),
              endpointUrl: item.url || item.endpointUrl,
              sourceType: item.sourceType || 'job_board',
              category: item.category || 'regional_portal',
              country: item.country || 'global',
              supportedLocations: item.supportedLocations || ['Worldwide'],
              jobCategories: item.jobCategories || ['Engineering', 'Product'],
              atsType: item.atsType || 'none',
              discoveryMethod: 'user_imported',
              sourceHealth: 'healthy',
              updateFrequency: 'daily',
              activeStatus: true,
              eligibilityStatus: 'eligible',
            }));
          }
        } catch {
          // Fallback: line-by-line URLs
          const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean);
          importedSources = lines.map((line, idx) => {
            const dom = parseDomainFromUrl(line);
            return {
              id: `custom-imp-${Date.now()}-${idx}`,
              name: dom ? dom.split('.')[0].toUpperCase() : `Imported Source ${idx + 1}`,
              domain: dom || 'custom.domain',
              endpointUrl: line,
              sourceType: 'job_board',
              category: 'regional_portal',
              country: 'global',
              supportedLocations: ['Worldwide'],
              jobCategories: ['All Roles'],
              atsType: 'none',
              discoveryMethod: 'user_imported',
              sourceHealth: 'healthy',
              updateFrequency: 'daily',
              activeStatus: true,
              eligibilityStatus: 'eligible',
            };
          });
        }

        if (importedSources.length === 0) {
          throw new Error('Could not parse any valid sources from the input.');
        }

        importedSources.forEach((s) => {
          sourceRegistry.registerSource(s);
          onSourceAdded?.(s);
        });

        setSuccessMessage(`Successfully registered ${importedSources.length} custom sources!`);
        setTimeout(() => handleClose(), 1500);
        return;
      }

      // Single source validation
      if (!url.trim()) {
        throw new Error('Please enter a valid URL.');
      }

      const canonical = sourceTruthEngine.getCanonicalUrl(url);
      if (!canonical || canonical === '#') {
        throw new Error('Invalid URL format. Must start with http:// or https://');
      }

      const detectedDomain = domain.trim() || parseDomainFromUrl(canonical);
      if (!detectedDomain) {
        throw new Error('Could not resolve host domain from URL.');
      }

      const sourceName = name.trim() || detectedDomain.split('.')[0].toUpperCase();
      const id = `custom-${detectedDomain.replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

      let sourceType: JobSourceRegistryEntry['sourceType'] = 'job_board';
      let category: JobSourceRegistryEntry['category'] = 'regional_portal';
      let discoveryMethod: JobSourceRegistryEntry['discoveryMethod'] = 'feed';

      if (selectedType === 'career_page') {
        sourceType = 'company_career_portal';
        category = 'company_ats';
        discoveryMethod = atsType !== 'none' ? 'api' : 'crawl';
      } else if (selectedType === 'url') {
        sourceType = 'direct_career_page';
        category = 'company_ats';
        discoveryMethod = 'crawl';
      } else if (selectedType === 'rss_feed') {
        sourceType = 'job_board';
        category = 'curated_remote' as any;
        discoveryMethod = 'feed';
      }

      const newEntry: JobSourceRegistryEntry = {
        id,
        name: sourceName,
        domain: detectedDomain,
        endpointUrl: canonical,
        sourceType,
        category,
        country: country.trim() || 'global',
        supportedLocations: country.toLowerCase().includes('india') ? ['India', 'Remote'] : ['Worldwide', 'Remote'],
        jobCategories: ['Engineering', 'Technology', 'Product', 'Commercial'],
        atsType,
        discoveryMethod,
        sourceHealth: 'healthy',
        updateFrequency: 'daily',
        activeStatus: true,
        eligibilityStatus: 'eligible',
        jobs_found: 0,
        jobs_verified: 0,
        jobs_rejected: 0,
      };

      // Register and evaluate tier
      sourceRegistry.registerSource(newEntry);
      const evalResult = sourceValueEngine.evaluateSource(newEntry);

      onSourceAdded?.(newEntry);
      setSuccessMessage(`Source "${sourceName}" registered successfully as ${evalResult.tierLabel}!`);
      setTimeout(() => handleClose(), 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to add source. Please verify the URL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const OPTIONS: Array<{ type: AddSourceType; label: string; icon: React.ReactNode; desc: string }> = [
    { type: 'url', label: '+ Add URL', icon: <Link2 className="h-4 w-4" />, desc: 'Specific job posting or direct listing link' },
    { type: 'career_page', label: '+ Add Company Career Page', icon: <Building2 className="h-4 w-4" />, desc: 'Official employer careers portal or ATS' },
    { type: 'job_board', label: '+ Add Job Board', icon: <Globe className="h-4 w-4" />, desc: 'Regional, industry, or niche job platform' },
    { type: 'rss_feed', label: '+ Add RSS / Feed', icon: <Rss className="h-4 w-4" />, desc: 'XML, RSS, or structured JSON feed stream' },
    { type: 'import', label: '+ Import Sources', icon: <FileSpreadsheet className="h-4 w-4" />, desc: 'Batch paste URLs or JSON source list' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Discovery Source"
      description="Add authentic job sources into the CareerOS verification and learning pipeline."
      size="xl"
    >
      <div className="space-y-5">
        {/* 5 Explicit Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-gray-100 rounded-xl">
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => {
                setSelectedType(opt.type);
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedType === opt.type
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <div className="mb-1">{opt.icon}</div>
              <span className="text-center truncate w-full">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Selected Option Description */}
        <div className="text-xs text-gray-500 bg-blue-50/50 border border-blue-100 rounded-lg p-2.5">
          {OPTIONS.find((o) => o.type === selectedType)?.desc}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {selectedType === 'import' ? (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Paste URLs (one per line) or JSON array of sources:
              </label>
              <textarea
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`https://jobs.lever.co/company\nhttps://boards.greenhouse.io/company\nhttps://example.com/careers`}
                className="w-full text-xs font-mono p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Source / Company Name (Optional)
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selectedType === 'career_page' ? 'e.g. Swiggy, Linear, Stripe' : 'e.g. Instahyre India, RemoteOK'}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Endpoint / Page URL *
                </label>
                <Input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (!domain) {
                      setDomain(parseDomainFromUrl(e.target.value));
                    }
                  }}
                  placeholder="https://..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Domain (e.g. stripe.com)
                  </label>
                  <Input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Country / Region
                  </label>
                  <Input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="India, United States, or Global"
                  />
                </div>
              </div>

              {selectedType === 'career_page' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ATS / Platform Type
                  </label>
                  <select
                    value={atsType}
                    onChange={(e) => setAtsType(e.target.value as ATSType)}
                    className="w-full text-xs p-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="none">Custom / Direct Web Portal</option>
                    <option value="greenhouse">Greenhouse (boards-api.greenhouse.io)</option>
                    <option value="lever">Lever (api.lever.co)</option>
                    <option value="ashby">Ashby (api.ashbyhq.com)</option>
                    <option value="workable">Workable (apply.workable.com)</option>
                    <option value="smartrecruiters">SmartRecruiters (api.smartrecruiters.com)</option>
                    <option value="workday">Workday</option>
                  </select>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>{isSubmitting ? 'Validating...' : 'Add Source'}</span>
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
