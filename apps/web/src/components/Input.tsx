import * as React from "react";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type BaseInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "children">;
interface InputProps extends BaseInputProps {
  label?: React.ReactNode;
  error?: string;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  const inputId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full space-y-2">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <ShadcnInput
        id={inputId}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

type BaseTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "children">;
interface TextareaProps extends BaseTextareaProps {
  label?: React.ReactNode;
  error?: string;
}

export function Textarea({ label, error, className = "", id, ...props }: TextareaProps) {
  const textareaId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full space-y-2">
      {label && <Label htmlFor={textareaId}>{label}</Label>}
      <ShadcnTextarea
        id={textareaId}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
