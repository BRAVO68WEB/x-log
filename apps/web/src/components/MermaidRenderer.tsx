"use client";

import { useRef, useEffect, useId } from "react";

interface MermaidRendererProps {
  contentHtml: string;
  className?: string;
}

export function MermaidRenderer({ contentHtml, className }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefix = useId().replace(/:/g, "");

  // Wrap bare <table> elements in a scrollable div for responsive overflow
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
      if (table.parentElement?.classList.contains("table-wrapper")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "table-wrapper";
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }, [contentHtml]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const codeBlocks = container.querySelectorAll<HTMLElement>("code.language-mermaid");
    if (codeBlocks.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const root = document.documentElement;
        const fixedTheme = root.dataset.theme;
        const isDark =
          root.classList.contains("dark") ||
          fixedTheme === "amoled" ||
          fixedTheme === "mocha" ||
          fixedTheme === "dracula" ||
          fixedTheme === "aurora" ||
          fixedTheme === "neon-circuit" ||
          fixedTheme === "signal";
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          fontFamily: "inherit",
        });

        for (let i = 0; i < codeBlocks.length; i++) {
          if (cancelled) return;

          const codeEl = codeBlocks[i];
          const preEl = codeEl.parentElement;
          if (!preEl || preEl.tagName !== "PRE") continue;

          const source = codeEl.textContent || "";
          const id = `mermaid-${prefix}-${i}`;

          try {
            const { svg } = await mermaid.render(id, source);
            const wrapper = document.createElement("div");
            wrapper.className = "mermaid-diagram";
            wrapper.innerHTML = svg;
            preEl.replaceWith(wrapper);
          } catch {
            preEl.classList.add("mermaid-error");
          }
        }
      } catch {
        // mermaid failed to load — keep original code blocks
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentHtml, prefix]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: contentHtml }}
    />
  );
}
