/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
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
  plugins: [],
};
