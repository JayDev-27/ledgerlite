/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Midnight Gallery design system ──────────────────────────────
        // Token names are kept for backwards compatibility with every
        // component; values now express the new system.
        // cream  → light neutrals (light canvas, dark-mode text)
        cream: {
          50: '#FBFBF9',
          100: '#F4F4F1',
          200: '#E6E8E3',
          300: '#D3D6D0',
          400: '#AEB2AB',
          500: '#8A8E87',
        },
        // sky → Lime Voltage signal (highlights, dark-mode accents)
        sky: {
          50: '#F4FCEE',
          100: '#E4F7D6',
          200: '#CDF1B3',
          300: '#B6EC91',
          400: '#9FE870',
          500: '#84D14F',
          600: '#4F8A27',
          700: '#3A681B',
        },
        // deep-blue → Iris primary (actions, active nav, key numbers)
        'deep-blue': {
          50: '#F0EFFF',
          100: '#E0DEFF',
          200: '#C4C0FF',
          300: '#A49EFF',
          400: '#847DFF',
          500: '#5B54E8',
          600: '#4A44C9',
          700: '#3A35A3',
          800: '#26236E',
          900: '#15143D',
          950: '#0B0A20',
        },
        // dark → Obsidian surfaces, stepped by tone not shadow
        dark: {
          bg: '#0B0C0D',
          surface: '#111213',
          elevated: '#17181A',
          border: '#1F2023',
          muted: '#2E2F33',
        },
        // Chromatic gallery tiles (landing + feature cards)
        gallery: {
          iris: '#847DFF',
          'pale-iris': '#D1C9FF',
          orchid: '#DD90D8',
          periwinkle: '#90B8F0',
          lime: '#9FE870',
          sun: '#FFD731',
          ember: '#FB4903',
          cyan: '#00B3DD',
          obsidian: '#0F1011',
          graphite: '#2E2E2E',
          ash: '#9F9FA0',
          cloud: '#F5F5F7',
        },
        status: {
          success: '#1B6B4C',
          'success-bg': '#E6F4ED',
          warning: '#B86A04',
          'warning-bg': '#FEF3E2',
          danger: '#B92E2E',
          'danger-bg': '#FDF0F0',
          info: '#5B54E8',
          'info-bg': '#F0EFFF',
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
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
        card: '18px',
        modal: '24px',
        tile: '30px',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(15, 16, 17, 0.05), 0 1px 2px -1px rgba(15, 16, 17, 0.05)',
        card: '0 4px 6px -1px rgba(15, 16, 17, 0.07), 0 2px 4px -2px rgba(15, 16, 17, 0.05)',
        'card-hover': '0 10px 15px -3px rgba(15, 16, 17, 0.1), 0 4px 6px -4px rgba(15, 16, 17, 0.06)',
        modal: '0 20px 25px -5px rgba(6, 25, 36, 0.25), 0 8px 10px -6px rgba(6, 25, 36, 0.15)',
        glow: '0 0 0 1px rgba(159, 232, 112, 0.35), 0 8px 40px -8px rgba(159, 232, 112, 0.35)',
        'dark-card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        marquee: 'marquee 28s linear infinite',
      },
    },
  },
  plugins: [],
};
