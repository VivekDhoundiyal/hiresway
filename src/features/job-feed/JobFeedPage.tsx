import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProfile, UserProfile, normalizeCareerProfile } from '@/core/profile';
import {
  useJobFeed,
  JobOpportunity,
  JobMatchAnalysis,
  classifyOpportunities,
  JobFilterCriteria,
} from '@/core/intelligence';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Drawer } from '@/components/drawer';
import { Modal } from '@/components/modal';
import { JobCard } from './components/JobCard';
import { JobDetailDrawer } from './components/JobDetailDrawer';
import { JobDebugDrawer } from './components/JobDebugDrawer';
import { JobImportModal } from './components/JobImportModal';
import { SourceRegistryDrawer } from './components/SourceRegistryDrawer';
import { MarketIntelligenceView } from './components/MarketIntelligenceView';
import { LocationControlModal } from './components/LocationControlModal';
import { CareerProfileModal } from './components/CareerProfileModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { AddSourceModal } from './components/AddSourceModal';
import { useVirtualizer } from '@/components/virtual';
import {
  MultiSelectDropdown,
  FilterChipsBar,
  ActiveFilterChip,
  MultiSelectOption,
} from './components/MultiSelectFilter';
import { WhyThisMatchesModal } from './components/WhyThisMatchesModal';
import { jobVerificationEngine } from '@/core/jobs/jobVerificationEngine';
import { remoteEligibilityEngine } from '@/core/jobs/remoteEligibilityEngine';
import { jobRepository } from '@/core/jobs/jobRepository';
import { HIGH_MATCH_THRESHOLD } from '@/core/jobs';
import {
  socialFeedEngine,
  roleTaxonomyEngine,
  locationFilterEngine,
  filterEvaluationEngine,
} from '@/core/jobs/engines';
import { SourceFilterTab } from '@/core/jobs/sourceRegistry';
import { CompanyLogo } from '@/components/company-logo';
import {
  Search,
  RefreshCw,
  Plus,
  Globe2,
  X,
  Briefcase,
  AlertCircle,
  Sparkles,
  RotateCcw,
  LayoutGrid,
  List,
  ChevronDown,
  ExternalLink,
  Check,
  Activity,
  Pause,
  AlertTriangle,
  SlidersHorizontal,
  Target,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { buildSearchConfiguration } from '@/core/jobs/searchConfiguration';
import { feedRankingEngine, FeedSortOption } from '@/core/jobs/engines/feedRankingEngine';

export type InboxSection =
  | 'all'
  | 'new'
  | 'just_in'
  | 'today'
  | 'high_priority'
  | 'target_companies'
  | 'remote'
  | 'salary_disclosed'
  | 'viewed'
  | 'saved'
  | 'applied'
  | 'news';

export const JobFeedPage: React.FC = () => {
  const { profile, saveFullProfile } = useProfile();
  const {
    careerModel,
    opportunities,
    savedJobs,
    rejectedJobs,
    sources,
    isScanning,
    discoveryError,
    lastDiscoveryRun,
    pendingNewJobsCount,
    applyPendingNewJobs,
    databaseTabCounts,
    lastUpdated,
    lastAttemptAt,
    lastSuccessAt,
    sourcesActuallyRan,
    runDiscovery,
    continuousDiscoveryState,
    continuousDiscoveryError,
    toggleContinuousDiscovery,
    pauseContinuousDiscovery,
    resumeContinuousDiscovery,
    refresh,
    importJob,
    viewJob,
    saveJob,
    unsaveJob,
    rejectJob,
    unrejectJob,
    applyJob,
    skipJob,
    toggleSource,
    feedAgeDays,
    setFeedAgeDays,
  } = useJobFeed();

  const [currentPage, setCurrentPage] = useState(1);

  // Helper: format unobtrusive last updated string
  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return 'Not yet scanned';
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Opportunity Inbox Active Section
  const [activeSection, setActiveSection] = useState<InboxSection>('all');

  // Modals & Drawers
  const [inspectingJob, setInspectingJob] = useState<
    (JobOpportunity & { match: JobMatchAnalysis }) | null
  >(null);
  const [debugJob, setDebugJob] = useState<
    (JobOpportunity & { match?: JobMatchAnalysis }) | null
  >(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [isSourceRegistryOpen, setIsSourceRegistryOpen] = useState(false);
  const [sourceDrawerFilter, setSourceDrawerFilter] = useState<SourceFilterTab>('all');
  const [isRejectedDrawerOpen, setIsRejectedDrawerOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<
    'role' | 'location' | 'remote' | 'seniority' | 'company' | 'type' | 'salary' | null
  >(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCareerProfileModalOpen, setIsCareerProfileModalOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const gridContainerRef = React.useRef<HTMLDivElement>(null);
  const [gridColumns, setGridColumns] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 768) return 1;
    if (window.innerWidth < 1024) return 2;
    return 3;
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) setGridColumns(1);
      else if (width < 1024) setGridColumns(2);
      else setGridColumns(3);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(() => {
    return searchParams.get('diagnostics') === 'open' || searchParams.get('diagnostics') === 'true';
  });

  useEffect(() => {
    if (searchParams.get('diagnostics') === 'open' || searchParams.get('diagnostics') === 'true') {
      setIsDiagnosticsOpen(true);
    }
  }, [searchParams]);

  const handleCloseDiagnostics = useCallback(() => {
    setIsDiagnosticsOpen(false);
    if (searchParams.get('diagnostics')) {
      const next = new URLSearchParams(searchParams);
      next.delete('diagnostics');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [selectedKeyboardIndex, setSelectedKeyboardIndex] = useState<number>(0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [dismissedRunId, setDismissedRunId] = useState<string | null>(null);
  const [whyMatchesJob, setWhyMatchesJob] = useState<(JobOpportunity & { match: JobMatchAnalysis }) | null>(null);

  // Canonical CareerProfile normalized directly from UserProfile (Profile-First Source of Truth)
  const careerProfile = useMemo(() => {
    return normalizeCareerProfile(profile);
  }, [profile]);

  // Canonical SearchConfiguration generated directly from UserProfile (Discovery Engine 2.0)
  const searchConfig = useMemo(() => {
    return buildSearchConfiguration(profile);
  }, [profile]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Debounced search state for ultra-fast keystroke responsiveness
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') || '');

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam !== null && qParam !== searchInput) {
      setSearchInput(qParam);
      setDebouncedSearch(qParam);
      setFilters((prev) => ({ ...prev, searchQuery: qParam }));
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Secondary Filters State
  const [filters, setFilters] = useState<JobFilterCriteria>({
    searchQuery: '',
    fitTier: 'all',
    remoteType: 'all',
    countryMarket: 'all',
    salaryDisclosedOnly: false,
    targetCompanyOnly: false,
    seniority: 'all',
    industry: 'all',
    sortBy: 'best_match',
    roleFilter: 'all',
    locationFilter: 'all',
    experienceMin: 0,
    companyFilter: 'all',
    jobType: 'all',
    verifiedOnly: false,
    locations: [],
    remoteStatuses: [],
    seniorities: [],
    companies: [],
    industries: [],
    roles: [],
    employmentTypes: [],
    sources: [],
  });

  // Profile Baseline Matching Toggle (ON by default, can be toggled by user)
  const [isProfileMatchingEnabled, setIsProfileMatchingEnabled] = useState<boolean>(true);

  // Reset pagination to page 1 whenever filters, search, or active section tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, debouncedSearch, activeSection, isProfileMatchingEnabled]);

  const { homeCountry } = careerModel.locationModel;

  // Compute multi-factor matching across active opportunities
  const classifiedOpportunities = useMemo(() => {
    return classifyOpportunities(profile, opportunities, isProfileMatchingEnabled ? 40 : 0);
  }, [profile, opportunities, isProfileMatchingEnabled]);

  // High Match Count (85%+ fit)
  const highMatchCount = useMemo(() => {
    return classifiedOpportunities.filter((j) => j.match.overallScore >= HIGH_MATCH_THRESHOLD).length;
  }, [classifiedOpportunities]);

  // Classified saved jobs
  const classifiedSavedJobs = useMemo(() => {
    return classifyOpportunities(profile, savedJobs, 0);
  }, [profile, savedJobs]);

  // Classified rejected jobs
  const classifiedRejectedJobs = useMemo(() => {
    return classifyOpportunities(profile, rejectedJobs, 0);
  }, [profile, rejectedJobs]);


  const databaseViewCounts = useMemo(() => {
    return jobRepository.getDatabaseViewCounts();
  }, [opportunities, savedJobs]);

  const viewedJobs = useMemo(() => {
    const dbJobs = jobRepository.getDatabaseOpportunities().filter((j) => j.lifecycleState === 'VIEWED' || Boolean(j.viewed_at) || Boolean(j.viewedAt));
    return classifyOpportunities(profile, dbJobs, 0);
  }, [profile, opportunities]);

  // Active base dataset according to section
  const baseSectionOpportunities = useMemo(() => {
    if (activeSection === 'saved') {
      return classifiedSavedJobs;
    }
    if (activeSection === 'applied') {
      const dbJobs = jobRepository.getDatabaseOpportunities().filter(
        (j) => j.lifecycleState === 'APPLIED' || j.applicationStatus === 'applied' || j.crm_status === 'Applied' || j.crm_status === 'Application Submitted'
      );
      return classifyOpportunities(profile, dbJobs, 0);
    }
    if (activeSection === 'viewed') {
      return viewedJobs;
    }
    if (activeSection === 'target_companies') {
      return classifiedOpportunities.filter((j) => j.isTargetCompany);
    }
    if (activeSection === 'high_priority') {
      return classifiedOpportunities.filter((j) => j.match.overallScore >= HIGH_MATCH_THRESHOLD);
    }
    if (activeSection === 'remote') {
      return classifiedOpportunities.filter((j) => {
        const status = (j.remoteStatus || '').toLowerCase();
        const rStatus = j.remote_eligibility?.status;
        return (
          status === 'remote' ||
          rStatus === 'WORLDWIDE_REMOTE' ||
          rStatus === 'REMOTE_FROM_INDIA' ||
          rStatus === 'REMOTE_COUNTRY_RESTRICTED' ||
          rStatus === 'REMOTE_REGION_RESTRICTED' ||
          remoteEligibilityEngine.isWorldwideRemote(j) ||
          remoteEligibilityEngine.isEligibleForIndiaFeed(j) ||
          (j as any).workFromAnywhere === true
        );
      });
    }
    if (activeSection === 'salary_disclosed') {
      return classifiedOpportunities.filter((j) => j.salary.disclosed || j.salary_truth?.status === 'EMPLOYER_STATED');
    }
    if (activeSection === 'new') {
      return classifiedOpportunities.filter((j) => {
        return (j.is_new === true || j.isNew === true) && !j.viewed_at && !j.viewedAt;
      });
    }
    if (activeSection === 'just_in') {
      return classifiedOpportunities.filter((j) => {
        const cohort = socialFeedEngine.getJobCohort(j);
        return cohort === 'JUST_IN' || cohort === 'NEW';
      });
    }
    if (activeSection === 'today') {
      return classifiedOpportunities.filter((j) => {
        const cohort = socialFeedEngine.getJobCohort(j);
        return cohort === 'NEW' || cohort === 'JUST_IN' || cohort === 'TODAY';
      });
    }
    return classifiedOpportunities;
  }, [activeSection, classifiedOpportunities, classifiedSavedJobs, viewedJobs, profile]);

  // Dynamic multi-select filter options derived from base opportunities
  const locationOptions = useMemo<MultiSelectOption[]>(() => {
    const counts: Record<string, number> = {};
    const standard = [
      'Bengaluru / Bangalore',
      'India',
      'Remote Worldwide',
      'San Francisco',
      'New York',
      'London',
      'Singapore',
      'Berlin',
    ];
    standard.forEach((loc) => { counts[loc] = 0; });

    baseSectionOpportunities.forEach((job) => {
      const loc = job.location || '';
      const locLower = loc.toLowerCase();
      if (remoteEligibilityEngine.isWorldwideRemote(job) || locLower.includes('worldwide') || locLower.includes('anywhere')) {
        counts['Remote Worldwide'] = (counts['Remote Worldwide'] || 0) + 1;
      }
      if (locLower.includes('bangalore') || locLower.includes('bengaluru')) {
        counts['Bengaluru / Bangalore'] = (counts['Bengaluru / Bangalore'] || 0) + 1;
      }
      if (locLower.includes('india') || job.country?.toLowerCase() === 'india') {
        counts['India'] = (counts['India'] || 0) + 1;
      }
      if (locLower.includes('san francisco')) {
        counts['San Francisco'] = (counts['San Francisco'] || 0) + 1;
      }
      if (locLower.includes('new york')) {
        counts['New York'] = (counts['New York'] || 0) + 1;
      }
      if (locLower.includes('london')) {
        counts['London'] = (counts['London'] || 0) + 1;
      }
      if (locLower.includes('singapore')) {
        counts['Singapore'] = (counts['Singapore'] || 0) + 1;
      }
      if (locLower.includes('berlin')) {
        counts['Berlin'] = (counts['Berlin'] || 0) + 1;
      }
      if (loc && !standard.some((s) => locLower.includes(s.toLowerCase().split(' ')[0]))) {
        const cleanLoc = loc.split(',')[0].trim();
        if (cleanLoc.length > 2 && cleanLoc.length < 30) {
          counts[cleanLoc] = (counts[cleanLoc] || 0) + 1;
        }
      }
    });

    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([loc, count]) => ({
        value: loc,
        label: loc,
        count,
      }));
  }, [baseSectionOpportunities]);

  const remoteOptions = useMemo<MultiSelectOption[]>(() => {
    let worldwide = 0;
    let indiaRemote = 0;
    let restricted = 0;
    let hybrid = 0;
    let onsite = 0;

    baseSectionOpportunities.forEach((job) => {
      if (remoteEligibilityEngine.isWorldwideRemote(job)) {
        worldwide++;
      } else if (
        job.remote_eligibility?.status === 'REMOTE_FROM_INDIA' ||
        (job.country?.toLowerCase() === 'india' && job.remoteStatus === 'remote')
      ) {
        indiaRemote++;
      } else if (
        job.remote_eligibility?.status === 'REMOTE_COUNTRY_RESTRICTED' ||
        job.remote_eligibility?.status === 'REMOTE_REGION_RESTRICTED'
      ) {
        restricted++;
      } else if (job.remoteStatus === 'hybrid' || job.remote_eligibility?.status === 'HYBRID') {
        hybrid++;
      } else {
        onsite++;
      }
    });

    return [
      { value: 'worldwide_remote', label: 'Worldwide Remote', count: worldwide },
      { value: 'india_remote', label: 'Remote (India)', count: indiaRemote },
      { value: 'restricted_remote', label: 'Remote (Restricted)', count: restricted },
      { value: 'hybrid', label: 'Hybrid', count: hybrid },
      { value: 'onsite', label: 'On-site', count: onsite },
    ];
  }, [baseSectionOpportunities]);

  const roleOptions = useMemo<MultiSelectOption[]>(() => {
    return roleTaxonomyEngine.getTaxonomyDropdownOptions(baseSectionOpportunities);
  }, [baseSectionOpportunities]);

  const companyOptions = useMemo<MultiSelectOption[]>(() => {
    const counts: Record<string, number> = {};
    baseSectionOpportunities.forEach((j) => {
      if (j.company) {
        counts[j.company] = (counts[j.company] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([comp, count]) => ({
        value: comp,
        label: comp,
        count,
      }));
  }, [baseSectionOpportunities]);

  const seniorityOptions = useMemo<MultiSelectOption[]>(() => {
    const counts: Record<string, number> = {
      junior: 0,
      mid: 0,
      senior: 0,
      lead: 0,
      principal: 0,
      director: 0,
      executive: 0,
    };
    baseSectionOpportunities.forEach((j) => {
      const sl = ((j.seniority as string) || '').toLowerCase();
      const tl = j.title.toLowerCase();
      if (sl.includes('junior') || tl.includes('junior') || sl.includes('associate') || tl.includes('associate')) counts.junior++;
      if (sl.includes('mid') || tl.includes('mid')) counts.mid++;
      if (sl.includes('senior') || tl.includes('senior') || sl.includes('sr.') || tl.includes('sr.')) counts.senior++;
      if (sl.includes('lead') || tl.includes('lead') || sl.includes('staff') || tl.includes('staff')) counts.lead++;
      if (sl.includes('principal') || tl.includes('principal')) counts.principal++;
      if (sl.includes('director') || tl.includes('director') || sl.includes('vp') || tl.includes('vp')) counts.director++;
      if (sl.includes('executive') || tl.includes('executive') || sl.includes('head') || tl.includes('head')) counts.executive++;
    });
    return [
      { value: 'junior', label: 'Junior / Associate', count: counts.junior },
      { value: 'mid', label: 'Mid-Level', count: counts.mid },
      { value: 'senior', label: 'Senior', count: counts.senior },
      { value: 'lead', label: 'Lead / Staff', count: counts.lead },
      { value: 'principal', label: 'Principal', count: counts.principal },
      { value: 'director', label: 'Director / VP', count: counts.director },
      { value: 'executive', label: 'Executive', count: counts.executive },
    ];
  }, [baseSectionOpportunities]);

  const employmentTypeOptions = useMemo<MultiSelectOption[]>(() => {
    const counts: Record<string, number> = {
      'full-time': 0,
      contract: 0,
      'part-time': 0,
      internship: 0,
    };
    baseSectionOpportunities.forEach((j) => {
      const et = (j.employmentType || '').toLowerCase();
      if (et.includes('full-time') || et.includes('full time')) counts['full-time']++;
      if (et.includes('contract')) counts.contract++;
      if (et.includes('part-time') || et.includes('part time')) counts['part-time']++;
      if (et.includes('internship') || et.includes('intern')) counts.internship++;
    });
    return [
      { value: 'full-time', label: 'Full-time', count: counts['full-time'] },
      { value: 'contract', label: 'Contract', count: counts.contract },
      { value: 'part-time', label: 'Part-time', count: counts['part-time'] },
      { value: 'internship', label: 'Internship', count: counts.internship },
    ];
  }, [baseSectionOpportunities]);

  const salaryOptions = useMemo<MultiSelectOption[]>(() => {
    return [
      { value: 'disclosed', label: 'Salary Disclosed' },
      { value: '50k', label: '$50k+ / ₹20L+' },
      { value: '100k', label: '$100k+ / ₹40L+' },
      { value: '150k', label: '$150k+ / ₹60L+' },
      { value: '200k', label: '$200k+ / ₹80L+' },
    ];
  }, []);

  const handleSalaryChange = useCallback((values: string[]) => {
    setFilters((prev) => ({
      ...prev,
      salaryRanges: values,
      salaryDisclosedOnly: values.includes('disclosed'),
      minSalary: values.includes('200k')
        ? 200000
        : values.includes('150k')
        ? 150000
        : values.includes('100k')
        ? 100000
        : values.includes('50k')
        ? 50000
        : undefined,
    }));
  }, []);

  // Active filter chips collection for the removable filter chips bar
  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (debouncedSearch.trim()) {
      chips.push({
        id: 'search',
        category: 'Search',
        label: debouncedSearch,
        onRemove: () => {
          setSearchInput('');
          setDebouncedSearch('');
        },
      });
    }
    const consolidatedLocs = locationFilterEngine.consolidateChips(filters.locations || []);
    consolidatedLocs.forEach((loc) => {
      chips.push({
        id: loc.id,
        category: 'Location',
        label: loc.label,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            locations: (prev.locations || []).filter((l) => locationFilterEngine.normalizeToken(l) !== loc.canonicalKey),
          })),
      });
    });

    (filters.remoteStatuses || []).forEach((rem) => {
      const label =
        rem === 'worldwide_remote'
          ? 'Worldwide Remote'
          : rem === 'india_remote'
          ? 'Remote (India)'
          : rem === 'restricted_remote'
          ? 'Remote (Restricted)'
          : rem === 'hybrid'
          ? 'Hybrid'
          : 'On-site';
      chips.push({
        id: `rem-${rem}`,
        category: 'Remote',
        label,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            remoteStatuses: (prev.remoteStatuses || []).filter((r) => r !== rem),
          })),
      });
    });
    (filters.roles || []).forEach((role) => {
      chips.push({
        id: `role-${role}`,
        category: 'Role',
        label: role,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            roles: (prev.roles || []).filter((r) => r !== role),
          })),
      });
    });
    (filters.companies || []).forEach((comp) => {
      chips.push({
        id: `comp-${comp}`,
        category: 'Company',
        label: comp,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            companies: (prev.companies || []).filter((c) => c !== comp),
          })),
      });
    });
    (filters.seniorities || []).forEach((sen) => {
      chips.push({
        id: `sen-${sen}`,
        category: 'Seniority',
        label: sen,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            seniorities: (prev.seniorities || []).filter((s) => s !== sen),
          })),
      });
    });
    (filters.employmentTypes || []).forEach((emp) => {
      chips.push({
        id: `emp-${emp}`,
        category: 'Type',
        label: emp,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            employmentTypes: (prev.employmentTypes || []).filter((e) => e !== emp),
          })),
      });
    });
    (filters.salaryRanges || []).forEach((sal) => {
      chips.push({
        id: `sal-${sal}`,
        category: 'Salary',
        label: sal === 'disclosed' ? 'Disclosed' : sal.toUpperCase(),
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            salaryRanges: (prev.salaryRanges || []).filter((s) => s !== sal),
            salaryDisclosedOnly: sal === 'disclosed' ? false : prev.salaryDisclosedOnly,
          })),
      });
    });
    if (filters.salaryDisclosedOnly && !(filters.salaryRanges || []).includes('disclosed')) {
      chips.push({
        id: 'salary-stated',
        category: 'Salary',
        label: 'Stated only',
        onRemove: () => setFilters((prev) => ({ ...prev, salaryDisclosedOnly: false })),
      });
    }
    if (filters.targetCompanyOnly) {
      chips.push({
        id: 'target-only',
        category: 'Company',
        label: 'Target only',
        onRemove: () => setFilters((prev) => ({ ...prev, targetCompanyOnly: false })),
      });
    }
    if (filters.verifiedOnly) {
      chips.push({
        id: 'verified-only',
        category: 'Verification',
        label: 'Verified Live',
        onRemove: () => setFilters((prev) => ({ ...prev, verifiedOnly: false })),
      });
    }
    return chips;
  }, [filters, debouncedSearch]);

  // Filter & Sort Opportunities (Single Source-of-Truth Filter Evaluation Engine)
  const filteredOpportunities = useMemo(() => {
    const result = baseSectionOpportunities.filter((item) => {
      const evalRes = filterEvaluationEngine.evaluateJob(item, filters, {
        searchQuery: debouncedSearch,
        careerProfile,
        searchConfig,
        isProfileMatchingEnabled,
        maxAgeDays: feedAgeDays,
      });
      return evalRes.passes;
    });

    // Feed Sorting Implementation (All 8 modes: feedRankingEngine)
    const sortMode: FeedSortOption =
      filters.sortBy === 'newest' || (filters.sortBy as any) === 'freshness'
        ? 'newest'
        : filters.sortBy === 'recently_updated'
        ? 'recently_updated'
        : filters.sortBy === 'highest_match' || (filters.sortBy as any) === 'match_percent'
        ? 'highest_match'
        : filters.sortBy === 'salary_high_low' || (filters.sortBy as any) === 'salary'
        ? 'salary_high_low'
        : filters.sortBy === 'salary_low_high'
        ? 'salary_low_high'
        : filters.sortBy === 'target_companies' || (filters.sortBy as any) === 'company'
        ? 'target_companies'
        : filters.sortBy === 'closing_soon'
        ? 'closing_soon'
        : 'best_match';

    return feedRankingEngine.sortOpportunities(result, sortMode);
  }, [baseSectionOpportunities, filters, debouncedSearch, careerProfile, searchConfig, isProfileMatchingEnabled, feedAgeDays]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = activeFilterChips.length;
    if (filters.remoteType !== 'all' && (!filters.remoteStatuses || filters.remoteStatuses.length === 0)) count++;
    if (filters.countryMarket !== 'all') count++;
    if (filters.fitTier !== 'all') count++;
    if (filters.experienceMin && filters.experienceMin > 0) count++;
    if (filters.sortBy !== 'match') count++;
    if (filters.salaryDisclosedOnly) count++;
    if (filters.targetCompanyOnly) count++;
    if (filters.verifiedOnly) count++;
    return count;
  }, [
    activeFilterChips.length,
    filters.remoteType,
    filters.remoteStatuses,
    filters.countryMarket,
    filters.fitTier,
    filters.experienceMin,
    filters.sortBy,
    filters.salaryDisclosedOnly,
    filters.targetCompanyOnly,
    filters.verifiedOnly,
  ]);

  const ITEMS_PER_PAGE = 30;
  const totalPages = Math.max(1, Math.ceil(filteredOpportunities.length / ITEMS_PER_PAGE));
  const paginatedOpportunities = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOpportunities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOpportunities, currentPage]);

  // Virtualizer for ultra-fast 3-column grid rendering without DOM bloating
  const rowVirtualizer = useVirtualizer({
    count: filteredOpportunities.length,
    estimateSize: 280,
    overscan: 3,
    columns: gridColumns,
    containerRef: gridContainerRef,
  });

  const resetFilters = useCallback(() => {
    setCurrentPage(1);
    setSearchInput('');
    setDebouncedSearch('');
    setFilters({
      searchQuery: '',
      fitTier: 'all',
      remoteType: 'all',
      countryMarket: 'all',
      salaryDisclosedOnly: false,
      targetCompanyOnly: false,
      seniority: 'all',
      industry: 'all',
      sortBy: 'match',
      roleFilter: 'all',
      locationFilter: 'all',
      experienceMin: 0,
      companyFilter: 'all',
      jobType: 'all',
      verifiedOnly: false,
      locations: [],
      remoteStatuses: [],
      seniorities: [],
      companies: [],
      industries: [],
      roles: [],
      employmentTypes: [],
      sources: [],
    });
  }, []);

  const handleSave = useCallback((jobId: string) => {
    const isCurrentlySaved = savedJobs.some((s) => s.id === jobId);
    const target = opportunities.find((j) => j.id === jobId) || savedJobs.find((j) => j.id === jobId);
    if (isCurrentlySaved) {
      unsaveJob(jobId);
      if (target) {
        setActionNotice(`"${target.title}" removed from Job Database.`);
        setTimeout(() => setActionNotice(null), 3500);
      }
    } else {
      saveJob(jobId);
      if (target) {
        setActionNotice(`"${target.title}" at ${target.company} saved to Job Database.`);
        setTimeout(() => setActionNotice(null), 3500);
      }
    }
  }, [saveJob, unsaveJob, opportunities, savedJobs]);

  const handleReject = useCallback((jobId: string) => {
    rejectJob(jobId);
    setActionNotice('Opportunity hidden. CareerOS will show fewer similar roles.');
    setTimeout(() => setActionNotice(null), 3500);
  }, [rejectJob]);

  const handleApply = useCallback((jobId: string) => {
    applyJob(jobId);
    const target = opportunities.find((j) => j.id === jobId) || savedJobs.find((j) => j.id === jobId);
    if (target) {
      const rawUrl = target.applyUrl || target.jobUrl;
      const targetUrl = jobVerificationEngine.sanitizeApplyUrl(rawUrl);
      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
      setActionNotice(`Applied to "${target.title}" at ${target.company}! Opening application portal.`);
      setTimeout(() => setActionNotice(null), 3500);
    }
  }, [applyJob, opportunities, savedJobs]);

  const handleRestore = useCallback((jobId: string) => {
    unrejectJob(jobId);
    setActionNotice('Opportunity restored to your active discovery feed.');
    setTimeout(() => setActionNotice(null), 3500);
  }, [unrejectJob]);

  const handleOpenJob = useCallback((targetJob: JobOpportunity & { match: JobMatchAnalysis }) => {
    viewJob(targetJob.id, targetJob.match?.overallScore);
    const now = new Date().toISOString();
    setInspectingJob({
      ...targetJob,
      is_new: false,
      isNew: false,
      viewed_at: now,
      viewedAt: now,
    });
  }, [viewJob]);

  // Auto-open job if specified in URL query params (?jobId=...)
  useEffect(() => {
    const jobIdParam = searchParams.get('jobId');
    if (jobIdParam && (!inspectingJob || inspectingJob.id !== jobIdParam)) {
      const target =
        classifiedOpportunities.find((j) => j.id === jobIdParam) ||
        classifiedSavedJobs.find((j) => j.id === jobIdParam);
      if (target) {
        handleOpenJob(target);
      }
    }
  }, [searchParams, classifiedOpportunities, classifiedSavedJobs, inspectingJob, handleOpenJob]);

  // Keyboard navigation & triage shortcuts: J, K, V, S, R, A, X, D/?
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        inspectingJob !== null ||
        isImportModalOpen ||
        isSourceRegistryOpen ||
        activeDropdown !== null ||
        isLocationModalOpen ||
        isCareerProfileModalOpen ||
        isDiagnosticsOpen
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const currentList = paginatedOpportunities;
      if (currentList.length === 0) return;

      if (key === 'j') {
        e.preventDefault();
        setSelectedKeyboardIndex((prev) => Math.min(currentList.length - 1, prev + 1));
      } else if (key === 'k') {
        e.preventDefault();
        setSelectedKeyboardIndex((prev) => Math.max(0, prev - 1));
      } else if (key === 'v') {
        e.preventDefault();
        const cur = currentList[selectedKeyboardIndex];
        if (cur) handleOpenJob(cur);
      } else if (key === 's') {
        e.preventDefault();
        const cur = currentList[selectedKeyboardIndex];
        if (cur) handleSave(cur.id);
      } else if (key === 'r') {
        e.preventDefault();
        const cur = currentList[selectedKeyboardIndex];
        if (cur) handleReject(cur.id);
      } else if (key === 'a') {
        e.preventDefault();
        const cur = currentList[selectedKeyboardIndex];
        if (cur) {
          const url = cur.applyUrl || cur.jobUrl;
          if (url && url.startsWith('http')) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          handleApply(cur.id);
        }
      } else if (key === 'x') {
        e.preventDefault();
        const cur = currentList[selectedKeyboardIndex];
        if (cur) skipJob(cur.id);
      } else if (key === 'd' || key === '?') {
        e.preventDefault();
        setIsDiagnosticsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    paginatedOpportunities,
    selectedKeyboardIndex,
    inspectingJob,
    isImportModalOpen,
    isSourceRegistryOpen,
    activeDropdown,
    isLocationModalOpen,
    isCareerProfileModalOpen,
    isDiagnosticsOpen,
    handleOpenJob,
    handleSave,
    handleReject,
    handleApply,
    skipJob,
  ]);

  const handleDebugJob = useCallback((targetJob: JobOpportunity & { match?: JobMatchAnalysis }) => {
    setDebugJob(targetJob);
  }, []);

  const handleSaveLocationPreferences = (
    newLocations: string[],
    newWorkplaceTypes: ('remote' | 'hybrid' | 'on-site')[]
  ) => {
    const updatedProfile = {
      ...profile,
      workPreferences: {
        ...profile.workPreferences,
        targetLocations: newLocations,
        workplaceTypes: newWorkplaceTypes,
      },
      lastUpdated: new Date().toISOString(),
    };
    saveFullProfile(updatedProfile);
    try {
      localStorage.setItem('careeros_target_locations', JSON.stringify(newLocations));
      localStorage.setItem('careeros_workplace_types', JSON.stringify(newWorkplaceTypes));
    } catch {}
    setFilters((p) => ({
      ...p,
      locations: newLocations,
    }));
    setActionNotice(
      `Updated target markets: ${newLocations.join(', ')}. Feed refreshed.`
    );
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSaveCareerProfile = (updatedProfile: UserProfile) => {
    saveFullProfile(updatedProfile);
    setActionNotice(
      `Career profile updated for ${updatedProfile.personalInfo.headline || updatedProfile.rolePreferences.targetPrimaryTitle}. Recommendations refreshed.`
    );
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-3 pb-12 w-full animate-fadeIn min-w-0">
      {/* 1. Header (Compact SaaS Layout: Title + Unified Statistics Strip + Actions) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-100 pb-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Job Feed
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Opportunities matched to your profile
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Unified Compact Statistics Strip */}
          <div className="bg-white border border-gray-200 rounded-xl px-2.5 py-1 flex items-center divide-x divide-gray-100 shadow-3xs">
            <div
              onClick={() => { setActiveSection('all'); resetFilters(); }}
              className="px-2 text-center cursor-pointer hover:opacity-80 transition-opacity"
              title="Total authentic opportunities discovered across sources"
            >
              <div className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
                {databaseTabCounts.all.toLocaleString()}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Discovered</div>
            </div>

            <div
              onClick={() => { setActiveSection('all'); resetFilters(); }}
              className="px-2 text-center cursor-pointer hover:opacity-80 transition-opacity"
              title="Qualified jobs matched to your career profile"
            >
              <div className="text-xs sm:text-sm font-bold text-blue-700 leading-tight">
                {classifiedOpportunities.length.toLocaleString()}
              </div>
              <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Qualified</div>
            </div>

            <div
              className="px-2 text-center"
              title="Jobs currently matching your active filters"
            >
              <div className="text-xs sm:text-sm font-bold text-teal-700 leading-tight">
                {filteredOpportunities.length.toLocaleString()}
              </div>
              <div className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider">Displayed</div>
            </div>

            <div
              onClick={() => setActiveSection('new')}
              className="px-2 text-center cursor-pointer hover:opacity-80 transition-opacity"
              title="New unread opportunities today"
            >
              <div className="text-xs sm:text-sm font-bold text-emerald-700 leading-tight">
                {databaseTabCounts.newCount.toLocaleString()}
              </div>
              <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">New Today</div>
            </div>

            <div
              onClick={() => setActiveSection('high_priority')}
              className="px-2 text-center cursor-pointer hover:opacity-80 transition-opacity"
              title="High Match opportunities (≥85% score)"
            >
              <div className="text-xs sm:text-sm font-bold text-amber-700 leading-tight">
                {highMatchCount.toLocaleString()}
              </div>
              <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">High Match</div>
            </div>

            <div
              onClick={() => setActiveSection('target_companies')}
              className="px-2 text-center cursor-pointer hover:opacity-80 transition-opacity"
              title="Opportunities at your target companies"
            >
              <div className="text-xs sm:text-sm font-bold text-purple-700 leading-tight">
                {databaseTabCounts.targetCompanies.toLocaleString()}
              </div>
              <div className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">Targets</div>
            </div>
          </div>

          {/* Action Buttons: Diagnostics, Import, Sources, Add Source, Discover Jobs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsDiagnosticsOpen(true)}
              className="h-8 px-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
              title="System Diagnostics & Funnels"
            >
              <Activity className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden xl:inline">Diagnostics</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="h-8 px-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
              title="Import Job by URL"
            >
              <Plus className="h-3.5 w-3.5 text-gray-500" />
              <span className="hidden xl:inline">Import</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSourceDrawerFilter('all');
                setIsSourceRegistryOpen(true);
              }}
              className="h-8 px-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
              title="Manage discovery sources"
            >
              <Globe2 className="h-3.5 w-3.5 text-gray-500" />
              <span className="hidden xl:inline">Sources</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddSourceModalOpen(true)}
              className="h-8 px-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
              title="Add new job source"
            >
              <Plus className="h-3.5 w-3.5 text-blue-600" />
              <span>Add Source</span>
            </button>

            {/* Exactly 4 Discovery States: DISCOVER, DISCOVERING, PAUSED, ERROR */}
            {(() => {
              const currentState = isScanning
                ? 'DISCOVERING'
                : continuousDiscoveryState === 'PAUSED'
                ? 'PAUSED'
                : continuousDiscoveryState === 'ERROR' || discoveryError
                ? 'ERROR'
                : 'DISCOVER';

              if (currentState === 'DISCOVERING') {
                return (
                  <button
                    type="button"
                    onClick={pauseContinuousDiscovery}
                    className="h-8 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer ring-2 ring-blue-300 ring-offset-1"
                    title="Continuous discovery running. Click to pause."
                  >
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Discovering...</span>
                  </button>
                );
              }

              if (currentState === 'PAUSED') {
                return (
                  <button
                    type="button"
                    onClick={() => resumeContinuousDiscovery()}
                    className="h-8 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
                    title="Continuous discovery paused. Click to resume."
                  >
                    <Pause className="h-3.5 w-3.5 text-amber-600 fill-amber-200" />
                    <span>Paused</span>
                  </button>
                );
              }

              if (currentState === 'ERROR') {
                return (
                  <button
                    type="button"
                    onClick={() => resumeContinuousDiscovery()}
                    className="h-8 px-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-300 text-red-800 text-xs font-semibold transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
                    title={continuousDiscoveryError || discoveryError || 'Discovery encountered an issue. Click to retry.'}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    <span>Retry</span>
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  onClick={toggleContinuousDiscovery}
                  className="h-8 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
                  title="Start live continuous discovery across prioritized sources"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Discover Jobs</span>
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 2. One-Row Compact Filter Toolbar (Reference UI) */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
          <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search jobs, companies, skills, or keywords..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-8 pl-8 pr-7 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-3xs transition-all"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              title="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Role Dropdown */}
        <MultiSelectDropdown
          label="Role"
          placeholder="Filter roles..."
          options={roleOptions}
          selectedValues={filters.roles || []}
          onChange={(values) => setFilters((p) => ({ ...p, roles: values }))}
          isOpen={activeDropdown === 'role'}
          onToggle={() => setActiveDropdown((curr) => (curr === 'role' ? null : 'role'))}
          onClose={() => setActiveDropdown(null)}
        />

        {/* Location Dropdown */}
        <MultiSelectDropdown
          label="Location"
          placeholder="Filter locations..."
          options={locationOptions}
          selectedValues={filters.locations || []}
          onChange={(values) => setFilters((p) => ({ ...p, locations: values }))}
          isOpen={activeDropdown === 'location'}
          onToggle={() => setActiveDropdown((curr) => (curr === 'location' ? null : 'location'))}
          onClose={() => setActiveDropdown(null)}
        />

        {/* Experience Dropdown */}
        <MultiSelectDropdown
          label="Experience"
          placeholder="Filter experience..."
          options={seniorityOptions}
          selectedValues={filters.seniorities || []}
          onChange={(values) => setFilters((p) => ({ ...p, seniorities: values }))}
          isOpen={activeDropdown === 'seniority'}
          onToggle={() => setActiveDropdown((curr) => (curr === 'seniority' ? null : 'seniority'))}
          onClose={() => setActiveDropdown(null)}
        />

        {/* Job Type Dropdown */}
        <MultiSelectDropdown
          label="Job Type"
          placeholder="Filter job type..."
          options={employmentTypeOptions}
          selectedValues={filters.employmentTypes || []}
          onChange={(values) => setFilters((p) => ({ ...p, employmentTypes: values }))}
          isOpen={activeDropdown === 'type'}
          onToggle={() => setActiveDropdown((curr) => (curr === 'type' ? null : 'type'))}
          onClose={() => setActiveDropdown(null)}
        />

        {/* Workplace Dropdown */}
        <MultiSelectDropdown
          label="Workplace"
          placeholder="Filter workplace..."
          options={remoteOptions}
          selectedValues={filters.remoteStatuses || []}
          onChange={(values) => setFilters((p) => ({ ...p, remoteStatuses: values }))}
          isOpen={activeDropdown === 'remote'}
          onToggle={() => setActiveDropdown((curr) => (curr === 'remote' ? null : 'remote'))}
          onClose={() => setActiveDropdown(null)}
        />

        {/* Salary Dropdown */}
        <MultiSelectDropdown
          label="Salary"
          placeholder="Filter salary..."
          options={salaryOptions}
          selectedValues={filters.salaryRanges || []}
          onChange={handleSalaryChange}
          isOpen={activeDropdown === 'salary'}
          onToggle={() => setActiveDropdown((curr) => (curr === 'salary' ? null : 'salary'))}
          onClose={() => setActiveDropdown(null)}
        />

        {/* More Filters Button */}
        <button
          type="button"
          onClick={() => setIsMoreFiltersOpen(true)}
          className={`h-8 px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-3xs shrink-0 ${
            activeFilterCount > 0
              ? 'border-blue-300 bg-blue-50 text-blue-700 font-semibold'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
          title="Open complete filter drawer"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>More Filters</span>
          {activeFilterCount > 0 && (
            <span className="h-4 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Sort Dropdown */}
        <div className="relative inline-flex items-center h-8 shrink-0">
          <select
            value={filters.sortBy}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                sortBy: e.target.value as JobFilterCriteria['sortBy'],
              }))
            }
            className="h-8 pl-2.5 pr-7 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-3xs appearance-none leading-none"
          >
            <option value="best_match">Sort: Best Match</option>
            <option value="newest">Sort: Newest</option>
            <option value="recently_updated">Sort: Recently Updated</option>
            <option value="highest_match">Sort: Highest Match</option>
            <option value="salary_high_low">Sort: Salary (High → Low)</option>
            <option value="salary_low_high">Sort: Salary (Low → High)</option>
            <option value="target_companies">Sort: Target Companies</option>
            <option value="closing_soon">Sort: Closing Soon</option>
          </select>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 3. Category Tabs + Profile Matching Toggle + Freshness (Single Compact Row) */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: 'All Jobs', count: databaseTabCounts.all },
            { id: 'new', label: 'New', count: databaseTabCounts.newCount },
            { id: 'high_priority', label: 'High Match', count: highMatchCount },
            { id: 'saved', label: 'Saved', count: databaseTabCounts.saved },
            { id: 'applied', label: 'Applied', count: databaseViewCounts.applied },
            { id: 'news', label: 'Market Intelligence' },
          ].map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as InboxSection)}
                className={`h-7 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 leading-none ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-3xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive
                        ? 'bg-blue-700/80 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right side: Profile matching toggle & Updated time */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {/* Profile matching toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Profile matching</span>
            <button
              type="button"
              role="switch"
              aria-checked={isProfileMatchingEnabled}
              onClick={() => setIsProfileMatchingEnabled((prev) => !prev)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-3xs ${
                isProfileMatchingEnabled ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              title="Toggle profile-based relevance matching"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  isProfileMatchingEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="h-3.5 w-px bg-gray-200 hidden sm:block" />

          {/* Freshness Indicator / Live Discovery Telemetry */}
          {isScanning ? (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
              <RefreshCw className="h-3 w-3 animate-spin text-blue-600" />
              <span>Scanning live sources...</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 text-xs text-gray-500 cursor-help"
              title={
                sourcesActuallyRan.length > 0
                  ? `Last attempt: ${lastAttemptAt ? lastAttemptAt.toLocaleString() : 'N/A'}\nLast success: ${lastSuccessAt ? lastSuccessAt.toLocaleString() : 'N/A'}\nSources executed (${sourcesActuallyRan.length}):\n${sourcesActuallyRan
                      .slice(0, 10)
                      .map((s: any) => `• ${s.sourceName || s.sourceId}: ${s.status} (${s.jobsDiscovered || 0} jobs)`)
                      .join('\n')}${sourcesActuallyRan.length > 10 ? '\n...and more' : ''}`
                  : undefined
              }
            >
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span>
                {lastAttemptAt && lastSuccessAt && Math.abs(lastAttemptAt.getTime() - lastSuccessAt.getTime()) > 60000 ? (
                  <>
                    Checked {formatLastUpdated(lastAttemptAt)} (Success {formatLastUpdated(lastSuccessAt)})
                  </>
                ) : (
                  <>Updated {formatLastUpdated(lastSuccessAt || lastAttemptAt || lastUpdated)}</>
                )}
                {sourcesActuallyRan.length > 0 && (
                  <span className="ml-1 text-[11px] text-gray-400">
                    ({sourcesActuallyRan.length} sources ran)
                  </span>
                )}
              </span>
            </div>
          )}

          {rejectedJobs.length > 0 && (
            <>
              <div className="h-3.5 w-px bg-gray-200" />
              <button
                type="button"
                onClick={() => setIsRejectedDrawerOpen(true)}
                className="text-xs text-gray-500 hover:text-gray-800 underline inline-flex items-center gap-1 leading-none cursor-pointer"
                title="View or restore hidden opportunities"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Hidden ({rejectedJobs.length})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Discovery Finished Brief Notice */}
      {!isScanning &&
        lastDiscoveryRun &&
        (lastDiscoveryRun.newJobsAdded ?? 0) > 0 &&
        lastDiscoveryRun.id !== dismissedRunId && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between gap-3 animate-fadeIn flex-wrap shadow-3xs">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong>{lastDiscoveryRun.newJobsAdded}</strong> new relevant opportunities found from{' '}
                {lastDiscoveryRun.sourcesQueriedCount ?? lastDiscoveryRun.queriedSourceCount ?? 0} prioritized sources.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  applyPendingNewJobs();
                  setActiveSection('all');
                  resetFilters();
                  setCurrentPage(1);
                  setDismissedRunId(lastDiscoveryRun.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wide transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                title="Publish and view all newly discovered jobs"
              >
                <span>SHOW NEW JOBS</span>
                <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={() => setDismissedRunId(lastDiscoveryRun.id)}
                className="text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer text-[11px] px-1.5 py-1"
                title="Dismiss banner"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium flex items-center justify-between animate-fadeIn">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-blue-600 hover:text-blue-800 underline cursor-pointer text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Discovery Error Banner */}
      {discoveryError && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span>Discovery warning: {discoveryError}. Existing discovered jobs remain safe and available.</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => runDiscovery()}>
            Retry
          </Button>
        </div>
      )}

      {/* Pending New Opportunities Notification Banner (Sticky "Show New Jobs") */}
      {pendingNewJobsCount > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between gap-3 text-xs animate-fadeIn sticky top-16 z-20 mb-3 border border-blue-500/30">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-200 shrink-0 animate-pulse" />
            <span className="font-semibold text-white">
              {pendingNewJobsCount} new matching {pendingNewJobsCount === 1 ? 'job' : 'jobs'} available
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              applyPendingNewJobs();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-wide transition-colors cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5"
          >
            <span>SHOW NEW JOBS</span>
            <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Active Removable Chips Bar (Only rendered when filters are active) */}
      {activeFilterChips.length > 0 && (
        <FilterChipsBar chips={activeFilterChips} onClearAll={resetFilters} />
      )}

      {/* 5. Opportunity Count & View Switcher Row */}
      {activeSection !== 'news' && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-gray-500">
            {filteredOpportunities.length === 0 ? (
              <span>
                Showing <strong className="text-sm font-bold text-gray-900">0</strong> matching opportunities
              </span>
            ) : (
              <span>
                Showing{' '}
                <strong className="text-sm font-bold text-gray-900">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredOpportunities.length)}
                </strong>{' '}
                of{' '}
                <strong className="text-sm font-bold text-gray-900">
                  {filteredOpportunities.length.toLocaleString()}
                </strong>{' '}
                matching {filteredOpportunities.length === 1 ? 'opportunity' : 'opportunities'}
              </span>
            )}
            {databaseTabCounts.all > filteredOpportunities.length && (
              <span className="text-gray-400 ml-1">
                (of {databaseTabCounts.all.toLocaleString()} in database)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Show:</span>
            <div className="relative">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'grid' | 'list')}
                className="h-7 pl-2.5 pr-6 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-gray-300 focus:outline-none cursor-pointer appearance-none shadow-3xs"
              >
                <option value="grid">Card View</option>
                <option value="list">List View</option>
              </select>
              <ChevronDown className="h-3 w-3 text-gray-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>

            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-blue-600 shadow-3xs' : 'text-gray-400 hover:text-gray-700'
                }`}
                title="Card View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-blue-600 shadow-3xs' : 'text-gray-400 hover:text-gray-700'
                }`}
                title="List View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Content Rendering */}
      {activeSection === 'news' ? (
        <MarketIntelligenceView careerModel={careerModel} />
      ) : (
        <div className="space-y-4">
          {/* Expanded 14-Day Window Banner */}
          {feedAgeDays > 7 && filteredOpportunities.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Showing jobs from the last {feedAgeDays} days (expanded window)</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedAgeDays(7)}
                className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
              >
                Reset to 7 days
              </button>
            </div>
          )}

          {filteredOpportunities.length === 0 ? (
            /* Truth-First Empty State (Section 31 & Mandate 10) */
            <div className="p-8 sm:p-12 rounded-2xl bg-white border border-dashed border-gray-200 text-center space-y-6 shadow-3xs max-w-2xl mx-auto">
              <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto shadow-3xs">
                <Briefcase className="h-6 w-6" />
              </div>

              <div className="space-y-2">
                <Typography as="h3" variant="h3" color="primary" className="font-bold text-gray-900">
                  {activeSection === 'saved'
                    ? 'No Saved Opportunities Yet'
                    : activeFilterChips.length > 0
                    ? 'No jobs match your current filter combination'
                    : 'No matching jobs found in active window'}
                </Typography>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  {activeSection === 'saved'
                    ? 'Click "Save" on any verified job card to curate roles here for pipeline tracking and resume tailoring.'
                    : activeFilterChips.length > 0
                    ? `Active combination: ${activeFilterChips.map((c) => `${c.category}: "${c.label}"`).join(' + ')}. Try clearing one or more filters below to broaden results.`
                    : `CareerOS strictly limits the active stream to the past ${feedAgeDays} days (${searchConfig.primaryRoles.slice(0, 2).join(', ')} in ${searchConfig.locations[0] || 'Target Markets'}).`}
                </p>
              </div>

              {/* Section 31: Transparent Pipeline Telemetry Breakdown */}
              {activeSection !== 'saved' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/80 p-4 rounded-xl border border-gray-200 text-left">
                  <div className="p-2">
                    <span className="text-[11px] font-medium text-gray-500 block">Sources Checked</span>
                    <span className="text-base font-bold text-gray-900">
                      {sources.filter((s) => Boolean(s.lastCheckedAt || s.sourceHealth === 'healthy')).length || sources.length}
                    </span>
                  </div>
                  <div className="p-2">
                    <span className="text-[11px] font-medium text-gray-500 block">Jobs Discovered</span>
                    <span className="text-base font-bold text-gray-900">
                      {databaseTabCounts.all || jobRepository.getDatabaseOpportunities().length}
                    </span>
                  </div>
                  <div className="p-2">
                    <span className="text-[11px] font-medium text-gray-500 block">Rejected (Irrelevant)</span>
                    <span className="text-base font-bold text-amber-700">
                      {classifiedRejectedJobs.length}
                    </span>
                  </div>
                  <div className="p-2">
                    <span className="text-[11px] font-medium text-gray-500 block">Active Matching Jobs</span>
                    <span className="text-base font-bold text-blue-700">
                      0
                    </span>
                  </div>
                </div>
              )}

              {/* Section 31: 5 Actionable Remedy Buttons */}
              <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
                {activeSection === 'saved' ? (
                  <Button variant="primary" onClick={() => setActiveSection('all')}>
                    Browse All Matches
                  </Button>
                ) : (
                  <>
                    {feedAgeDays <= 7 ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setFeedAgeDays(14)}
                        leftIcon={<Clock className="h-3.5 w-3.5" />}
                      >
                        Expand to 14 days
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setFeedAgeDays(7)}
                        leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                      >
                        Reset to 7 days
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCareerProfileModalOpen(true)}
                      leftIcon={<Target className="h-3.5 w-3.5" />}
                    >
                      Broaden role criteria
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCareerProfileModalOpen(true)}
                      leftIcon={<Briefcase className="h-3.5 w-3.5" />}
                    >
                      Edit Search Configuration
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsRejectedDrawerOpen(true)}
                    >
                      View rejected matches ({classifiedRejectedJobs.length})
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              {paginatedOpportunities.map((job) => {
                const applyTargetUrl = jobVerificationEngine.sanitizeApplyUrl(job.applyUrl || job.jobUrl);
                const hasValidApplyUrl = Boolean(applyTargetUrl && applyTargetUrl !== '#' && applyTargetUrl.startsWith('http'));
                const isApplyUrlValid =
                  hasValidApplyUrl &&
                  jobVerificationEngine.verifyJobUrl(applyTargetUrl).isValid &&
                  job.isApplyUrlValidated !== false &&
                  job.verificationStatus !== 'failed';
                const isJobSaved = savedJobs.some((s) => s.id === job.id);

                return (
                  <div
                    key={job.id}
                    className="p-4 hover:bg-gray-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <CompanyLogo
                        company={job.company}
                        domain={job.companyDomain}
                        logoUrl={job.companyLogo}
                        logoData={job.companyLogoData}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {((job.is_new || job.isNew) && !job.viewed_at && !job.viewedAt) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 tracking-wider uppercase shrink-0 shadow-3xs">
                              NEW
                            </span>
                          )}
                          <span
                            onClick={() => handleOpenJob(job)}
                            className="font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer text-sm"
                          >
                            {job.title}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWhyMatchesJob(job);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all hover:scale-105 cursor-pointer shadow-3xs ${
                              job.match.overallScore >= HIGH_MATCH_THRESHOLD
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                            }`}
                            title="Click to view why this matches your profile"
                          >
                            <Sparkles className="h-2.5 w-2.5 opacity-70" />
                            <span>{job.match.overallScore}% Match</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                          <span className="font-semibold text-gray-800">{job.company}</span>
                          <span className="text-gray-300">•</span>
                          <span>{job.location || 'Location not disclosed'}</span>
                          <span className="text-gray-300">•</span>
                          <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.2 rounded text-[10.5px] font-medium">
                            {job.workFromAnywhere || job.remoteStatus === 'remote' ? 'Remote' : job.remoteStatus === 'hybrid' ? 'Hybrid' : 'On-site'}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span>{job.salary.disclosed && job.salary.rawText ? `${job.salary.rawText} · Employer stated` : 'Salary not disclosed'}</span>
                          <span className="text-gray-300">•</span>
                          {(job.isVerifiedLive && (job.verificationStatus === 'LIVE_VERIFIED' || job.verificationStatus === 'verified_live')) ? (
                            <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                              ✓ Verified Live
                            </span>
                          ) : (
                            <span className="text-gray-400 font-medium">Discovered</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSave(job.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          isJobSaved
                            ? 'border-blue-200 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {isJobSaved ? 'Saved' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenJob(job)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        View
                      </button>
                      {isApplyUrlValid ? (
                        <a
                          href={applyTargetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleApply(job.id)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                        >
                          <span>Apply</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                        >
                          Unavailable
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Virtualized Opportunities Grid: 3 columns on desktop, 2 on medium, 1 on mobile */
            <div
              ref={gridContainerRef}
              className="relative w-full min-w-0"
              style={{
                height: `${Math.max(300, rowVirtualizer.totalSize)}px`,
              }}
            >
              {rowVirtualizer.virtualItems.map((virtualRow) => {
                const startIndex = virtualRow.index * gridColumns;
                const rowJobs = filteredOpportunities.slice(startIndex, startIndex + gridColumns);
                return (
                  <div
                    key={virtualRow.index}
                    className={`absolute top-0 left-0 w-full grid gap-4 ${
                      gridColumns === 1
                        ? 'grid-cols-1'
                        : gridColumns === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-3'
                    }`}
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                    }}
                  >
                    {rowJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        isSaved={savedJobs.some((s) => s.id === job.id)}
                        onSave={handleSave}
                        onReject={handleReject}
                        onApply={handleApply}
                        onOpen={handleOpenJob}
                        onWhyMatches={(j) => setWhyMatchesJob(j)}
                        onInspectDebug={handleDebugJob}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Toolbar (for list view) */}
          {viewMode === 'list' && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200/80 pt-4 px-1 mt-4">
              <span className="text-xs text-gray-500">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredOpportunities.length)} of{' '}
                {filteredOpportunities.length.toLocaleString()} matching opportunities
                {databaseTabCounts.all > filteredOpportunities.length && (
                  <span className="text-gray-400 ml-1">
                    (of {databaseTabCounts.all.toLocaleString()} in database)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed shadow-3xs"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && p - prev > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span className="text-xs text-gray-400 px-1">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                              currentPage === p
                                ? 'bg-blue-600 text-white shadow-3xs'
                                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed shadow-3xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Deep Job Detail Inspection Drawer */}
      <JobDetailDrawer
        job={inspectingJob}
        isOpen={Boolean(inspectingJob)}
        isSaved={Boolean(inspectingJob && savedJobs.some((s) => s.id === inspectingJob.id))}
        onClose={() => {
          setInspectingJob(null);
          if (searchParams.get('jobId')) {
            const next = new URLSearchParams(searchParams);
            next.delete('jobId');
            setSearchParams(next, { replace: true });
          }
        }}
        onSave={handleSave}
        onReject={handleReject}
        onApply={handleApply}
        onView={viewJob}
        onInspectDebug={(targetJob) => setDebugJob(targetJob)}
      />

      {/* 7. Internal Verification & Truth Engine Audit Drawer (Directive 37) */}
      <JobDebugDrawer
        job={debugJob}
        isOpen={Boolean(debugJob)}
        onClose={() => setDebugJob(null)}
      />

      {/* 8. Direct Job URL / Text Ingestion Modal */}
      <JobImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(params) => {
          const imported = importJob(params);
          setActionNotice(`Imported "${imported.title}" at ${imported.company} into your feed.`);
          setTimeout(() => setActionNotice(null), 3500);
          return imported;
        }}
      />

      {/* 9. Verified Source Ecosystem Drawer */}
      <SourceRegistryDrawer
        isOpen={isSourceRegistryOpen}
        onClose={() => setIsSourceRegistryOpen(false)}
        sources={sources}
        onToggleSource={toggleSource}
        onStartDiscovery={runDiscovery}
        initialFilterTab={sourceDrawerFilter}
      />

      {/* 10. Restoration Drawer for Rejected Jobs */}
      <Drawer
        isOpen={isRejectedDrawerOpen}
        onClose={() => setIsRejectedDrawerOpen(false)}
        placement="right"
        width="max-w-xl w-full"
        title="Hidden & Deprioritized Jobs"
        description="Opportunities you previously hid. You can restore any role to return it to your active discovery stream."
      >
        <div className="space-y-4 pb-6">
          {classifiedRejectedJobs.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-body-sm">
              No hidden opportunities.
            </div>
          ) : (
            classifiedRejectedJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between gap-3 hover:border-border-strong transition-colors"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-text-primary text-body-sm block truncate">
                    {job.title}
                  </span>
                  <span className="text-caption text-text-muted block truncate">
                    {job.company} · {job.location}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(job.id)}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  className="text-caption shrink-0"
                >
                  Restore
                </Button>
              </div>
            ))
          )}
        </div>
      </Drawer>

      {/* 11. Location Market Control Modal */}
      <LocationControlModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        targetLocations={profile.workPreferences.targetLocations || ['India', 'Remote Worldwide / Work From Anywhere']}
        workplaceTypes={profile.workPreferences.workplaceTypes}
        homeCountry={homeCountry}
        allOpportunities={opportunities}
        onSave={handleSaveLocationPreferences}
      />

      {/* 12. Complete Interactive Career Profile Modal */}
      <CareerProfileModal
        isOpen={isCareerProfileModalOpen}
        onClose={() => setIsCareerProfileModalOpen(false)}
        profile={profile}
        onSave={handleSaveCareerProfile}
      />

      {/* 13. Add Source Modal (5 Options: URL, ATS, Job Board, RSS, Import) */}
      <AddSourceModal
        isOpen={isAddSourceModalOpen}
        onClose={() => setIsAddSourceModalOpen(false)}
        onSourceAdded={() => refresh()}
      />

      {/* 14. System Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={handleCloseDiagnostics}
      />

      {/* 15. More Filters Modal (2-Column Responsive Grouped Sections) */}
      <Modal
        isOpen={isMoreFiltersOpen}
        onClose={() => setIsMoreFiltersOpen(false)}
        title="Complete Filter Criteria"
        size="xl"
      >
        <div className="space-y-6 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Role, Seniority, Company, & Employment Type */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                Role & Organization
              </h4>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Target Roles</label>
                <MultiSelectDropdown
                  label="Role"
                  placeholder="Search roles..."
                  options={roleOptions}
                  selectedValues={filters.roles || []}
                  onChange={(values) => setFilters((p) => ({ ...p, roles: values }))}
                  isOpen={activeDropdown === 'role'}
                  onToggle={() => setActiveDropdown((curr) => (curr === 'role' ? null : 'role'))}
                  onClose={() => setActiveDropdown(null)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Seniority Level</label>
                <MultiSelectDropdown
                  label="Seniority"
                  placeholder="Filter seniority..."
                  options={seniorityOptions}
                  selectedValues={filters.seniorities || []}
                  onChange={(values) => setFilters((p) => ({ ...p, seniorities: values }))}
                  isOpen={activeDropdown === 'seniority'}
                  onToggle={() => setActiveDropdown((curr) => (curr === 'seniority' ? null : 'seniority'))}
                  onClose={() => setActiveDropdown(null)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Specific Companies</label>
                <MultiSelectDropdown
                  label="Company"
                  placeholder="Search companies..."
                  options={companyOptions}
                  selectedValues={filters.companies || []}
                  onChange={(values) => setFilters((p) => ({ ...p, companies: values }))}
                  isOpen={activeDropdown === 'company'}
                  onToggle={() => setActiveDropdown((curr) => (curr === 'company' ? null : 'company'))}
                  onClose={() => setActiveDropdown(null)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Employment Type</label>
                <MultiSelectDropdown
                  label="Type"
                  placeholder="Filter by type..."
                  options={employmentTypeOptions}
                  selectedValues={filters.employmentTypes || []}
                  onChange={(values) => setFilters((p) => ({ ...p, employmentTypes: values }))}
                  isOpen={activeDropdown === 'type'}
                  onToggle={() => setActiveDropdown((curr) => (curr === 'type' ? null : 'type'))}
                  onClose={() => setActiveDropdown(null)}
                />
              </div>
            </div>

            {/* Column 2: Location, Remote, Policy & Truth Toggles */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-blue-600" />
                Geography, Workplace & Verification
              </h4>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Locations & Markets (Semantic OR)</label>
                <MultiSelectDropdown
                  label="Location"
                  placeholder="Filter locations..."
                  options={locationOptions}
                  selectedValues={filters.locations || []}
                  onChange={(values) => setFilters((p) => ({ ...p, locations: values }))}
                  isOpen={activeDropdown === 'location'}
                  onToggle={() => setActiveDropdown((curr) => (curr === 'location' ? null : 'location'))}
                  onClose={() => setActiveDropdown(null)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Workplace & Remote Arrangement</label>
                <MultiSelectDropdown
                  label="Remote"
                  placeholder="Filter remote..."
                  options={remoteOptions}
                  selectedValues={filters.remoteStatuses || []}
                  onChange={(values) => setFilters((p) => ({ ...p, remoteStatuses: values }))}
                  isOpen={activeDropdown === 'remote'}
                  onToggle={() => setActiveDropdown((curr) => (curr === 'remote' ? null : 'remote'))}
                  onClose={() => setActiveDropdown(null)}
                />
              </div>

              <div className="pt-2">
                <label className="text-xs font-semibold text-gray-700 block mb-2">Quality & Truth Constraints</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={filters.salaryDisclosedOnly}
                      onChange={(e) => setFilters((p) => ({ ...p, salaryDisclosedOnly: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold text-gray-900 block">Employer-Stated Salary Only</span>
                      <span className="text-[11px] text-gray-500">Only show jobs with confirmed, transparent compensation figures.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={filters.targetCompanyOnly}
                      onChange={(e) => setFilters((p) => ({ ...p, targetCompanyOnly: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold text-gray-900 block">Target Companies Only</span>
                      <span className="text-[11px] text-gray-500">Strictly restrict feed to your target company watchlist.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={filters.verifiedOnly}
                      onChange={(e) => setFilters((p) => ({ ...p, verifiedOnly: e.target.checked }))}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold text-gray-900 block">Verified Live Only</span>
                      <span className="text-[11px] text-gray-500">Confirmed active listing directly on employer career portal.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters((p) => ({
                  ...p,
                  roles: [],
                  locations: [],
                  remoteStatuses: [],
                  seniorities: [],
                  companies: [],
                  employmentTypes: [],
                  salaryDisclosedOnly: false,
                  targetCompanyOnly: false,
                  verifiedOnly: false,
                }));
              }}
            >
              Reset All Filters
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMoreFiltersOpen(false)}
              >
                Apply for Session
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const updatedLocations = filters.locations && filters.locations.length > 0
                    ? filters.locations
                    : profile.workPreferences?.targetLocations || [];

                  const updatedWorkplace = (filters.remoteStatuses && filters.remoteStatuses.length > 0)
                    ? filters.remoteStatuses.map((s) => s.replace('_remote', '').replace('restricted_remote', 'remote') as 'remote' | 'hybrid' | 'on-site')
                    : profile.workPreferences?.workplaceTypes || [];

                  const updatedProfile: UserProfile = {
                    ...profile,
                    rolePreferences: {
                      ...profile.rolePreferences,
                      targetPrimaryTitle: (filters.roles && filters.roles.length > 0) ? filters.roles[0] : profile.rolePreferences?.targetPrimaryTitle,
                      targetJobTitles: (filters.roles && filters.roles.length > 0) ? filters.roles : profile.rolePreferences?.targetJobTitles || [],
                    },
                    workPreferences: {
                      ...profile.workPreferences,
                      targetLocations: updatedLocations,
                      workplaceTypes: updatedWorkplace.length > 0 ? updatedWorkplace : ['remote'],
                    },
                    lastUpdated: new Date().toISOString(),
                  };

                  saveFullProfile(updatedProfile);
                  try {
                    localStorage.setItem('careeros_target_locations', JSON.stringify(updatedLocations));
                    localStorage.setItem('careeros_workplace_types', JSON.stringify(updatedWorkplace));
                  } catch {}

                  setActionNotice('Filters applied and permanently saved to your Career Profile. Search intent refreshed.');
                  setTimeout(() => setActionNotice(null), 4000);
                  setIsMoreFiltersOpen(false);
                }}
              >
                Apply & Save to Profile
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 16. Explainable Why This Matches Modal */}
      <WhyThisMatchesModal
        isOpen={Boolean(whyMatchesJob)}
        onClose={() => setWhyMatchesJob(null)}
        job={whyMatchesJob}
        onOpenDetails={handleOpenJob}
        onApply={handleApply}
      />
    </div>
  );
};
