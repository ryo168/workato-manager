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
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
      },
      colors: {
        primary: "#f97316",
        success: "#059669",
        error: "#dc2626",
        warning: "#f59e0b",
        sidebar: {
          bg: "#111827",
          border: "#374151",
          text: "#d1d5db",
          hover: "#374151",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
