import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ProfileCompletenessDetails, useProfile } from '@/core/profile';
import { getIntelligenceTier } from '@/core/intelligence';
import { Tooltip } from '@/components/tooltip';
import { Badge } from '@/components/badge';
import {
  User,
  FileText,
  Target,
  Wrench,
  Briefcase,
  GraduationCap,
  Award,
  Sliders,
  DollarSign,
  Compass,
  Check,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  X,
} from 'lucide-react';

export interface ProfileSectionNavProps {
  completionScore: number;
  completenessDetails?: ProfileCompletenessDetails;
}

const profileSections = [
  { id: 'personal-info', label: 'Personal Info', shortLabel: 'Info', icon: User },
  { id: 'summary', label: 'Summary', shortLabel: 'Summary', icon: FileText },
  { id: 'roles', label: 'Target Roles', shortLabel: 'Roles', icon: Target },
  { id: 'skills', label: 'Skills & Tools', shortLabel: 'Skills', icon: Wrench },
  {
    id: 'experience',
    label: 'Work Experience',
    shortLabel: 'Experience',
    icon: Briefcase,
  },
  { id: 'education', label: 'Education', shortLabel: 'Education', icon: GraduationCap },
  { id: 'certifications', label: 'Certifications', shortLabel: 'Certs', icon: Award },
  { id: 'preferences', label: 'Preferences', shortLabel: 'Prefs', icon: Sliders },
  { id: 'compensation', label: 'Compensation', shortLabel: 'Comp', icon: DollarSign },
  { id: 'goals', label: 'Availability & Goals', shortLabel: 'Goals', icon: Compass },
];

