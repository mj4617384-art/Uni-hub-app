/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        hub: {
          bg: "var(--hub-bg)",
          card: "var(--hub-card)",
          card2: "var(--hub-card2)",
          border: "var(--hub-border)",
          accent: "var(--hub-accent)",
          accentLight: "var(--hub-accent-light)",
          text: "var(--hub-text)",
          textDim: "var(--hub-text-dim)",
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
