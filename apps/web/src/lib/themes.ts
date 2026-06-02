export type InstanceThemeId =
  | "system"
  | "xlog-default"
  | "blues"
  | "marigold"
  | "aurora"
  | "sunburst"
  | "monochrome"
  | "mocha"
  | "amoled"
  | "off-white"
  | "dracula"
  | "mint-grove"
  | "neon-circuit"
  | "signal"
  | "retro-classic";

export type ThemeAppearance = "system" | "light" | "dark";

export interface InstanceThemeOption {
  id: InstanceThemeId;
  label: string;
  swatches: string[];
  appearance: ThemeAppearance;
}

export const instanceThemes: InstanceThemeOption[] = [
  {
    id: "system",
    label: "System",
    swatches: ["#f7f7f4", "#1d1b16", "#f54e00", "#807d72"],
    appearance: "system",
  },
  {
    id: "xlog-default",
    label: "X-log Default",
    swatches: ["#f7f7f4", "#ffffff", "#f54e00", "#26251e"],
    appearance: "light",
  },
  {
    id: "blues",
    label: "Blues",
    swatches: ["#0F2854", "#1C4D8D", "#4988C4", "#BDE8F5"],
    appearance: "dark",
  },
  {
    id: "marigold",
    label: "Marigold",
    swatches: ["#D92243", "#F69D39", "#E0C375", "#FFF5E5"],
    appearance: "light",
  },
  {
    id: "aurora",
    label: "Aurora",
    swatches: ["#360185", "#8F0177", "#DE1A58", "#F4B342"],
    appearance: "dark",
  },
  {
    id: "sunburst",
    label: "Sunburst",
    swatches: ["#8CE4FF", "#FEEE91", "#FFA239", "#FF5656"],
    appearance: "light",
  },
  {
    id: "monochrome",
    label: "Monochrome",
    swatches: ["#fafafa", "#e5e5e5", "#525252", "#171717"],
    appearance: "light",
  },
  {
    id: "mocha",
    label: "Mocha",
    swatches: ["#1e1e2e", "#313244", "#cba6f7", "#f5e0dc"],
    appearance: "dark",
  },
  {
    id: "amoled",
    label: "AMOLED",
    swatches: ["#000000", "#080808", "#ffffff", "#00e5ff"],
    appearance: "dark",
  },
  {
    id: "off-white",
    label: "Off White",
    swatches: ["#fbfaf4", "#f0ede3", "#d7cbb8", "#2c2a25"],
    appearance: "light",
  },
  {
    id: "dracula",
    label: "Dracula",
    swatches: ["#282a36", "#44475a", "#bd93f9", "#ff79c6"],
    appearance: "dark",
  },
  {
    id: "mint-grove",
    label: "Mint Grove",
    swatches: ["#EEEEEE", "#6FCF97", "#2FA084", "#1F6F5F"],
    appearance: "light",
  },
  {
    id: "neon-circuit",
    label: "Neon Circuit",
    swatches: ["#362F4F", "#5B23FF", "#008BFF", "#E4FF30"],
    appearance: "dark",
  },
  {
    id: "signal",
    label: "Signal",
    swatches: ["#143F6B", "#F55353", "#FEB139", "#F6F54D"],
    appearance: "dark",
  },
  {
    id: "retro-classic",
    label: "Retro Classic",
    swatches: ["#F1F1F1", "#FDB827", "#21209C", "#23120B"],
    appearance: "light",
  },
];

const themeIds = new Set(instanceThemes.map((theme) => theme.id));

export function normalizeThemeId(value: unknown): InstanceThemeId {
  return themeIds.has(value as InstanceThemeId) ? (value as InstanceThemeId) : "system";
}

export function getThemeOption(id: InstanceThemeId) {
  return instanceThemes.find((theme) => theme.id === id) ?? instanceThemes[0];
}

export function applyThemeById(id: InstanceThemeId) {
  if (typeof document === "undefined") {
    return;
  }

  const theme = getThemeOption(id);
  const root = document.documentElement;
  root.dataset.theme = theme.id;

  if (theme.appearance === "dark") {
    root.classList.add("dark");
    return;
  }

  if (theme.appearance === "light") {
    root.classList.remove("dark");
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", prefersDark);
}
