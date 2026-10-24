/** @type {import('tailwindcss').Config} */
const channel = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Colours are CSS variables (see index.css) so light and dark share one set of class names.
      colors: {
        ink: {
          900: channel('ink-900'),
          800: channel('ink-800'),
          700: channel('ink-700'),
          600: channel('ink-600'),
          500: channel('ink-500'),
          400: channel('ink-400'),
        },
        surface: {
          DEFAULT: channel('surface'),
          muted: channel('surface-muted'),
          subtle: channel('surface-subtle'),
        },
        line: {
          DEFAULT: channel('line'),
          strong: channel('line-strong'),
        },
        brand: {
          50: channel('brand-50'),
          100: channel('brand-100'),
          200: channel('brand-200'),
          500: channel('brand-500'),
          600: channel('brand-600'),
          700: channel('brand-700'),
        },
        // `accent-*` was referenced by the login page, header avatar and research panel but never
        // defined, so those elements rendered unstyled. It is now an alias of the brand scale.
        accent: {
          50: channel('brand-50'),
          100: channel('brand-100'),
          200: channel('brand-200'),
          300: channel('brand-200'),
          500: channel('brand-500'),
          600: channel('brand-600'),
          700: channel('brand-700'),
          800: channel('brand-700'),
        },
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.05), 0 1px 1px rgb(var(--shadow) / 0.04)',
        pop: '0 4px 12px rgb(var(--shadow) / 0.10)',
        drawer: '-8px 0 24px rgb(var(--shadow) / 0.18)',
      },
      keyframes: {
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-up': { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-up': 'slide-up 180ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [],
}
