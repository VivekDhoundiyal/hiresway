import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          soft: '#EFF6FF',
        },
        accent: {
          DEFAULT: '#16A34A',
          soft: '#F0FDF4',
        },
        success: {
          DEFAULT: '#16A34A',
          soft: '#F0FDF4',
        },
        background: '#F8FAFC',
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F1F5F9',
        },
        'text-primary': '#0F172A',
        'text-secondary': '#475569',
        'text-muted': '#64748B',
        border: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        warning: {
          DEFAULT: '#D97706',
          soft: '#FEF3C7',
        },
        error: {
          DEFAULT: '#DC2626',
          soft: '#FEF2F2',
        },
        info: {
          DEFAULT: '#0284C7',
          soft: '#F0F9FF',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.025em' }],
        h1: ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        h2: ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.015em' }],
        h3: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem' }],
        'body-md': ['0.875rem', { lineHeight: '1.25rem' }],
        'body-sm': ['0.75rem', { lineHeight: '1rem' }],
        caption: ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        md: '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        lg: '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
      },
    },
  },
  plugins: [],
};

export default config;
