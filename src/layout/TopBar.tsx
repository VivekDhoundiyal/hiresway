import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  LogOut,
  Briefcase,
  Building2,
  Sparkles,
  Bot,
  Users,
  Compass,
} from 'lucide-react';
import { Modal } from '@/components/modal';
import { Drawer } from '@/components/drawer';
import { Tooltip } from '@/components/tooltip';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { EmptyState } from '@/components/empty-state';
import { CopilotDrawer } from '@/components/copilot/CopilotDrawer';
import { useProfile } from '@/core/profile';
import { AuthModal, userContextService } from '@/core/auth';
import { useSidebar } from './useSidebar';
import { careerSearchEngine, preferenceLearningEngine } from '@/core/jobs/engines';

export interface TopBarProps {
  onOpenMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileMenu }) => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isCollapsed, toggleCollapsed } = useSidebar();

  // Dialog & Drawer states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'switch'>('login');
  const [searchQuery, setSearchQuery] = useState('');
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close account menu on outside click or Escape
  useEffect(() => {
    if (!isAccountOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setIsAccountOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAccountOpen]);

  // Global keyboard shortcuts: Cmd+K / Ctrl+K and Cmd+B / Ctrl+B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapsed]);

  // Hybrid Search across Jobs, Companies, Skills, Titles & Keywords via CareerSearchEngine
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) {
      return { jobs: [], companies: [], skills: [], totalCount: 0 };
    }

    const res = careerSearchEngine.search(q, {
      maxJobs: 6,
      maxCompanies: 4,
      maxSkills: 4,
    });

    return {
      jobs: res.jobs.map((r) => r.job),
      companies: res.companies.map((c) => ({ company: c.company, count: c.opportunityCount })),
      skills: res.skills.map((s) => ({ skill: s.skill, count: s.jobCount })),
      totalCount: res.totalResults,
    };
  }, [searchQuery, isSearchOpen]);

  const handleSelectJob = (jobId: string) => {
    if (searchQuery.trim()) {
      preferenceLearningEngine.ingestSearch(searchQuery.trim());
    }
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/job-feed?jobId=${encodeURIComponent(jobId)}`);
  };

  const handleSelectCompany = (company: string) => {
    preferenceLearningEngine.ingestSearch(company);
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/job-feed?q=${encodeURIComponent(company)}`);
  };

  const handleSelectSkill = (skill: string) => {
    preferenceLearningEngine.ingestSearch(skill);
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/job-feed?q=${encodeURIComponent(skill)}`);
  };

  const handleSearchSubmit = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    preferenceLearningEngine.ingestSearch(trimmed);
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/job-feed?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <>
      <header className="h-16 px-4 sm:px-8 bg-surface border-b border-border/80 flex items-center justify-between shrink-0 sticky top-0 z-20">
        {/* Left Area: Mobile Menu Toggle & Global Search */}
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="md:hidden p-2 -ml-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Desktop Sidebar Collapse Toggle */}
          <Tooltip
            content={
              isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'
            }
          >
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={
                isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'
              }
              className="hidden md:flex p-1.5 -ml-2 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </Tooltip>

          {/* Prominent Global Search Input matching Reference */}
          <div className="flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search jobs, companies, skills, or keywords (⌘K)"
              className="w-full flex items-center justify-between h-9 sm:h-10 px-3.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200/80 text-slate-400 hover:border-slate-300 transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-3xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="text-xs sm:text-body-sm text-slate-400 truncate">
                  Search jobs, companies, skills, or keywords...
                </span>
              </div>
              <kbd className="inline-flex items-center px-2 py-0.5 rounded-md border border-slate-200 bg-white text-[11px] text-slate-500 font-mono shadow-3xs">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>

        {/* Right Area: Copilot, Notifications & Account Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Career Copilot Trigger */}
          <button
            type="button"
            onClick={() => setIsCopilotOpen(true)}
            aria-label="Open Career Copilot"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary-soft text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer select-none"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Copilot</span>
          </button>

          {/* Notifications Trigger with Red Dot */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              aria-label="Open notifications"
              className="p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              <span
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-surface"
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="h-5 w-[1px] bg-border/80 mx-0.5" aria-hidden="true" />

          {/* Account Avatar with VIVEK */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setIsAccountOpen((prev) => !prev)}
              aria-expanded={isAccountOpen}
              aria-haspopup="true"
              aria-label="Open account menu"
              className="flex items-center gap-2.5 p-1 rounded-full hover:bg-surface-subtle transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="h-8 w-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-xs overflow-hidden border border-amber-600/20 shadow-xs">
                {profile.personalInfo.avatarUrl ? (
                  <img
                    src={profile.personalInfo.avatarUrl}
                    alt={profile.personalInfo.fullName || 'User'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{(profile.personalInfo.fullName?.trim()?.[0] || 'C').toUpperCase()}</span>
                )}
              </div>
              <span className="hidden sm:inline-block text-xs font-bold text-gray-800 tracking-wide">
                {profile.personalInfo.fullName ? profile.personalInfo.fullName.trim().split(' ')[0].toUpperCase() : 'ACCOUNT'}
              </span>
              <ChevronDown
                className={`hidden sm:inline-block h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${
                  isAccountOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Compact Account Dropdown Popover */}
            {isAccountOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-surface border border-border shadow-lg py-1 z-30 divide-y divide-border/60"
                role="menu"
                aria-label="Account Menu"
              >
                <div className="px-3.5 py-3">
                  <p className="text-body-sm font-semibold text-text-primary truncate">
                    {profile.personalInfo.fullName || 'CareerOS Candidate'}
                  </p>
                  <p className="text-caption text-text-muted truncate mt-0.5">
                    {profile.personalInfo.email ||
                      profile.rolePreferences.targetPrimaryTitle ||
                      'Local Protected Profile'}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountOpen(false);
                      navigate('/onboarding');
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-body-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle text-left cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 text-text-muted" />
                    <span>Career Onboarding</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-body-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle text-left cursor-pointer transition-colors"
                  >
                    <Settings className="h-4 w-4 text-text-muted" />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountOpen(false);
                      setAuthModalMode('switch');
                      setIsAuthModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-body-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle text-left cursor-pointer transition-colors"
                  >
                    <Users className="h-4 w-4 text-text-muted" />
                    <span>Switch Account</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountOpen(false);
                      userContextService.logout();
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-body-sm text-error hover:bg-error-soft text-left cursor-pointer transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Real Global Career Search Modal */}
      <Modal
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          setSearchQuery('');
        }}
        title="Search Jobs, Companies & Skills"
        description="Search active jobs, employers, skills, titles, and keywords"
        size="lg"
      >
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchSubmit(searchQuery);
            }}
          >
            <Input
              autoFocus
              placeholder="Search by job title, company, skill (e.g. Sales Manager, Coursera, AI)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4 text-gray-400" />}
            />
          </form>

          {/* Direct filter action banner when typing */}
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => handleSearchSubmit(searchQuery)}
              className="w-full flex items-center justify-between p-2.5 rounded-lg bg-blue-50/70 hover:bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span>Filter all Job Feed results for &ldquo;{searchQuery}&rdquo;</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="max-h-80 overflow-y-auto space-y-4 divide-y divide-border/40 pr-1">
            {searchQuery.trim() === '' ? (
              /* Suggested / Popular Searches */
              <div className="py-2 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                  Popular Searches
                </span>
                <div className="flex flex-wrap gap-2">
                  {['Sales Manager', 'Coursera', 'AI', 'Software Engineer', 'Product Manager', 'Remote', 'Frontend'].map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setSearchQuery(term);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-subtle hover:bg-primary-soft text-text-primary hover:text-primary border border-border/80 transition-colors cursor-pointer"
                    >
                      <Search className="h-3 w-3 text-text-muted" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : searchResults.totalCount > 0 ? (
              <div className="space-y-4 pt-1">
                {/* 1. Jobs Section */}
                {searchResults.jobs.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted block px-1">
                      Jobs ({searchResults.jobs.length})
                    </span>
                    <div className="divide-y divide-border/60">
                      {searchResults.jobs.map((job) => (
                        <div
                          key={job.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectJob(job.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSelectJob(job.id);
                          }}
                          className="p-3 flex items-center justify-between rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="p-2 rounded-md bg-blue-50 text-blue-600 shrink-0">
                              <Briefcase className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-body-sm font-semibold text-text-primary block truncate">
                                {job.title}
                              </span>
                              <span className="text-caption text-text-muted block truncate">
                                {job.company} • {job.location || 'Remote'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <Badge variant="primary" size="sm">
                              {job.match_score ? `${job.match_score}% Match` : 'Opportunity'}
                            </Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Companies Section */}
                {searchResults.companies.length > 0 && (
                  <div className="space-y-1.5 pt-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted block px-1">
                      Companies ({searchResults.companies.length})
                    </span>
                    <div className="divide-y divide-border/60">
                      {searchResults.companies.map((item) => (
                        <div
                          key={item.company}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectCompany(item.company)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSelectCompany(item.company);
                          }}
                          className="p-3 flex items-center justify-between rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="p-2 rounded-md bg-purple-50 text-purple-600 shrink-0">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-body-sm font-semibold text-text-primary block truncate">
                                {item.company}
                              </span>
                              <span className="text-caption text-text-muted block truncate">
                                {item.count} active {item.count === 1 ? 'opportunity' : 'opportunities'} in feed
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <Badge variant="neutral" size="sm">
                              Company
                            </Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Skills Section */}
                {searchResults.skills.length > 0 && (
                  <div className="space-y-1.5 pt-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted block px-1">
                      Skills ({searchResults.skills.length})
                    </span>
                    <div className="divide-y divide-border/60">
                      {searchResults.skills.map((item) => (
                        <div
                          key={item.skill}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectSkill(item.skill)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSelectSkill(item.skill);
                          }}
                          className="p-3 flex items-center justify-between rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="p-2 rounded-md bg-emerald-50 text-emerald-600 shrink-0">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-body-sm font-semibold text-text-primary block truncate">
                                {item.skill}
                              </span>
                              <span className="text-caption text-text-muted block truncate">
                                Required across {item.count} {item.count === 1 ? 'opportunity' : 'opportunities'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <Badge variant="neutral" size="sm">
                              Skill
                            </Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-body-sm text-text-muted space-y-2">
                <div>No direct matches found for &ldquo;{searchQuery}&rdquo;.</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSearchSubmit(searchQuery)}
                >
                  Search Job Feed anyway
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Career Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />

      {/* Notifications Drawer */}
      <Drawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        placement="right"
        title="Notifications"
        description="Recent reminders and activity alerts"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-caption text-text-muted">No pending alerts</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNotificationsOpen(false)}
            >
              Close
            </Button>
          </div>
        }
      >
        <div className="py-8">
          <EmptyState
            icon={Bell}
            title="All caught up"
            description="You have no unread notifications. Updates on job applications, follow-up deadlines, and scheduled interviews will appear here."
          />
        </div>
      </Drawer>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </>
  );
};
