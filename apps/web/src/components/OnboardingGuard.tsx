"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingSpinner } from "./LoadingSpinner";
import { onboardingApi } from "@/lib/api";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    // Re-check when pathname changes
    checkOnboardingStatus();
  }, [pathname]);

  const checkOnboardingStatus = async () => {
    // Always allow access to onboarding page
    if (pathname === "/onboarding") {
      setLoading(false);
      setCompleted(false); // Set to false so we don't block onboarding page
      return;
    }

    try {
      const data = await onboardingApi.getState();
      const isCompleted = data.completed || false;
      setCompleted(isCompleted);

      // If onboarding is not completed, redirect to onboarding page
      if (!isCompleted) {
        router.replace("/onboarding");
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      // On error, allow access (don't block) - might be API not ready yet
      setCompleted(true);
    } finally {
      setLoading(false);
    }
  };

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
