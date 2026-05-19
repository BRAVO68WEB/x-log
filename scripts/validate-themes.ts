import { readFileSync } from "fs";
import { instanceThemes as webThemes } from "../apps/web/src/lib/themes";
import { instanceThemes as mobileThemes } from "../apps/mobile/src/theme/palettes";

type Rgb = { r: number; g: number; b: number };
type CssTheme = Record<string, string>;

const rootDir = new URL("..", import.meta.url);
const themeCssPath = new URL("apps/web/src/app/theme.css", rootDir);
const css = readFileSync(themeCssPath, "utf8");

const failures: string[] = [];

const webThemeIds = webThemes.map((theme) => theme.id);
const mobileThemeIds = mobileThemes.map((theme) => theme.id);

expectSameSet("web/mobile theme ids", webThemeIds, mobileThemeIds);

const cssThemes = parseCssThemes(css);
const fixedWebThemeIds = webThemeIds.filter((id) => id !== "system");

for (const themeId of fixedWebThemeIds) {
  if (!cssThemes[themeId]) {
    failures.push(`web:${themeId} missing [data-theme] block`);
  }
}

validateWebTheme(":root", cssThemes[":root"]);
validateWebTheme(".dark", cssThemes[".dark"]);

for (const theme of webThemes) {
  if (theme.id === "system") {
    continue;
  }

  validateWebTheme(theme.id, cssThemes[theme.id]);
  validateWebAppearance(theme.id, cssThemes[theme.id], theme.appearance);
}

for (const theme of mobileThemes) {
  if (theme.id === "system") {
    continue;
  }

  if (!theme.tokens) {
    failures.push(`mobile:${theme.id} missing tokens`);
    continue;
  }

  validateMobileTheme(theme.id, theme.tokens, theme.appearance);
}

if (failures.length) {
  console.error("Theme validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Theme validation passed for ${webThemeIds.length} themes.`);

function parseCssThemes(source: string) {
  const themes: Record<string, CssTheme> = {};
  const blockPattern = /(:root|\.dark|\[data-theme="([^"]+)"\])\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(source))) {
    const selector = match[1];
    const themeId = match[2] ?? selector;
    const body = match[3];
    const values: CssTheme = {};
    const varPattern = /--([a-z0-9-]+):\s*([^;]+);/g;
    let varMatch: RegExpExecArray | null;

    while ((varMatch = varPattern.exec(body))) {
      values[varMatch[1]] = varMatch[2].trim();
    }

    themes[themeId] = values;
  }

  return themes;
}

function validateWebTheme(themeId: string, theme?: CssTheme) {
  if (!theme) {
    failures.push(`web:${themeId} missing theme variables`);
    return;
  }

  requireContrast(`web:${themeId} foreground/background`, theme, "foreground", "background", 7);
  requireContrast(`web:${themeId} card-foreground/card`, theme, "card-foreground", "card", 7);
  requireContrast(`web:${themeId} popover-foreground/popover`, theme, "popover-foreground", "popover", 7);
  requireContrast(`web:${themeId} muted-foreground/background`, theme, "muted-foreground", "background", 3);
  requireContrast(`web:${themeId} primary-foreground/primary`, theme, "primary-foreground", "primary", 4.5);
  requireContrast(`web:${themeId} accent-foreground/accent`, theme, "accent-foreground", "accent", 4.5);

  if (theme.primary === theme.accent) {
    failures.push(`web:${themeId} accent must not equal primary`);
  }

  const accentCardContrast = cssContrast(theme, "accent", "card");
  if (accentCardContrast !== null && (accentCardContrast < 1.05 || accentCardContrast > 2.2)) {
    failures.push(
      `web:${themeId} accent/card contrast ${formatRatio(accentCardContrast)} outside 1.05-2.20 hover-surface range`
    );
  }
}

function validateWebAppearance(themeId: string, theme: CssTheme | undefined, appearance: string) {
  if (!theme || appearance === "system") {
    return;
  }

  const background = parseHsl(theme.background);
  if (!background) {
    return;
  }

  const luminance = relativeLuminance(hslToRgb(background.h, background.s, background.l));

  if (appearance === "light" && luminance < 0.55) {
    failures.push(`web:${themeId} fixed light theme uses a dark page background`);
  }

  if (appearance === "dark" && luminance > 0.35) {
    failures.push(`web:${themeId} fixed dark theme uses a light page background`);
  }
}

function validateMobileTheme(
  themeId: string,
  tokens: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    accentContrast: string;
    accentSoft: string;
  },
  appearance: string
) {
  requireHexContrast(`mobile:${themeId} text/background`, tokens.text, tokens.background, 7);
  requireHexContrast(`mobile:${themeId} text/surface`, tokens.text, tokens.surface, 7);
  requireHexContrast(`mobile:${themeId} textMuted/background`, tokens.textMuted, tokens.background, 3);
  requireHexContrast(`mobile:${themeId} accentContrast/accent`, tokens.accentContrast, tokens.accent, 4.5);
  requireHexContrast(`mobile:${themeId} text/accentSoft`, tokens.text, tokens.accentSoft, 4.5);

  if (tokens.accent.toLowerCase() === tokens.accentSoft.toLowerCase()) {
    failures.push(`mobile:${themeId} accentSoft must not equal accent`);
  }

  const softSurfaceContrast = contrast(hexToRgb(tokens.accentSoft), hexToRgb(tokens.surface));
  if (softSurfaceContrast < 1.05 || softSurfaceContrast > 2.4) {
    failures.push(
      `mobile:${themeId} accentSoft/surface contrast ${formatRatio(softSurfaceContrast)} outside 1.05-2.40 hover-surface range`
    );
  }

  const backgroundLuminance = relativeLuminance(hexToRgb(tokens.background));
  if (appearance === "light" && backgroundLuminance < 0.55) {
    failures.push(`mobile:${themeId} fixed light theme uses a dark page background`);
  }
  if (appearance === "dark" && backgroundLuminance > 0.35) {
    failures.push(`mobile:${themeId} fixed dark theme uses a light page background`);
  }
}

