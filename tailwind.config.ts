import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f7f3ea",
        ink: "#242821",
        moss: "#4f6f52",
        leaf: "#6fa76b",
        sage: "#dfe8d9",
        tomato: "#cf695c",
        honey: "#e6b96a",
        oat: "#ebe1d0"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(54, 66, 49, 0.12)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
