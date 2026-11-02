import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        brand: { DEFAULT: '#1d4ed8', dark: '#1e40af' },
      },
      boxShadow: { card: '0 1px 3px rgb(15 23 42 / 0.12)' },
    },
  },
  plugins: [],
} satisfies Config;
