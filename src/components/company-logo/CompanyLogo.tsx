import React, { useState, useEffect } from 'react';
import {
  companyIdentityService,
  CompanyIdentity,
} from '@/core/companies/companyIdentityService';
import { CompanyLogoData } from '@/core/jobs/types';

export type CompanyLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface CompanyLogoProps {
  company: string;
  domain?: string;
  logoUrl?: string;
  logoData?: CompanyLogoData;
  size?: CompanyLogoSize;
  className?: string;
  showTooltip?: boolean;
}

const SIZE_CONFIG: Record<
  CompanyLogoSize,
  { container: string; img: string; text: string; padding: string }
> = {
  xs: {
    container: 'w-5 h-5 min-w-[20px] rounded-md',
    img: 'w-3.5 h-3.5',
    text: 'text-[9px] font-semibold',
    padding: 'p-0.5',
  },
  sm: {
    container: 'w-7 h-7 min-w-[28px] rounded-lg',
    img: 'w-5 h-5',
    text: 'text-[11px] font-semibold',
    padding: 'p-1',
  },
  md: {
    container: 'w-10 h-10 min-w-[40px] rounded-xl shadow-3xs',
    img: 'w-6 h-6',
    text: 'text-xs font-semibold',
    padding: 'p-1.5',
  },
  lg: {
    container: 'w-12 h-12 min-w-[48px] rounded-xl shadow-3xs',
    img: 'w-8 h-8',
    text: 'text-sm font-semibold',
    padding: 'p-2',
  },
  xl: {
    container: 'w-14 h-14 min-w-[56px] rounded-2xl shadow-2xs',
    img: 'w-9 h-9',
    text: 'text-base font-semibold',
    padding: 'p-2.5',
  },
};

// Global memory cache for resolved working logo URLs to skip repeat candidate trials
const workingLogoUrlCache = new Map<string, string>();
const failedLogoUrlCache = new Set<string>();

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  company,
  domain,
  logoUrl,
  logoData,
  size = 'md',
  className = '',
  showTooltip = false,
}) => {
  const cacheKey = (domain || company || '').toLowerCase().trim();
  const cachedWorkingUrl = workingLogoUrlCache.get(cacheKey);

  const initialUrl = cachedWorkingUrl || logoData?.url || logoUrl;
  const identity: CompanyIdentity = companyIdentityService.getCompanyIdentity(
    company,
    domain,
    initialUrl
  );

  const sizeStyles = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  // Candidates list in cascade order, filtering out known failed URLs
  const [sources, setSources] = useState<string[]>(() => {
    const list: string[] = [];
    if (cachedWorkingUrl && !failedLogoUrlCache.has(cachedWorkingUrl)) {
      list.push(cachedWorkingUrl);
    }
    if (initialUrl && initialUrl.startsWith('http') && !failedLogoUrlCache.has(initialUrl)) {
      if (!list.includes(initialUrl)) list.push(initialUrl);
    }
    (identity?.candidateUrls || []).forEach((u) => {
      if (!list.includes(u) && !failedLogoUrlCache.has(u)) {
        list.push(u);
      }
    });
    return list;
  });

  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Re-sync when props change
  useEffect(() => {
    const updated = companyIdentityService.getCompanyIdentity(company, domain, logoData?.url || logoUrl);
    const list: string[] = [];
    const passedUrl = logoData?.url || logoUrl;
    if (passedUrl && passedUrl.startsWith('http')) {
      list.push(passedUrl);
    }
    (updated?.candidateUrls || []).forEach((u) => {
      if (!list.includes(u)) {
        list.push(u);
      }
    });

    setSources(list);
    setSourceIndex(0);
    setHasError(false);
    setIsLoaded(false);
  }, [company, domain, logoUrl, logoData?.url]);

  const handleImageError = () => {
    const failedUrl = sources[sourceIndex];
    if (failedUrl) {
      failedLogoUrlCache.add(failedUrl);
    }
    if (sourceIndex + 1 < sources.length) {
      setSourceIndex((prev) => prev + 1);
      setIsLoaded(false);
    } else {
      setHasError(true);
    }
  };

  const handleImageLoad = () => {
    const loadedUrl = sources[sourceIndex];
    if (loadedUrl) {
      workingLogoUrlCache.set(cacheKey, loadedUrl);
    }
    setIsLoaded(true);
  };

  // Fallback state: clean neutral monogram (white background, subtle border, no neon colors)
  if (hasError || sources.length === 0) {
    const displayName = identity?.canonicalName || company || 'Company';
    const initialText = identity?.initial || (displayName.substring(0, 2) || 'CO').toUpperCase();

    return (
      <div
        className={`flex items-center justify-center select-none shrink-0 border border-gray-200 bg-white text-gray-700 dark:text-gray-200 ${sizeStyles.container} ${className}`}
        style={{ backgroundColor: '#ffffff' }}
        title={showTooltip ? displayName : undefined}
        aria-label={`${displayName} logo`}
      >
        <span className={sizeStyles.text}>{initialText}</span>
      </div>
    );
  }

  const currentUrl = sources[sourceIndex];
  const displayName = identity?.canonicalName || company || 'Company';
  const initialText = identity?.initial || (displayName.substring(0, 2) || 'CO').toUpperCase();

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 bg-white border border-gray-200/90 overflow-hidden select-none ${sizeStyles.container} ${sizeStyles.padding} ${className}`}
      style={{ backgroundColor: '#ffffff' }}
      title={showTooltip ? displayName : undefined}
      aria-label={`${displayName} logo`}
    >
      {/* Fallback initials while image is loading in the background */}
      {!isLoaded && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-white text-gray-400 ${sizeStyles.text}`}
          style={{ backgroundColor: '#ffffff' }}
        >
          {initialText}
        </div>
      )}

      {/* Real company logo image - strictly preserved original brand colors, no grayscale */}
      <img
        key={currentUrl}
        src={currentUrl}
        alt={`${identity.canonicalName} logo`}
        loading="lazy"
        decoding="async"
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`object-contain transition-opacity duration-150 ${sizeStyles.img} ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          filter: 'none',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />
    </div>
  );
};
