import React, { useState } from 'react';
import { userContextService, AuthModal } from '@/core/auth';
import { useProfile } from '@/core/profile';
import { jobRepository } from '@/core/jobs/jobRepository';
import { applicationEngine } from '@/core/applications';
import { outreachEngine } from '@/core/outreach';
import { documentEngine } from '@/core/documents';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import {
  Settings,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  Users,
  CheckCircle2,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { profile } = useProfile();
  const session = userContextService.getSession();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'switch'>('switch');

  // Discovery Preferences
  const [minScore, setMinScore] = useState<number>(() => {
    return Number(localStorage.getItem('careeros_min_match_score') || 40);
  });
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('careeros_autosync_disabled') !== 'true';
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSavePreferences = () => {
    localStorage.setItem('careeros_min_match_score', String(minScore));
    localStorage.setItem('careeros_autosync_disabled', String(!isAutoSyncEnabled));
    showStatus('Discovery preferences saved successfully.');
  };

  const handleExportWorkspace = () => {
    const fullBackup = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: session.id,
        email: session.email,
        displayName: session.displayName,
      },
      profile: profile,
      applications: applicationEngine.getApplicationsSync(),
      outreach: outreachEngine.getRecordsSync(),
      documents: documentEngine.getDocumentsSync(),
      savedOpportunities: jobRepository.getSavedOpportunities(),
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `careeros_workspace_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Workspace backup JSON downloaded.');
  };

  const handleImportWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || typeof json !== 'object') throw new Error('Invalid JSON');

        if (json.applications && Array.isArray(json.applications)) {
          for (const app of json.applications) {
            await applicationEngine.createApplication(app);
          }
        }

        if (json.documents && Array.isArray(json.documents)) {
          for (const doc of json.documents) {
            await documentEngine.saveDocument(doc);
          }
        }

        alert('Backup data successfully merged into your workspace!');
        window.location.reload();
      } catch {
        alert('Failed to parse backup JSON. Please check file structure.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearCache = () => {
    if (window.confirm('Clear cached unacted job feed items? Your saved jobs, applications, and documents are 100% preserved.')) {
      jobRepository.pruneExpiredJobs();
      showStatus('Discovery feed cache cleared.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 animate-fadeIn">
      {/* Header */}
      <div className="pb-5 border-b border-border space-y-1">
        <div className="flex items-center gap-3">
          <Typography as="h1" variant="h2" color="primary" className="text-2xl sm:text-3xl font-bold tracking-tight">
            Settings & System Preferences
          </Typography>
          <Badge variant="primary" size="sm" icon={<Settings className="h-3 w-3" />}>
            Preferences
          </Badge>
        </div>
        <Typography as="p" variant="body-md" color="secondary">
          Manage your local cryptographic identity, discovery filters, background scheduling, and data portability.
        </Typography>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 1. Account & Cryptographic Security */}
      <Card variant="bordered" padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Account & Local Authentication
            </Typography>
            <Typography as="p" variant="body-sm" color="secondary" className="mt-0.5">
              Zero-cost local security powered by Web Crypto PBKDF2-SHA256.
            </Typography>
          </div>
          <Badge variant="primary" size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            PBKDF2 Protected
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-subtle border border-border text-xs">
          <div>
            <span className="text-text-muted block">Active User:</span>
            <span className="font-bold text-text-primary text-sm">
              {profile.personalInfo.fullName || session.displayName || 'Default Candidate'}
            </span>
          </div>
          <div>
            <span className="text-text-muted block">Identity Scope / ID:</span>
            <span className="font-mono text-text-secondary">{session.id || 'user-primary-1'}</span>
          </div>
          <div>
            <span className="text-text-muted block">Email:</span>
            <span className="font-medium text-text-primary">{profile.personalInfo.email || session.email || 'local@hiresway.internal'}</span>
          </div>
          <div>
            <span className="text-text-muted block">Session Expiration:</span>
            <span className="text-text-secondary">{session.expiresAt ? new Date(session.expiresAt).toLocaleDateString() : '7 Days (Rolling)'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAuthMode('switch');
              setIsAuthModalOpen(true);
            }}
            leftIcon={<Users className="h-4 w-4" />}
          >
            Switch Account
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAuthMode('register');
              setIsAuthModalOpen(true);
            }}
          >
            Create New Local Account
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              userContextService.logout();
              window.location.reload();
            }}
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            Sign Out
          </Button>
        </div>
      </Card>

      {/* 2. Job Discovery & Matching Controls */}
      <Card variant="bordered" padding="lg" className="space-y-4">
        <div>
          <Typography as="h2" variant="h3" color="primary">
            Job Discovery & Match Gate Controls
          </Typography>
          <Typography as="p" variant="body-sm" color="secondary" className="mt-0.5">
            Tune algorithmic parameters for candidate matching and freshness policy.
          </Typography>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <div className="flex items-center justify-between text-caption font-semibold text-text-primary mb-1">
              <span>Strict Relevance Match Score Gate: {minScore}%</span>
              <span className="text-text-muted font-normal text-xs">Jobs below this score will not pollute your primary feed</span>
            </div>
            <input
              type="range"
              min={20}
              max={80}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[11px] text-text-muted">
              <span>Broad Discovery (20%)</span>
              <span>Recommended (40%)</span>
              <span>Ultra-Strict (80%)</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-subtle border border-border">
            <div>
              <p className="text-body-sm font-semibold text-text-primary">Continuous Background Scheduler</p>
              <p className="text-caption text-text-muted">
                Periodically probes connected ATS endpoints without blocking user interactions.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isAutoSyncEnabled}
              onChange={(e) => setIsAutoSyncEnabled(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-subtle border border-border">
            <div>
              <p className="text-body-sm font-semibold text-text-primary">14-Day Freshness Retention Rule</p>
              <p className="text-caption text-text-muted">
                Unacted jobs older than 14 days automatically expire. User-saved and tracked jobs survive indefinitely.
              </p>
            </div>
            <Badge variant="success" size="sm">
              Active Enforcement
            </Badge>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={handleSavePreferences}>
              Save Discovery Preferences
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. Data Portability & Workspace Backup */}
      <Card variant="bordered" padding="lg" className="space-y-4">
        <div>
          <Typography as="h2" variant="h3" color="primary">
            Data Portability & Workspace Backups
          </Typography>
          <Typography as="p" variant="body-sm" color="secondary" className="mt-0.5">
            Export or restore your full CareerOS data: profiles, applications, outreach notes, and tailored resumes.
          </Typography>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportWorkspace}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Export Complete Workspace (.json)
          </Button>

          <label className="cursor-pointer inline-flex items-center">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-subtle text-text-primary transition-colors cursor-pointer">
              <Upload className="h-4 w-4" />
              Restore From Backup
            </span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportWorkspace}
              className="hidden"
            />
          </label>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearCache}
            leftIcon={<RefreshCw className="h-4 w-4 text-text-muted" />}
          >
            Prune Stale Discovered Cache
          </Button>
        </div>
      </Card>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
};
