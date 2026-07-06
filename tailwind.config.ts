import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B0B0C",
          900: "#111113",
          850: "#141416",
          800: "#1A1A1D",
          700: "#232327",
        },
        gold: {
          300: "#FBD08A",
          400: "#F7B245",
          500: "#E89C22",
          600: "#B87A1A",
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "glow-gold": "0 0 40px -8px rgba(247,178,69,0.25)",
        "card-hover": "0 8px 32px -8px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
