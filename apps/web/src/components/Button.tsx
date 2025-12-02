import * as React from "react";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseStyles = "font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-light-pine dark:bg-dark-pine opacity-100 text-white hover:bg-light-foam dark:hover:bg-dark-foam focus:ring-light-pine dark:focus:ring-dark-pine",
    secondary: "bg-light-overlay dark:bg-dark-overlay opacity-100 text-light-text dark:text-dark-text hover:bg-light-highlight-low dark:hover:bg-dark-highlight-low focus:ring-light-muted dark:focus:ring-dark-muted",
    danger: "bg-light-love dark:bg-dark-love opacity-100 text-white hover:bg-light-rose dark:hover:bg-dark-rose focus:ring-light-love dark:focus:ring-dark-love",
    ghost: "bg-transparent text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay focus:ring-light-muted dark:focus:ring-dark-muted",
    outline: "border border-light-highlight-med dark:border-dark-highlight-med bg-light-surface dark:bg-dark-surface opacity-100 text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay focus:ring-light-muted dark:focus:ring-dark-muted",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
