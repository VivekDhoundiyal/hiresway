import React, { useState, useMemo } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Typography } from '@/components/typography';
import {
  JobOpportunity,
  RemoteType,
  RemoteScope,
  SalaryPeriod,
  SeniorityLevel,
  EmploymentType,
} from '@/core/jobs/types';
import { jobRepository } from '@/core/jobs/jobRepository';
import { jobVerificationEngine } from '@/core/jobs/jobVerificationEngine';
import { CheckCircle2, AlertTriangle, Link as LinkIcon, Building2, Briefcase } from 'lucide-react';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobAdded: (job: JobOpportunity) => void;
}

export const AddJobModal: React.FC<AddJobModalProps> = ({ isOpen, onClose, onJobAdded }) => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isOfflineOpportunity, setIsOfflineOpportunity] = useState(false);
  const [location, setLocation] = useState('');
  const [workArrangement, setWorkArrangement] = useState<RemoteType>('remote');
  const [remoteScope, setRemoteScope] = useState<RemoteScope>('worldwide');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full-time');
  const [seniority, setSeniority] = useState<SeniorityLevel>('senior');
  const [department, setDepartment] = useState('');
  const [industry, setIndustry] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('INR');
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>('yearly');
  const [datePosted, setDatePosted] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [recruiterLinkedin, setRecruiterLinkedin] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [notes, setNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  // Real-time URL feedback & ATS detection
  const urlCheck = useMemo(() => {
    if (isOfflineOpportunity || !jobUrl.trim()) return null;
    const check = jobVerificationEngine.verifyJobUrl(jobUrl.trim());
    const ats = jobVerificationEngine.detectAtsPlatform(jobUrl.trim());
    return { ...check, ats };
  }, [jobUrl, isOfflineOpportunity]);

  // Real-time duplicate check
  const duplicateWarning = useMemo(() => {
    if (!company.trim() || !title.trim()) return null;
    const check = jobRepository.checkDuplicateJob({
      company: company.trim(),
      title: title.trim(),
      jobUrl: isOfflineOpportunity ? undefined : jobUrl.trim(),
    });
    return check.isDuplicate ? check.reason : null;
  }, [company, title, jobUrl, isOfflineOpportunity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Job Title is required.');
      return;
    }
    if (!company.trim()) {
      setFormError('Company Name is required.');
      return;
    }
    if (!isOfflineOpportunity) {
      if (!jobUrl.trim()) {
        setFormError('Job URL is required for public opportunities.');
        return;
      }
      if (urlCheck && !urlCheck.isValid) {
        setFormError(urlCheck.reason || 'Invalid application URL destination.');
        return;
      }
    }
    if (!location.trim()) {
      setFormError('Location is required.');
      return;
    }

    const minNum = salaryMin ? parseFloat(salaryMin.replace(/[^0-9.]/g, '')) : undefined;
    const maxNum = salaryMax ? parseFloat(salaryMax.replace(/[^0-9.]/g, '')) : undefined;

    if (minNum && maxNum && minNum > maxNum) {
      setFormError('Salary minimum cannot exceed salary maximum.');
      return;
    }

    const skillsArray = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const createdJob = jobRepository.addManualJob({
        title: title.trim(),
        company: company.trim(),
        jobUrl: isOfflineOpportunity ? '#' : jobUrl.trim(),
        location: location.trim(),
        remoteStatus: workArrangement,
        workArrangement,
        remoteScope,
        employmentType,
        seniority,
        department: department.trim() || undefined,
        industry: industry.trim() || undefined,
        salaryMin: minNum,
        salaryMax: maxNum,
        salaryCurrency,
        salaryPeriod,
        datePosted: datePosted || 'not_disclosed',
        postingDate: datePosted || 'not_disclosed',
        closingDate: closingDate || undefined,
        sourceName: sourceName.trim() || (isOfflineOpportunity ? 'Private Opportunity' : 'Manual Entry'),
        recruiterName: recruiterName.trim() || undefined,
        recruiterEmail: recruiterEmail.trim() || undefined,
        recruiterLinkedin: recruiterLinkedin.trim() || undefined,
        description: description.trim() || `${title.trim()} role at ${company.trim()}.`,
        requiredSkills: skillsArray,
        notes: notes.trim() || undefined,
      });

      onJobAdded(createdJob);
      onClose();
    } catch (err: unknown) {
      setFormError((err as Error)?.message || 'Failed to save job to database.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Opportunity to Job Database"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto px-1 pr-2">
        {formError && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-body-sm text-red-800 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{formError}</span>
          </div>
        )}

        {duplicateWarning && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-body-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{duplicateWarning}. Saving will update the existing entry.</span>
          </div>
        )}

        {/* 1. Core Identification */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Job Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. Senior Enterprise Account Executive"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              leftIcon={<Briefcase className="h-4 w-4 text-text-muted" />}
            />
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. Datadog, Stripe"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              leftIcon={<Building2 className="h-4 w-4 text-text-muted" />}
            />
          </div>
        </div>

        {/* 2. Original Job URL & Offline Option */}
        <div className="space-y-2 p-3.5 rounded-lg bg-surface-subtle/50 border border-border">
          <div className="flex items-center justify-between">
            <label className="text-caption font-semibold text-text-primary flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5 text-text-muted" />
              <span>Original Job Posting URL {!isOfflineOpportunity && <span className="text-red-500">*</span>}</span>
            </label>
            <label className="flex items-center gap-1.5 text-caption cursor-pointer text-text-secondary select-none">
              <input
                type="checkbox"
                checked={isOfflineOpportunity}
                onChange={(e) => setIsOfflineOpportunity(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span>Private / offline opportunity</span>
            </label>
          </div>

          {!isOfflineOpportunity && (
            <>
              <Input
                placeholder="https://careers.company.com/jobs/12345 or ATS link"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                required={!isOfflineOpportunity}
              />
              {urlCheck && (
                <div className="text-[11.5px] pt-1">
                  {urlCheck.isValid ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Valid Destination: {urlCheck.ats.label}
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {urlCheck.reason}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 3. Location, Remote Scope & Seniority */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Location / Market <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. Bengaluru, India or Worldwide"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Work Arrangement <span className="text-red-500">*</span>
            </label>
            <select
              value={workArrangement}
              onChange={(e) => setWorkArrangement(e.target.value as RemoteType)}
              className="w-full h-9 rounded-md border border-border bg-surface px-2.5 text-body-sm text-text-primary focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="on-site">On-site</option>
            </select>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Remote Scope
            </label>
            <select
              value={remoteScope}
              onChange={(e) => setRemoteScope(e.target.value as RemoteScope)}
              className="w-full h-9 rounded-md border border-border bg-surface px-2.5 text-body-sm text-text-primary focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="worldwide">Worldwide / Work From Anywhere</option>
              <option value="india">India Only</option>
              <option value="specific_countries">Specific Countries</option>
              <option value="region">Region Restricted</option>
              <option value="unknown">Undisclosed / Unknown</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Seniority Level
            </label>
            <select
              value={seniority}
              onChange={(e) => setSeniority(e.target.value as SeniorityLevel)}
              className="w-full h-9 rounded-md border border-border bg-surface px-2.5 text-body-sm text-text-primary focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead / Staff</option>
              <option value="manager">Manager</option>
              <option value="director">Director</option>
              <option value="executive">VP / Executive</option>
            </select>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Employment Type
            </label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
              className="w-full h-9 rounded-md border border-border bg-surface px-2.5 text-body-sm text-text-primary focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="full-time">Full-time</option>
              <option value="contract">Contract</option>
              <option value="part-time">Part-time</option>
              <option value="internship">Internship</option>
            </select>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Department
            </label>
            <Input
              placeholder="e.g. Sales, Growth"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Industry / Sector
            </label>
            <Input
              placeholder="e.g. Enterprise SaaS"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
        </div>

        {/* 4. Compensation */}
        <div className="p-3.5 rounded-lg bg-surface-subtle/50 border border-border space-y-2">
          <Typography as="h4" variant="caption" className="font-semibold text-text-primary uppercase tracking-wider">
            Compensation Benchmark (Optional)
          </Typography>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] text-text-secondary mb-1">Min Base</label>
              <Input
                placeholder="e.g. 4500000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-text-secondary mb-1">Max Base</label>
              <Input
                placeholder="e.g. 6500000"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-text-secondary mb-1">Currency</label>
              <select
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-surface px-2 text-body-sm text-text-primary"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="SGD">SGD (S$)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-text-secondary mb-1">Period</label>
              <select
                value={salaryPeriod}
                onChange={(e) => setSalaryPeriod(e.target.value as SalaryPeriod)}
                className="w-full h-9 rounded-md border border-border bg-surface px-2 text-body-sm text-text-primary"
              >
                <option value="yearly">Annual</option>
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
                <option value="not_disclosed">Not Disclosed</option>
              </select>
            </div>
          </div>
        </div>

        {/* 5. Dates & Source */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Recruiter Posted Date
            </label>
            <Input
              type="date"
              value={datePosted}
              onChange={(e) => setDatePosted(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Application Deadline
            </label>
            <Input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-primary mb-1">
              Source Name
            </label>
            <Input
              placeholder="e.g. Official ATS, Referral"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
            />
          </div>
        </div>

        {/* 6. Recruiter Contact Details */}
        <div className="p-3.5 rounded-lg bg-surface-subtle/50 border border-border space-y-2">
          <Typography as="h4" variant="caption" className="font-semibold text-text-primary uppercase tracking-wider">
            Recruiter / Contact Information (Optional)
          </Typography>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] text-text-secondary mb-1">Name</label>
              <Input
                placeholder="e.g. Sarah Jenkins"
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-text-secondary mb-1">Email</label>
              <Input
                type="email"
                placeholder="recruiter@company.com"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-text-secondary mb-1">LinkedIn Profile</label>
              <Input
                placeholder="https://linkedin.com/in/..."
                value={recruiterLinkedin}
                onChange={(e) => setRecruiterLinkedin(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 7. Skills & Description */}
        <div>
          <label className="block text-caption font-semibold text-text-primary mb-1">
            Required Skills (Comma separated)
          </label>
          <Input
            placeholder="Enterprise Sales, B2B SaaS, MEDDPICC, Deal Closure"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-caption font-semibold text-text-primary mb-1">
            Job Description / Responsibilities
          </label>
          <textarea
            rows={4}
            className="w-full rounded-md border border-border bg-surface p-2.5 text-body-sm text-text-primary focus:outline-hidden focus:ring-2 focus:ring-primary"
            placeholder="Paste authentic job description, key responsibilities, and requirements..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-caption font-semibold text-text-primary mb-1">
            Personal Notes
          </label>
          <Input
            placeholder="e.g. Discussed with Sarah on LinkedIn; strong fit for Q4 quota."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Add to Job Database
          </Button>
        </div>
      </form>
    </Modal>
  );
};
