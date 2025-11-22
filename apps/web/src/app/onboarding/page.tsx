"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { onboardingApi } from "@/lib/api";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const data = await onboardingApi.getState();
      setCompleted(data.completed || false);
      
      // If already completed, redirect to home
      if (data.completed) {
        router.push("/");
        return;
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      // On error, allow access to onboarding page
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  // If completed, the redirect will happen, but show loading while redirecting
  if (completed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 bg-gray-50">
      <OnboardingWizard />
    </main>
  );
}

