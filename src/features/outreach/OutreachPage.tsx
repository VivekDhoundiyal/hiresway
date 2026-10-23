import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProfile } from '@/core/profile';
import {
  generateOutreachDraft,
  OutreachBlueprint,
  JobPosting,
  jobRepository,
  opportunityToJobPosting,
  createTargetJobFromProfile,
} from '@/core/intelligence';
import { outreachEngine } from '@/core/outreach';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Badge } from '@/components/badge';
import { Sparkles, Copy, Check, Mail, Building2 } from 'lucide-react';

export const OutreachPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useProfile();

  const queryJobId = searchParams.get('jobId');
  const queryCompany = searchParams.get('company');

  const availableJobs: JobPosting[] = useMemo(() => {
    const dbOpps = jobRepository.getDatabaseOpportunities();
    const activeOpps = jobRepository.getActiveOpportunities();
    const combined = [...dbOpps, ...activeOpps];

    if (queryJobId) {
      const specific = jobRepository.getOpportunityById(queryJobId);
      if (specific && !combined.some((j) => j.id === queryJobId)) {
        combined.unshift(specific);
      }
    }

    return combined.map(opportunityToJobPosting);
  }, [queryJobId]);

  const fallbackJob: JobPosting = useMemo(
    () =>
      createTargetJobFromProfile(profile, {
        company:
          queryCompany ||
          profile.targetMarkets?.targetCompanies?.[0] ||
          'Target Employer',
      }),
    [profile, queryCompany]
  );

  const initialJobId = useMemo(() => {
    if (queryJobId) return queryJobId;
    if (queryCompany) {
      const found = availableJobs.find(
        (j) => j.company.toLowerCase() === queryCompany.toLowerCase()
      );
      if (found) return found.id;
    }
    return availableJobs[0]?.id || 'profile-target-role';
  }, [queryJobId, queryCompany, availableJobs]);

  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);

  const matchedJobOpp = useMemo(() => {
    return jobRepository.getOpportunityById(selectedJobId);
  }, [selectedJobId]);

  const [recipientName, setRecipientName] = useState(() => {
    const opp = jobRepository.getOpportunityById(initialJobId);
    return opp?.recruiterName || 'Hiring Lead';
  });

  React.useEffect(() => {
    if (matchedJobOpp?.recruiterName) {
      setRecipientName(matchedJobOpp.recruiterName);
    }
  }, [matchedJobOpp]);
  const [copied, setCopied] = useState(false);

  const [outreachLog, setOutreachLog] = useState<any[]>(() => {
    const list = outreachEngine.getRecordsSync();
    if (list.length > 0) return list;
    return [
      {
        id: 'log-1',
        recipientName: 'David Kim (VP Sales)',
        company: 'CloudScale Dynamics',
        channel: 'LinkedIn InMail',
        sentDate: '2 days ago',
        status: 'sent',
      },
      {
        id: 'log-2',
        recipientName: 'Elena Rostova (Lead Recruiter)',
        company: 'StripeWave Systems',
        channel: 'Direct Email',
        sentDate: '4 days ago',
        status: 'replied',
      },
    ];
  });

  React.useEffect(() => {
    const unsub = outreachEngine.subscribe((records) => {
      if (records.length > 0) {
        setOutreachLog(records);
      }
    });
    return unsub;
  }, []);

  const selectedJob = useMemo(() => {
    return availableJobs.find((j) => j.id === selectedJobId) || availableJobs[0] || fallbackJob;
  }, [availableJobs, selectedJobId, fallbackJob]);

  const draft: OutreachBlueprint = useMemo(() => {
    return generateOutreachDraft(profile, selectedJob, recipientName);
  }, [profile, selectedJob, recipientName]);

  const [customBody, setCustomBody] = useState<string>(draft.bodyText);

  React.useEffect(() => {
    setCustomBody(draft.bodyText);
  }, [draft.bodyText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${draft.subjectLine}\n\n${customBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleMailto = () => {
    const subjectEnc = encodeURIComponent(draft.subjectLine);
    const bodyEnc = encodeURIComponent(customBody);
    window.open(`mailto:?subject=${subjectEnc}&body=${bodyEnc}`, '_blank');
  };

  const handleLogOutreach = async () => {
    await outreachEngine.logOutreach({
      jobId: selectedJob.id,
      company: selectedJob.company,
      recipientName: recipientName,
      channel: 'Direct Email',
      subjectLine: draft.subjectLine,
      bodyText: customBody,
      status: 'sent',
    });
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* 1. Header */}
      <div className="space-y-3 pb-5 border-b border-border/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Typography
                as="h1"
                variant="h2"
                color="primary"
                className="text-2xl sm:text-3xl font-bold tracking-tight"
              >
                Outreach & Networking
              </Typography>
              <Badge variant="primary" size="sm" icon={<Sparkles className="h-3 w-3" />}>
                Context-Aware Personalization
              </Badge>
            </div>
            <Typography as="p" variant="body-md" color="secondary" className="mt-1">
              Generate high-conversion outreach referencing verified achievements directly
              from your canonical profile.
            </Typography>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/target-companies')}
            leftIcon={<Building2 className="h-4 w-4" />}
          >
            Target Companies
          </Button>
        </div>
      </div>

      {/* 2. Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card variant="default" padding="md" className="space-y-4">
            <Typography
              as="h3"
              variant="body-md"
              color="primary"
              className="font-semibold border-b border-border pb-2"
            >
              Outreach Parameters
            </Typography>

            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-text-secondary">
                Target Opportunity
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                aria-label="Target Opportunity"
                className="w-full h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {availableJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} — {job.company}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-text-secondary">
                Recipient Contact Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Sarah Jenkins"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
              {matchedJobOpp?.recruiterEmail || matchedJobOpp?.recruiterLinkedin ? (
                <div className="text-[11.5px] text-text-secondary space-y-0.5 pt-0.5">
                  {matchedJobOpp.recruiterEmail && (
                    <p>
                      Email:{' '}
                      <a
                        href={`mailto:${matchedJobOpp.recruiterEmail}`}
                        className="text-primary hover:underline"
                      >
                        {matchedJobOpp.recruiterEmail}
                      </a>
                    </p>
                  )}
                  {matchedJobOpp.recruiterLinkedin && (
                    <p>
                      LinkedIn:{' '}
                      <a
                        href={matchedJobOpp.recruiterLinkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Verified Profile ↗
                      </a>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11.5px] text-text-muted italic pt-0.5">
                  Recruiter contact not available from listing source.
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/70">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Value Proposition Highlight:
              </span>
              <p className="text-caption text-text-secondary">{draft.valueProposition}</p>
            </div>
          </Card>

          <Card variant="default" padding="md" className="space-y-3">
            <Typography
              as="h3"
              variant="body-md"
              color="primary"
              className="font-semibold flex items-center justify-between"
            >
              <span>Recent Outreach Log</span>
              <span className="text-caption text-text-muted font-normal">
                {outreachLog.length} messages
              </span>
            </Typography>

            <div className="space-y-2">
              {outreachLog.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-surface-subtle border border-border/60 text-caption space-y-1"
                >
                  <div className="flex items-center justify-between font-medium text-text-primary">
                    <span>{log.recipient}</span>
                    <span className="text-text-muted">{log.date}</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>{log.company}</span>
                    <span className="text-primary font-medium">{log.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Preview */}
        <div className="lg:col-span-2 space-y-4">
          <Card variant="default" padding="lg" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
              <div>
                <Typography
                  as="h3"
                  variant="h3"
                  color="primary"
                  className="font-semibold"
                >
                  Personalized Outreach Draft
                </Typography>
                <p className="text-caption text-text-muted mt-0.5">
                  Tailored for {selectedJob.title} at {selectedJob.company}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMailto}
                  leftIcon={<Mail className="h-4 w-4" />}
                >
                  Send via Email
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCopy}
                  leftIcon={
                    copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />
                  }
                >
                  {copied ? 'Copied!' : 'Copy Message'}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-caption font-semibold text-text-secondary">
                Subject Line
              </label>
              <div className="p-2.5 rounded-md bg-surface-subtle border border-border text-body-sm font-medium text-text-primary">
                {draft.subjectLine}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-text-secondary">
                Message Body
              </label>
              <textarea
                rows={12}
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                className="w-full rounded-md bg-surface text-body-md text-text-primary p-4 border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-sans leading-relaxed resize-y shadow-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-caption text-text-muted">
                Zero fabrication: Facts and metrics reflect your saved work experiences.
              </span>
              <Button variant="secondary" size="sm" onClick={handleLogOutreach}>
                Mark as Sent & Log
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
