"use client";

import { Button } from "@/components/ui/button";
import { useInstanceTheme } from "@/components/InstanceThemeProvider";
import { getThemeOption } from "@/lib/themes";

export function ThemeToggle() {
  const { themeId } = useInstanceTheme();
  const theme = getThemeOption(themeId);

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={`Current theme: ${theme.label}`}
      title={`Current theme: ${theme.label}`}
      className="h-9 gap-2 text-muted-foreground"
    >
      <span className="flex overflow-hidden rounded-full border border-border">
        {theme.swatches.slice(0, 4).map((color) => (
          <span
            key={color}
            className="h-4 w-4"
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
      <span className="hidden max-w-24 truncate sm:inline">{theme.label}</span>
    </Button>
  );
}
