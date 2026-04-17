import type { Config } from "tailwindcss";

// Tokens transcribed from DESIGN.md §2 (palette) and §6 (depth).
const config: Config = {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        parchment: "#f5f4ed",
        ivory: "#faf9f5",
        sand: "#e8e6dc",
        white: "#ffffff",
        nearblack: "#141413",
        darksurface: "#30302e",

        // Brand
        terracotta: "#c96442",
        coral: "#d97757",

        // Text
        charcoal: "#4d4c48",
        olive: "#5e5d59",
        stone: "#87867f",
        darkwarm: "#3d3d3a",
        silver: "#b0aea5",

        // Semantic
        crimson: "#b53333",
        focus: "#3898ec",

        // Borders / rings
        bordercream: "#f0eee6",
        borderwarm: "#e8e6dc",
        borderdark: "#30302e",
        ringwarm: "#d1cfc5",
        ringdeep: "#c2c0b6",
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'Inter'", "system-ui", "Arial", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Sizes from DESIGN.md §3
        display: ["4rem", { lineHeight: "1.10", fontWeight: "500" }],      // 64px
        section: ["3.25rem", { lineHeight: "1.20", fontWeight: "500" }],   // 52px
        subhead: ["2rem", { lineHeight: "1.10", fontWeight: "500" }],      // 32px
        feature: ["1.6rem", { lineHeight: "1.20", fontWeight: "500" }],    // 25.6
        bodyserif: ["1.06rem", { lineHeight: "1.60", fontWeight: "400" }], // 17px
        bodylarge: ["1.25rem", { lineHeight: "1.60", fontWeight: "400" }], // 20
        body: ["1rem", { lineHeight: "1.60", fontWeight: "400" }],
        bodysm: ["0.94rem", { lineHeight: "1.60" }],
        caption: ["0.875rem", { lineHeight: "1.43" }],
        label: ["0.75rem", { lineHeight: "1.25", letterSpacing: "0.12px" }],
        overline: ["0.625rem", { lineHeight: "1.60", letterSpacing: "0.5px" }],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      boxShadow: {
        ring: "0 0 0 1px #d1cfc5",
        "ring-deep": "0 0 0 1px #c2c0b6",
        "ring-dark": "0 0 0 1px #30302e",
        whisper: "rgba(0,0,0,0.05) 0 4px 24px",
      },
      maxWidth: {
        container: "1200px",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Slow-drifting radial glow for hero backdrops
        "glow-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.5" },
          "50%": { transform: "translate(30px, -20px) scale(1.05)", opacity: "0.7" },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "marquee-slow": "marquee 80s linear infinite",
        "fade-up": "fade-up 0.5s ease-out both",
        "fade-in": "fade-in 0.6s ease-out both",
        "glow-drift": "glow-drift 12s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
