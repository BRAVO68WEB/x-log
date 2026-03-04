import * as React from "react";
import {
  Button as ShadcnButton,
  type ButtonProps as ShadcnButtonProps,
} from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VariantMap = "primary" | "secondary" | "danger" | "ghost" | "outline";

interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: VariantMap;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantMapping: Record<VariantMap, ShadcnButtonProps["variant"]> = {
  primary: "default",
  secondary: "secondary",
  danger: "destructive",
  ghost: "ghost",
  outline: "outline",
};

const sizeMapping: Record<string, ShadcnButtonProps["size"]> = {
  sm: "sm",
  md: "default",
  lg: "lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={variantMapping[variant]}
      size={sizeMapping[size]}
      className={cn(className)}
      {...props}
    >
      {children}
    </ShadcnButton>
  );
}
