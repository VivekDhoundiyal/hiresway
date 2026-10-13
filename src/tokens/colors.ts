/**
 * CareerOs Locked Brand Palette v1.0
 *
 * Rules:
 * - Blue (#2563EB) is the primary CareerOs identity.
 * - Green (#16A34A) is reserved ONLY for positive/progress states.
 * - No gradients, neon colors, glassmorphism, or excessive colors.
 * - Clean professional light theme inspired by Google's simplicity and Duolingo's clarity.
 */
export const colors = {
  // Primary Identity (Blue)
  primary: {
    base: '#2563EB',
    hover: '#1D4ED8',
    soft: '#EFF6FF',
  },
  // Accent & Success (Green - Positive / Progress states only)
  accent: {
    base: '#16A34A',
    soft: '#F0FDF4',
  },
  success: {
    base: '#16A34A',
    soft: '#F0FDF4',
  },
  // Neutrals & Surfaces
  background: '#F8FAFC',
  surface: {
    base: '#FFFFFF',
    subtle: '#F1F5F9',
  },
  // Typography Colors
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#64748B',
  },
  // Borders
  border: {
    base: '#E2E8F0',
    strong: '#CBD5E1',
  },
  // Feedback States
  warning: {
    base: '#D97706',
    soft: '#FEF3C7',
  },
  error: {
    base: '#DC2626',
    soft: '#FEF2F2',
  },
  info: {
    base: '#0284C7',
    soft: '#F0F9FF',
  },
} as const;

export type ColorTokens = typeof colors;
