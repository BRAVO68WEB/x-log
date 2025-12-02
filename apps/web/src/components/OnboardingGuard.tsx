"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingSpinner } from "./LoadingSpinner";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const checkOnboardingStatus = useCallback(async () => {
    // Always allow access to onboarding page
    if (pathname === "/onboarding") {
      setLoading(false);
      setCompleted(false); // Set to false so we don't block onboarding page
      return;
    }

    try {
      const res = await fetch(`/api/onboarding/state`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { completed: boolean };
      const isCompleted = data.completed || false;
      setCompleted(isCompleted);

      if (!isCompleted) {
        router.replace("/onboarding");
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      setCompleted(true);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  useEffect(() => {
    checkOnboardingStatus();
  }, [pathname, checkOnboardingStatus]);

  // Show loading spinner while checking
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If onboarding is not completed and user is trying to access other pages, show loading
  // (they will be redirected by the useEffect)
  if (!completed && pathname !== "/onboarding") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
