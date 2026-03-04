"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarContextValue {
  loaded: boolean;
  setLoaded: (loaded: boolean) => void;
  hasImage: boolean;
  setHasImage: (hasImage: boolean) => void;
}

const AvatarContext = React.createContext<AvatarContextValue>({
  loaded: false,
  setLoaded: () => {},
  hasImage: false,
  setHasImage: () => {},
});

function Avatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [loaded, setLoaded] = React.useState(false);
  const [hasImage, setHasImage] = React.useState(false);

  return (
    <AvatarContext.Provider value={{ loaded, setLoaded, hasImage, setHasImage }}>
      <div
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      />
    </AvatarContext.Provider>
  );
}

function AvatarImage({ className, src, onLoad, onError, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const { setLoaded, setHasImage } = React.useContext(AvatarContext);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    setHasImage(!!src);
    setError(false);
    setLoaded(false);
  }, [src, setHasImage, setLoaded]);

  if (!src || error) return null;

  return (
    <img
      className={cn("aspect-square h-full w-full object-cover", className)}
      src={src}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        setError(true);
        setLoaded(false);
        onError?.(e);
      }}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { loaded, hasImage } = React.useContext(AvatarContext);

  // Hide fallback when image has loaded successfully
  if (hasImage && loaded) return null;

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted",
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
