import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Globe2, MapPin, Plus, X, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { JobOpportunity } from '@/core/intelligence';
import { remoteEligibilityEngine } from '@/core/jobs/remoteEligibilityEngine';

export interface LocationControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLocations: string[];
  workplaceTypes: ('remote' | 'hybrid' | 'on-site')[];
  homeCountry?: string;
  allOpportunities?: JobOpportunity[];
  onSave: (
    newLocations: string[],
    newWorkplaceTypes: ('remote' | 'hybrid' | 'on-site')[]
  ) => void;
}

export interface PresetMarket {
  id: string;
  name: string;
  description: string;
  badge?: string;
  canonicalKey: string;
}

export const PRESET_MARKETS: PresetMarket[] = [
  {
    id: 'india',
    name: 'India',
    description: 'Bengaluru, Delhi NCR, Mumbai, Pune, Hyderabad, Chennai & all Indian tech hubs',
    badge: 'Home Market',
    canonicalKey: 'india',
  },
  {
    id: 'wfa',
    name: 'Remote Worldwide / Work From Anywhere',
    description: 'Boundary-free global remote roles accepting India and worldwide talent',
    badge: 'Global Remote',
    canonicalKey: 'worldwide',
  },
  {
    id: 'us',
    name: 'United States',
    description: 'US Remote & On-Site / Hybrid Hubs (Requires US work eligibility)',
    canonicalKey: 'united states',
  },
  {
    id: 'europe',
    name: 'Europe / EMEA',
    description: 'Germany, Netherlands, Ireland, France & EMEA regional hubs',
    canonicalKey: 'europe',
  },
  {
    id: 'uk',
    name: 'United Kingdom',
    description: 'London, Manchester & UK-eligible remote/hybrid roles',
    canonicalKey: 'united kingdom',
  },
  {
    id: 'canada',
    name: 'Canada',
    description: 'Toronto, Vancouver & Canada-authorized roles',
    canonicalKey: 'canada',
  },
  {
    id: 'apac',
    name: 'Singapore & APAC',
    description: 'Singapore, Australia, Japan & APAC regional distribution roles',
    canonicalKey: 'apac',
  },
  {
    id: 'middle_east',
    name: 'UAE & Middle East',
    description: 'Dubai, Abu Dhabi, Riyadh & GCC commercial hubs',
    canonicalKey: 'middle east',
  },
];

/**
 * Normalizes location names to avoid contradictory broad duplicates
 * (e.g. "Worldwide", "Global Remote", "Anywhere" collapse to canonical name).
 */
export function normalizeTargetLocations(locations: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const loc of locations) {
    const trimmed = loc.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();

    // Prevent contradictory broad locations: map all worldwide synonyms to canonical preset
    let canonical = trimmed;
    if (
      lower.includes('worldwide') ||
      lower.includes('work from anywhere') ||
      lower.includes('wfa') ||
      lower === 'global' ||
      lower === 'anywhere' ||
      lower === 'remote anywhere'
    ) {
      canonical = 'Remote Worldwide / Work From Anywhere';
    }

    const key = canonical.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(canonical);
    }
  }

  return normalized.length > 0 ? normalized : ['India', 'Remote Worldwide / Work From Anywhere'];
}

