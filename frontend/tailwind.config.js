/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        hospital: {
          navy:   '#0a2540',
          blue:   '#1565c0',
          teal:   '#00838f',
          light:  '#e3f2fd',
          green:  '#2e7d32',
          amber:  '#e65100',
          red:    '#c62828',
          gray:   '#546e7a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
