/**
 * CareerOS Single Source-of-Truth Filter Evaluation Engine
 *
 * Implements Section 3 & Section 4 of CareerOS Discovery Engine 2.0:
 * - Unified, deterministic filter evaluation shared across feed rendering and ingestion gating.
 * - Strict WITHIN-CATEGORY OR logic: e.g., selecting 'India' and 'Worldwide Remote' returns jobs
 *   matching India OR Worldwide Remote.
 * - Strict CROSS-CATEGORY AND logic: job must pass Location AND Workplace AND Role AND Seniority AND Freshness.
 * - Eliminates ad-hoc, divergent filtering chains.
 */

import { JobOpportunity, JobFilterCriteria } from '../types';
import { locationFilterEngine } from './locationFilterEngine';
import { remoteEligibilityEngine } from '../remoteEligibilityEngine';
import { roleTaxonomyEngine } from './roleTaxonomyEngine';
import { CareerProfile } from '../../profile/careerProfileNormalizer';
import { SearchConfiguration } from '../searchConfiguration';

export interface FilterEvaluationResult {
  passes: boolean;
  rejectionReason?: string;
  failedCategory?: string;
  categoryResults: {
    search: boolean;
    location: boolean;
    workplace: boolean;
    role: boolean;
    seniority: boolean;
    employmentType: boolean;
    company: boolean;
    salary: boolean;
    targetCompany: boolean;
    verification: boolean;
    freshness: boolean;
    profileHardExclusions: boolean;
    skills?: boolean;
    sources?: boolean;
    industry?: boolean;
    experience?: boolean;
    matchScore?: boolean;
  };
}

export class FilterEvaluationEngine {
  /**
   * Pure deterministic evaluation function for a single job against current filter criteria.
   */
  public evaluateJob(
    job: JobOpportunity,
    filters: JobFilterCriteria,
    options?: {
      searchQuery?: string;
      careerProfile?: CareerProfile;
      searchConfig?: SearchConfiguration;
      isProfileMatchingEnabled?: boolean;
      maxAgeDays?: number;
    }
  ): FilterEvaluationResult {
    const categoryResults = {
      search: true,
      location: true,
      workplace: true,
      role: true,
      seniority: true,
      employmentType: true,
      company: true,
      salary: true,
      targetCompany: true,
      verification: true,
      freshness: true,
      profileHardExclusions: true,
      skills: true,
      sources: true,
      industry: true,
      experience: true,
      matchScore: true,
    };

    const compLower = (job.company || '').toLowerCase().trim();
    const titleLower = (job.title || '').toLowerCase().trim();
    const locLower = (job.location || '').toLowerCase().trim();
    const isProfileMatching = options?.isProfileMatchingEnabled ?? true;

    // 1. Profile Negative Signals & Confusion Hard Exclusions
    if (isProfileMatching) {
      // Check negative career signals (telecaller, door-to-door, commission-only, etc.)
      const negExcl = roleTaxonomyEngine.isExcludedNegativeRole(
        job.title,
        job.description,
        options?.searchConfig?.excludedRoles || options?.careerProfile?.negativeRoleSignals || []
      );
      if (negExcl.isExcluded) {
        categoryResults.profileHardExclusions = false;
        return {
          passes: false,
          rejectionReason: negExcl.reason || 'Excluded by profile negative signal',
          failedCategory: 'profileHardExclusions',
          categoryResults,
        };
      }

      // Check role confusion guards (e.g. Account Executive vs Assistant, Growth vs Growth Intern)
      const targetRoles = options?.careerProfile?.primaryRoles || options?.searchConfig?.primaryRoles || [];
      for (const target of targetRoles) {
        const confusion = roleTaxonomyEngine.checkRoleConfusion(target, job.title);
        if (confusion.isConfusedMismatch) {
          categoryResults.profileHardExclusions = false;
          return {
            passes: false,
            rejectionReason: confusion.reason || 'Role confusion mismatch',
            failedCategory: 'profileHardExclusions',
            categoryResults,
          };
        }
      }
    }

    // 2. Strict 7-Day Freshness Gate (calendar originalPostedAt)
    const maxDays = options?.maxAgeDays ?? 7;
    const postDateStr = job.originalPostedAt || job.posted_at || job.datePosted || (job as any).postedDate;
    if (postDateStr && postDateStr !== 'not_disclosed') {
      const postDate = new Date(postDateStr);
      if (!isNaN(postDate.getTime())) {
        const ageDays = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > maxDays) {
          categoryResults.freshness = false;
          return {
            passes: false,
            rejectionReason: `Job posted ${Math.floor(ageDays)} days ago (exceeds ${maxDays}-day window)`,
            failedCategory: 'freshness',
            categoryResults,
          };
        }
      }
    }

