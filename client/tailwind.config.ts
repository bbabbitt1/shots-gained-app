import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0F1A',
          card: '#141B2D',
          surface: '#1C2640',
        },
        border: '#2A3A5C',
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          muted: '#8291A7', // ≥4.5:1 on card/surface for outdoor legibility
        },
        accent: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
        },
        sg: {
          positive: '#22C55E',
          'positive-bg': 'rgba(34, 197, 94, 0.1)',
          negative: '#EF4444',
          'negative-bg': 'rgba(239, 68, 68, 0.1)',
          neutral: '#94A3B8',
        },
        cat: {
          driving: '#F59E0B',
          approach: '#3B82F6',
          shortgame: '#A78BFA',
          putting: '#22D3EE',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        rise: 'rise 600ms cubic-bezier(0.32, 0.72, 0, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