function requireContrast(
  label: string,
  theme: CssTheme,
  foregroundKey: string,
  backgroundKey: string,
  minimum: number
) {
  const ratio = cssContrast(theme, foregroundKey, backgroundKey);
  if (ratio === null) {
    failures.push(`${label} missing or invalid color`);
    return;
  }

  if (ratio < minimum) {
    failures.push(`${label} contrast ${formatRatio(ratio)} below ${minimum}`);
  }
}

function requireHexContrast(label: string, foreground: string, background: string, minimum: number) {
  const ratio = contrast(hexToRgb(foreground), hexToRgb(background));
  if (ratio < minimum) {
    failures.push(`${label} contrast ${formatRatio(ratio)} below ${minimum}`);
  }
}

function cssContrast(theme: CssTheme, foregroundKey: string, backgroundKey: string) {
  const foreground = parseHsl(theme[foregroundKey]);
  const background = parseHsl(theme[backgroundKey]);
  if (!foreground || !background) {
    return null;
  }

  return contrast(
    hslToRgb(foreground.h, foreground.s, foreground.l),
    hslToRgb(background.h, background.s, background.l)
  );
}

function parseHsl(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [hue, saturation, lightness] = value.split(/\s+/);
  const h = Number(hue);
  const s = Number(saturation?.replace("%", "")) / 100;
  const l = Number(lightness?.replace("%", "")) / 100;

  if (![h, s, l].every(Number.isFinite)) {
    return null;
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hPrime = h / 60;
  const x = chroma * (1 - Math.abs((hPrime % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hPrime >= 0 && hPrime < 1) {
    r1 = chroma;
    g1 = x;
  } else if (hPrime >= 1 && hPrime < 2) {
    r1 = x;
    g1 = chroma;
  } else if (hPrime >= 2 && hPrime < 3) {
    g1 = chroma;
    b1 = x;
  } else if (hPrime >= 3 && hPrime < 4) {
    g1 = x;
    b1 = chroma;
  } else if (hPrime >= 4 && hPrime < 5) {
    r1 = x;
    b1 = chroma;
  } else if (hPrime >= 5 && hPrime < 6) {
    r1 = chroma;
    b1 = x;
  }

  const m = l - chroma / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function hexToRgb(value: string): Rgb {
  const hex = value.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function contrast(a: Rgb, b: Rgb) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance({ r, g, b }: Rgb) {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function expectSameSet(label: string, left: string[], right: string[]) {
  const leftOnly = left.filter((item) => !right.includes(item));
  const rightOnly = right.filter((item) => !left.includes(item));

  if (leftOnly.length || rightOnly.length) {
    failures.push(
      `${label} mismatch: left-only [${leftOnly.join(", ")}], right-only [${rightOnly.join(", ")}]`
    );
  }
}

function formatRatio(value: number) {
  return value.toFixed(2);
}
