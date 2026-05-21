/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0F141B',
        panel: '#151B24',
        border: '#2A3444',
        divider: '#253040',
        primary: '#38BDF8',
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        'nav-bg': '#111822',
        'hover-bg': '#1B2533',
        'select-bg': '#123042',
        'text-primary': '#E6EDF3',
        'text-secondary': '#9AA7B7',
        'text-muted': '#6B7788',
      },
    },
  },
  plugins: [],
}
