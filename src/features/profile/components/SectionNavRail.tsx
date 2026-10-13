import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/card';
import { ProfileCompletenessDetails } from '@/core/profile';
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
  CheckCircle2,
  Check,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

export interface SectionNavRailProps {
  completionScore: number;
  completenessDetails?: ProfileCompletenessDetails;
}

const sections = [
  { id: 'personal-info', label: 'Personal Info', icon: User },
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'roles', label: 'Target Roles', icon: Target },
  { id: 'skills', label: 'Skills & Tools', icon: Wrench },
  { id: 'experience', label: 'Work Experience', icon: Briefcase },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'certifications', label: 'Certifications', icon: Award },
  { id: 'preferences', label: 'Work Preferences', icon: Sliders },
  { id: 'compensation', label: 'Compensation', icon: DollarSign },
  { id: 'goals', label: 'Availability & Goals', icon: Compass },
];

export const SectionNavRail: React.FC<SectionNavRailProps> = ({
  completionScore,
  completenessDetails,
}) => {
  const [activeSection, setActiveSection] = useState('personal-info');

  const updateActiveSection = useCallback(() => {
    const container = document.getElementById('main-content');
    const containerTop = container ? container.getBoundingClientRect().top : 0;

    for (let i = sections.length - 1; i >= 0; i--) {
      const el = document.getElementById(sections[i].id);
      if (el) {
        const elTop = el.getBoundingClientRect().top;
        if (elTop - containerTop <= 110) {
          setActiveSection(sections[i].id);
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

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    const container = document.getElementById('main-content');

    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScrollTop = container.scrollTop + (elRect.top - containerRect.top) - 16;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
      setActiveSection(id);
    } else if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-accent text-accent';
    if (score >= 50) return 'bg-primary text-primary';
    return 'bg-amber-500 text-amber-600';
  };

  const topRecommendation = completenessDetails?.recommendations?.[0];

  return (
    <>
      {/* Mobile Horizontal Section Tabs */}
      <div className="lg:hidden sticky top-0 z-10 bg-background/95 backdrop-blur-xs py-2.5 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto no-scrollbar border-b border-border/80">
        <div className="flex items-center gap-1.5 min-w-max">
          {sections.map((sec) => {
            const isCompleted = completenessDetails?.sections?.[sec.id]?.isComplete;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium transition-colors
                  ${
                    activeSection === sec.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                  }
                `}
              >
                <span>{sec.label}</span>
                {isCompleted && (
                  <Check
                    className={`h-3 w-3 ${activeSection === sec.id ? 'text-white' : 'text-accent'}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Sticky Rail */}
      <div className="hidden lg:block w-64 shrink-0 space-y-4 select-none">
        <div className="sticky top-6 space-y-4">
          {/* Profile Strength Widget */}
          <Card variant="default" padding="sm" className="p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-body-sm font-semibold text-text-primary">
                Profile Completeness
              </span>
              <span
                className={`text-body-sm font-bold ${getScoreColor(completionScore).split(' ')[1]}`}
              >
                {completionScore}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-surface-subtle border border-border/70 overflow-hidden">
              <div
                className={`h-full transition-all duration-normal ease-out ${getScoreColor(completionScore).split(' ')[0]}`}
                style={{ width: `${completionScore}%` }}
              />
            </div>

            {topRecommendation ? (
              <div className="flex items-start gap-2 p-2 rounded-md bg-surface-subtle border border-border/60 text-caption text-text-secondary">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className="leading-snug">{topRecommendation}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-caption text-text-muted pt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                <span>Canonical profile complete & ready</span>
              </div>
            )}

            {completenessDetails?.contradictions &&
              completenessDetails.contradictions.length > 0 && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 border border-amber-200/80 text-caption text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    {completenessDetails.contradictions[0]}
                  </span>
                </div>
              )}
          </Card>

          {/* Jump Links Nav */}
          <nav className="p-2 rounded-xl bg-surface border border-border shadow-xs space-y-0.5">
            <div className="px-3 py-1.5 text-caption font-semibold uppercase text-text-muted tracking-wider">
              Profile Sections
            </div>

            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              const sectionInfo = completenessDetails?.sections?.[sec.id];
              const isDone = sectionInfo?.isComplete;

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollToSection(sec.id)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-lg text-body-sm transition-colors text-left
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    ${
                      isActive
                        ? 'bg-primary-soft text-primary font-medium border-l-2 border-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-normal'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{sec.label}</span>
                  </div>

                  {isDone ? (
                    <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                  ) : (
                    <span className="text-[10px] text-text-muted/60 font-mono">
                      {sectionInfo ? `${sectionInfo.percentage}%` : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
};
