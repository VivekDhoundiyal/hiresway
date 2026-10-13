import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProfile } from '@/core/profile';
import {
  JobOpportunity,
  JobMatchAnalysis,
} from '@/core/intelligence';
import { fastJobMatcher } from '@/core/intelligence/fastJobMatcher';
import { matchScoreCache } from '@/core/intelligence/matchScoreCache';
import { targetCompaniesStore } from '@/core/target-companies/targetCompanyStore';
import { jobRepository } from '@/core/jobs/jobRepository';
import { jobVerificationEngine } from '@/core/jobs/jobVerificationEngine';
import { excelImportService } from '@/core/jobs/excelImportService';
import { freshnessEngine } from '@/core/jobs/engines/freshnessEngine';
import {
  JobDatabaseStandardView,
  SavedDatabaseViewRecord,
  CRMJobStatus,
  HIGH_MATCH_THRESHOLD,
  MAX_JOB_AGE_DAYS,
} from '@/core/jobs/types';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge, BadgeVariant } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { AddJobModal } from './components/AddJobModal';
import { ImportJobsModal } from './components/ImportJobsModal';
import { ImportHistoryModal } from './components/ImportHistoryModal';
import { JobInspectDrawer } from './components/JobInspectDrawer';
import { SaveViewModal } from './components/SaveViewModal';
import { DatabaseDiagnosticsModal } from './components/DatabaseDiagnosticsModal';
import {
  Search,
  Building2,
  LayoutList,
  LayoutGrid,
  Plus,
  FileSpreadsheet,
  RefreshCw,
  SlidersHorizontal,
  History,
  Bookmark,
  AlertTriangle,
  X,
  Trash2,
  Archive,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  CheckSquare,
  Square,
  MinusSquare,
  ShieldCheck,
  CheckCircle2,
  MoreHorizontal,
} from 'lucide-react';

const CRM_STATUS_OPTIONS: CRMJobStatus[] = [
  'Interested',
  'Shortlisted',
  'Saved',
  'Viewed',
  'To Apply',
  'Applied',
  'Application Submitted',
  'Assessment',
  'Assignment',
  'Recruiter Screen',
  'HR Interview',
  'Hiring Manager Interview',
  'Technical Interview',
  'Final Interview',
  'Offer',
  'Negotiation',
  'Accepted',
  'Rejected',
  'Withdrawn',
  'On Hold',
  'Closed',
  'Archived',
];

const STANDARD_VIEWS: { id: JobDatabaseStandardView; label: string }[] = [
  { id: 'all', label: 'All Jobs' },
  { id: 'new', label: 'New (7d)' },
  { id: 'high_match', label: 'High Match' },
  { id: 'target_companies', label: 'Target Companies' },
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'archived', label: 'Archived' },
  { id: 'expired', label: 'Expired' },
  { id: 'needs_verification', label: 'Needs Verification' },
];

const SAVED_VIEWS_STORAGE_KEY = 'careeros_database_saved_views';

