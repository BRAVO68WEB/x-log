/** @type {import('tailwindcss').Config} */
const withOpacity = (variable) => ({ opacityValue }) => {
  if (opacityValue === undefined) {
    return `hsl(var(${variable}))`;
  }
  return `hsl(var(${variable}) / ${opacityValue})`;
};

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "Plus Jakarta Sans", "sans-serif"],
        heading: ["var(--font-heading)", "Monocraft", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        dark: {
          base: withOpacity("--background"),
          surface: withOpacity("--card"),
          overlay: withOpacity("--popover"),
          muted: withOpacity("--muted-foreground"),
          subtle: withOpacity("--muted-foreground"),
          text: withOpacity("--foreground"),
          love: withOpacity("--destructive"),
          gold: withOpacity("--secondary"),
          rose: withOpacity("--accent"),
          pine: withOpacity("--primary"),
          foam: withOpacity("--accent"),
          iris: withOpacity("--secondary"),
          "highlight-low": withOpacity("--border"),
          "highlight-med": withOpacity("--input"),
          "highlight-high": withOpacity("--ring"),
        },
        light: {
          base: withOpacity("--background"),
          surface: withOpacity("--card"),
          overlay: withOpacity("--popover"),
          muted: withOpacity("--muted-foreground"),
          subtle: withOpacity("--muted-foreground"),
          text: withOpacity("--foreground"),
          love: withOpacity("--destructive"),
          gold: withOpacity("--secondary"),
          rose: withOpacity("--accent"),
          pine: withOpacity("--primary"),
          foam: withOpacity("--accent"),
          iris: withOpacity("--secondary"),
          "highlight-low": withOpacity("--border"),
          "highlight-med": withOpacity("--input"),
          "highlight-high": withOpacity("--ring"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
