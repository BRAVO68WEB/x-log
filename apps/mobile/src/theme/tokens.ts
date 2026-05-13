export interface ThemeTokens {
  background: string;
  surface: string;
  surfaceSoft: string;
  surfaceMuted: string;
  surfaceStrong: string;
  border: string;
  borderSoft: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accentActive: string;
  accentContrast: string;
  accentSoft: string;
  danger: string;
  success: string;
}

export const lightTheme: ThemeTokens = {
  background: "#f7f7f4",
  surface: "#ffffff",
  surfaceSoft: "#fafaf7",
  surfaceMuted: "#efeee8",
  surfaceStrong: "#e6e5e0",
  border: "#e6e5e0",
  borderSoft: "#efeee8",
  borderStrong: "#cfcdc4",
  text: "#26251e",
  textMuted: "#807d72",
  textSoft: "#a09c92",
  accent: "#f54e00",
  accentActive: "#d04200",
  accentContrast: "#ffffff",
  accentSoft: "#fff0e8",
  danger: "#cf2d56",
  success: "#1f8a65",
};

export const darkTheme: ThemeTokens = {
  background: "#1d1b16",
  surface: "#302d26",
  surfaceSoft: "#26231d",
  surfaceMuted: "#3f3b33",
  surfaceStrong: "#4a463d",
  border: "#3f3b33",
  borderSoft: "#343129",
  borderStrong: "#5a554b",
  text: "#fafaf7",
  textMuted: "#b5b0a4",
  textSoft: "#8f897d",
  accent: "#f54e00",
  accentActive: "#d04200",
  accentContrast: "#ffffff",
  accentSoft: "#462417",
  danger: "#cf2d56",
  success: "#76b89b",
};