export const LocationControlModal: React.FC<LocationControlModalProps> = ({
  isOpen,
  onClose,
  targetLocations,
  workplaceTypes,
  allOpportunities = [],
  onSave,
}) => {
  const [selectedLocations, setSelectedLocations] = useState<string[]>(() =>
    normalizeTargetLocations(targetLocations)
  );
  const [selectedWorkplace, setSelectedWorkplace] = useState<('remote' | 'hybrid' | 'on-site')[]>(
    () => (workplaceTypes && workplaceTypes.length > 0 ? workplaceTypes : ['remote', 'hybrid', 'on-site'])
  );
  const [customInput, setCustomInput] = useState('');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Sync internal state with props every time modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedLocations(normalizeTargetLocations(targetLocations));
      setSelectedWorkplace(
        workplaceTypes && workplaceTypes.length > 0 ? workplaceTypes : ['remote', 'hybrid', 'on-site']
      );
      setCustomInput('');
      setSaveFeedback(null);
    }
  }, [isOpen, targetLocations, workplaceTypes]);

  // Compute live match count based on selected locations & workplace types
  const liveMatchCount = useMemo(() => {
    if (allOpportunities.length === 0) return 0;

    const locs = selectedLocations.map((l) => l.toLowerCase());
    const hasWorldwide = locs.some(
      (l) => l.includes('worldwide') || l.includes('wfa') || l.includes('anywhere')
    );
    const hasIndia = locs.some((l) => l.includes('india'));

    return allOpportunities.filter((job) => {
      // 1. Workplace match
      const jobMode = (job.remoteStatus || 'on-site').toLowerCase();
      const jobEligMode = job.remote_eligibility?.status;
      let matchesWorkplace = false;

      if (selectedWorkplace.includes('remote')) {
        if (
          jobMode === 'remote' ||
          remoteEligibilityEngine.isWorldwideRemote(job) ||
          jobEligMode === 'WORLDWIDE_REMOTE' ||
          jobEligMode === 'REMOTE_FROM_INDIA'
        ) {
          matchesWorkplace = true;
        }
      }
      if (selectedWorkplace.includes('hybrid')) {
        if (jobMode === 'hybrid' || jobEligMode === 'HYBRID') {
          matchesWorkplace = true;
        }
      }
      if (selectedWorkplace.includes('on-site')) {
        if (jobMode === 'on-site' || jobMode === 'onsite' || jobEligMode === 'ONSITE') {
          matchesWorkplace = true;
        }
      }

      if (!matchesWorkplace) return false;

      // 2. Location match
      if (hasWorldwide && (remoteEligibilityEngine.isWorldwideRemote(job) || jobMode === 'remote')) {
        return true;
      }

      const jobLoc = (job.location || '').toLowerCase();
      const jobCountry = (job.country || '').toLowerCase();

      if (hasIndia) {
        if (
          jobCountry === 'india' ||
          jobLoc.includes('india') ||
          jobLoc.includes('bengaluru') ||
          jobLoc.includes('bangalore') ||
          jobLoc.includes('mumbai') ||
          jobLoc.includes('delhi') ||
          jobLoc.includes('hyderabad') ||
          jobLoc.includes('pune') ||
          jobLoc.includes('chennai') ||
          remoteEligibilityEngine.isEligibleForIndiaFeed(job)
        ) {
          return true;
        }
      }

      // Check any other specific location match
      for (const loc of locs) {
        if (loc.includes('worldwide')) continue;
        if (loc.includes('india')) continue;
        const clean = loc.split('/')[0].split('(')[0].trim();
        if (clean && (jobLoc.includes(clean) || jobCountry.includes(clean))) {
          return true;
        }
      }

      return false;
    }).length;
  }, [allOpportunities, selectedLocations, selectedWorkplace]);

  const togglePreset = (market: PresetMarket) => {
    setSelectedLocations((prev) => {
      const exists = prev.some(
        (l) =>
          l.toLowerCase() === market.name.toLowerCase() ||
          (market.canonicalKey === 'worldwide' &&
            (l.toLowerCase().includes('worldwide') || l.toLowerCase().includes('wfa')))
      );

      if (exists) {
        // Enforce at least 1 market remains active
        if (prev.length <= 1) return prev;
        return prev.filter(
          (l) =>
            l.toLowerCase() !== market.name.toLowerCase() &&
            !(
              market.canonicalKey === 'worldwide' &&
              (l.toLowerCase().includes('worldwide') || l.toLowerCase().includes('wfa'))
            )
        );
      } else {
        return normalizeTargetLocations([...prev, market.name]);
      }
    });
  };

  const removeLocation = (loc: string) => {
    setSelectedLocations((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((l) => l !== loc);
    });
  };

  const addCustomLocation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setSelectedLocations((prev) => normalizeTargetLocations([...prev, trimmed]));
    setCustomInput('');
  };

  const toggleWorkplaceType = (type: 'remote' | 'hybrid' | 'on-site') => {
    setSelectedWorkplace((prev) => {
      if (prev.includes(type)) {
        if (prev.length <= 1) return prev;
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleSave = () => {
    const validatedLocations = normalizeTargetLocations(selectedLocations);
    const validatedWorkplace =
      selectedWorkplace.length > 0 ? selectedWorkplace : (['remote', 'hybrid', 'on-site'] as const);

    // Call onSave which persists to profile repository & updates feed
    onSave(validatedLocations, [...validatedWorkplace]);
    setSaveFeedback('Preferences saved successfully!');
    setTimeout(() => {
      onClose();
    }, 250);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Location Markets & Remote Eligibility"
      size="lg"
    >
      <div className="space-y-5">
        {/* Info Banner */}
        <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-xs sm:text-sm text-gray-800 flex items-start gap-2.5">
          <Globe2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-caption leading-relaxed">
            <strong className="text-blue-900 font-semibold block mb-0.5">
              Strict Market Matching & Remote Eligibility Gate
            </strong>
            The discovery engine strictly matches opportunities against your configured markets below.
            Select the regional markets and workplace arrangements you are open to pursuing.
          </div>
        </div>

        {/* Selected Markets Active Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
              Active Target Markets ({selectedLocations.length})
            </label>
            <span className="text-xs text-blue-700 font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>{liveMatchCount.toLocaleString()} jobs match these filters</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-gray-50 border border-gray-200 min-h-[44px]">
            {selectedLocations.map((loc) => (
              <span
                key={loc}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-3xs"
              >
                <span>{loc}</span>
                {selectedLocations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLocation(loc)}
                    className="hover:bg-white/20 rounded p-0.5 cursor-pointer transition-colors"
                    title={`Remove ${loc}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Common Regional Markets Grid */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
            Regional Market Presets
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_MARKETS.map((preset) => {
              const isSelected = selectedLocations.some((l) => {
                if (preset.canonicalKey === 'worldwide') {
                  return (
                    l.toLowerCase().includes('worldwide') ||
                    l.toLowerCase().includes('wfa') ||
                    l.toLowerCase().includes('anywhere')
                  );
                }
                return l.toLowerCase() === preset.name.toLowerCase();
              });

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => togglePreset(preset)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 shadow-3xs ring-1 ring-blue-500/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs sm:text-sm text-gray-900">
                        {preset.name}
                      </span>
                      {preset.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-blue-100 text-blue-700 shrink-0">
                          {preset.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div
                    className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Location Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
            Add Specific Country or Metropolitan Hub
          </label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. Netherlands, Australia, Germany, or Singapore..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomLocation();
                }
              }}
              leftIcon={<MapPin className="h-4 w-4 text-gray-400" />}
              className="flex-1 text-xs sm:text-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => addCustomLocation()}
              disabled={!customInput.trim()}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Market
            </Button>
          </div>
        </div>

        {/* Workplace Arrangements */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
            Allowed Workplace Arrangements
          </label>
          <div className="flex items-center gap-4 flex-wrap">
            {(['remote', 'hybrid', 'on-site'] as const).map((type) => {
              const isChecked = selectedWorkplace.includes(type);
              return (
                <label
                  key={type}
                  className="flex items-center gap-2 text-xs sm:text-sm text-gray-800 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleWorkplaceType(type)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span className="capitalize">{type === 'on-site' ? 'On-Site' : type}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Warning if Worldwide Remote is not selected */}
        {!selectedLocations.some(
          (l) => l.toLowerCase().includes('worldwide') || l.toLowerCase().includes('wfa')
        ) && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Worldwide Remote is deselected. You will only see roles physically in your selected regional hubs.</span>
          </div>
        )}

        {/* Action Buttons & Match Summary */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {saveFeedback ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                {saveFeedback}
              </span>
            ) : (
              <span>
                <strong>{liveMatchCount.toLocaleString()}</strong> verified jobs currently match
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Apply & Save to Profile
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
