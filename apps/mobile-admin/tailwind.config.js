/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5B4FE8",
          dark: "#473BC4",
          light: "#7B71EE",
          subtle: "#F4F3FF",
        },
        ink: {
          DEFAULT: "#1A1A4E",
          muted: "#6B6B8D",
          soft: "#9E9EB8",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          card: "#FFFFFF",
          elevated: "#F8F8FC",
        },
        canvas: {
          DEFAULT: "#F4F4F8",
          dark: "#0F0F2A",
        },
        line: {
          DEFAULT: "#E7E7F0",
          subtle: "#F0F0F5",
        },
        success: {
          DEFAULT: "#15803D",
          light: "#DCFCE7",
        },
        warning: {
          DEFAULT: "#B45309",
          light: "#FEF3C7",
        },
        danger: {
          DEFAULT: "#DC2626",
          light: "#FEE2E2",
        },
        info: {
          DEFAULT: "#0369A1",
          light: "#E0F2FE",
        },
      },
      fontFamily: {
        sans: ["PlusJakartaSans", "sans-serif"],
        bengali: ["HindSiliguri", "sans-serif"],
      },
    },
  },
  plugins: [],
};
