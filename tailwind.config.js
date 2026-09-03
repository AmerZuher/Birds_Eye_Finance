/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      borderRadius: {
        pill: '999px',
        sheet: '28px',
        card: '22px',
        'stat-card': '18px',
        'tx-list': '20px',
        'quick-chip': '16px',
        field: '16px',
        'tile-sm': '11px',
        'tile-lg': '14px',
        'icon-tile': '8px',
      },
    },
  },
  plugins: [],
};
