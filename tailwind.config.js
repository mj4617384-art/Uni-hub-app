/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        hub: {
          bg: "#0A0F1E",
          card: "#101A30",
          card2: "#0D1526",
          border: "#1E2A45",
          accent: "#2F6FED",
          accentLight: "#4C8CFF",
          text: "#FFFFFF",
          textDim: "#8A96AD",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
