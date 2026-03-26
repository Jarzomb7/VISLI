import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#bcd2ff",
          300: "#8eb4ff",
          400: "#5989ff",
          500: "#3360ff",
          600: "#1b3cf5",
          700: "#142be1",
          800: "#1725b6",
          900: "#19258f",
          950: "#141957",
        },
      },
    },
  },
  plugins: [],
};

export default config;
