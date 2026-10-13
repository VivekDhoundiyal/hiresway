import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { CompanyLogo } from '@/components/company-logo';
import {
  companyResolutionService,
  targetCompaniesStore,
} from '@/core/target-companies';
import {
  CompanySuggestionItem,
  CompanyDisambiguationChoice,
  TargetCompanyTag,
} from '@/core/jobs/types';
import { Search, ChevronRight, AlertCircle } from 'lucide-react';

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyAdded?: (companyName: string) => void;
}

export const AddCompanyModal: React.FC<AddCompanyModalProps> = ({
  isOpen,
  onClose,
  onCompanyAdded,
}) => {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<TargetCompanyTag>('Priority');
  const [suggestions, setSuggestions] = useState<CompanySuggestionItem[]>([]);
  const [disambiguationChoices, setDisambiguationChoices] = useState<CompanyDisambiguationChoice[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTag('Priority');
      setSuggestions([]);
      setDisambiguationChoices(null);
      setErrorMessage(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Handle typing: query suggestions or check disambiguation
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setErrorMessage(null);

    const clean = val.trim();
    if (clean.length === 0) {
      setSuggestions([]);
      setDisambiguationChoices(null);
      return;
    }

    // Check disambiguation first
    const choices = companyResolutionService.getDisambiguationChoices(clean);
    if (choices && choices.length > 1) {
      setDisambiguationChoices(choices);
      setSuggestions([]);
      return;
    } else {
      setDisambiguationChoices(null);
    }

    const existing = targetCompaniesStore.getCompanies();
    const results = companyResolutionService.getSuggestions(clean, existing);
    setSuggestions(results);
  };

  const handleSelectCompany = async (companyName: string) => {
    if (!companyName.trim()) return;

    if (targetCompaniesStore.isTargetCompany(companyName)) {
      setErrorMessage(`"${companyName}" is already in your Target Companies list.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await targetCompaniesStore.addCompanyByName(companyName, 'manual', tag);
      onCompanyAdded?.(companyName);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add target company.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (disambiguationChoices && disambiguationChoices.length > 0) {
      // Must choose an option
      return;
    }
    if (suggestions.length > 0) {
      handleSelectCompany(suggestions[0].canonicalName);
    } else if (query.trim()) {
      handleSelectCompany(query.trim());
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Target Company"
      description="Enter a company name. CareerOs will find the official company profile and careers page automatically."
      size="md"
    >
      <form onSubmit={handleSubmitCustom} className="space-y-4 pt-1">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Company Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700 block">
            Company Name
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search for a company..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Priority / Watchlist Tag selector */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-xs text-gray-500 font-medium">Monitoring Tier:</span>
          <div className="flex items-center gap-1">
            {(['Dream', 'Priority', 'Watchlist'] as TargetCompanyTag[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  tag === t
                    ? t === 'Dream'
                      ? 'bg-purple-100 text-purple-800 border border-purple-300'
                      : t === 'Priority'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-200 text-gray-800 border border-gray-300'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
                }`}
              >
                {t === 'Dream' ? '★ Dream' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Disambiguation UI: "Which company do you mean?" */}
        {disambiguationChoices && disambiguationChoices.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800">Which company do you mean?</span>
              <span className="text-[11px] text-gray-400">Multiple entities match</span>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {disambiguationChoices.map((choice) => (
                <div
                  key={choice.id}
                  onClick={() => handleSelectCompany(choice.name)}
                  className="p-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CompanyLogo
                      company={choice.name}
                      domain={choice.domain}
                      logoUrl={choice.logoUrl}
                      logoData={choice.logoData}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {choice.name}
                        </span>
                        <span className="text-[11px] text-gray-400">({choice.domain})</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {choice.description || choice.industry}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Intelligent Suggestions Dropdown */}
        {!disambiguationChoices && suggestions.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Suggestions
            </span>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {suggestions.map((item) => {
                const isAlready = targetCompaniesStore.isTargetCompany(item.canonicalName);
                return (
                  <div
                    key={item.canonicalName}
                    onClick={() => !isAlready && handleSelectCompany(item.canonicalName)}
                    className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                      isAlready
                        ? 'bg-gray-50/80 border-gray-200 opacity-60 cursor-not-allowed'
                        : 'border-transparent hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CompanyLogo
                        company={item.canonicalName}
                        domain={item.domain}
                        logoUrl={item.logoUrl}
                        logoData={item.logoData}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {item.canonicalName}
                          </span>
                          {item.domain && (
                            <span className="text-xs text-gray-400 truncate">
                              • {item.domain}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {item.industry}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isAlready ? (
                        <span className="text-[11px] text-gray-500 font-medium px-2 py-0.5 rounded bg-gray-200">
                          Monitored
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCompany(item.canonicalName);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 h-7 px-2.5"
                        >
                          Select
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={!query.trim() || Boolean(disambiguationChoices && disambiguationChoices.length > 0)}
          >
            Add Company
          </Button>
        </div>
      </form>
    </Modal>
  );
};
