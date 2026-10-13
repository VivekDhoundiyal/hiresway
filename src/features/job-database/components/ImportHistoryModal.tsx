import React, { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { ImportBatchRecord } from '@/core/jobs/types';
import { jobRepository } from '@/core/jobs/jobRepository';
import { FileSpreadsheet, Calendar, ChevronRight } from 'lucide-react';

interface ImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBatch: (batchId: string) => void;
}

export const ImportHistoryModal: React.FC<ImportHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectBatch,
}) => {
  const history = jobRepository.getImportHistory();
  const [selectedBatch, setSelectedBatch] = useState<ImportBatchRecord | null>(
    history.length > 0 ? history[0] : null
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Spreadsheet Import History"
      size="xl"
    >
      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="py-12 text-center text-text-muted space-y-2">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-text-muted/60" />
            <p className="text-body-sm">No spreadsheet imports recorded yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Batch List Column */}
            <div className="space-y-2 md:border-r md:border-border md:pr-4 max-h-96 overflow-y-auto">
              <span className="text-caption font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                Past Batches ({history.length})
              </span>
              {history.map((batch: ImportBatchRecord) => {
                const isSelected = selectedBatch?.id === batch.id;
                const formattedDate = new Date(batch.importedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={batch.id}
                    onClick={() => setSelectedBatch(batch)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary-soft/50 shadow-xs'
                        : 'border-border hover:border-border-strong bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-body-sm text-text-primary truncate max-w-[170px]">
                        {batch.filename}
                      </span>
                      <ChevronRight className="h-4 w-4 text-text-muted" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-caption mt-2 pt-2 border-t border-border/40">
                      <span className="text-emerald-600 font-semibold">{batch.importedCount} added</span>
                      <span>•</span>
                      <span className="text-text-muted">{batch.skippedCount} skipped</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Batch Detail Column */}
            <div className="md:col-span-2 space-y-4 max-h-96 overflow-y-auto pl-1">
              {selectedBatch ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div>
                      <Typography as="h3" variant="body-md" className="font-bold text-text-primary">
                        {selectedBatch.filename}
                      </Typography>
                      <span className="text-caption text-text-muted">
                        Imported on {new Date(selectedBatch.importedAt).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onSelectBatch(selectedBatch.id);
                        onClose();
                      }}
                    >
                      Filter by this Batch
                    </Button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 text-center text-caption">
                    <div className="p-2 rounded bg-surface-subtle border border-border">
                      <span className="text-text-muted block">Total</span>
                      <strong className="text-base text-text-primary">{selectedBatch.totalRows}</strong>
                    </div>
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-700 dark:text-emerald-300 block">Imported</span>
                      <strong className="text-base text-emerald-700 dark:text-emerald-300">{selectedBatch.importedCount}</strong>
                    </div>
                    <div className="p-2 rounded bg-primary/10 border border-primary/20">
                      <span className="text-primary block">Updated</span>
                      <strong className="text-base text-primary">{selectedBatch.updatedCount}</strong>
                    </div>
                    <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                      <span className="text-red-700 dark:text-red-300 block">Rejected</span>
                      <strong className="text-base text-red-700 dark:text-red-300">{selectedBatch.rejectedCount}</strong>
                    </div>
                  </div>

                  {/* Row Level Results */}
                  <div className="space-y-2">
                    <span className="text-caption font-semibold text-text-secondary uppercase tracking-wider block">
                      Row-by-Row Ingestion Log
                    </span>
                    <div className="rounded-lg border border-border divide-y divide-border/60 max-h-48 overflow-y-auto">
                      {selectedBatch.results.map((res, i) => (
                        <div key={i} className="p-2.5 flex items-center justify-between text-body-sm">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-caption font-mono text-text-muted">#{res.rowNumber}</span>
                              <span className="font-semibold text-text-primary truncate">{res.title}</span>
                              <span className="text-text-muted">•</span>
                              <span className="text-text-secondary text-caption truncate">{res.company}</span>
                            </div>
                            {res.reason && (
                              <p className="text-[11px] text-text-muted mt-0.5">{res.reason}</p>
                            )}
                          </div>
                          <Badge
                            variant={
                              res.status === 'imported'
                                ? 'success'
                                : res.status === 'updated'
                                ? 'primary'
                                : res.status === 'skipped'
                                ? 'neutral'
                                : 'error'
                            }
                            size="sm"
                          >
                            {res.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-text-muted">
                  <p>Select a batch to inspect row-level outcomes.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
