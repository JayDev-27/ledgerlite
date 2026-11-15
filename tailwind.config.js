/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FAF6EE',
          100: '#F5EEDD', // Primary app background in light mode
          200: '#EAE1CE',
          300: '#DFD1B8',
          400: '#C7B493',
          500: '#B09A72',
        },
        sky: {
          50: '#F1F7FA',
          100: '#DEEDF4',
          200: '#BEDBEB',
          300: '#9FC7DE',
          400: '#84B3CE', // Secondary highlight / chart / borders
          500: '#5C98BC',
          600: '#437A9A',
          700: '#325C76',
        },
        'deep-blue': {
          50: '#E8F2F7',
          100: '#C7DEEC',
          200: '#94BFD9',
          300: '#5A9DC2',
          400: '#2E7FA9',
          500: '#16587B', // Primary action, headings, key numbers, active nav
          600: '#124764',
          700: '#0E374E',
          800: '#0A2737',
          900: '#061924',
          950: '#030D13',
        },
        // Dark theme tokens derived from deep blue and cream
        dark: {
          bg: '#081722',
          surface: '#0F2536',
          elevated: '#17344B',
          border: '#1F4766',
          muted: '#27577E',
        },
        // Harmonious semantic colors
        status: {
          success: '#1B6B4C',
          'success-bg': '#E6F4ED',
          warning: '#B86A04',
          'warning-bg': '#FEF3E2',
          danger: '#B92E2E',
          'danger-bg': '#FDF0F0',
          info: '#16587B',
          'info-bg': '#EAF3F8',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '14px',
        modal: '18px',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(22, 88, 123, 0.05), 0 1px 2px -1px rgba(22, 88, 123, 0.05)',
        card: '0 4px 6px -1px rgba(22, 88, 123, 0.07), 0 2px 4px -2px rgba(22, 88, 123, 0.05)',
        'card-hover': '0 10px 15px -3px rgba(22, 88, 123, 0.1), 0 4px 6px -4px rgba(22, 88, 123, 0.06)',
        modal: '0 20px 25px -5px rgba(6, 25, 36, 0.25), 0 8px 10px -6px rgba(6, 25, 36, 0.15)',
        'dark-card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
};
