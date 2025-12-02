import * as React from "react";
import type { InputHTMLAttributes } from "react";

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "children">;
interface InputProps extends BaseInputProps {
  label?: React.ReactNode;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1">
          {label}
        </label>
      )}
      <input
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-light-pine dark:focus:ring-dark-pine focus:border-light-pine dark:focus:border-dark-pine bg-light-surface dark:bg-dark-surface opacity-100 text-light-text dark:text-dark-text ${
          error ? "border-light-love dark:border-dark-love" : "border-light-highlight-med dark:border-dark-highlight-med"
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-light-love dark:text-dark-love">{error}</p>}
    </div>
  );
}

type BaseTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "children">;
interface TextareaProps extends BaseTextareaProps {
  label?: React.ReactNode;
  error?: string;
}

export function Textarea({ label, error, className = "", ...props }: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1">
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-light-pine dark:focus:ring-dark-pine focus:border-light-pine dark:focus:border-dark-pine bg-light-surface dark:bg-dark-surface opacity-100 text-light-text dark:text-dark-text ${
          error ? "border-light-love dark:border-dark-love" : "border-light-highlight-med dark:border-dark-highlight-med"
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-light-love dark:text-dark-love">{error}</p>}
    </div>
  );
}
