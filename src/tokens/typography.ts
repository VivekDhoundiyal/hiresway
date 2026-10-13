/**
 * CareerOs Typography Tokens
 * Consistent modern sans-serif scale designed for accessible clarity across Web & Mobile
 */
export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  fontSize: {
    display: {
      size: '2.25rem', // 36px
      lineHeight: '2.75rem', // 44px
      letterSpacing: '-0.025em',
      fontWeight: '700',
    },
    h1: {
      size: '1.875rem', // 30px
      lineHeight: '2.25rem', // 36px
      letterSpacing: '-0.02em',
      fontWeight: '700',
    },
    h2: {
      size: '1.5rem', // 24px
      lineHeight: '2rem', // 32px
      letterSpacing: '-0.015em',
      fontWeight: '600',
    },
    h3: {
      size: '1.25rem', // 20px
      lineHeight: '1.75rem', // 28px
      letterSpacing: '-0.01em',
      fontWeight: '600',
    },
    bodyLarge: {
      size: '1rem', // 16px
      lineHeight: '1.5rem', // 24px
      letterSpacing: '0',
      fontWeight: '400',
    },
    bodyMedium: {
      size: '0.875rem', // 14px
      lineHeight: '1.25rem', // 20px
      letterSpacing: '0',
      fontWeight: '400',
    },
    bodySmall: {
      size: '0.75rem', // 12px
      lineHeight: '1rem', // 16px
      letterSpacing: '0',
      fontWeight: '400',
    },
    caption: {
      size: '0.6875rem', // 11px
      lineHeight: '0.875rem', // 14px
      letterSpacing: '0.02em',
      fontWeight: '500',
    },
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export type TypographyTokens = typeof typography;