    // 3. Search Query Match
    const query = (options?.searchQuery || '').toLowerCase().trim();
    if (query) {
      const matchTitle = titleLower.includes(query);
      const matchCompany = compLower.includes(query);
      const matchLoc = locLower.includes(query);
      const matchSkills = (job.requiredSkills || []).some((s) => s.toLowerCase().includes(query));
      const matchDesc = (job.description || '').toLowerCase().includes(query);

      if (!matchTitle && !matchCompany && !matchLoc && !matchSkills && !matchDesc) {
        categoryResults.search = false;
        return {
          passes: false,
          rejectionReason: `Does not match search term "${query}"`,
          failedCategory: 'search',
          categoryResults,
        };
      }
    }

    // 4. Target Company Only Filter
    if (filters.targetCompanyOnly && !job.isTargetCompany) {
      categoryResults.targetCompany = false;
      return {
        passes: false,
        rejectionReason: 'Not a target company',
        failedCategory: 'targetCompany',
        categoryResults,
      };
    }

    // 5. Multi-Select Locations Filter (Strict WITHIN-CATEGORY OR)
    const selectedLocs = (filters.locations && filters.locations.length > 0)
      ? filters.locations
      : (filters.locationFilter && filters.locationFilter !== 'all')
      ? [filters.locationFilter]
      : [];

    const selectedWorkplaces = (filters.remoteStatuses && filters.remoteStatuses.length > 0)
      ? filters.remoteStatuses
      : (filters.remoteType && filters.remoteType !== 'all')
      ? [filters.remoteType]
      : [];

    if (selectedLocs.length > 0 || selectedWorkplaces.length > 0) {
      const locEval = locationFilterEngine.evaluateEligibility(job, selectedLocs, selectedWorkplaces);
      if (!locEval.eligible) {
        categoryResults.location = false;
        return {
          passes: false,
          rejectionReason: locEval.reason || 'Location or remote status not matching selection',
          failedCategory: 'location',
          categoryResults,
        };
      }
    }

    // 6. Country Market Filter (Home Country / India / Worldwide Remote)
    if (filters.countryMarket && filters.countryMarket !== 'all') {
      const isIndiaEligible = remoteEligibilityEngine.isEligibleForIndiaFeed(job);
      const isWorldwide = remoteEligibilityEngine.isWorldwideRemote(job);

      if (filters.countryMarket === 'home') {
        const home = (options?.careerProfile?.homeCountry || 'India').toLowerCase();
        const isHome =
          (job.country || '').toLowerCase() === home ||
          locLower.includes(home) ||
          (home === 'india' && isIndiaEligible);
        if (!isHome) {
          categoryResults.location = false;
          return {
            passes: false,
            rejectionReason: 'Not eligible for home market',
            failedCategory: 'location',
            categoryResults,
          };
        }
      } else if (filters.countryMarket === 'india_global' || filters.countryMarket === 'global_remote') {
        if (!isIndiaEligible) {
          categoryResults.location = false;
          return {
            passes: false,
            rejectionReason: 'Not eligible for India / Global Remote',
            failedCategory: 'location',
            categoryResults,
          };
        }
      } else if (filters.countryMarket === 'wfa') {
        if (!isWorldwide) {
          categoryResults.location = false;
          return {
            passes: false,
            rejectionReason: 'Not a Worldwide Remote / Work-From-Anywhere position',
            failedCategory: 'location',
            categoryResults,
          };
        }
      }
    }

    // 7. Salary Filters
    if (filters.salaryDisclosedOnly && !job.salary?.disclosed && job.salary_truth?.status !== 'EMPLOYER_STATED') {
      categoryResults.salary = false;
      return {
        passes: false,
        rejectionReason: 'Salary not stated by employer',
        failedCategory: 'salary',
        categoryResults,
      };
    }

