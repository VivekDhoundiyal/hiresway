import React, { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { sourceRegistry } from '@/core/jobs/sourceRegistry';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Play,
  Sparkles,
} from 'lucide-react';

interface ActivateAllSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDiscovery: () => void;
  onViewRegistry: () => void;
}

type ModalStep = 'confirm' | 'activating' | 'complete';

export const ActivateAllSourcesModal: React.FC<ActivateAllSourcesModalProps> = ({
  isOpen,
  onClose,
  onStartDiscovery,
  onViewRegistry,
}) => {
  const [step, setStep] = useState<ModalStep>('confirm');
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    percent: number;
    currentCategory: string;
  }>({ completed: 0, total: 0, percent: 0, currentCategory: '' });

  const [finalReport, setFinalReport] = useState<{
    activatedCount: number;
    alreadyActiveCount: number;
    unavailableCount: number;
    requiresConfigCount: number;
    unsupportedCount: number;
  } | null>(null);

  const breakdown = sourceRegistry.getEligibilityBreakdown();

  const handleReset = () => {
    setStep('confirm');
    setProgress({ completed: 0, total: 0, percent: 0, currentCategory: '' });
    setFinalReport(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleStartActivation = async () => {
    setStep('activating');
    setProgress({
      completed: 0,
      total: breakdown.eligibleInactiveCount,
      percent: 0,
      currentCategory: 'company career sources',
    });

    try {
      const result = await sourceRegistry.activateAllEligible((completed, total, cat) => {
        setProgress({
          completed,
          total,
          percent: Math.round((completed / total) * 100),
          currentCategory: cat,
        });
      });

      setFinalReport(result);
      setStep('complete');
    } catch (err) {
      console.error('Failed to activate sources:', err);
      setStep('confirm');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        step === 'complete'
          ? 'All Eligible Sources Activated'
          : step === 'activating'
          ? 'Activating Sources'
          : 'Activate All Sources?'
      }
      description={
        step === 'complete'
          ? 'CareerOs has enabled all eligible sources. Your next discovery run will search across this complete ecosystem.'
          : step === 'activating'
          ? 'Enabling verified endpoints across company ATS portals, startup directories, and remote boards.'
          : 'CareerOs will enable all eligible sources currently available in your Source Registry.'
      }
      size="md"
    >
      <div className="space-y-4 pt-1">
        {/* STEP 1: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {/* Impact notice */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 space-y-2">
              <span className="font-semibold block flex items-center gap-1.5 text-blue-950">
                <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                This will expand your live discovery scope:
              </span>
              <ul className="space-y-1 text-blue-800/90 pl-4 list-disc">
                <li>Increase the number of authentic jobs discovered</li>
                <li>Increase automated duplicate detection workload</li>
                <li>Increase live URL & requisition verification requests</li>
                <li>Slightly increase discovery scan execution time</li>
                <li>Increase the verified data volume entering your Job Feed</li>
              </ul>
            </div>

            {/* Dynamic Eligibility Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-700 block">
                Source Inventory & Eligibility Split
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-[11px] text-gray-500 block">Total Registered</span>
                  <span className="text-base font-bold text-gray-900">
                    {breakdown.totalRegistered.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-[11px] text-emerald-700 block font-medium">Eligible for Discovery</span>
                  <span className="text-base font-bold text-emerald-900">
                    {breakdown.eligibleCount.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-[11px] text-blue-700 block font-medium">Already Active</span>
                  <span className="text-base font-bold text-blue-900">
                    {breakdown.alreadyActiveCount.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200">
                  <span className="text-[11px] text-amber-700 block font-medium">Temporarily Unavailable</span>
                  <span className="text-base font-bold text-amber-900">
                    {breakdown.unavailableCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-50/80 border border-purple-200">
                  <span className="text-[11px] text-purple-700 block font-medium">Require Configuration</span>
                  <span className="text-base font-bold text-purple-900">
                    {breakdown.requiresConfigCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-[11px] text-gray-500 block">Unsupported</span>
                  <span className="text-base font-bold text-gray-700">
                    {breakdown.unsupportedCount}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 italic">
              * "Activate All" will enable only the {breakdown.eligibleCount.toLocaleString()} eligible sources. Broken endpoints, rate-limited hosts, and unconfigured portals remain safely isolated.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleStartActivation}
                className="font-semibold"
              >
                Activate All {breakdown.eligibleCount.toLocaleString()} Eligible Sources
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Activating Progress */}
        {step === 'activating' && (
          <div className="py-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto animate-pulse">
              <Layers className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                Activating sources…
              </p>
              <p className="text-xs text-gray-500">
                {progress.completed} / {progress.total} activated
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-sm mx-auto bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-200 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <p className="text-xs text-blue-700">
              Current: Activating {progress.currentCategory}…
            </p>
          </div>
        )}

        {/* STEP 3: Complete Report */}
        {step === 'complete' && finalReport && (
          <div className="py-2 space-y-4">
            <div className="text-center space-y-1">
              <div className="h-11 w-11 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-base font-bold text-gray-900">
                All eligible sources activated
              </p>
              <p className="text-xs text-gray-500">
                Your Source Registry is fully prepared for multi-source discovery.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">New Sources Enabled:</span>
                <strong className="text-emerald-700 font-bold">
                  {finalReport.activatedCount.toLocaleString()} sources
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Sources Already Active:</span>
                <span className="text-gray-700 font-medium">
                  {finalReport.alreadyActiveCount} sources
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Temporarily Unavailable (Skipped):</span>
                <span className="text-amber-700 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {finalReport.unavailableCount} sources
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Requires Configuration (Skipped):</span>
                <span className="text-purple-700 font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {finalReport.requiresConfigCount} sources
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  handleClose();
                  onViewRegistry();
                }}
              >
                View Source Registry
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  handleClose();
                  onStartDiscovery();
                }}
                leftIcon={<Play className="h-3.5 w-3.5 fill-current" />}
                className="font-semibold"
              >
                Start Discovery
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
