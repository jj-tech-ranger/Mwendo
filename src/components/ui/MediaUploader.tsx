import React, { useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface MediaUploaderProps {
  label?: string;
  helperText?: string;
  accept?: string;
  maxSizeMb?: number;
  value?: string; // image preview URL
  onChange?: (file: File | null) => void;
  className?: string;
  isAvatarMode?: boolean;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  label = 'Upload Photo',
  helperText = 'PNG, JPG or WebP up to 5MB',
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeMb = 5,
  value,
  onChange,
  className,
  isAvatarMode = false,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMb}MB limit.`);
      return;
    }

    setError(null);
    setProgress(20);

    // Simulated local preview generation & progress
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setProgress(null);
      if (onChange) onChange(file);
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setError(null);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onChange) onChange(null);
  };

  return (
    <div className={cn('w-full space-y-2', className)}>
      {label && (
        <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider">
          {label}
        </label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
      />

      {previewUrl ? (
        <div
          className={cn(
            'relative overflow-hidden border border-outline-variant/40 bg-surface-container-low flex items-center justify-center group',
            isAvatarMode ? 'w-24 h-24 rounded-full mx-auto' : 'w-full h-40 rounded-2xl'
          )}
        >
          <img
            src={previewUrl}
            alt="Upload Preview"
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-on-background/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Change
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={handleClear}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFileSelect(e.dataTransfer.files?.[0] || null);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'w-full p-lg border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 bg-surface-container-low hover:bg-surface-container',
            dragOver ? 'border-primary bg-primary-container/10' : 'border-outline-variant/50',
            isAvatarMode && 'max-w-xs mx-auto'
          )}
        >
          <div className="w-12 h-12 rounded-full bg-secondary-container/30 text-secondary flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-2xl">
              {isAvatarMode ? 'photo_camera' : 'cloud_upload'}
            </span>
          </div>

          <p className="font-headline-lg-mobile text-xs text-on-surface font-bold">
            Click or drag image to upload
          </p>
          <p className="font-body-sm text-[11px] text-on-surface-variant mt-0.5">{helperText}</p>

          {progress !== null && (
            <div className="w-full max-w-xs mt-3 bg-surface-container rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs font-body-sm text-error">{error}</p>}
    </div>
  );
};