export const JobDatabasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useProfile();

  // Core Data State
  const [databaseJobs, setDatabaseJobs] = useState<JobOpportunity[]>([]);
  const [activeStandardView, setActiveStandardView] = useState<JobDatabaseStandardView>('all');
  const [savedCustomViews, setSavedCustomViews] = useState<SavedDatabaseViewRecord[]>([]);

  // Search & Filters
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<
    'freshness' | 'verification' | 'match' | 'salary' | 'company' | 'updated'
  >('freshness');

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filterVerification, setFilterVerification] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterWorkplace, setFilterWorkplace] = useState<string>('all');
  const [filterMatchTier, setFilterMatchTier] = useState<string>('all');
  const [filterTargetCompany, setFilterTargetCompany] = useState<string>('all');
  const [filterCompensation, setFilterCompensation] = useState<string>('all');
  const [filterSeniority, setFilterSeniority] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterBatchId, setFilterBatchId] = useState<string | null>(
    searchParams.get('batchId') || null
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Bulk Selection
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [bulkStatusToApply, setBulkStatusToApply] = useState<CRMJobStatus | ''>('');

  // Modals & Drawer State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSaveViewModalOpen, setIsSaveViewModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [inspectingJob, setInspectingJob] = useState<
    (JobOpportunity & { match: JobMatchAnalysis }) | null
  >(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [isVerifyingAction, setIsVerifyingAction] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load Saved Views from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
      if (stored) {
        setSavedCustomViews(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load saved views:', e);
    }
  }, []);

  const loadDatabaseJobs = useCallback(() => {
    setDatabaseJobs(jobRepository.getDatabaseOpportunities());
  }, []);

  useEffect(() => {
    loadDatabaseJobs();
  }, [loadDatabaseJobs]);

  // Synchronize batchId query param
  useEffect(() => {
    const qBatch = searchParams.get('batchId');
    if (qBatch && qBatch !== filterBatchId) {
      setFilterBatchId(qBatch);
      setCurrentPage(1);
    }
  }, [searchParams, filterBatchId]);

  // View Counts for standard tabs
  const viewCounts = useMemo(() => {
    return jobRepository.getDatabaseViewCounts();
  }, [databaseJobs]);

  // Profile Matching (Cached & Non-destructive)
  const rankedJobs = useMemo(() => {
    const profileKey = matchScoreCache.getProfileVersionKey(profile);
    const profileIndex = fastJobMatcher.createProfileIndex(profile);

    return databaseJobs.map((opp) => {
      const isTargetComp = Boolean(
        opp.isTargetCompany ||
        targetCompaniesStore.isTargetCompany(opp.company) ||
        profileIndex.targetCompanies.has((opp.company || '').toLowerCase().trim())
      );

      let match = matchScoreCache.get(opp.id, profileKey, isTargetComp);
      if (!match) {
        const fastResult = fastJobMatcher.fastMatchJob(profileIndex, opp);
        match = {
          overallScore: fastResult.score,
          fitCategory: fastResult.fitCategory,
          titleMatchScore: fastResult.titleScore,
          skillsMatchScore: fastResult.skillsScore,
          experienceMatchScore: fastResult.experienceScore,
          compensationMatchScore: 80,
          workplaceMatchScore: fastResult.workplaceScore,
          strengths: [
            fastResult.titleScore >= 70 ? `Role title alignment (${fastResult.titleScore}%)` : 'Title evaluated',
            fastResult.matchedSkills.length > 0
              ? `Matched skills: ${fastResult.matchedSkills.slice(0, 3).join(', ')}`
              : 'Technical profile evaluated',
          ],
          gaps: fastResult.missingSkills.length > 0
            ? [`Growth areas: ${fastResult.missingSkills.slice(0, 2).join(', ')}`]
            : [],
          recommendations: ['Track pipeline stages and interviewer contacts in CRM.'],
          trajectoryRelevance: 'Saved opportunity in canonical database.',
        };
        matchScoreCache.set(opp.id, profileKey, isTargetComp, match);
      }

      return {
        ...opp,
        isTargetCompany: isTargetComp,
        match,
        match_score: match.overallScore,
        match_reasons: match.strengths,
      };
    });
  }, [profile, databaseJobs]);

  // Filtering based on Active Standard View + Query + Advanced Filters
  const filteredJobs = useMemo(() => {
    const now = new Date();

    return rankedJobs.filter((item) => {
      // 1. Standard View Predicate
      if (activeStandardView !== 'all') {
        const isExpired =
          !freshnessEngine.isJobWithinAgeWindow(item, MAX_JOB_AGE_DAYS, now).eligible ||
          item.feed_status === 'EXPIRED' ||
          item.lifecycleState === 'EXPIRED';
        const isArchived = item.lifecycleState === 'ARCHIVED' || item.crm_status === 'Archived';
        const isRejected = item.lifecycleState === 'REJECTED' || item.crm_status === 'Rejected' || item.crm_status === 'Withdrawn';
        const isApplied = item.lifecycleState === 'APPLIED' || item.crm_status === 'Applied' || item.crm_status === 'Application Submitted';
        const isSaved = item.lifecycleState === 'SAVED' || item.crm_status === 'Saved' || item.crm_status === 'Shortlisted' || item.crm_status === 'Interested';
        const isInterviewing = item.lifecycleState === 'INTERVIEW' || [
          'Assessment',
          'Assignment',
          'Recruiter Screen',
          'HR Interview',
          'Hiring Manager Interview',
          'Technical Interview',
          'Final Interview',
          'Offer',
          'Negotiation',
        ].includes(item.crm_status || '');
        const isHighMatch = (item.match_score || item.match.overallScore || 0) >= HIGH_MATCH_THRESHOLD;
        const isTarget = Boolean(item.isTargetCompany || item.target_company || targetCompaniesStore.isTargetCompany(item.company));
        const needsVerif =
          item.verificationStatus === 'needs_verification' ||
          item.verificationStatus === 'unverified' ||
          item.verificationStatus === 'imported_needs_verification';

        switch (activeStandardView) {
          case 'new':
            if (isExpired || isArchived || isRejected) return false;
            break;
          case 'high_match':
            if (!isHighMatch) return false;
            break;
          case 'target_companies':
            if (!isTarget) return false;
            break;
          case 'saved':
            if (!isSaved) return false;
            break;
          case 'applied':
            if (!isApplied) return false;
            break;
          case 'interviewing':
            if (!isInterviewing) return false;
            break;
          case 'rejected':
            if (!isRejected) return false;
            break;
          case 'archived':
            if (!isArchived) return false;
            break;
          case 'expired':
            if (!isExpired) return false;
            break;
          case 'needs_verification':
            if (!needsVerif) return false;
            break;
        }
      }

      // 2. Text Search
      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchCompany = item.company.toLowerCase().includes(q);
        const matchLocation = item.location.toLowerCase().includes(q);
        const matchSkills = item.requiredSkills?.some((s: string) => s.toLowerCase().includes(q));
        const matchSource = (item.sourceName || item.source?.name || '').toLowerCase().includes(q);
        const matchUrl = (item.jobUrl || item.applyUrl || '').toLowerCase().includes(q);
        const matchRecruiter = (item.recruiterName || '').toLowerCase().includes(q);
        const matchSeniority = (item.seniority || '').toLowerCase().includes(q);
        const matchVerification = (item.verificationStatus || '').toLowerCase().includes(q);

        if (
          !matchTitle &&
          !matchCompany &&
          !matchLocation &&
          !matchSkills &&
          !matchSource &&
          !matchUrl &&
          !matchRecruiter &&
          !matchSeniority &&
          !matchVerification
        ) {
          return false;
        }
      }

      // 3. Verification Filter
      if (filterVerification !== 'all') {
        if (filterVerification === 'verified_live') {
          if (item.verificationStatus !== 'verified_live' && item.verificationStatus !== 'recently_verified')
            return false;
        } else if (item.verificationStatus !== filterVerification) {
          return false;
        }
      }

      // 4. Location Filter
      if (filterLocation !== 'all') {
        const locLower = item.location.toLowerCase();
        if (filterLocation === 'india') {
          if (!locLower.includes('india') && item.country?.toLowerCase() !== 'india') return false;
        } else if (filterLocation === 'worldwide') {
          if (!item.workFromAnywhere && !locLower.includes('anywhere') && !locLower.includes('worldwide'))
            return false;
        } else if (filterLocation === 'us') {
          if (!locLower.includes('united states') && !locLower.includes('us') && !locLower.includes('usa')) return false;
        }
      }

      // 5. Workplace Filter
      if (filterWorkplace !== 'all') {
        if (filterWorkplace === 'remote') {
          if (item.remoteStatus !== 'remote' && !item.workFromAnywhere) return false;
        } else if (filterWorkplace === 'hybrid') {
          if (item.remoteStatus !== 'hybrid') return false;
        } else if (filterWorkplace === 'on-site') {
          if (item.remoteStatus !== 'on-site') return false;
        }
      }

      // 6. Match Tier Filter
      if (filterMatchTier !== 'all') {
        if (filterMatchTier === 'strong' && item.match.overallScore < 85) return false;
        if (
          filterMatchTier === 'potential' &&
          (item.match.overallScore < 70 || item.match.overallScore >= 85)
        )
          return false;
        if (
          filterMatchTier === 'stretch' &&
          (item.match.overallScore < 55 || item.match.overallScore >= 70)
        )
          return false;
        if (filterMatchTier === 'low' && item.match.overallScore >= 55) return false;
      }

      // 7. Target Company Filter
      if (filterTargetCompany === 'target' && !item.isTargetCompany) return false;
      if (filterTargetCompany === 'non_target' && item.isTargetCompany) return false;

      // 8. Compensation Filter
      if (filterCompensation === 'disclosed' && !item.salary?.disclosed) return false;
      if (filterCompensation === 'undisclosed' && item.salary?.disclosed) return false;

      // 9. Seniority Filter
      if (filterSeniority !== 'all' && item.seniority?.toLowerCase() !== filterSeniority.toLowerCase()) return false;

      // 10. Source Filter
      if (filterSource !== 'all') {
        const srcName = (item.sourceName || item.source?.name || '').toLowerCase();
        if (filterSource === 'ats' && item.source?.type !== 'ats_hosted' && !srcName.includes('greenhouse') && !srcName.includes('lever') && !srcName.includes('workday')) return false;
        if (filterSource === 'imported' && !item.importBatchId && !srcName.includes('import')) return false;
        if (filterSource === 'linkedin' && !srcName.includes('linkedin')) return false;
        if (filterSource === 'indeed' && !srcName.includes('indeed')) return false;
      }

      // 11. Batch ID Filter
      if (filterBatchId && item.importBatchId !== filterBatchId) return false;

      return true;
    });
  }, [
    rankedJobs,
    activeStandardView,
    debouncedQuery,
    filterVerification,
    filterLocation,
    filterWorkplace,
    filterMatchTier,
    filterTargetCompany,
    filterCompensation,
    filterSeniority,
    filterSource,
    filterBatchId,
  ]);

  // Sorting
  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      if (sortBy === 'match') {
        return b.match.overallScore - a.match.overallScore;
      }
      if (sortBy === 'verification') {
        const dateA = new Date(a.lastVerified || 0).getTime();
        const dateB = new Date(b.lastVerified || 0).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'salary') {
        const salA = a.salary?.max || a.salary?.min || 0;
        const salB = b.salary?.max || b.salary?.min || 0;
        return salB - salA;
      }
      if (sortBy === 'company') {
        return a.company.localeCompare(b.company);
      }
      if (sortBy === 'updated') {
        const dateA = new Date(a.updatedAt || a.dateDiscovered || 0).getTime();
        const dateB = new Date(b.updatedAt || b.dateDiscovered || 0).getTime();
        return dateB - dateA;
      }
      // Default: freshness (Newest recruiter posted date)
      const postA = a.datePosted && a.datePosted !== 'not_disclosed' ? new Date(a.datePosted).getTime() : 0;
      const postB = b.datePosted && b.datePosted !== 'not_disclosed' ? new Date(b.datePosted).getTime() : 0;
      if (postB !== postA) return postB - postA;
      return b.match.overallScore - a.match.overallScore;
    });
  }, [filteredJobs, sortBy]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedJobs = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return sortedJobs.slice(startIndex, startIndex + pageSize);
  }, [sortedJobs, validCurrentPage, pageSize]);

  // Active Filters Count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterVerification !== 'all') count++;
    if (filterLocation !== 'all') count++;
    if (filterWorkplace !== 'all') count++;
    if (filterMatchTier !== 'all') count++;
    if (filterTargetCompany !== 'all') count++;
    if (filterCompensation !== 'all') count++;
    if (filterSeniority !== 'all') count++;
    if (filterSource !== 'all') count++;
    if (filterBatchId) count++;
    return count;
  }, [
    filterVerification,
    filterLocation,
    filterWorkplace,
    filterMatchTier,
    filterTargetCompany,
    filterCompensation,
    filterSeniority,
    filterSource,
    filterBatchId,
  ]);

  const clearAllFilters = () => {
    setFilterVerification('all');
    setFilterLocation('all');
    setFilterWorkplace('all');
    setFilterMatchTier('all');
    setFilterTargetCompany('all');
    setFilterCompensation('all');
    setFilterSeniority('all');
    setFilterSource('all');
    setFilterBatchId(null);
    setSearchInput('');
    setDebouncedQuery('');
    setSearchParams({});
    setCurrentPage(1);
  };

  // Selection Logic
  const allVisibleSelected =
    paginatedJobs.length > 0 && paginatedJobs.every((j) => selectedJobIds.has(j.id));
  const someVisibleSelected =
    paginatedJobs.some((j) => selectedJobIds.has(j.id)) && !allVisibleSelected;

  const toggleSelectAllVisible = () => {
    const next = new Set(selectedJobIds);
    if (allVisibleSelected) {
      paginatedJobs.forEach((j) => next.delete(j.id));
    } else {
      paginatedJobs.forEach((j) => next.add(j.id));
    }
    setSelectedJobIds(next);
  };

  const toggleSelectJob = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedJobIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedJobIds(next);
  };

  // Bulk Operations Handlers
  const handleBulkSave = () => {
    const ids = Array.from(selectedJobIds);
    const count = jobRepository.bulkSaveJobs(ids);
    loadDatabaseJobs();
    setSelectedJobIds(new Set());
    setNotification(`Successfully saved ${count} opportunities!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleBulkArchive = () => {
    const ids = Array.from(selectedJobIds);
    const count = jobRepository.bulkArchiveJobs(ids);
    loadDatabaseJobs();
    setSelectedJobIds(new Set());
    setNotification(`Archived ${count} opportunities.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleBulkReject = () => {
    const ids = Array.from(selectedJobIds);
    const count = jobRepository.bulkRejectJobs(ids);
    loadDatabaseJobs();
    setSelectedJobIds(new Set());
    setNotification(`Marked ${count} opportunities as Rejected.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleBulkStatusChange = (status: CRMJobStatus) => {
    if (!status) return;
    const ids = Array.from(selectedJobIds);
    const count = jobRepository.bulkUpdateCRMStatus(ids, status);
    loadDatabaseJobs();
    setSelectedJobIds(new Set());
    setBulkStatusToApply('');
    setNotification(`Updated CRM status to "${status}" for ${count} opportunities.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleBulkVerify = () => {
    const ids = Array.from(selectedJobIds);
    setIsVerifyingAction(true);
    setTimeout(() => {
      const res = jobRepository.bulkVerifyJobs(ids);
      loadDatabaseJobs();
      setIsVerifyingAction(false);
      setNotification(
        `Verified ${res.total} jobs: ${res.verifiedLive} live, ${res.broken} broken, ${res.closed} closed.`
      );
      setTimeout(() => setNotification(null), 4000);
    }, 400);
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedJobIds);
    if (window.confirm(`Permanently remove ${ids.length} selected opportunities from the database?`)) {
      const count = jobRepository.bulkDeleteJobs(ids);
      loadDatabaseJobs();
      setSelectedJobIds(new Set());
      setNotification(`Removed ${count} opportunities.`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Export Handlers
  const handleExport = (format: 'csv' | 'xlsx', selectedOnly = false) => {
    const targetJobs = selectedOnly
      ? databaseJobs.filter((j) => selectedJobIds.has(j.id))
      : sortedJobs;

    if (targetJobs.length === 0) {
      alert('No jobs to export.');
      return;
    }

    const filename = `careeros_jobs_${activeStandardView}_${new Date().toISOString().slice(0, 10)}`;
    excelImportService.exportJobs(targetJobs, filename, format);
    setNotification(`Exported ${targetJobs.length} opportunities to ${format.toUpperCase()}!`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Custom Saved Views Handlers
  const handleSaveCurrentView = (name: string) => {
    const newView: SavedDatabaseViewRecord = {
      id: `view-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      standardView: activeStandardView,
      searchQuery: searchInput,
      sortBy,
      filters: {
        crmStatuses: undefined,
        verificationStatus: filterVerification !== 'all' ? (filterVerification as any) : undefined,
        workplaces: filterWorkplace !== 'all' ? [filterWorkplace] : undefined,
      },
    };

    const updated = [newView, ...savedCustomViews.filter((v) => v.name !== name)];
    setSavedCustomViews(updated);
    try {
      localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save view to localStorage:', e);
    }
    setNotification(`Custom view "${name}" saved!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteSavedView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedCustomViews.filter((v) => v.id !== id);
    setSavedCustomViews(updated);
    try {
      localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist view removal:', e);
    }
  };

  const handleApplySavedView = (view: SavedDatabaseViewRecord) => {
    setActiveStandardView(view.standardView || 'all');
    setSearchInput(view.searchQuery || '');
    if (view.sortBy) setSortBy(view.sortBy as any);
    clearAllFilters();
    setCurrentPage(1);
    setNotification(`Applied saved view: "${view.name}"`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Row Action Handlers
  const handleUpdateStatus = (jobId: string, status: CRMJobStatus, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    jobRepository.updateCRMStatus(jobId, status);
    loadDatabaseJobs();
    setNotification(`Status updated to ${status}`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteSingleJob = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Remove this opportunity from your Job Database?')) {
      jobRepository.deleteDatabaseJob(jobId);
      loadDatabaseJobs();
      setNotification('Opportunity removed from Job Database');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleArchiveSingleJob = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    jobRepository.archiveDatabaseJob(jobId);
    loadDatabaseJobs();
    setNotification('Opportunity archived');
    setTimeout(() => setNotification(null), 3000);
  };

  // Helpers
  const getScoreVariant = (score: number): BadgeVariant => {
    if (score >= 85) return 'success';
    if (score >= 70) return 'primary';
    if (score >= 55) return 'warning';
    return 'neutral';
  };

  const formatJobSalary = (job: JobOpportunity) => {
    if (!job.salary?.disclosed || (!job.salary.min && !job.salary.rawText)) {
      return 'Not disclosed';
    }
    if (job.salary.rawText) {
      return job.salary.rawText;
    }
    if (job.salary.min && job.salary.max) {
      const curr = job.salary.currency || 'USD';
      const sym = curr === 'INR' ? '₹' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : '$';
      if (curr === 'INR') {
        return `${sym}${(job.salary.min / 100000).toFixed(0)}L – ${sym}${(job.salary.max / 100000).toFixed(0)}L`;
      }
      return `${sym}${Math.round(job.salary.min / 1000)}k – ${sym}${Math.round(job.salary.max / 1000)}k`;
    }
    return 'Not disclosed';
  };

  const formatWorkplaceBadge = (job: JobOpportunity) => {
    if (job.workFromAnywhere) {
      return (
        <span className="inline-flex px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          WFA
        </span>
      );
    }
    if (job.remoteStatus === 'remote') {
      return (
        <span className="inline-flex px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
          Remote
        </span>
      );
    }
    if (job.remoteStatus === 'hybrid') {
      return (
        <span className="inline-flex px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          Hybrid
        </span>
      );
    }
    return (
      <span className="inline-flex px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-surface-subtle text-text-secondary border border-border">
        On-site
      </span>
    );
  };

  return (
    <div className="space-y-5 pb-24 max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Typography as="h1" variant="h2" color="primary" className="font-bold tracking-tight">
              Job Database
            </Typography>
            <Badge variant="primary" size="sm" className="font-mono">
              v2.0
            </Badge>
          </div>
          <Typography as="p" variant="body-sm" color="muted" className="mt-1">
            Canonical source of truth for all discovered, imported, and tracked opportunities.
          </Typography>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDiagnosticsModalOpen(true)}
            leftIcon={<Activity className="h-4 w-4 text-primary" />}
            title="Open Database Health Diagnostics"
          >
            Diagnostics
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryModalOpen(true)}
            leftIcon={<History className="h-4 w-4 text-text-muted" />}
          >
            Import History
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            leftIcon={<FileSpreadsheet className="h-4 w-4 text-primary" />}
          >
            Import Jobs
          </Button>

          <div className="relative inline-block text-left group">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="h-4 w-4 text-text-muted" />}
            >
              Export
            </Button>
            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-surface border border-border shadow-lg p-1.5 hidden group-hover:block z-30 space-y-1">
              <button
                type="button"
                onClick={() => handleExport('csv', false)}
                className="w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-surface-subtle rounded-lg flex items-center justify-between cursor-pointer"
              >
                <span>Export as CSV</span>
                <span className="text-[10px] text-text-muted">.csv</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('xlsx', false)}
                className="w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-surface-subtle rounded-lg flex items-center justify-between cursor-pointer"
              >
                <span>Export as Excel</span>
                <span className="text-[10px] text-text-muted">.xlsx</span>
              </button>
              {selectedJobIds.size > 0 && (
                <>
                  <div className="border-t border-border/60 my-1" />
                  <button
                    type="button"
                    onClick={() => handleExport('csv', true)}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft/40 rounded-lg cursor-pointer"
                  >
                    Export Selected ({selectedJobIds.size})
                  </button>
                </>
              )}
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            + Add Job
          </Button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-body-sm text-emerald-800 dark:text-emerald-200 font-medium flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-emerald-700 dark:text-emerald-300 underline text-caption cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Standard View Tabs & Custom Saved Views Bar */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-border/60 scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-max">
            {STANDARD_VIEWS.map((tab) => {
              const isActive = activeStandardView === tab.id;
              const count = viewCounts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveStandardView(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-subtle border border-border/80 text-text-muted'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSaveViewModalOpen(true)}
              leftIcon={<Bookmark className="h-3.5 w-3.5 text-primary" />}
              className="h-8 text-xs shrink-0"
              title="Save current filters & criteria as a custom view"
            >
              Save View
            </Button>
          </div>
        </div>

        {/* User Saved Views Pills */}
        {savedCustomViews.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-caption pt-1">
            <span className="text-text-muted font-medium text-[11px] uppercase tracking-wider">
              Saved Views:
            </span>
            {savedCustomViews.map((sv) => (
              <span
                key={sv.id}
                onClick={() => handleApplySavedView(sv)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-subtle/80 hover:bg-surface-subtle border border-border text-text-primary font-medium text-xs cursor-pointer transition-colors group"
              >
                <Bookmark className="h-3 w-3 text-primary" />
                <span>{sv.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSavedView(sv.id, e)}
                  className="text-text-muted hover:text-red-500 ml-0.5"
                  title="Remove saved view"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. Search, Filter & Bulk Actions Bar */}
      <Card variant="default" className="p-3.5 space-y-3 border-border/80 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder="Search canonical database (title, company, skills, location, URL, recruiter)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftIcon={<Search className="h-4 w-4 text-text-muted" />}
              className="w-full text-xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Toggle */}
            <Button
              variant={activeFiltersCount > 0 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              className="h-9 text-xs"
            >
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-2.5 text-xs font-semibold rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-3xs"
            >
              <option value="freshness">Sort: Newest Posted</option>
              <option value="match">Sort: Match Score</option>
              <option value="verification">Sort: Recently Verified</option>
              <option value="salary">Sort: Salary (High to Low)</option>
              <option value="company">Sort: Company (A-Z)</option>
              <option value="updated">Sort: Last Updated</option>
            </select>

            {/* View Switch: Table / Grid */}
            <div className="flex items-center bg-surface-subtle p-0.5 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-caption font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Table View (9 columns, responsive)"
              >
                <LayoutList className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-caption font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Panel (Collapsible) */}
        {isFiltersOpen && (
          <div className="pt-3 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-caption animate-in fade-in">
            <div>
              <label className="block text-text-muted font-medium mb-1">Verification</label>
              <select
                value={filterVerification}
                onChange={(e) => {
                  setFilterVerification(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-text-primary text-xs"
              >
                <option value="all">All Verification</option>
                <option value="verified_live">Verified Live</option>
                <option value="needs_verification">Needs Verification</option>
                <option value="link_broken">Link Broken</option>
                <option value="job_closed">Closed</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-text-muted font-medium mb-1">Location</label>
              <select
                value={filterLocation}
                onChange={(e) => {
                  setFilterLocation(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-text-primary text-xs"
              >
                <option value="all">All Locations</option>
                <option value="india">India</option>
                <option value="worldwide">Worldwide (WFA)</option>
                <option value="us">United States</option>
              </select>
            </div>

            <div>
              <label className="block text-text-muted font-medium mb-1">Workplace</label>
              <select
                value={filterWorkplace}
                onChange={(e) => {
                  setFilterWorkplace(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-text-primary text-xs"
              >
                <option value="all">All Arrangements</option>
                <option value="remote">Remote Only</option>
                <option value="hybrid">Hybrid</option>
                <option value="on-site">On-site</option>
              </select>
            </div>

            <div>
              <label className="block text-text-muted font-medium mb-1">Match Tier</label>
              <select
                value={filterMatchTier}
                onChange={(e) => {
                  setFilterMatchTier(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-text-primary text-xs"
              >
                <option value="all">All Match Scores</option>
                <option value="strong">Strong Fit (85%+)</option>
                <option value="potential">Potential Fit (70–84%)</option>
                <option value="stretch">Stretch (55–69%)</option>
                <option value="low">Low Relevance (&lt;55%)</option>
              </select>
            </div>

            <div>
              <label className="block text-text-muted font-medium mb-1">Company</label>
              <select
                value={filterTargetCompany}
                onChange={(e) => {
                  setFilterTargetCompany(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-text-primary text-xs"
              >
                <option value="all">All Companies</option>
                <option value="target">Target Companies Only</option>
                <option value="non_target">Non-Target</option>
              </select>
            </div>

            <div>
              <label className="block text-text-muted font-medium mb-1">Compensation</label>
              <select
                value={filterCompensation}
                onChange={(e) => {
                  setFilterCompensation(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-text-primary text-xs"
              >
                <option value="all">All Compensation</option>
                <option value="disclosed">Disclosed Only</option>
                <option value="undisclosed">Not Disclosed</option>
              </select>
            </div>

            <div>
              <label className="block text-text-muted font-medium mb-1">Seniority</label>
              <select
                value={filterSeniority}
                onChange={(e) => {
                  setFilterSeniority(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-text-primary text-xs"
              >
                <option value="all">All Levels</option>
                <option value="entry">Entry Level</option>
                <option value="mid">Mid Level</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead / Staff</option>
                <option value="director">Director+</option>
              </select>
            </div>

            <div>
              <label className="block text-text-muted font-medium mb-1">Source</label>
              <select
                value={filterSource}
                onChange={(e) => {
                  setFilterSource(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-text-primary text-xs"
              >
                <option value="all">All Sources</option>
                <option value="ats">Direct ATS (Greenhouse/Lever)</option>
                <option value="imported">Excel Imported</option>
                <option value="linkedin">LinkedIn</option>
                <option value="indeed">Indeed</option>
              </select>
            </div>
          </div>
        )}

        {/* Active Filters Chip Bar */}
        {(activeFiltersCount > 0 || filterBatchId) && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/40 text-caption">
            <span className="text-text-muted font-medium">Active:</span>

            {filterBatchId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/30 text-xs">
                <span>Batch: {filterBatchId.slice(0, 10)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterBatchId(null);
                    setSearchParams({});
                  }}
                  className="hover:text-primary-hover cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filterVerification !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-subtle text-text-primary border border-border text-xs">
                <span>Status: {filterVerification}</span>
                <button type="button" onClick={() => setFilterVerification('all')}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filterLocation !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-subtle text-text-primary border border-border text-xs">
                <span>Location: {filterLocation}</span>
                <button type="button" onClick={() => setFilterLocation('all')}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filterWorkplace !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-subtle text-text-primary border border-border text-xs">
                <span>Workplace: {filterWorkplace}</span>
                <button type="button" onClick={() => setFilterWorkplace('all')}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filterMatchTier !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-subtle text-text-primary border border-border text-xs">
                <span>Match: {filterMatchTier}</span>
                <button type="button" onClick={() => setFilterMatchTier('all')}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filterTargetCompany !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-subtle text-text-primary border border-border text-xs">
                <span>Company: {filterTargetCompany}</span>
                <button type="button" onClick={() => setFilterTargetCompany('all')}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filterCompensation !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-subtle text-text-primary border border-border text-xs">
                <span>Comp: {filterCompensation}</span>
                <button type="button" onClick={() => setFilterCompensation('all')}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-primary hover:underline text-xs ml-1 cursor-pointer font-semibold"
            >
              Clear all
            </button>
          </div>
        )}

        {/* 4. Multi-Select Bulk Actions Bar (Shown when 1+ selected) */}
        {selectedJobIds.size > 0 && (
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between gap-3 flex-wrap animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-6 px-2 rounded bg-primary text-white font-bold text-xs">
                {selectedJobIds.size}
              </span>
              <span className="text-xs font-semibold text-text-primary">
                opportunities selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedJobIds(new Set())}
                className="text-xs text-text-muted hover:text-text-primary underline ml-2 cursor-pointer"
              >
                Deselect all
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleBulkSave} className="h-7 text-xs">
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkArchive} className="h-7 text-xs">
                Archive
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkReject} className="h-7 text-xs">
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkVerify}
                disabled={isVerifyingAction}
                leftIcon={<RefreshCw className={`h-3 w-3 ${isVerifyingAction ? 'animate-spin' : ''}`} />}
                className="h-7 text-xs"
              >
                Verify
              </Button>

              {/* Status Selector */}
              <select
                value={bulkStatusToApply}
                onChange={(e) => handleBulkStatusChange(e.target.value as CRMJobStatus)}
                className="h-7 px-2 text-xs font-semibold rounded border border-border bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">Set Status...</option>
                {CRM_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport('csv', true)}
                leftIcon={<Download className="h-3 w-3" />}
                className="h-7 text-xs"
              >
                Export CSV
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkDelete}
                leftIcon={<Trash2 className="h-3 w-3 text-red-500" />}
                className="h-7 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 5. Main Content: Empty States or Job List (Table or Grid) */}
      {databaseJobs.length === 0 ? (
        /* Empty State 1: No saved jobs yet */
        <div className="p-12 rounded-2xl bg-surface border border-dashed border-border text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-primary-soft text-primary border border-blue-200 flex items-center justify-center mx-auto shadow-xs">
            <Bookmark className="h-6 w-6" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <Typography as="h3" variant="h3" color="primary">
              No jobs in database yet
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Discover relevant opportunities from Job Feed, import them in bulk from an Excel spreadsheet, or add opportunities manually.
            </Typography>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => navigate('/job-feed')}
              leftIcon={<Bookmark className="h-4 w-4" />}
            >
              Discover Jobs
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(true)}
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
            >
              Import Jobs
            </Button>
            <Button
              variant="primary"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              + Add Job
            </Button>
          </div>
        </div>
      ) : sortedJobs.length === 0 ? (
        /* Empty State 2: No jobs matching filters */
        <div className="p-12 rounded-2xl bg-surface border border-dashed border-border text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <Typography as="h3" variant="h3" className="text-text-primary">
              No opportunities match current criteria
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Your canonical database contains {databaseJobs.length} opportunities, but none match view "{activeStandardView.replace(/_/g, ' ')}" and active filters.
            </Typography>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" onClick={clearAllFilters}>
              Clear Filters
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setActiveStandardView('all');
                clearAllFilters();
              }}
            >
              View All Jobs ({databaseJobs.length})
            </Button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* RESPONSIVE 9-COLUMN DESKTOP TABLE (No Horizontal Overflow) */
        <div className="w-full rounded-xl border border-border/90 bg-surface overflow-hidden shadow-2xs">
          <table className="w-full table-fixed text-left text-body-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-subtle/70 text-caption font-semibold uppercase text-text-muted tracking-wider select-none">
                {/* 1. Selection Checkbox */}
                <th className="w-10 px-3 py-3 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    className="text-text-muted hover:text-text-primary cursor-pointer flex items-center justify-center"
                    title={allVisibleSelected ? 'Deselect all visible' : 'Select all visible'}
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : someVisibleSelected ? (
                      <MinusSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>

                {/* 2. Job Title */}
                <th className="w-[26%] px-3 py-3">Job Opportunity</th>

                {/* 3. Company */}
                <th className="w-[14%] px-3 py-3">Company</th>

                {/* 4. Match Score */}
                <th className="w-[8%] px-2 py-3 text-center">Match</th>

                {/* 5. Location */}
                <th className="w-[11%] px-3 py-3">Location</th>

                {/* 6. Workplace */}
                <th className="w-[8%] px-2 py-3 text-center">Arrangement</th>

                {/* 7. Salary */}
                <th className="w-[11%] px-3 py-3">Compensation</th>

                {/* 8. Freshness */}
                <th className="w-[8%] px-2 py-3 text-center">Freshness</th>

                {/* 9. CRM Status */}
                <th className="w-[11%] px-2 py-3">CRM Status</th>

                {/* 10. Actions */}
                <th className="w-[3%] px-2 py-3 text-right"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">
              {paginatedJobs.map((item) => {
                const isSelected = selectedJobIds.has(item.id);
                const currentCRMStatus =
                  item.crm_status ||
                  (item.lifecycleState === 'SAVED'
                    ? 'Saved'
                    : item.lifecycleState === 'APPLIED'
                    ? 'Applied'
                    : item.lifecycleState === 'REJECTED'
                    ? 'Rejected'
                    : 'Viewed');

                const postedDateText = jobVerificationEngine.formatPostedDate(
                  item.datePosted || item.postingDate,
                  item.posted_at_raw
                );

                return (
                  <tr
                    key={item.id}
                    onClick={() => setInspectingJob(item)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected
                        ? 'bg-primary/5 hover:bg-primary/10'
                        : 'hover:bg-surface-subtle/60'
                    }`}
                  >
                    {/* Checkbox */}
                    <td
                      className="px-3 py-3 text-center"
                      onClick={(e) => toggleSelectJob(item.id, e)}
                    >
                      <button
                        type="button"
                        className="text-text-muted hover:text-text-primary cursor-pointer flex items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    {/* Job Title & Verified Badge */}
                    <td className="px-3 py-3 overflow-hidden">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="font-semibold text-text-primary text-xs truncate group-hover:text-primary transition-colors block"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                        {item.isVerifiedLive && (
                          <span title="Live Verified Listing">
                            <ShieldCheck
                              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                            />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5 truncate">
                        <span className="capitalize">{item.seniority || 'Mid Level'}</span>
                        <span>•</span>
                        <span className="truncate">{item.sourceName || item.source?.name || 'Direct'}</span>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-3 py-3 overflow-hidden">
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className="font-medium text-text-primary text-xs truncate"
                          title={item.company}
                        >
                          {item.company}
                        </span>
                        {item.isTargetCompany && (
                          <span className="px-1 py-0.2 rounded text-[9.5px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                            Target
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Match Score */}
                    <td className="px-2 py-3 text-center overflow-hidden">
                      <Badge variant={getScoreVariant(item.match.overallScore)} size="sm">
                        {item.match.overallScore}%
                      </Badge>
                    </td>

                    {/* Location */}
                    <td className="px-3 py-3 overflow-hidden">
                      <span
                        className="text-xs text-text-secondary truncate block"
                        title={item.location || 'Not disclosed'}
                      >
                        {item.location || 'Not disclosed'}
                      </span>
                    </td>

                    {/* Workplace Arrangement */}
                    <td className="px-2 py-3 text-center overflow-hidden">
                      {formatWorkplaceBadge(item)}
                    </td>

                    {/* Salary */}
                    <td className="px-3 py-3 overflow-hidden">
                      <span
                        className="text-xs font-medium text-text-primary truncate block"
                        title={formatJobSalary(item)}
                      >
                        {formatJobSalary(item)}
                      </span>
                    </td>

                    {/* Freshness */}
                    <td className="px-2 py-3 text-center overflow-hidden">
                      <span
                        className="text-[11px] text-text-muted truncate block"
                        title={`Recruiter posted: ${item.datePosted || 'N/A'}`}
                      >
                        {postedDateText}
                      </span>
                    </td>

                    {/* CRM Status */}
                    <td className="px-2 py-3 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={currentCRMStatus}
                        onChange={(e) => handleUpdateStatus(item.id, e.target.value as CRMJobStatus, e)}
                        className="w-full h-7 px-1.5 text-[11px] font-semibold rounded border border-border bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-3xs truncate"
                      >
                        {CRM_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Quick Row Actions */}
                    <td className="px-2 py-3 text-right overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectingJob(item)}
                          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                          title="Inspect Opportunity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleArchiveSingleJob(item.id, e)}
                          className="p-1 rounded text-text-muted hover:text-amber-600 hover:bg-surface-subtle transition-colors cursor-pointer"
                          title="Archive Opportunity"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSingleJob(item.id, e)}
                          className="p-1 rounded text-text-muted hover:text-red-600 hover:bg-surface-subtle transition-colors cursor-pointer"
                          title="Delete Opportunity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedJobs.map((item) => {
            const badgeConfig = jobVerificationEngine.getVerificationBadgeConfig(
              item.verificationStatus
            );
            const badgeClass =
              badgeConfig.variant === 'warning'
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
                : badgeConfig.variant === 'error'
                ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';

            return (
              <Card
                key={item.id}
                variant="default"
                onClick={() => setInspectingJob(item)}
                className="p-5 border-border/80 hover:border-primary/50 transition-all flex flex-col justify-between space-y-4 group bg-surface cursor-pointer shadow-2xs"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-1 text-[11px] pb-2 border-b border-border/50">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold border ${badgeClass}`}
                    >
                      <span>{badgeConfig.label}</span>
                    </span>
                    <span className="text-text-muted">
                      {jobVerificationEngine.formatPostedDate(item.datePosted || item.postingDate)}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3
                        className="font-semibold text-text-primary text-body-md line-clamp-1 group-hover:text-primary transition-colors"
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                      <p className="text-caption text-text-secondary flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 text-text-muted" />
                        <span className="font-medium text-text-primary">{item.company}</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px]">{item.location}</span>
                      </p>
                    </div>

                    <Badge variant={getScoreVariant(item.match.overallScore)} size="sm">
                      {item.match.overallScore}%
                    </Badge>
                  </div>

                  <div className="text-caption text-text-primary font-medium">
                    {formatJobSalary(item)}
                  </div>
                </div>

                <div
                  className="pt-3 border-t border-border/60 flex items-center justify-between gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInspectingJob(item)}
                    className="px-2 h-8 text-xs"
                  >
                    Inspect
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/resume-studio?jobId=${item.id}`)}
                    className="px-2.5 h-8 text-xs"
                  >
                    Tailor
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 6. Instant Fast Pagination Bar */}
      {sortedJobs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-caption text-text-secondary border-t border-border/60">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <strong>{(validCurrentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong>{Math.min(validCurrentPage * pageSize, sortedJobs.length)}</strong> of{' '}
              <strong>{sortedJobs.length}</strong> opportunities
            </span>

            <span className="text-text-muted">|</span>

            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 px-2 text-xs font-semibold rounded border border-border bg-surface text-text-primary focus:outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="h-7 px-2 text-xs"
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2.5 text-xs"
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </Button>

            <span className="px-3 text-xs font-semibold text-text-primary">
              Page {validCurrentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 px-2.5 text-xs"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="h-7 px-2 text-xs"
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Add Job Modal */}
      {isAddModalOpen && (
        <AddJobModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onJobAdded={(newJob) => {
            loadDatabaseJobs();
            setNotification(`Successfully added "${newJob.title}" to Job Database!`);
            setTimeout(() => setNotification(null), 3000);
          }}
        />
      )}

      {/* 2. Import Jobs Modal */}
      {isImportModalOpen && (
        <ImportJobsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={(batchId) => {
            loadDatabaseJobs();
            setFilterBatchId(batchId);
            setSearchParams({ batchId });
            setNotification('Spreadsheet imported successfully! Viewing imported batch.');
            setTimeout(() => setNotification(null), 4000);
          }}
        />
      )}

      {/* 3. Import History Modal */}
      {isHistoryModalOpen && (
        <ImportHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          onSelectBatch={(batchId) => {
            setFilterBatchId(batchId);
            setSearchParams({ batchId });
          }}
        />
      )}

      {/* 4. Save Custom View Modal */}
      {isSaveViewModalOpen && (
        <SaveViewModal
          isOpen={isSaveViewModalOpen}
          onClose={() => setIsSaveViewModalOpen(false)}
          activeStandardView={activeStandardView}
          activeFilterSummary={
            activeFiltersCount > 0
              ? `${activeFiltersCount} active filters + search "${searchInput || 'none'}"`
              : searchInput
              ? `Search query: "${searchInput}"`
              : 'Base view default filter'
          }
          onSave={handleSaveCurrentView}
        />
      )}

      {/* 5. Database Diagnostics Modal */}
      {isDiagnosticsModalOpen && (
        <DatabaseDiagnosticsModal
          isOpen={isDiagnosticsModalOpen}
          onClose={() => setIsDiagnosticsModalOpen(false)}
          onDataChanged={loadDatabaseJobs}
        />
      )}

      {/* 6. Inspection Slide-Over Drawer */}
      {inspectingJob && (
        <JobInspectDrawer
          job={inspectingJob}
          isOpen={Boolean(inspectingJob)}
          onClose={() => setInspectingJob(null)}
          onJobUpdated={(updated) => {
            loadDatabaseJobs();
            setInspectingJob({ ...updated, match: inspectingJob.match });
          }}
        />
      )}
    </div>
  );
};
