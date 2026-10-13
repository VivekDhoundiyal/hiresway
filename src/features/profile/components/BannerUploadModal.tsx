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
  Image as ImageIcon,
} from 'lucide-react';

export interface BannerUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBannerUrl?: string;
  onSave: (bannerUrl: string) => void;
  onRemove: () => void;
}

export const BannerUploadModal: React.FC<BannerUploadModalProps> = ({
  isOpen,
  onClose,
  currentBannerUrl,
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

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file must be under 10MB.');
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

    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // Scale to cover the 3:1 banner area
    const scaleX = cw / img.width;
    const scaleY = ch / img.height;
    const coverScale = Math.max(scaleX, scaleY);
    const currentScale = coverScale * zoom;

    const drawWidth = img.width * currentScale;
    const drawHeight = img.height * currentScale;

    const centerX = cw / 2 + offset.x;
    const centerY = ch / 2 + offset.y;

    const x = centerX - drawWidth / 2;
    const y = centerY - drawHeight / 2;

    ctx.save();
    // Rounded rect clip for banner preview
    ctx.beginPath();
    ctx.roundRect(0, 0, cw, ch, 8);
    ctx.clip();
    ctx.drawImage(img, x, y, drawWidth, drawHeight);
    ctx.restore();

    // Border guideline
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, cw - 2, ch - 2);
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

    // Render optimized 1200x400 banner
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 1200;
    exportCanvas.height = 400;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    const cw = 1200;
    const ch = 400;

    const scaleX = cw / img.width;
    const scaleY = ch / img.height;
    const coverScale = Math.max(scaleX, scaleY);
    const currentScale = coverScale * zoom;

    const drawWidth = img.width * currentScale;
    const drawHeight = img.height * currentScale;

    // Scale canvas offset to export resolution (canvas width is 600, export is 1200 => ratio is 2)
    const ratio = 1200 / 600;
    const centerX = cw / 2 + offset.x * ratio;
    const centerY = ch / 2 + offset.y * ratio;

    const x = centerX - drawWidth / 2;
    const y = centerY - drawHeight / 2;

    ctx.drawImage(img, x, y, drawWidth, drawHeight);

    // Export compressed JPEG data URL
    const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.85);
    onSave(dataUrl);
    onClose();
  };

  const handleRemoveExisting = () => {
    onRemove();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={imageSrc ? 'Crop & Adjust Cover Photo' : 'Update Cover Photo'}
      description="Select and adjust a wide banner image for your profile header (3:1 aspect ratio recommended)."
      size="lg"
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
                <ImageIcon className="h-6 w-6" />
              </div>

              <span className="text-body-md font-medium text-text-primary block mb-1">
                Click to browse or drag and drop cover photo
              </span>
              <span className="text-caption text-text-muted block">
                PNG, JPEG or WebP (max 10MB). Minimum 1200×400px recommended.
              </span>
            </div>

            {currentBannerUrl && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-subtle border border-border">
                <span className="text-body-sm text-text-secondary">
                  A custom cover banner is currently active on your profile.
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 className="h-4 w-4 text-error" />}
                  onClick={handleRemoveExisting}
                  className="text-error hover:bg-error-soft"
                >
                  Remove Current Banner
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Canvas Cropper View */
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <div className="relative rounded-lg overflow-hidden border border-border shadow-inner bg-slate-900 cursor-grab active:cursor-grabbing w-full max-w-[600px]">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="block w-full h-auto"
                />
              </div>
              <span className="text-caption text-text-muted mt-2">
                Click and drag to pan / reposition the banner image.
              </span>
            </div>

            {/* Controls */}
            <div className="p-3 bg-surface-subtle rounded-lg border border-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <ZoomOut className="h-4 w-4 text-text-muted shrink-0" />
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full sm:w-48 accent-primary cursor-pointer"
                  aria-label="Zoom level"
                />
                <ZoomIn className="h-4 w-4 text-text-muted shrink-0" />
                <span className="text-caption text-text-secondary font-mono">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setZoom(1);
                    setOffset({ x: 0, y: 0 });
                  }}
                >
                  Reset
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Upload className="h-3.5 w-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace
                </Button>
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
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-error-soft text-error rounded-lg text-body-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          {imageSrc && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Check className="h-4 w-4" />}
              onClick={handleApply}
            >
              Apply Cover Photo
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
