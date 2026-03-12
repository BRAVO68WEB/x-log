"use client";

import { useId } from "react";

export function GeometryLines() {
  const id = useId();
  const patternId1 = `geo-diag-1-${id}`;
  const patternId2 = `geo-diag-2-${id}`;
  const maskId = `geo-mask-${id}`;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-[1] h-full w-full"
    >
      <defs>
        {/* Diagonal lines going top-left to bottom-right */}
        <pattern
          id={patternId1}
          width="160"
          height="160"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="0"
            x2="160"
            y2="160"
            className="stroke-primary/[0.04]"
            strokeWidth="0.5"
          />
        </pattern>

        {/* Diagonal lines going top-right to bottom-left */}
        <pattern
          id={patternId2}
          width="160"
          height="160"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="160"
            y1="0"
            x2="0"
            y2="160"
            className="stroke-accent/[0.04]"
            strokeWidth="0.5"
          />
        </pattern>

        {/* Radial gradient mask - lines fade from center outward */}
        <radialGradient id={maskId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        <mask id={`${maskId}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${maskId})`} />
        </mask>
      </defs>

      <g mask={`url(#${maskId}-mask)`}>
        {/* Cross-hatch pattern fills */}
        <rect width="100%" height="100%" fill={`url(#${patternId1})`} />
        <rect width="100%" height="100%" fill={`url(#${patternId2})`} />

        {/* Angular connector polylines in corners - architectural/blueprint aesthetic */}
        {/* Top-left corner */}
        <polyline
          points="0,80 40,80 80,40 80,0"
          fill="none"
          className="stroke-primary/[0.06]"
          strokeWidth="0.5"
        />
        <circle cx="40" cy="80" r="2" className="fill-primary/[0.06]" />
        <circle cx="80" cy="40" r="2" className="fill-primary/[0.06]" />

        {/* Top-right corner */}
        <polyline
          points="100%,80 calc(100%-40),80 calc(100%-80),40 calc(100%-80),0"
          fill="none"
          className="stroke-accent/[0.06]"
          strokeWidth="0.5"
        />

        {/* Bottom-left corner */}
        <polyline
          points="0,calc(100%-80) 40,calc(100%-80) 80,calc(100%-40) 80,100%"
          fill="none"
          className="stroke-accent/[0.06]"
          strokeWidth="0.5"
        />

        {/* Bottom-right corner */}
        <polyline
          points="100%,calc(100%-80) calc(100%-40),calc(100%-80) calc(100%-80),calc(100%-40) calc(100%-80),100%"
          fill="none"
          className="stroke-primary/[0.06]"
          strokeWidth="0.5"
        />

        {/* Node circles at intersection points */}
        <circle cx="160" cy="160" r="2" className="fill-primary/[0.04]" />
        <circle cx="320" cy="320" r="2" className="fill-accent/[0.04]" />
        <circle cx="480" cy="160" r="2" className="fill-accent/[0.04]" />
        <circle cx="160" cy="480" r="2" className="fill-primary/[0.04]" />
        <circle cx="640" cy="320" r="2" className="fill-primary/[0.04]" />
        <circle cx="320" cy="640" r="2" className="fill-accent/[0.04]" />
      </g>
    </svg>
  );
}
