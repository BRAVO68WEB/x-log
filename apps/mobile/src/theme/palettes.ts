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
      background: "#0F2854",
      surface: "#1C4D8D",
      surfaceSoft: "#163E75",
      surfaceMuted: "#245B9E",
      surfaceStrong: "#4988C4",
      border: "#4988C4",
      borderSoft: "#245B9E",
      borderStrong: "#BDE8F5",
      text: "#F4FCFF",
      textMuted: "#BDE8F5",
      textSoft: "#84BCE0",
      accent: "#BDE8F5",
      accentActive: "#8ED6EA",
      accentContrast: "#0F2854",
      accentSoft: "#163E75",
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
      background: "#FFF5E5",
      surface: "#FFFFFF",
      surfaceSoft: "#FFF9EF",
      surfaceMuted: "#F4E2BD",
      surfaceStrong: "#E0C375",
      border: "#E0C375",
      borderSoft: "#F4E2BD",
      borderStrong: "#C89B43",
      text: "#3F1D18",
      textMuted: "#805734",
      textSoft: "#A8794D",
      accent: "#D92243",
      accentActive: "#B81735",
      accentContrast: "#FFFFFF",
      accentSoft: "#FFE4D8",
      danger: "#D92243",
      success: "#337F57",
    },
  },
  {
    id: "aurora",
    label: "Aurora",
    swatches: ["#360185", "#8F0177", "#DE1A58", "#F4B342"],
    appearance: "dark",
    tokens: {
      background: "#360185",
      surface: "#4B0E91",
      surfaceSoft: "#3D077B",
      surfaceMuted: "#6E168C",
      surfaceStrong: "#8F0177",
      border: "#8F0177",
      borderSoft: "#6E168C",
      borderStrong: "#DE1A58",
      text: "#FFF7E9",
      textMuted: "#F4B342",
      textSoft: "#D99DD1",
      accent: "#DE1A58",
      accentActive: "#F04478",
      accentContrast: "#FFFFFF",
      accentSoft: "#5D126F",
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
      background: "#8CE4FF",
      surface: "#FEEE91",
      surfaceSoft: "#FFF6BD",
      surfaceMuted: "#FFD177",
      surfaceStrong: "#FFA239",
      border: "#FFA239",
      borderSoft: "#FFD177",
      borderStrong: "#FF5656",
      text: "#4B2020",
      textMuted: "#9B3B2D",
      textSoft: "#C86537",
      accent: "#FF5656",
      accentActive: "#E63F3F",
      accentContrast: "#FFFFFF",
      accentSoft: "#FFD4C2",
      danger: "#D92F47",
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
      surfaceSoft: "#F5F5F5",
      surfaceMuted: "#E5E5E5",
      surfaceStrong: "#D4D4D4",
      border: "#E5E5E5",
      borderSoft: "#F5F5F5",
      borderStrong: "#A3A3A3",
      text: "#171717",
      textMuted: "#525252",
      textSoft: "#737373",
      accent: "#171717",
      accentActive: "#000000",
      accentContrast: "#FFFFFF",
      accentSoft: "#E5E5E5",
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
      border: "#45475A",
      borderSoft: "#313244",
      borderStrong: "#6C7086",
      text: "#F5E0DC",
      textMuted: "#CDD6F4",
      textSoft: "#A6ADC8",
      accent: "#CBA6F7",
      accentActive: "#B4BEFE",
      accentContrast: "#1E1E2E",
      accentSoft: "#3A2F4F",
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
      accentSoft: "#062A30",
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
      surfaceSoft: "#F7F4EC",
      surfaceMuted: "#F0EDE3",
      surfaceStrong: "#E3DACB",
      border: "#E3DACB",
      borderSoft: "#F0EDE3",
      borderStrong: "#D7CBB8",
      text: "#2C2A25",
      textMuted: "#6D675A",
      textSoft: "#918A7B",
      accent: "#B79B72",
      accentActive: "#9D805A",
      accentContrast: "#2C2A25",
      accentSoft: "#EFE5D4",
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
      surface: "#44475A",
      surfaceSoft: "#343746",
      surfaceMuted: "#4F5268",
      surfaceStrong: "#6272A4",
      border: "#44475A",
      borderSoft: "#343746",
      borderStrong: "#6272A4",
      text: "#F8F8F2",
      textMuted: "#BD93F9",
      textSoft: "#A6ACCD",
      accent: "#FF79C6",
      accentActive: "#FF92D0",
      accentContrast: "#282A36",
      accentSoft: "#4F2C4D",
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
      background: "#EEEEEE",
      surface: "#FFFFFF",
      surfaceSoft: "#F7F7F7",
      surfaceMuted: "#D7F0E1",
      surfaceStrong: "#6FCF97",
      border: "#B8E4CC",
      borderSoft: "#D7F0E1",
      borderStrong: "#2FA084",
      text: "#123B34",
      textMuted: "#1F6F5F",
      textSoft: "#43897A",
      accent: "#2FA084",
      accentActive: "#1F6F5F",
      accentContrast: "#FFFFFF",
      accentSoft: "#D7F0E1",
      danger: "#C13D5A",
      success: "#2FA084",
    },
  },
  {
    id: "neon-circuit",
    label: "Neon Circuit",
    swatches: ["#362F4F", "#5B23FF", "#008BFF", "#E4FF30"],
    appearance: "dark",
    tokens: {
      background: "#362F4F",
      surface: "#433A60",
      surfaceSoft: "#302A46",
      surfaceMuted: "#4B3B7A",
      surfaceStrong: "#5B23FF",
      border: "#5B23FF",
      borderSoft: "#4B3B7A",
      borderStrong: "#008BFF",
      text: "#FBFFE6",
      textMuted: "#E4FF30",
      textSoft: "#9BD5FF",
      accent: "#E4FF30",
      accentActive: "#CFF000",
      accentContrast: "#362F4F",
      accentSoft: "#4B3B7A",
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
      background: "#143F6B",
      surface: "#1B4D7D",
      surfaceSoft: "#12375E",
      surfaceMuted: "#275B8B",
      surfaceStrong: "#FEB139",
      border: "#FEB139",
      borderSoft: "#275B8B",
      borderStrong: "#F6F54D",
      text: "#FFFDEB",
      textMuted: "#F6F54D",
      textSoft: "#FFC982",
      accent: "#F55353",
      accentActive: "#D93F3F",
      accentContrast: "#FFFFFF",
      accentSoft: "#533E53",
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
      background: "#F1F1F1",
      surface: "#FFFFFF",
      surfaceSoft: "#F8F8F8",
      surfaceMuted: "#FFE3A0",
      surfaceStrong: "#FDB827",
      border: "#E8C46C",
      borderSoft: "#FFE3A0",
      borderStrong: "#21209C",
      text: "#23120B",
      textMuted: "#4A342B",
      textSoft: "#6E5B53",
      accent: "#21209C",
      accentActive: "#17166F",
      accentContrast: "#FFFFFF",
      accentSoft: "#DADAF3",
      danger: "#C74444",
      success: "#2FA084",
    },
  },
];

const themeIds = new Set(instanceThemes.map((theme) => theme.id));

export function normalizeThemeId(value: unknown): InstanceThemeId {
  return themeIds.has(value as InstanceThemeId)
    ? (value as InstanceThemeId)
    : "system";
}

export function getThemeOption(id: InstanceThemeId) {
  return instanceThemes.find((theme) => theme.id === id) ?? instanceThemes[0];
}

export function getThemeTokens(
  id: InstanceThemeId,
  systemTheme: "light" | "dark"
) {
  if (id === "system") {
    return systemTheme === "dark" ? darkTheme : lightTheme;
  }

  return getThemeOption(id).tokens ?? lightTheme;
}
