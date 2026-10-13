/**
 * CareerOs Border Radius Tokens
 * Restrained geometric curves for clean, approachable, and professional surfaces
 */
export const radii = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export type RadiiTokens = typeof radii;
