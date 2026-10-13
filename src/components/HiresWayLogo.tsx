import React from 'react';

interface HiresWayLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const HiresWayLogo: React.FC<HiresWayLogoProps> = ({
  className = '',
  iconOnly = false,
  size = 'md',
}) => {
  const iconHeight = size === 'sm' ? 'h-6' : size === 'lg' ? 'h-9' : 'h-8';
  const textHeight = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon Mark with Image + SVG Fallback */}
      <div className={`${iconHeight} aspect-square relative flex items-center justify-center shrink-0`}>
        <img
          src="/hiresway-logo.png"
          alt="HiresWay"
          className={`${iconHeight} w-auto object-contain drop-shadow-xs`}
          onError={(e) => {
            // Hide img if failed and reveal SVG
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        {/* Crisp vector fallback SVG */}
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${iconHeight} w-auto object-contain hidden`}
        >
          <defs>
            <linearGradient id="hwBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00A3FF" />
              <stop offset="100%" stopColor="#0055FE" />
            </linearGradient>
            <linearGradient id="hwGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00E599" />
              <stop offset="100%" stopColor="#00A86B" />
            </linearGradient>
            <linearGradient id="hwRibbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0066FF" />
              <stop offset="50%" stopColor="#00C4FF" />
              <stop offset="100%" stopColor="#00E599" />
            </linearGradient>
          </defs>
          {/* Left Vertical Pillar */}
          <rect x="6" y="6" width="11" height="36" rx="5.5" fill="url(#hwBlueGrad)" />
          {/* Right Vertical Pillar */}
          <rect x="31" y="6" width="11" height="36" rx="5.5" fill="url(#hwGreenGrad)" />
          {/* Sweeping Dynamic Arrow Ribbon */}
          <path
            d="M 11 26 C 16 34, 24 24, 34 16 L 39 12 M 39 12 L 32 11 M 39 12 L 40 19"
            stroke="url(#hwRibbonGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Wordmark */}
      {!iconOnly && (
        <span className={`${textHeight} font-extrabold tracking-tight text-slate-900 flex items-center leading-none`}>
          <span>Hires</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500">
            Way
          </span>
        </span>
      )}
    </div>
  );
};
