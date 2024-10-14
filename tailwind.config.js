const colors = require('tailwindcss/colors');
/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './modules/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      '1md': '870px',
      lg: '1024px',
      xg: '1152px',
      xl: '1280px',
      '1xl': '1440px',
      '2xl': '1536px'
    },
    extend: {
      margin: {
        4.5: '17.5px'
      },
      boxShadow: {
        custom: '0 0px 10px 5px rgb(0 0 0 / 0.05)'
      },
      backgroundImage: {
        'split-transparent-gray': "linear-gradient(to left, #9ca3af 50% ,  rgba(255, 255, 255, 0.3) 50% );",
        'split-gray-transparent': "linear-gradient(to right, #9ca3af 50% , rgba(255, 255, 255, 0.3) 50%);",
     },
      colors: {
        sky: colors.sky,
        teal: colors.teal,
        teams_brand_background_2: '#3d3e66',
        teams_brand_foreground_1: '#494b83',
        teams_brand_foreground_bg: '#6264a7',
        teams_brand_border_1: '#b3b5ff',
        teams_brand_background_1: '#e9eaf6',
        teams_brand_50: '#e9eaf6',
        teams_brand_100: '#dbdcf0',
        teams_brand_200: '#c6c9ff',
        teams_brand_300: '#b3b5ff',
        teams_brand_400: '#a6a7dc',
        teams_brand_450: '#9ea2ff',
        teams_brand_500: '#7479dc',
        teams_brand_600: '#6264a7',
        teams_brand_700: '#494b83',
        teams_brand_800: '#464775',
        teams_brand_900: '#3d3e66',
        teams_brand_1000: '#323348',
        teams_brand_1001: '#37385c',
        teams_dark_mode: '#1f1f1f',
        teams_light_mode: '#f5f5f5',
        teams_dark_mode_menu_underline: '#666666'
      },
      minHeight: (theme) => ({
        ...theme('spacing')
      })
    }
  },

  plugins: [require('@tailwindcss/forms')]
};
module.exports = config;