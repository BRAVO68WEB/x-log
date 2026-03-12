"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  BentoGrid                                                         */
/* ------------------------------------------------------------------ */

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4;
}

const colClasses: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

function BentoGrid({
  columns = 3,
  className,
  children,
  ...props
}: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 auto-rows-auto gap-4",
        "[grid-auto-flow:dense]",
        colClasses[columns],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BentoCard                                                          */
/* ------------------------------------------------------------------ */

type BentoSize = "1x1" | "2x1" | "1x2" | "2x2" | "3x1" | "full";

const sizeClasses: Record<BentoSize, string> = {
  "1x1": "",
  "2x1": "md:col-span-2",
  "1x2": "md:row-span-2",
  "2x2": "md:col-span-2 md:row-span-2",
  "3x1": "md:col-span-3",
  full: "md:col-span-full",
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: "easeOut",
    },
  }),
};

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: BentoSize;
  accent?: boolean;
  index?: number;
}

function BentoCard({
  size = "1x1",
  accent = false,
  index = 0,
  className,
  children,
  ...props
}: BentoCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      custom={index}
      className={cn(
        "relative rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-hidden",
        sizeClasses[size],
        className
      )}
      {...(props as any)}
    >
      {accent && (
        <svg
          className="absolute top-0 right-0 w-12 h-12 pointer-events-none"
          aria-hidden="true"
        >
          <polyline
            points="48,0 48,12 36,12"
            fill="none"
            className="stroke-primary/20"
            strokeWidth="1"
          />
          <circle cx="48" cy="0" r="2" className="fill-primary/20" />
          <circle cx="36" cy="12" r="1.5" className="fill-primary/20" />
        </svg>
      )}
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  BentoCardHeader / BentoCardContent                                 */
/* ------------------------------------------------------------------ */

function BentoCardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-6 pb-2", className)}
      {...props}
    />
  );
}

function BentoCardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export { BentoGrid, BentoCard, BentoCardHeader, BentoCardContent };
