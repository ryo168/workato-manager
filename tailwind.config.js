/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(-2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 6px 1px rgba(201,100,66,0.2), 0 0 12px 2px rgba(201,100,66,0.1)" },
          "50%": { boxShadow: "0 0 10px 2px rgba(201,100,66,0.3), 0 0 20px 4px rgba(201,100,66,0.15)" },
        },
        sparkle: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(0.8)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        shimmer: "shimmer 2.5s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
        sparkle: "sparkle 1.5s ease-in-out infinite",
      },
      colors: {
        primary: "#C96442",
        success: "#059669",
        error: "#dc2626",
        warning: "#d97706",
        sidebar: {
          bg: "#2F2518",
          border: "#4A3C2E",
          text: "#D4C8B8",
          hover: "#3D3024",
        },
        surface: "#F5F0EB",
        "surface-secondary": "#EDE6DD",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
