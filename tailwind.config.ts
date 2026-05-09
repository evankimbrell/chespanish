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
        bg: {
          DEFAULT: "#0a0908",
          1: "#100e0c",
          2: "#15130f",
          3: "#1c1a15",
          4: "#25221c",
        },
        line: {
          DEFAULT: "#2a2620",
          2: "#3a342b",
        },
        ink: {
          DEFAULT: "#f5f1e8",
          2: "#d6cfbf",
        },
        mute: {
          DEFAULT: "#8a8478",
          2: "#5e584d",
        },
        warm: {
          DEFAULT: "#d4a574",
          deep: "#b8814c",
        },
        leaf: "#7d8a6a",
        crit: "#c97064",
        ok: "#9bb591",
      },
      fontFamily: {
        serif: ["var(--font-newsreader)", "Source Serif Pro", "Georgia", "serif"],
        sans: ["var(--font-inter-tight)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      maxWidth: {
        "page": "1320px",
        "narrow": "920px",
      },
      animation: {
        "wave": "wave 1.1s ease-in-out infinite",
        "pulse-record": "pulse-record 1.4s ease-out infinite",
        "fade-in": "fade 0.35s ease-out",
        "shimmer": "shimmer 1.6s linear infinite",
        "spin-slow": "spin 0.8s linear infinite",
        "pulse-warm": "pulse-warm 2.4s ease-in-out infinite",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(0.4)", opacity: "0.5" },
          "50%": { transform: "scaleY(1)", opacity: "1" },
        },
        "pulse-record": {
          "0%": { boxShadow: "0 0 0 0 rgba(201,112,100,0.45)" },
          "100%": { boxShadow: "0 0 0 28px rgba(201,112,100,0)" },
        },
        fade: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "pulse-warm": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
