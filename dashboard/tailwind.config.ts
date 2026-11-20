import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Official Azzurro navy
        ink: "#1A2B4C",
        navy: {
          50: "#f3f5f9",
          100: "#e6ebf3",
          200: "#c9d3e4",
          300: "#9aacc7",
          400: "#6b82a8",
          500: "#4a6289",
          600: "#354a6d",
          700: "#1A2B4C",
          800: "#142039",
          900: "#0d1628",
        },
        // Keep azzurro alias pointing at navy for existing classnames
        azzurro: {
          50: "#f3f5f9",
          100: "#e6ebf3",
          200: "#c9d3e4",
          300: "#9aacc7",
          400: "#6b82a8",
          500: "#4a6289",
          600: "#354a6d",
          700: "#1A2B4C",
          800: "#142039",
          900: "#0d1628",
        },
        // Official Azzurro pink / CTA
        brand: {
          50: "#fdf2f7",
          100: "#fce7f0",
          200: "#fbcfe2",
          300: "#f9a8cc",
          400: "#f472a8",
          500: "#D81B60",
          600: "#be185d",
          700: "#9d174d",
          800: "#831843",
          900: "#701a3a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        brand: "12px",
      },
    },
  },
  plugins: [],
} satisfies Config;
