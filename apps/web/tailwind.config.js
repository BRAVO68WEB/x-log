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
      colors: {
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
    },
  },
  plugins: [],
};
