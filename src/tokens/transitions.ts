/**
 * CareerOs Transition Tokens
 * Snappy, fluid transitions calibrated for both web browsers and Tauri native desktop/mobile
 */
export const transitions = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  },
} as const;

export type TransitionTokens = typeof transitions;