    if (filters.minSalary && filters.minSalary > 0) {
      const maxSal = job.salary?.max || job.salary?.min || 0;
      if (maxSal < filters.minSalary) {
        categoryResults.salary = false;
        return {
          passes: false,
          rejectionReason: `Salary (${maxSal}) below minimum requested (${filters.minSalary})`,
          failedCategory: 'salary',
          categoryResults,
        };
      }
    }

    // 8. Match Tier Filter
    if (filters.fitTier && filters.fitTier !== 'all') {
      const matchScore = (job as any).match?.overallScore ?? (job as any).matchScore ?? (job as any).match_score ?? 0;
      const tierClean = filters.fitTier.replace(' FIT', '').trim().toUpperCase();
      if (tierClean === 'HIGH' && matchScore < 85) {
        return {
          passes: false,
          rejectionReason: `Score ${matchScore}% below High Fit threshold`,
          failedCategory: 'role',
          categoryResults,
        };
      }
      if (tierClean === 'GOOD' && (matchScore < 70 || matchScore >= 85)) {
        return {
          passes: false,
          rejectionReason: `Score ${matchScore}% outside Good Fit range`,
          failedCategory: 'role',
          categoryResults,
        };
      }
    }

    // 9. Multi-Select Roles Filter (Hierarchical & Disambiguated)
    if (filters.roles && filters.roles.length > 0) {
      const taxMatch = roleTaxonomyEngine.matchesRoleCriteria(job.title, filters.roles);
      const containsMatch = filters.roles.some((role) =>
        titleLower.includes(role.toLowerCase())
      );
      if (!taxMatch.matches && !containsMatch) {
        categoryResults.role = false;
        return {
          passes: false,
          rejectionReason: `Title "${job.title}" does not match selected roles`,
          failedCategory: 'role',
          categoryResults,
        };
      }
    } else if (filters.roleFilter && filters.roleFilter !== 'all') {
      if (!titleLower.includes(filters.roleFilter.toLowerCase())) {
        categoryResults.role = false;
        return {
          passes: false,
          rejectionReason: `Title "${job.title}" does not contain "${filters.roleFilter}"`,
          failedCategory: 'role',
          categoryResults,
        };
      }
    }

    // 10. Multi-Select Companies Filter
    if (filters.companies && filters.companies.length > 0) {
      const matchComp = filters.companies.some(
        (c) => compLower === c.toLowerCase() || compLower.includes(c.toLowerCase())
      );
      if (!matchComp) {
        categoryResults.company = false;
        return {
          passes: false,
          rejectionReason: `Company "${job.company}" not in selected companies`,
          failedCategory: 'company',
          categoryResults,
        };
      }
    } else if (filters.companyFilter && filters.companyFilter !== 'all') {
      if (!compLower.includes(filters.companyFilter.toLowerCase())) {
        categoryResults.company = false;
        return {
          passes: false,
          rejectionReason: `Company "${job.company}" does not match "${filters.companyFilter}"`,
          failedCategory: 'company',
          categoryResults,
        };
      }
    }

    // 11. Multi-Select Seniority Filter
    if (filters.seniorities && filters.seniorities.length > 0) {
      const jobSen = ((job.seniority as string) || '').toLowerCase();
      const matchSen = filters.seniorities.some((s) => {
        const sLower = s.toLowerCase();
        return jobSen.includes(sLower) || titleLower.includes(sLower);
      });
      if (!matchSen) {
        categoryResults.seniority = false;
        return {
          passes: false,
          rejectionReason: `Seniority does not match selected seniority levels`,
          failedCategory: 'seniority',
          categoryResults,
        };
      }
    }

    // 12. Multi-Select Employment Type Filter
    if (filters.employmentTypes && filters.employmentTypes.length > 0) {
      const jobEmp = (job.employmentType || '').toLowerCase();
      const matchEmp = filters.employmentTypes.some((et) => jobEmp.includes(et.toLowerCase()));
      if (!matchEmp) {
        categoryResults.employmentType = false;
        return {
          passes: false,
          rejectionReason: `Employment type "${job.employmentType}" not in selected types`,
          failedCategory: 'employmentType',
          categoryResults,
        };
      }
    } else if (filters.jobType && filters.jobType !== 'all') {
      if (!job.employmentType?.toLowerCase().includes(filters.jobType.toLowerCase())) {
        categoryResults.employmentType = false;
        return {
          passes: false,
          rejectionReason: `Employment type does not match "${filters.jobType}"`,
          failedCategory: 'employmentType',
          categoryResults,
        };
      }
    }

