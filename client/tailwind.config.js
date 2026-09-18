/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
      rotate: {
        'y-1': 'rotateY(1deg)',
        'y-180': 'rotateY(180deg)',
      },
      scale: {
        '102': '1.02',
      },
    },
  },
  plugins: [],
};