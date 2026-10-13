import React, { useState, useRef } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import {
  JobOpportunity,
  ImportRowValidation,
  ImportBatchRecord,
  JobImportDecision,
} from '@/core/jobs/types';
import { excelImportService } from '@/core/jobs/excelImportService';
import { jobRepository } from '@/core/jobs/jobRepository';
import {
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface ImportJobsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (batchId: string) => void;
}

type ImportStep = 'template' | 'upload' | 'validate' | 'review' | 'importing' | 'report';

export const ImportJobsModal: React.FC<ImportJobsModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('template');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validation results
  const [validations, setValidations] = useState<{
    validRows: ImportRowValidation[];
    warningRows: ImportRowValidation[];
    errorRows: ImportRowValidation[];
    totalRows: number;
  }>({
    validRows: [],
    warningRows: [],
    errorRows: [],
    totalRows: 0,
  });

  // Duplicate decisions state
  const [rowDecisions, setRowDecisions] = useState<Record<number, JobImportDecision>>({});

  // Final Report stats
  const [reportStats, setReportStats] = useState<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    rejectedCount: number;
    batchId: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadTemplate = () => {
    excelImportService.downloadJobImportTemplate();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleRunValidation = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an Excel (.xlsx) or CSV file first.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const existingJobs = jobRepository.getDatabaseOpportunities();
      const results = await excelImportService.parseAndValidateSpreadsheet(
        selectedFile,
        existingJobs
      );

      setValidations(results);

      // Initialize decisions for possible duplicates
      const initialDecisions: Record<number, JobImportDecision> = {};
      [...results.validRows, ...results.warningRows].forEach((r) => {
        initialDecisions[r.rowNumber] = r.userDecision || 'import_new';
      });
      setRowDecisions(initialDecisions);

      // If errors only, stay on validate; else if duplicates exist, go to review
      setCurrentStep('validate');
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to parse file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecisionChange = (rowNumber: number, decision: JobImportDecision) => {
    setRowDecisions((prev) => ({ ...prev, [rowNumber]: decision }));
  };

  const handleExecuteImport = () => {
    const candidateRows = [...validations.validRows, ...validations.warningRows];
    if (candidateRows.length === 0) {
      setErrorMessage('No valid rows available to import.');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('importing');

    setTimeout(() => {
      try {
        const batchId = `batch-${Date.now()}`;
        const jobsToImport: JobOpportunity[] = [];
        const resultsLog: ImportBatchRecord['results'] = [];

        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        candidateRows.forEach((r) => {
          const decision = rowDecisions[r.rowNumber] || 'import_new';

          if (decision === 'skip') {
            skippedCount++;
            resultsLog.push({
              rowNumber: r.rowNumber,
              title: (r.rawData['job_title'] as string) || 'Untitled',
              company: (r.rawData['company'] as string) || 'Unknown',
              status: 'skipped',
              verificationStatus: 'unverified',
              reason: 'Skipped by user decision',
            });
            return;
          }

          if (r.parsedJob) {
            const jobObj = {
              ...r.parsedJob,
              importBatchId: batchId,
            } as JobOpportunity;

            jobsToImport.push(jobObj);

            if (decision === 'update_existing') {
              updatedCount++;
              resultsLog.push({
                rowNumber: r.rowNumber,
                title: jobObj.title,
                company: jobObj.company,
                status: 'updated',
                verificationStatus: jobObj.verificationStatus,
                reason: 'Updated existing record',
              });
            } else {
              importedCount++;
              resultsLog.push({
                rowNumber: r.rowNumber,
                title: jobObj.title,
                company: jobObj.company,
                status: 'imported',
                verificationStatus: jobObj.verificationStatus,
              });
            }
          }
        });

        // Add error rows to results log
        validations.errorRows.forEach((r) => {
          resultsLog.push({
            rowNumber: r.rowNumber,
            title: (r.rawData['job_title'] as string) || 'Invalid Row',
            company: (r.rawData['company'] as string) || 'Unknown',
            status: 'rejected',
            verificationStatus: 'unverified',
            reason: r.issues.map((i) => i.message).join('; '),
          });
        });

        const batchRecord: ImportBatchRecord = {
          id: batchId,
          filename: selectedFile?.name || 'Import.xlsx',
          importedAt: new Date().toISOString(),
          totalRows: validations.totalRows,
          validCount: validations.validRows.length,
          warningCount: validations.warningRows.length,
          errorCount: validations.errorRows.length,
          importedCount,
          updatedCount,
          skippedCount,
          rejectedCount: validations.errorRows.length,
          results: resultsLog,
        };

        jobRepository.importBatch(jobsToImport, batchRecord);

        setReportStats({
          importedCount,
          updatedCount,
          skippedCount,
          rejectedCount: validations.errorRows.length,
          batchId,
        });

        setCurrentStep('report');
      } catch (err: unknown) {
        setErrorMessage((err as Error)?.message || 'Import execution failed.');
        setCurrentStep('validate');
      } finally {
        setIsProcessing(false);
      }
    }, 600);
  };

  const handleDownloadErrors = () => {
    if (validations.errorRows.length === 0) return;
    excelImportService.downloadErrorReport(validations.errorRows, selectedFile?.name || 'Import');
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidations({ validRows: [], warningRows: [], errorRows: [], totalRows: 0 });
    setRowDecisions({});
    setReportStats(null);
    setCurrentStep('upload');
  };

  const candidateDuplicates = [...validations.validRows, ...validations.warningRows].filter(
    (r) => r.duplicateStatus !== 'new'
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Opportunities via Excel / CSV"
      size="xl"
    >
      <div className="space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-border pb-3 text-caption font-medium text-text-muted">
          <div className="flex items-center gap-1 sm:gap-2">
            <span
              className={`px-2 py-0.5 rounded ${
                currentStep === 'template' ? 'bg-primary text-white font-bold' : 'bg-surface-subtle text-text-primary'
              }`}
            >
              1. Template
            </span>
            <span>→</span>
            <span
              className={`px-2 py-0.5 rounded ${
                currentStep === 'upload' ? 'bg-primary text-white font-bold' : 'bg-surface-subtle text-text-primary'
              }`}
            >
              2. Upload
            </span>
            <span>→</span>
            <span
              className={`px-2 py-0.5 rounded ${
                currentStep === 'validate' ? 'bg-primary text-white font-bold' : 'bg-surface-subtle text-text-primary'
              }`}
            >
              3. Validate
            </span>
            <span>→</span>
            <span
              className={`px-2 py-0.5 rounded ${
                currentStep === 'review' ? 'bg-primary text-white font-bold' : 'bg-surface-subtle text-text-primary'
              }`}
            >
              4. Review
            </span>
            <span>→</span>
            <span
              className={`px-2 py-0.5 rounded ${
                currentStep === 'report' ? 'bg-primary text-white font-bold' : 'bg-surface-subtle text-text-primary'
              }`}
            >
              5. Complete
            </span>
          </div>

          <span className="text-[11.5px] text-text-secondary hidden sm:inline">
            Truth-First Ingestion Pipeline
          </span>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-body-sm text-red-800 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Template */}
        {currentStep === 'template' && (
          <div className="space-y-4 py-2">
            <div className="p-5 rounded-xl bg-surface-subtle/50 border border-border space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <Typography as="h3" variant="body-md" className="font-bold text-text-primary">
                    Download CareerOs Import Template
                  </Typography>
                  <Typography as="p" variant="body-sm" color="muted" className="mt-1 leading-relaxed">
                    The template includes two sheets: <strong className="text-text-primary">Jobs</strong> (formatted with all mandatory and optional columns, plus authentic sample rows) and <strong className="text-text-primary">Instructions</strong> (complete specifications for permitted values, remote scopes, and dates).
                  </Typography>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-body-sm text-amber-800 dark:text-amber-300 text-caption">
                <strong>Verification Safety Notice:</strong> Imported jobs enter your database with provenance and undergo source URL validation. They are marked as <em>"Imported — Needs Verification"</em> until confirmed live at the source.
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  variant="primary"
                  onClick={handleDownloadTemplate}
                  leftIcon={<Download className="h-4 w-4" />}
                >
                  Download Excel Template (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('upload')}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Skip to Upload
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Upload */}
        {currentStep === 'upload' && (
          <div className="space-y-4 py-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 rounded-xl border-2 border-dashed border-border hover:border-primary/60 transition-colors text-center cursor-pointer space-y-3 bg-surface-subtle/30"
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <UploadCloud className="h-6 w-6" />
              </div>

              <div>
                <span className="font-semibold text-text-primary text-body-md">
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop spreadsheet'}
                </span>
                <p className="text-caption text-text-muted mt-1">
                  Supports Excel (.xlsx) and CSV (.csv) files up to 10MB.
                </p>
              </div>

              {selectedFile && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface text-caption font-medium border border-border text-text-primary">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.csv"
              onChange={handleFileSelected}
              className="hidden"
            />

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setCurrentStep('template')}>
                Back to Template
              </Button>
              <Button
                variant="primary"
                onClick={handleRunValidation}
                disabled={!selectedFile || isProcessing}
                leftIcon={isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : undefined}
                rightIcon={!isProcessing ? <ArrowRight className="h-4 w-4" /> : undefined}
              >
                {isProcessing ? 'Validating Spreadsheet...' : 'Validate Spreadsheet'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Validate Preview */}
        {currentStep === 'validate' && (
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg bg-surface border border-border">
                <span className="text-caption text-text-muted">Total Rows</span>
                <div className="text-2xl font-bold text-text-primary">{validations.totalRows}</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-caption text-emerald-700 dark:text-emerald-300">Valid</span>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {validations.validRows.length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-caption text-amber-700 dark:text-amber-300">Warnings</span>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {validations.warningRows.length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="text-caption text-red-700 dark:text-red-300">Errors (Blocked)</span>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {validations.errorRows.length}
                </div>
              </div>
            </div>

            {/* Validation Table */}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-left text-body-sm border-collapse">
                <thead>
                  <tr className="bg-surface-subtle border-b border-border text-caption font-semibold text-text-muted">
                    <th className="py-2 px-3 w-14">Row</th>
                    <th className="py-2 px-3">Job Title & Company</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Issues / Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {[...validations.validRows, ...validations.warningRows, ...validations.errorRows]
                    .sort((a, b) => a.rowNumber - b.rowNumber)
                    .map((r) => (
                      <tr key={r.rowNumber} className="hover:bg-surface-subtle/30">
                        <td className="py-2 px-3 text-caption font-mono text-text-muted">
                          #{r.rowNumber}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-text-primary text-body-sm">
                            {(r.rawData['job_title'] as string) || 'Missing Title'}
                          </div>
                          <div className="text-caption text-text-secondary">
                            {(r.rawData['company'] as string) || 'Missing Company'}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {r.status === 'valid' ? (
                            <Badge variant="success" size="sm">Valid</Badge>
                          ) : r.status === 'warning' ? (
                            <Badge variant="warning" size="sm">Warning</Badge>
                          ) : (
                            <Badge variant="error" size="sm">Error</Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-caption">
                          {r.issues.length === 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready for import</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {r.issues.map((iss, i) => (
                                <li
                                  key={i}
                                  className={
                                    iss.type === 'error'
                                      ? 'text-red-600 dark:text-red-400 font-medium'
                                      : 'text-amber-700 dark:text-amber-400'
                                  }
                                >
                                  • {iss.message}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button variant="outline" onClick={handleReset}>
                Fix & Re-upload
              </Button>

              <div className="flex items-center gap-2">
                {validations.errorRows.length > 0 && (
                  <Button variant="outline" onClick={handleDownloadErrors} leftIcon={<Download className="h-4 w-4" />}>
                    Download Error Report
                  </Button>
                )}

                {candidateDuplicates.length > 0 ? (
                  <Button
                    variant="primary"
                    onClick={() => setCurrentStep('review')}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Review {candidateDuplicates.length} Duplicates
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleExecuteImport}
                    disabled={validations.validRows.length + validations.warningRows.length === 0}
                  >
                    Import {validations.validRows.length + validations.warningRows.length} Valid Rows
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Review & Duplicates */}
        {currentStep === 'review' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border">
              <span className="text-body-sm font-semibold text-text-primary">
                Duplicate Resolution Review ({candidateDuplicates.length} matches found)
              </span>
              <p className="text-caption text-text-muted mt-0.5">
                CareerOs detected possible duplicates in your database. Select your preferred decision for each row.
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {candidateDuplicates.map((r) => (
                <div
                  key={r.rowNumber}
                  className="p-3.5 rounded-lg border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-caption font-mono text-text-muted">Row #{r.rowNumber}</span>
                      <span className="font-semibold text-body-sm text-text-primary">
                        {(r.rawData['job_title'] as string)}
                      </span>
                      <span className="text-text-muted">•</span>
                      <span className="text-body-sm text-text-secondary">
                        {(r.rawData['company'] as string)}
                      </span>
                    </div>
                    <p className="text-caption text-amber-700 dark:text-amber-400">
                      Reason: {r.duplicateReason}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={rowDecisions[r.rowNumber] || 'import_new'}
                      onChange={(e) => handleDecisionChange(r.rowNumber, e.target.value as JobImportDecision)}
                      className="h-8 rounded-md border border-border bg-surface px-2 text-caption text-text-primary font-medium"
                    >
                      <option value="keep_existing">Keep Existing Record</option>
                      <option value="update_existing">Update Existing Record</option>
                      <option value="import_new">Import as Separate Job</option>
                      <option value="skip">Skip This Row</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button variant="outline" onClick={() => setCurrentStep('validate')}>
                Back to Preview
              </Button>
              <Button variant="primary" onClick={handleExecuteImport}>
                Apply Decisions & Import Opportunities
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: Importing Progress */}
        {currentStep === 'importing' && (
          <div className="py-12 text-center space-y-4">
            <RefreshCw className="h-10 w-10 text-primary animate-spin mx-auto" />
            <div>
              <Typography as="h3" variant="h3" className="text-text-primary">
                Ingesting Opportunities...
              </Typography>
              <Typography as="p" variant="body-sm" color="muted" className="mt-1">
                Sanitizing rows, updating canonical fingerprints, and initiating automated source verification.
              </Typography>
            </div>
          </div>
        )}

        {/* STEP 6: Report */}
        {currentStep === 'report' && reportStats && (
          <div className="space-y-5 py-2">
            <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <Typography as="h3" variant="h3" className="text-emerald-800 dark:text-emerald-200">
                Import Complete!
              </Typography>
              <Typography as="p" variant="body-sm" className="text-emerald-700 dark:text-emerald-300">
                Your database has been updated with genuine, structured job opportunities.
              </Typography>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-lg bg-surface border border-border">
                <span className="text-caption text-text-muted">Imported New</span>
                <div className="text-xl font-bold text-emerald-600">{reportStats.importedCount}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <span className="text-caption text-text-muted">Updated Existing</span>
                <div className="text-xl font-bold text-primary">{reportStats.updatedCount}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <span className="text-caption text-text-muted">Skipped</span>
                <div className="text-xl font-bold text-text-muted">{reportStats.skippedCount}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <span className="text-caption text-text-muted">Rejected (Errors)</span>
                <div className="text-xl font-bold text-red-600">{reportStats.rejectedCount}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button variant="outline" onClick={handleReset}>
                Import Another File
              </Button>

              <div className="flex items-center gap-2">
                {reportStats.rejectedCount > 0 && (
                  <Button variant="outline" onClick={handleDownloadErrors} leftIcon={<Download className="h-4 w-4" />}>
                    Download Error Report
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => {
                    onImportComplete(reportStats.batchId);
                    onClose();
                  }}
                  leftIcon={<Eye className="h-4 w-4" />}
                >
                  View Imported Jobs
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