    // 13. Verified Only Filter
    if (
      (filters.verifiedOnly || filters.verifiedLiveOnly) &&
      !job.isVerifiedLive &&
      job.verificationStatus !== 'LIVE_VERIFIED' &&
      job.verificationStatus !== 'verified_live' &&
      job.verificationStatus !== 'recently_verified'
    ) {
      categoryResults.verification = false;
      return {
        passes: false,
        rejectionReason: 'Job has not been verified live',
        failedCategory: 'verification',
        categoryResults,
      };
    }

    // 14. Worldwide Remote Only
    if (filters.worldwideRemoteOnly) {
      const isWorldwide = remoteEligibilityEngine.isWorldwideRemote(job);
      if (!isWorldwide) {
        categoryResults.location = false;
        return {
          passes: false,
          rejectionReason: 'Not a worldwide remote role',
          failedCategory: 'location',
          categoryResults,
        };
      }
    }

    // 15. Currencies Filter (Within-category OR)
    if (filters.currencies && filters.currencies.length > 0) {
      const jobCurr = ((job.salary?.currency || job.currency || job.salary_truth?.currency || '') as string).toUpperCase();
      const matchCurr = filters.currencies.some((c) => jobCurr.includes(c.toUpperCase()));
      if (!matchCurr) {
        categoryResults.salary = false;
        return {
          passes: false,
          rejectionReason: `Currency "${jobCurr || 'unspecified'}" does not match selected currencies [${filters.currencies.join(', ')}]`,
          failedCategory: 'salary',
          categoryResults,
        };
      }
    }

    // 16. Countries Filter (Within-category OR)
    if (filters.countries && filters.countries.length > 0) {
      const jCountry = (job.country || '').toLowerCase();
      const matchCountry = filters.countries.some((c) => {
        const cLower = c.toLowerCase();
        return jCountry.includes(cLower) || locLower.includes(cLower);
      });
      if (!matchCountry) {
        categoryResults.location = false;
        return {
          passes: false,
          rejectionReason: `Job country does not match selected countries [${filters.countries.join(', ')}]`,
          failedCategory: 'location',
          categoryResults,
        };
      }
    }

    // 17. Industries Filter (Within-category OR)
    if (filters.industries && filters.industries.length > 0) {
      const jobInd = (job.industry || '').toLowerCase();
      const matchInd = filters.industries.some((ind) => jobInd.includes(ind.toLowerCase()));
      if (!matchInd) {
        categoryResults.industry = false;
        return {
          passes: false,
          rejectionReason: `Job industry "${job.industry || 'unspecified'}" not in selected industries`,
          failedCategory: 'industry',
          categoryResults,
        };
      }
    } else if (filters.industry && filters.industry !== 'all') {
      const jobInd = (job.industry || '').toLowerCase();
      if (!jobInd.includes(filters.industry.toLowerCase())) {
        categoryResults.industry = false;
        return {
          passes: false,
          rejectionReason: `Job industry "${job.industry || 'unspecified'}" does not match "${filters.industry}"`,
          failedCategory: 'industry',
          categoryResults,
        };
      }
    }

    // 18. Skills Filter (Within-category OR)
    if (filters.skills && filters.skills.length > 0) {
      const jobSkills = [
        ...(job.requiredSkills || []),
        ...(job.preferredSkills || []),
        ...(job.skills || []),
      ].map((s) => s.toLowerCase());
      const jobDesc = (job.description || '').toLowerCase();
      const matchSkill = filters.skills.some((sk) => {
        const skLower = sk.toLowerCase();
        return jobSkills.some((js) => js.includes(skLower)) || jobDesc.includes(skLower) || titleLower.includes(skLower);
      });
      if (!matchSkill) {
        categoryResults.skills = false;
        return {
          passes: false,
          rejectionReason: `Job does not require selected skills [${filters.skills.join(', ')}]`,
          failedCategory: 'skills',
          categoryResults,
        };
      }
    }

