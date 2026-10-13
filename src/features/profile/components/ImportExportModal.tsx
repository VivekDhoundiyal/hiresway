import React, { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { ErrorState } from '@/components/feedback';
import {
  Download,
  Upload,
  Copy,
  Check,
  FileJson,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

export interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportJson: () => string;
  importJson: (json: string) => { success: boolean; error?: string };
  downloadJsonFile: () => void;
  resetProfile: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  exportJson,
  importJson,
  downloadJsonFile,
  resetProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'reset'>('export');
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);

  const jsonString = exportJson();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
        setImportError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    setImportError(null);
    setImportSuccess(false);

    if (!importText.trim()) {
      setImportError('Please paste or upload JSON content before importing.');
      return;
    }

    const res = importJson(importText);
    if (res.success) {
      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        onClose();
      }, 1200);
    } else {
      setImportError(res.error || 'Failed to import profile.');
    }
  };

  const handleExecuteReset = () => {
    resetProfile();
    setResetConfirmed(true);
    setTimeout(() => {
      setResetConfirmed(false);
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile Data Management"
      description="Backup, transfer, or restore your complete professional identity record"
      size="lg"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-border/80 pb-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('export');
              setImportError(null);
            }}
            className={`px-3 py-1.5 rounded-md text-body-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
            }`}
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('import');
              setImportError(null);
            }}
            className={`px-3 py-1.5 rounded-md text-body-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
            }`}
          >
            Import JSON
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('reset');
              setImportError(null);
            }}
            className={`px-3 py-1.5 rounded-md text-body-sm font-medium transition-colors ${
              activeTab === 'reset'
                ? 'bg-error text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
            }`}
          >
            Reset
          </button>
        </div>

        {/* Tab 1: Export */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <p className="text-body-sm text-text-secondary">
              Download your structured profile as a standalone JSON document. You can
              store this locally, use it as a backup, or restore it on any device.
            </p>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={downloadJsonFile}
              >
                Download .JSON File
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={
                  copied ? (
                    <Check className="h-4 w-4 text-accent" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )
                }
                onClick={handleCopy}
              >
                {copied ? 'Copied to Clipboard' : 'Copy JSON'}
              </Button>
            </div>

            <div className="relative">
              <pre className="max-h-60 overflow-y-auto p-3.5 rounded-lg bg-surface-subtle border border-border text-caption font-mono text-text-secondary leading-relaxed">
                {jsonString}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: Import */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <p className="text-body-sm text-text-secondary">
              Upload or paste a previously exported CareerOs profile JSON. The file will
              be verified and merged safely into your local repository.
            </p>

            {importError && <ErrorState variant="inline" message={importError} />}

            {importSuccess && (
              <div className="p-3 rounded-md bg-accent-soft border border-green-200 text-accent text-body-sm flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>Profile imported and restored successfully!</span>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 cursor-pointer p-3 border border-dashed border-border rounded-lg hover:border-primary hover:bg-surface-subtle/50 transition-colors text-body-sm text-text-secondary">
                <FileJson className="h-5 w-5 text-primary" />
                <span>Click to choose a .json backup file...</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Or paste raw JSON content below:
              </label>
              <textarea
                rows={7}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError(null);
                }}
                placeholder='{"version": "1.0.0", "personalInfo": { ... }}'
                className="w-full rounded-md bg-surface text-caption font-mono text-text-primary p-3 border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Upload className="h-4 w-4" />}
                onClick={handleApplyImport}
                disabled={!importText.trim()}
              >
                Apply & Save Profile
              </Button>
            </div>
          </div>
        )}

        {/* Tab 3: Reset */}
        {activeTab === 'reset' && (
          <div className="space-y-4 p-4 rounded-lg bg-error-soft/30 border border-red-200">
            <div className="flex items-start gap-3 text-error">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-body-md block">
                  Restore Starter Template
                </span>
                <p className="text-body-sm text-text-secondary mt-1">
                  This will reset all profile fields back to the baseline starter
                  template. Any custom work experience, notes, and skills will be
                  overwritten.
                </p>
              </div>
            </div>

            {resetConfirmed && (
              <div className="p-2.5 rounded bg-accent-soft text-accent text-body-sm font-medium flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                <span>Profile has been reset to defaults.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<RotateCcw className="h-4 w-4" />}
                onClick={handleExecuteReset}
              >
                Confirm Reset to Default
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
