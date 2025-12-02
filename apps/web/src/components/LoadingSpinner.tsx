export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex justify-center items-center">
      <div
        className={`${sizes[size]} border-4 border-light-highlight-med dark:border-dark-highlight-med border-t-light-pine dark:border-t-dark-pine rounded-full animate-spin`}
      />
    </div>
  );
}