    // 19. Sources Filter (Within-category OR)
    if (filters.sources && filters.sources.length > 0) {
      const srcName =
        (typeof job.source === 'object' && job.source !== null ? (job.source as any).name : '') ||
        job.sourceName ||
        (job as any).source_name ||
        (typeof job.source === 'string' ? job.source : '') ||
        (job as any).source_type ||
        (job as any).ats_provider ||
        '';
      const jobSource = srcName.toLowerCase();
      const matchSource = filters.sources.some((s) => jobSource.includes(s.toLowerCase()));
      if (!matchSource) {
        categoryResults.sources = false;
        return {
          passes: false,
          rejectionReason: `Job source "${jobSource || 'unknown'}" not in selected sources [${filters.sources.join(', ')}]`,
          failedCategory: 'sources',
          categoryResults,
        };
      }
    }

    // 20. Experiences Filter
    if (filters.experiences && filters.experiences.length > 0) {
      const jobExp = String(job.minExperienceYears ?? job.experience_min ?? job.experience ?? '');
      const matchExp = filters.experiences.some((exp) => jobExp.toLowerCase().includes(exp.toLowerCase()) || titleLower.includes(exp.toLowerCase()));
      if (!matchExp) {
        categoryResults.experience = false;
        return {
          passes: false,
          rejectionReason: `Experience level does not match selected options`,
          failedCategory: 'experience',
          categoryResults,
        };
      }
    }
    if (filters.experienceMin && filters.experienceMin > 0) {
      const jobExpMin = job.minExperienceYears ?? job.experience_min;
      if (jobExpMin !== undefined && jobExpMin < filters.experienceMin) {
        categoryResults.experience = false;
        return {
          passes: false,
          rejectionReason: `Job minimum experience (${jobExpMin} yrs) below requested (${filters.experienceMin} yrs)`,
          failedCategory: 'experience',
          categoryResults,
        };
      }
    }

    // 21. Minimum Match Score Filter
    if (filters.matchPercentageMin && filters.matchPercentageMin > 0) {
      const score = (job as any).match?.overallScore ?? (job as any).matchScore ?? (job as any).profile_match_score ?? 0;
      if (score < filters.matchPercentageMin) {
        categoryResults.matchScore = false;
        return {
          passes: false,
          rejectionReason: `Job match score (${score}%) below required minimum (${filters.matchPercentageMin}%)`,
          failedCategory: 'matchScore',
          categoryResults,
        };
      }
    }

    // 22. Target Companies Only (Multi-flag sync)
    if (filters.targetCompaniesOnly && !job.isTargetCompany && !job.target_company && !(job as any).is_target_company) {
      categoryResults.targetCompany = false;
      return {
        passes: false,
        rejectionReason: 'Not a target company',
        failedCategory: 'targetCompany',
        categoryResults,
      };
    }

    // 23. CRM Status Filter (Within-category OR)
    if (filters.crmStatuses && filters.crmStatuses.length > 0) {
      const currentCRM = (job.crm_status || (job.lifecycleState === 'SAVED' ? 'Saved' : job.lifecycleState === 'APPLIED' ? 'Applied' : 'Viewed')) as any;
      if (!filters.crmStatuses.includes(currentCRM)) {
        return {
          passes: false,
          rejectionReason: `CRM Status "${currentCRM}" not in selected statuses [${filters.crmStatuses.join(', ')}]`,
          failedCategory: 'verification',
          categoryResults,
        };
      }
    }

    // 24. Lifecycle State Filter (Within-category OR)
    if (filters.lifecycleStates && filters.lifecycleStates.length > 0) {
      const currentState = job.lifecycleState || 'DISCOVERED';
      if (!filters.lifecycleStates.includes(currentState)) {
        return {
          passes: false,
          rejectionReason: `Lifecycle State "${currentState}" not in selected states`,
          failedCategory: 'verification',
          categoryResults,
        };
      }
    }

    // Passed all cross-category checks!
    return {
      passes: true,
      categoryResults,
    };
  }
}

export const filterEvaluationEngine = new FilterEvaluationEngine();
