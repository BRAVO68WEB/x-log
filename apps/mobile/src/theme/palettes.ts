import { darkTheme, lightTheme, type ThemeTokens } from "./tokens";

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
  tokens?: ThemeTokens;
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
    tokens: lightTheme,
  },
  {
    id: "blues",
    label: "Blues",
    swatches: ["#0F2854", "#1C4D8D", "#4988C4", "#BDE8F5"],
    appearance: "dark",
    tokens: {
      background: "#0B1F3A",
      surface: "#102B4D",
      surfaceSoft: "#0E2644",
      surfaceMuted: "#163A63",
      surfaceStrong: "#285984",
      border: "#285984",
      borderSoft: "#163A63",
      borderStrong: "#93D9F5",
      text: "#EAF6FF",
      textMuted: "#B8D7EE",
      textSoft: "#8BB6D4",
      accent: "#4D96D8",
      accentActive: "#93D9F5",
      accentContrast: "#07182D",
      accentSoft: "#15345A",
      danger: "#FF7A90",
      success: "#80E0C1",
    },
  },
  {
    id: "marigold",
    label: "Marigold",
    swatches: ["#D92243", "#F69D39", "#E0C375", "#FFF5E5"],
    appearance: "light",
    tokens: {
      background: "#FFF8EA",
      surface: "#FFFFFF",
      surfaceSoft: "#FFFDF8",
      surfaceMuted: "#F2E3C0",
      surfaceStrong: "#F7D99A",
      border: "#EAD3A3",
      borderSoft: "#F2E3C0",
      borderStrong: "#F69D39",
      text: "#33241B",
      textMuted: "#725A3C",
      textSoft: "#9A7A52",
      accent: "#C62843",
      accentActive: "#A91F36",
      accentContrast: "#FFFFFF",
      accentSoft: "#FFF0D8",
      danger: "#C62843",
      success: "#337F57",
    },
  },
  {
    id: "aurora",
    label: "Aurora",
    swatches: ["#360185", "#8F0177", "#DE1A58", "#F4B342"],
    appearance: "dark",
    tokens: {
      background: "#20113D",
      surface: "#2B1850",
      surfaceSoft: "#241444",
      surfaceMuted: "#3A1D63",
      surfaceStrong: "#5A2B7A",
      border: "#5A2B7A",
      borderSoft: "#3A1D63",
      borderStrong: "#F4B342",
      text: "#FFF6E5",
      textMuted: "#D8BDE6",
      textSoft: "#B990CA",
      accent: "#D92D67",
      accentActive: "#EF5A89",
      accentContrast: "#FFFFFF",
      accentSoft: "#341958",
      danger: "#FF6C8F",
      success: "#8DE0C0",
    },
  },
  {
    id: "sunburst",
    label: "Sunburst",
    swatches: ["#8CE4FF", "#FEEE91", "#FFA239", "#FF5656"],
    appearance: "light",
    tokens: {
      background: "#FFF8EA",
      surface: "#FFFFFF",
      surfaceSoft: "#FFFDF8",
      surfaceMuted: "#F3E3C7",
      surfaceStrong: "#FFE8AD",
      border: "#EDD6AD",
      borderSoft: "#F3E3C7",
      borderStrong: "#FFA239",
      text: "#2F241C",
      textMuted: "#765D44",
      textSoft: "#9C7651",
      accent: "#C93D32",
      accentActive: "#B8322A",
      accentContrast: "#FFFFFF",
      accentSoft: "#FFF2D6",
      danger: "#C92F3D",
      success: "#1E8B66",
    },
  },
  {
    id: "monochrome",
    label: "Monochrome",
    swatches: ["#FAFAFA", "#E5E5E5", "#525252", "#171717"],
    appearance: "light",
    tokens: {
      background: "#FAFAFA",
      surface: "#FFFFFF",
      surfaceSoft: "#F7F7F7",
      surfaceMuted: "#E5E5E5",
      surfaceStrong: "#D4D4D4",
      border: "#E5E5E5",
      borderSoft: "#F5F5F5",
      borderStrong: "#A3A3A3",
      text: "#171717",
      textMuted: "#525252",
      textSoft: "#737373",
      accent: "#262626",
      accentActive: "#000000",
      accentContrast: "#FFFFFF",
      accentSoft: "#EEEEEE",
      danger: "#B91C1C",
      success: "#166534",
    },
  },
  {
    id: "mocha",
    label: "Mocha",
    swatches: ["#1E1E2E", "#313244", "#CBA6F7", "#F5E0DC"],
    appearance: "dark",
    tokens: {
      background: "#1E1E2E",
      surface: "#313244",
      surfaceSoft: "#252535",
      surfaceMuted: "#45475A",
      surfaceStrong: "#585B70",
      border: "#585B70",
      borderSoft: "#45475A",
      borderStrong: "#6C7086",
      text: "#F5E0DC",
      textMuted: "#CDD6F4",
      textSoft: "#A6ADC8",
      accent: "#CBA6F7",
      accentActive: "#B4BEFE",
      accentContrast: "#1E1E2E",
      accentSoft: "#45475A",
      danger: "#F38BA8",
      success: "#A6E3A1",
    },
  },
  {
    id: "amoled",
    label: "AMOLED",
    swatches: ["#000000", "#080808", "#FFFFFF", "#00E5FF"],
    appearance: "dark",
    tokens: {
      background: "#000000",
      surface: "#080808",
      surfaceSoft: "#050505",
      surfaceMuted: "#111111",
      surfaceStrong: "#1F1F1F",
      border: "#1F1F1F",
      borderSoft: "#111111",
      borderStrong: "#333333",
      text: "#FFFFFF",
      textMuted: "#BFBFBF",
      textSoft: "#8A8A8A",
      accent: "#00E5FF",
      accentActive: "#38F0FF",
      accentContrast: "#000000",
      accentSoft: "#111111",
      danger: "#FF4770",
      success: "#4DFFB0",
    },
  },
  {
    id: "off-white",
    label: "Off White",
    swatches: ["#FBFAF4", "#F0EDE3", "#D7CBB8", "#2C2A25"],
    appearance: "light",
    tokens: {
      background: "#FBFAF4",
      surface: "#FFFFFF",
      surfaceSoft: "#F8F6EF",
      surfaceMuted: "#F0EDE3",
      surfaceStrong: "#E3DACB",
      border: "#E3DACB",
      borderSoft: "#F0EDE3",
      borderStrong: "#D7CBB8",
      text: "#2C2A25",
      textMuted: "#6D675A",
      textSoft: "#918A7B",
      accent: "#8F7149",
      accentActive: "#755C38",
      accentContrast: "#FFFFFF",
      accentSoft: "#F0EDE3",
      danger: "#B54343",
      success: "#4F7B55",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    swatches: ["#282A36", "#44475A", "#BD93F9", "#FF79C6"],
    appearance: "dark",
    tokens: {
      background: "#282A36",
      surface: "#3A3D4D",
      surfaceSoft: "#303240",
      surfaceMuted: "#44475A",
      surfaceStrong: "#56596E",
      border: "#56596E",
      borderSoft: "#44475A",
      borderStrong: "#6272A4",
      text: "#F8F8F2",
      textMuted: "#C7C9D8",
      textSoft: "#A6ACCD",
      accent: "#BD93F9",
      accentActive: "#D6B8FF",
      accentContrast: "#282A36",
      accentSoft: "#44475A",
      danger: "#FF5555",
      success: "#50FA7B",
    },
  },
  {
    id: "mint-grove",
    label: "Mint Grove",
    swatches: ["#EEEEEE", "#6FCF97", "#2FA084", "#1F6F5F"],
    appearance: "light",
    tokens: {
      background: "#F3F6F2",
      surface: "#FFFFFF",
      surfaceSoft: "#F8FAF7",
      surfaceMuted: "#E7EEE9",
      surfaceStrong: "#DCEFE4",
      border: "#CDE6D7",
      borderSoft: "#E7EEE9",
      borderStrong: "#2FA084",
      text: "#143B34",
      textMuted: "#466A5F",
      textSoft: "#638B7E",
      accent: "#1F7F6C",
      accentActive: "#166756",
      accentContrast: "#FFFFFF",
      accentSoft: "#E6F4EC",
      danger: "#B5435A",
      success: "#1F7F6C",
    },
  },
  {
    id: "neon-circuit",
    label: "Neon Circuit",
    swatches: ["#362F4F", "#5B23FF", "#008BFF", "#E4FF30"],
    appearance: "dark",
    tokens: {
      background: "#1E1B2F",
      surface: "#28243D",
      surfaceSoft: "#231F35",
      surfaceMuted: "#302A4A",
      surfaceStrong: "#504A73",
      border: "#504A73",
      borderSoft: "#302A4A",
      borderStrong: "#E4FF30",
      text: "#F3F0FF",
      textMuted: "#B8B0D8",
      textSoft: "#958DBD",
      accent: "#6D4DFF",
      accentActive: "#E4FF30",
      accentContrast: "#FFFFFF",
      accentSoft: "#302A4A",
      danger: "#FF5E8A",
      success: "#6FCF97",
    },
  },
  {
    id: "signal",
    label: "Signal",
    swatches: ["#143F6B", "#F55353", "#FEB139", "#F6F54D"],
    appearance: "dark",
    tokens: {
      background: "#0D2A49",
      surface: "#143A60",
      surfaceSoft: "#102F50",
      surfaceMuted: "#183F67",
      surfaceStrong: "#416482",
      border: "#416482",
      borderSoft: "#183F67",
      borderStrong: "#FEB139",
      text: "#FFF8DE",
      textMuted: "#F0C275",
      textSoft: "#CFA46A",
      accent: "#C92F3D",
      accentActive: "#F55353",
      accentContrast: "#FFFFFF",
      accentSoft: "#183F67",
      danger: "#F55353",
      success: "#6FCF97",
    },
  },
  {
    id: "retro-classic",
    label: "Retro Classic",
    swatches: ["#F1F1F1", "#FDB827", "#21209C", "#23120B"],
    appearance: "light",
    tokens: {
      background: "#F5F2EC",
      surface: "#FFFFFF",
      surfaceSoft: "#FAF8F3",
      surfaceMuted: "#EEE7DB",
      surfaceStrong: "#F7D47A",
      border: "#E4D4AA",
      borderSoft: "#EEE7DB",
      borderStrong: "#21209C",
      text: "#23120B",
      textMuted: "#5F5048",
      textSoft: "#7F6D63",
      accent: "#21209C",
      accentActive: "#17166F",
      accentContrast: "#FFFFFF",
      accentSoft: "#FFF0CF",
      danger: "#C74444",
      success: "#2FA084",
    },
  },
];

const themeIds = new Set(instanceThemes.map((theme) => theme.id));

export function normalizeThemeId(value: unknown): InstanceThemeId {
  return themeIds.has(value as InstanceThemeId) ? (value as InstanceThemeId) : "system";
}

export function getThemeOption(id: InstanceThemeId) {
  return instanceThemes.find((theme) => theme.id === id) ?? instanceThemes[0];
}

export function getThemeTokens(id: InstanceThemeId, systemTheme: "light" | "dark") {
  if (id === "system") {
    return systemTheme === "dark" ? darkTheme : lightTheme;
  }

  return getThemeOption(id).tokens ?? lightTheme;
}
