import React from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { AlertTriangle } from 'lucide-react';

interface DisableAllSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  activeCount: number;
}

export const DisableAllSourcesModal: React.FC<DisableAllSourcesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  activeCount,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Disable All Sources?"
      description="This will pause automated and manual discovery polling across all currently active sources."
      size="sm"
    >
      <div className="space-y-4 pt-1">
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">
              You are about to disable {activeCount} active sources
            </span>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              When all sources are disabled, future discovery runs will not return new opportunities until you re-enable your preferred sources or click "Activate All Eligible Sources".
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="font-semibold"
          >
            Disable All {activeCount} Sources
          </Button>
        </div>
      </div>
    </Modal>
  );
};
