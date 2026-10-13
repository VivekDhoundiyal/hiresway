/**
 * CareerOs Responsive Breakpoint Tokens
 * Standard screen widths aligned with Tailwind CSS responsive design
 */
export const breakpoints = {
  sm: '640px', // Mobile landscape / Small tablets
  md: '768px', // Tablets / Desktop sidebar threshold
  lg: '1024px', // Laptops / Standard desktop
  xl: '1280px', // Large desktop / High-density workspace
  '2xl': '1536px', // Extra-wide monitors
} as const;

export type BreakpointTokens = typeof breakpoints;
