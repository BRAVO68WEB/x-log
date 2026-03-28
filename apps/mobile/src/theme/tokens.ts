export interface ThemeTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentContrast: string;
  accentSoft: string;
  danger: string;
  success: string;
}

export const lightTheme: ThemeTokens = {
  background: "#f3f4f6",
  surface: "#ffffff",
  surfaceMuted: "#e5e7eb",
  border: "#d1d5db",
  text: "#111827",
  textMuted: "#6b7280",
  accent: "#1d4ed8",
  accentContrast: "#ffffff",
  accentSoft: "#dbeafe",
  danger: "#b91c1c",
  success: "#0f766e",
};

export const darkTheme: ThemeTokens = {
  background: "#0b1220",
  surface: "#111827",
  surfaceMuted: "#1f2937",
  border: "#374151",
  text: "#f9fafb",
  textMuted: "#9ca3af",
  accent: "#60a5fa",
  accentContrast: "#08111f",
  accentSoft: "#172554",
  danger: "#f87171",
  success: "#2dd4bf",
};
