"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";

interface OIDCCallbackResponse {
  action: "login" | "link" | "pending_link" | "already_linked" | "error";
  redirect_url: string;
  user?: {
    id: string;
    username: string;
    email: string | null;
    role: string;
  };
  link_state?: string;
  error?: string;
}

export default function OIDCCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasProcessed = useRef(false); // Prevent multiple calls

  useEffect(() => {
    // Prevent multiple executions - OIDC codes can only be used once
    if (hasProcessed.current) {
      return;
    }

    // Extract query params early
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const iss = searchParams.get("iss");

    // Handle OIDC provider errors early
    if (errorParam) {
      hasProcessed.current = true;
      const errorMsg = errorDescription || errorParam;
      router.replace(`/login?error=oidc_failed&description=${encodeURIComponent(errorMsg)}`);
      return;
    }

    // Validate required params early
    if (!code || !state) {
      hasProcessed.current = true;
      router.replace("/login?error=invalid_callback");
      return;
    }

    // Mark as processed immediately to prevent duplicate calls
    hasProcessed.current = true;

    const handleCallback = async () => {
      try {

        // Build query string for backend API call
        const queryParams = new URLSearchParams({
          code,
          state,
        });
        if (iss) {
          queryParams.set("iss", iss);
        }

        // Make API call to backend
        const response = await fetch(`/api/auth/oidc/callback?${queryParams.toString()}`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Callback processing failed" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = (await response.json()) as OIDCCallbackResponse;

        // Handle different actions
        switch (data.action) {
          case "login":
            // User logged in successfully
            await refetch(); // Refresh auth state
            router.replace(data.redirect_url);
            break;

          case "link":
            // OIDC account linked to current user
            await refetch(); // Refresh auth state
            router.replace(data.redirect_url);
            break;

          case "already_linked":
            // OIDC account already linked to current user
            router.replace(data.redirect_url);
            break;

          case "pending_link":
            // Need manual linking - redirect to linking page
            router.replace(data.redirect_url);
            break;

          case "error":
            // Error occurred
            const errorMsg = data.error || "OIDC processing failed";
            router.replace(`/login?error=oidc_processing_failed&description=${encodeURIComponent(errorMsg)}`);
            break;

          default:
            router.replace("/login?error=unknown_action");
        }
      } catch (err) {
        console.error("OIDC callback error:", err);
        const errorMsg = err instanceof Error ? err.message : "OIDC callback processing failed";
        setError(errorMsg);
        // Redirect to login with error after a short delay
        setTimeout(() => {
          router.replace(`/login?error=oidc_processing_failed&description=${encodeURIComponent(errorMsg)}`);
        }, 2000);
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - we read searchParams inside the effect

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-light-base dark:bg-dark-base">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="rounded-md bg-light-love/10 dark:bg-dark-love/20 p-4 border border-light-love/20 dark:border-dark-love/20">
            <div className="text-sm text-light-love dark:text-dark-love">{error}</div>
          </div>
          <p className="text-sm text-light-subtle dark:text-dark-subtle">
            Redirecting to login...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-light-base dark:bg-dark-base">
      <div className="max-w-md w-full space-y-4 text-center">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-light-subtle dark:text-dark-subtle">
          Processing OIDC callback...
        </p>
      </div>
    </main>
  );
}
