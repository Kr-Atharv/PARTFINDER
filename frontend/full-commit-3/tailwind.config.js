/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          900: '#0f1c2e',
          800: '#16263d',
          700: '#243652',
          600: '#3b4d68',
          500: '#5a6b84',
          400: '#8593a8',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f6f8fa',
          subtle: '#eef1f5',
        },
        line: {
          DEFAULT: '#e2e7ee',
          strong: '#cdd5df',
        },
        brand: {
          50: '#effaf8',
          100: '#d3f3ee',
          200: '#a8e6dd',
          500: '#0f9d92',
          600: '#0b857b',
          700: '#0a6b63',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 28, 46, 0.04), 0 1px 1px rgba(15, 28, 46, 0.03)',
        pop: '0 4px 12px rgba(15, 28, 46, 0.08)',
      },
    },
  },
  plugins: [],
}
