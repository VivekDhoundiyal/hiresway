import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import {
  Upload,
  ZoomIn,
  ZoomOut,
  Check,
  RotateCcw,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

export interface ProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  onSave: (avatarUrl: string) => void;
  onRemove?: () => void;
}

export const ProfilePictureModal: React.FC<ProfilePictureModalProps> = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  onSave,
  onRemove,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setImageSrc(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
    }
  }, [isOpen]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, WebP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Image file must be under 8MB.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setImageSrc(src);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        drawCanvas();
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    // Save context for circular clip
    ctx.save();

    // Scale and center image
    const minDim = Math.min(img.width, img.height);
    const baseScale = size / minDim;
    const currentScale = baseScale * zoom;

    const drawWidth = img.width * currentScale;
    const drawHeight = img.height * currentScale;

    const centerX = size / 2 + offset.x;
    const centerY = size / 2 + offset.y;

    const x = centerX - drawWidth / 2;
    const y = centerY - drawHeight / 2;

    ctx.drawImage(img, x, y, drawWidth, drawHeight);
    ctx.restore();

    // Draw circular guideline overlay
    ctx.save();
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Darken exterior
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();
  }, [zoom, offset]);

  useEffect(() => {
    if (imageSrc && imageRef.current) {
      drawCanvas();
    }
  }, [imageSrc, drawCanvas]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleApply = () => {
    const img = imageRef.current;
    if (!img) return;

    // Render clean 256x256 thumbnail to an offscreen canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 256;
    exportCanvas.height = 256;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    const size = 256;
    const minDim = Math.min(img.width, img.height);
    const baseScale = size / minDim;
    const currentScale = baseScale * zoom;

    const drawWidth = img.width * currentScale;
    const drawHeight = img.height * currentScale;

    // Adjust relative to export canvas scale (256 / 280)
    const scaleRatio = 256 / 280;
    const centerX = size / 2 + offset.x * scaleRatio;
    const centerY = size / 2 + offset.y * scaleRatio;

    const x = centerX - drawWidth / 2;
    const y = centerY - drawHeight / 2;

    ctx.drawImage(img, x, y, drawWidth, drawHeight);

    // Export optimized JPEG data URL
    const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.88);
    onSave(dataUrl);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={imageSrc ? 'Crop & Adjust Profile Picture' : 'Upload Profile Picture'}
      description="Select and crop your professional profile photo."
      size="md"
    >
      <div className="space-y-5">
        {!imageSrc ? (
          /* File Selection View */
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary hover:bg-primary-soft/20 rounded-xl p-8 text-center cursor-pointer transition-colors group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              <div className="mx-auto h-12 w-12 rounded-full bg-primary-soft text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Upload className="h-6 w-6" />
              </div>

              <p className="text-body-md font-semibold text-text-primary">
                Click to choose a photo
              </p>
              <p className="text-caption text-text-muted mt-1">
                Supports JPEG, PNG, or WebP up to 8MB
              </p>
            </div>

            {currentAvatarUrl && onRemove && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-subtle border border-border">
                <span className="text-body-sm text-text-secondary">
                  You have a custom profile picture active.
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 className="h-4 w-4 text-error" />}
                  onClick={() => {
                    onRemove();
                    onClose();
                  }}
                  className="text-error hover:bg-error-soft"
                >
                  Remove Photo
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Interactive Crop Canvas View */
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <p className="text-caption text-text-muted mb-2">
                Drag to reposition • Use slider to zoom
              </p>

              <div className="relative rounded-xl overflow-hidden border border-border bg-surface-subtle shadow-sm cursor-grab active:cursor-grabbing">
                <canvas
                  ref={canvasRef}
                  width={280}
                  height={280}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="block"
                />
              </div>
            </div>

            {/* Zoom Slider Control */}
            <div className="flex items-center justify-center gap-3 px-4">
              <ZoomOut className="h-4 w-4 text-text-muted" />
              <input
                type="range"
                min="0.8"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-48 accent-primary cursor-pointer"
                aria-label="Zoom level"
              />
              <ZoomIn className="h-4 w-4 text-text-muted" />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImageSrc(null);
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              >
                Choose Different
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Check className="h-4 w-4" />}
                  onClick={handleApply}
                >
                  Apply Photo
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-body-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
