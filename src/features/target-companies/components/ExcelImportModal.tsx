import React, { useState, useRef } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import {
  targetCompaniesStore,
  targetCompaniesExcelImportService,
} from '@/core/target-companies';
import { ExcelImportPreviewSummary, TargetCompany } from '@/core/jobs/types';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Check,
} from 'lucide-react';
import { TargetCompanyErrorBoundary } from './TargetCompanyErrorBoundary';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (addedCount: number) => void;
}

type ModalStep = 'upload' | 'preview' | 'importing' | 'complete';

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<ModalStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [previewSummary, setPreviewSummary] = useState<ExcelImportPreviewSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importStage, setImportStage] = useState<'preparing' | 'saving' | 'verifying' | 'complete'>('preparing');

  // Progressive enrichment state
  const [importProgress, setImportProgress] = useState<{
    completed: number;
    total: number;
    percent: number;
    latestCompany?: TargetCompany;
  }>({ completed: 0, total: 0, percent: 0 });

  const [finalStats, setFinalStats] = useState<{
    addedCount: number;
    alreadyMonitoredCount: number;
    duplicateCount: number;
    needsReviewCount: number;
    failedCount: number;
    finalPersistentCount: number;
    failedCompanies?: Array<{ name: string; reason: string }>;
  }>({
    addedCount: 0,
    alreadyMonitoredCount: 0,
    duplicateCount: 0,
    needsReviewCount: 0,
    failedCount: 0,
    finalPersistentCount: 0,
    failedCompanies: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('upload');
    setIsDragging(false);
    setIsSubmitting(false);
    setImportStage('preparing');
    setSelectedFileName(null);
    setPreviewSummary(null);
    setErrorMessage(null);
    setImportProgress({ completed: 0, total: 0, percent: 0 });
  };

  const handleClose = () => {
    if (isSubmitting) return; // Prevent closing while transaction is committing
    resetState();
    onClose();
  };

  const handleFileProcess = async (file: File) => {
    setErrorMessage(null);
    setSelectedFileName(file.name);

    const validExtensions = ['.xlsx', '.xls'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage('Please upload a valid Excel spreadsheet (.xlsx or .xls).');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const existing = targetCompaniesStore.getCompanies();
      const summary = await targetCompaniesExcelImportService.parseAndValidateExcel(buffer, existing);

      setPreviewSummary(summary);
      setStep('preview');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to read spreadsheet.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleStartImport = async () => {
    if (!previewSummary || isSubmitting) return;

    const readyRows = previewSummary.rows.filter((r) => r.status === 'ready_to_add');
    if (readyRows.length === 0) {
      setErrorMessage('No companies are ready to add.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStep('importing');
    setImportStage('preparing');
    setImportProgress({ completed: 0, total: readyRows.length, percent: 0 });

    try {
      // Yield to let UI render the importing state
      await new Promise((r) => setTimeout(r, 60));

      setImportStage('saving');
      const entries = readyRows.map((r) => ({
        name: r.cleanedName,
        tag: r.tag || 'Priority',
      }));

      const result = await targetCompaniesStore.importCompaniesBatch(
        entries,
        (completed, total, latest) => {
          setImportProgress({
            completed,
            total,
            percent: Math.round((completed / total) * 100),
            latestCompany: latest,
          });
        }
      );

      setImportStage('verifying');
      await new Promise((r) => setTimeout(r, 60));

      setFinalStats({
        addedCount: result.added.length,
        alreadyMonitoredCount: previewSummary.alreadyMonitoredCount,
        duplicateCount: previewSummary.duplicateInFileCount,
        needsReviewCount: previewSummary.needsReviewCount,
        failedCount: result.failedCount,
        finalPersistentCount: result.finalPersistentCount || targetCompaniesStore.getCompanies().length,
        failedCompanies: result.failedCompanies || [],
      });

      setImportStage('complete');
      setStep('complete');

      // Safely call onImportComplete without letting callback errors break modal completion
      try {
        onImportComplete?.(result.added.length);
      } catch (cbErr) {
        console.error('[ExcelImportModal] onImportComplete callback failed:', cbErr);
      }
    } catch (err: any) {
      console.error('[ExcelImportModal] Import failed:', err);
      setErrorMessage(err.message || 'Import failed. Please try again.');
      setStep('preview');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        step === 'complete'
          ? 'Import Complete'
          : step === 'preview'
          ? 'Review Import'
          : 'Import Target Companies'
      }
      description={
        step === 'complete'
          ? 'Your new target companies have been added and monitoring is active.'
          : step === 'preview'
          ? 'Review and verify detected companies before adding them to your watchlist.'
          : 'Upload an Excel file containing company names. CareerOs will identify each company, find its official careers page, and add it to your monitoring list.'
      }
      size="lg"
    >
      <TargetCompanyErrorBoundary fallbackType="page">
        <div className="space-y-4 pt-1">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Upload Zone */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />

              <div className="flex flex-col items-center justify-center space-y-2.5">
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-800">
                    Drag & drop your Excel file here
                  </p>
                  <p className="text-xs text-gray-500">
                    or <span className="text-blue-600 underline font-medium">Choose File</span> from your computer
                  </p>
                </div>
                <p className="text-[11px] font-medium text-gray-400">
                  Supports .xlsx and .xls files
                </p>
              </div>
            </div>

            {/* Microcopy & Template Download */}
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-600">
              <div className="space-y-0.5">
                <p className="font-semibold text-gray-800">
                  Required column: <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Company Name</span>
                </p>
                <p className="text-gray-500 text-[11px]">
                  Do not add logos, URLs, careers pages, or other information. CareerOs will find those automatically.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => targetCompaniesExcelImportService.downloadExcelTemplate()}
                leftIcon={<Download className="h-3.5 w-3.5 text-gray-500" />}
                className="text-xs shrink-0 h-8"
              >
                Download Excel Template
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Import Preview */}
        {step === 'preview' && previewSummary && (
          <div className="space-y-4">
            {/* Breakdown summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200">
                <span className="text-xs text-blue-700 block font-medium">Ready to Add</span>
                <span className="text-xl font-bold text-blue-900">{previewSummary.readyToAddCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-xs text-gray-600 block font-medium">Already Monitored</span>
                <span className="text-xl font-bold text-gray-800">{previewSummary.alreadyMonitoredCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-xs text-gray-600 block font-medium">In-File Duplicates</span>
                <span className="text-xl font-bold text-gray-800">{previewSummary.duplicateInFileCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200">
                <span className="text-xs text-amber-700 block font-medium">Needs Review</span>
                <span className="text-xl font-bold text-amber-900">{previewSummary.needsReviewCount}</span>
              </div>
            </div>

            {/* Row List */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-gray-700 block">
                Spreadsheet Rows ({previewSummary.totalRowsFound} total found{selectedFileName ? ` • ${selectedFileName}` : ''})
              </span>
              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100 bg-white">
                {previewSummary.rows.map((row) => (
                  <div
                    key={row.rowNumber}
                    className="p-2.5 flex items-center justify-between text-xs hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-gray-400 w-6 shrink-0">
                        #{row.rowNumber}
                      </span>
                      <span className="font-medium text-gray-900 truncate">
                        {row.rawName}
                      </span>
                      {row.resolvedCompany?.domain && (
                        <span className="text-gray-400 text-[11px] truncate">
                          ({row.resolvedCompany.domain})
                        </span>
                      )}
                    </div>

                    <div className="shrink-0">
                      {row.status === 'ready_to_add' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <Check className="h-3 w-3 text-emerald-600 stroke-[3]" />
                          Ready
                        </span>
                      )}
                      {row.status === 'already_monitored' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                          Already Monitored
                        </span>
                      )}
                      {row.status === 'duplicate_in_file' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                          Duplicate in File
                        </span>
                      )}
                      {row.status === 'needs_review' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          Needs Review
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Large File Safety Notice */}
            {previewSummary.readyToAddCount > 100 && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  You are adding <strong>{previewSummary.readyToAddCount}</strong> companies. CareerOs will process and enrich them progressively in the background.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => setStep('upload')}
              >
                Back to Upload
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={previewSummary.readyToAddCount === 0 || isSubmitting}
                isLoading={isSubmitting}
                onClick={handleStartImport}
              >
                {isSubmitting ? 'Importing...' : `Import ${previewSummary.readyToAddCount} Companies`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Progressive Importing State */}
        {step === 'importing' && (
          <div className="py-8 text-center space-y-5">
            <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto animate-pulse">
              <FileSpreadsheet className="h-6 w-6" />
            </div>

            {/* Stages indicator */}
            <div className="flex items-center justify-center gap-2 max-w-sm mx-auto text-[11px] font-medium text-gray-500">
              <span className={`px-2 py-0.5 rounded-full ${importStage === 'preparing' ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-gray-100 text-gray-600'}`}>
                1. Preparing
              </span>
              <span>→</span>
              <span className={`px-2 py-0.5 rounded-full ${importStage === 'saving' ? 'bg-blue-100 text-blue-800 font-bold' : (importStage === 'verifying' || importStage === 'complete' ? 'bg-emerald-100 text-emerald-800 font-medium' : 'bg-gray-100 text-gray-600')}`}>
                2. Saving to Persistent Storage
              </span>
              <span>→</span>
              <span className={`px-2 py-0.5 rounded-full ${importStage === 'verifying' ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-gray-100 text-gray-600'}`}>
                3. Verifying
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                {importStage === 'preparing' && 'Preparing company records...'}
                {importStage === 'saving' && 'Writing & committing to persistent database...'}
                {importStage === 'verifying' && 'Verifying persistent storage records...'}
                {importStage === 'complete' && 'Import complete!'}
              </p>
              <p className="text-xs text-gray-500">
                {importProgress.completed} of {importProgress.total} companies processed ({importProgress.percent}%)
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-sm mx-auto bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, importProgress.percent)}%` }}
              />
            </div>

            {importProgress.latestCompany && (
              <p className="text-xs text-blue-700 animate-fadeIn truncate max-w-md mx-auto">
                Processing: <strong>{importProgress.latestCompany.name}</strong>
              </p>
            )}
          </div>
        )}

        {/* STEP 4: Import Complete Summary */}
        {step === 'complete' && (
          <div className="py-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-base font-bold text-gray-900">Import Complete</p>
              <p className="text-xs text-gray-500">
                Your monitored watchlist has been permanently saved and verified.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Companies Added & Saved:</span>
                <strong className="text-emerald-700 font-bold">{finalStats.addedCount}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Verified Persistent in Database:</span>
                <strong className="text-blue-700 font-bold">{finalStats.finalPersistentCount || targetCompaniesStore.getCompanies().length}</strong>
              </div>
              {finalStats.alreadyMonitoredCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Already Monitored (Skipped):</span>
                  <span className="text-gray-700 font-medium">{finalStats.alreadyMonitoredCount}</span>
                </div>
              )}
              {finalStats.duplicateCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Duplicates in Spreadsheet (Skipped):</span>
                  <span className="text-gray-700 font-medium">{finalStats.duplicateCount}</span>
                </div>
              )}
              {finalStats.needsReviewCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Companies Needing Review:</span>
                  <span className="text-amber-700 font-medium">{finalStats.needsReviewCount}</span>
                </div>
              )}
              {finalStats.failedCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Failed / Unresolved Records:</span>
                  <span className="text-red-700 font-medium">{finalStats.failedCount}</span>
                </div>
              )}
            </div>

            {finalStats.failedCompanies && finalStats.failedCompanies.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Unresolved items ({finalStats.failedCompanies.length}):</p>
                <div className="max-h-24 overflow-y-auto space-y-0.5 text-[11px] text-amber-800">
                  {finalStats.failedCompanies.map((fc, idx) => (
                    <div key={idx}>• {fc.name}: {fc.reason}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <Button type="button" variant="primary" size="sm" onClick={handleClose}>
                View Target Companies
              </Button>
            </div>
          </div>
        )}
      </div>
    </TargetCompanyErrorBoundary>
  </Modal>
  );
};
