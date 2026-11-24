import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // SPEC §5 brand palette
        "hg-orange": "#FF5F0E",
        "hg-cream": "#F3E9D2",
        "hg-concrete": "#8B8883",
        "hg-wood": "#B07A4A",
        "hg-navy": "#2E3A8C",
        "hg-yellow": "#F7D046",
        "hg-red": "#E0352B",
        "hg-violet": "#4B4FB8",
      },
    },
  },
  plugins: [],
} satisfies Config;
