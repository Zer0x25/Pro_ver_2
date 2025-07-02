/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        'sap-blue': '#005792',
        'sap-light-blue': '#007bff',
        'sap-gray': '#f0f2f5',
        'sap-dark-gray': '#343a40',
        'sap-medium-gray': '#6c757d',
        'sap-border': '#dee2e6',
      },
    },
  },
  plugins: [],
}