export const ProfileSectionNav: React.FC<ProfileSectionNavProps> = ({
  completionScore,
  completenessDetails,
}) => {
  const { profile } = useProfile();
  const [activeSection, setActiveSection] = useState('personal-info');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navContainerRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isManualScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  const tierInfo = getIntelligenceTier(profile);

  // Close mobile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Scroll spy relative to main-content
  const updateActiveSection = useCallback(() => {
    // Skip updating active section while programmatic smooth scroll is running
    if (isManualScrollingRef.current) return;

    const container = document.getElementById('main-content');
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 60;

    // If near bottom of page, activate the last section
    if (isNearBottom) {
      setActiveSection(profileSections[profileSections.length - 1].id);
      return;
    }

    for (let i = profileSections.length - 1; i >= 0; i--) {
      const el = document.getElementById(profileSections[i].id);
      if (el) {
        const elTop = el.getBoundingClientRect().top;
        if (elTop - containerTop <= 140) {
          setActiveSection(profileSections[i].id);
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    const container = document.getElementById('main-content');
    if (!container) {
      window.addEventListener('scroll', updateActiveSection, { passive: true });
      return () => window.removeEventListener('scroll', updateActiveSection);
    }

    container.addEventListener('scroll', updateActiveSection, { passive: true });
    updateActiveSection();

    return () => container.removeEventListener('scroll', updateActiveSection);
  }, [updateActiveSection]);

  // Smoothly center the active tab pill inside the horizontal nav without affecting page scroll
  useEffect(() => {
    const navEl = navContainerRef.current;
    const activeTabEl = tabRefs.current[activeSection];
    if (navEl && activeTabEl) {
      const tabLeft = activeTabEl.offsetLeft;
      const tabWidth = activeTabEl.offsetWidth;
      const navWidth = navEl.offsetWidth;
      const targetScrollLeft = tabLeft - navWidth / 2 + tabWidth / 2;
      navEl.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth',
      });
    }
  }, [activeSection]);

  const scrollToSection = (id: string) => {
    setIsDropdownOpen(false);
    setActiveSection(id);

    // Lock scroll spy while smooth scrolling
    isManualScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      isManualScrollingRef.current = false;
    }, 850);

    const el = document.getElementById(id);
    const container = document.getElementById('main-content');

    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      // 76px offset ensures sticky nav doesn't obscure card title or actions
      const targetScrollTop = container.scrollTop + (elRect.top - containerRect.top) - 76;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    } else if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-accent';
    if (score >= 50) return 'text-primary';
    return 'text-amber-600';
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-accent';
    if (score >= 50) return 'bg-primary';
    return 'bg-amber-500';
  };

  const topRecommendation = completenessDetails?.recommendations?.[0];
  const activeSectionObj =
    profileSections.find((s) => s.id === activeSection) || profileSections[0];
  const ActiveIcon = activeSectionObj.icon;

  return (
    <>
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-md border-y sm:border sm:rounded-xl border-border shadow-xs -mx-4 sm:mx-0 px-3 sm:px-4 py-2 transition-all">
        <div className="flex items-center justify-between gap-3">
          {/* Mobile Dropdown Trigger */}
          <div className="relative sm:hidden" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-body-sm font-semibold text-text-primary shadow-xs cursor-pointer select-none"
              aria-expanded={isDropdownOpen}
              aria-label="Select profile section"
            >
              <ActiveIcon className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate max-w-[130px]">{activeSectionObj.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Mobile Popover Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-surface rounded-xl border border-border shadow-lg py-1 z-30 divide-y divide-border/60">
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Jump to Section
                </div>
                <div className="py-1 max-h-72 overflow-y-auto">
                  {profileSections.map((sec) => {
                    const Icon = sec.icon;
                    const isDone = completenessDetails?.sections?.[sec.id]?.isComplete;
                    const isCurrent = activeSection === sec.id;

                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => scrollToSection(sec.id)}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 text-body-sm text-left transition-colors cursor-pointer
                          ${
                            isCurrent
                              ? 'bg-primary-soft text-primary font-semibold'
                              : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{sec.label}</span>
                        </div>
                        {isDone && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Desktop & Tablet Horizontal Tab Rail */}
          <nav
            ref={navContainerRef}
            className="flex-1 overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1 sm:gap-1.5 min-w-0 py-0.5 select-none"
            aria-label="Profile Sections"
          >
            {profileSections.map((sec) => {
              const Icon = sec.icon;
              const isDone = completenessDetails?.sections?.[sec.id]?.isComplete;
              const isActive = activeSection === sec.id;

              return (
                <button
                  key={sec.id}
                  ref={(el) => (tabRefs.current[sec.id] = el)}
                  type="button"
                  onClick={() => scrollToSection(sec.id)}
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-caption sm:text-body-sm font-medium whitespace-nowrap transition-all cursor-pointer shrink-0
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    ${
                      isActive
                        ? 'bg-primary text-white shadow-xs font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle bg-transparent'
                    }
                  `}
                  title={sec.label}
                >
                  <Icon
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${isActive ? 'text-white' : 'text-text-muted'}`}
                  />
                  <span>{sec.label}</span>
                  {isDone && (
                    <Check
                      className={`h-3 w-3 shrink-0 ${isActive ? 'text-white' : 'text-accent'}`}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Actionable Career Intelligence Tier & Strength Indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-subtle border border-border/80 shrink-0 select-none">
            <button
              type="button"
              onClick={() => setIsTierModalOpen(true)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
              title="Click to view unlocked Career Intelligence capabilities"
            >
              <span className="text-caption font-semibold text-text-secondary hidden lg:inline">
                {tierInfo.tierName.split(':')[0]}:
              </span>
              <span
                className={`text-caption font-bold ${getScoreColor(completionScore)}`}
              >
                {completionScore}%
              </span>

              <div className="w-12 sm:w-16 h-1.5 rounded-full bg-border overflow-hidden shrink-0">
                <div
                  className={`h-full transition-all duration-normal ease-out ${getBarColor(completionScore)}`}
                  style={{ width: `${completionScore}%` }}
                />
              </div>
            </button>

            {topRecommendation && (
              <Tooltip content={`Next step: ${topRecommendation}`}>
                <button
                  type="button"
                  onClick={() => setIsTierModalOpen(true)}
                  className="text-primary hover:text-primary-hover transition-colors cursor-pointer p-0.5"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                </button>
              </Tooltip>
            )}

            {completenessDetails?.contradictions &&
              completenessDetails.contradictions.length > 0 && (
                <Tooltip content={completenessDetails.contradictions[0]}>
                  <div className="text-amber-600 transition-colors cursor-help p-0.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  </div>
                </Tooltip>
              )}
          </div>
        </div>
      </div>

      {/* Intelligence Tier & Meaningful Strength Modal */}
      {isTierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="relative w-full max-w-lg bg-surface rounded-xl border border-border shadow-xl p-6 space-y-5 my-auto">
            <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={completionScore >= 70 ? 'accent' : 'primary'} size="sm">
                    {tierInfo.tierName}
                  </Badge>
                  <span className="text-body-sm font-bold text-text-primary">
                    {completionScore}% Intelligence Level
                  </span>
                </div>
                <p className="text-caption text-text-muted">
                  CareerOs personalizes your search, tailoring, and outreach based on your
                  canonical profile depth.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsTierModalOpen(false)}
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-subtle cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Unlocked Capabilities */}
            <div className="space-y-2">
              <span className="text-caption font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                Unlocked Downstream Capabilities
              </span>
              <div className="p-3 rounded-lg bg-surface-subtle border border-border/80 space-y-1.5">
                {tierInfo.unlockedCapabilities.map((cap, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-caption text-text-secondary"
                  >
                    <Check className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Tier Milestones */}
            <div className="space-y-2">
              <span className="text-caption font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                High-Impact Milestones to Unlock More
              </span>
              <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200/80 space-y-1.5">
                {tierInfo.nextTierMilestones.map((ms, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-caption text-blue-900"
                  >
                    <span className="text-primary font-bold">•</span>
                    <span>{ms}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTierModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-body-sm font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
