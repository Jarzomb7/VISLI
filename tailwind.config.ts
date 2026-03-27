import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef2ff",
          100: "#dce4fd",
          200: "#b9c9fc",
          300: "#8da8f9",
          400: "#5f83f4",
          500: "#3b5eee",
          600: "#1e3fdb",
          700: "#1a33b8",
          800: "#0f1f6f",
          900: "#0a1647",
          950: "#060d2b",
        },
        glass: {
          light: "rgba(255, 255, 255, 0.08)",
          medium: "rgba(255, 255, 255, 0.12)",
          heavy: "rgba(255, 255, 255, 0.18)",
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(59, 94, 238, 0.3)",
        "glow-lg": "0 0 40px rgba(59, 94, 238, 0.2)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.12)",
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
