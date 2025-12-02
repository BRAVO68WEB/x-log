"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useQuery } from "react-query";

export default function OnboardingClient() {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const router = useRouter();

  const query = useQuery<{ completed: boolean }>(
    ["onboarding-state"],
    async () => {
      const res = await fetch(`/api/onboarding/state`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ completed: boolean }>;
    },
    {
      onSuccess: (data) => {
        setCompleted(data.completed || false);
        if (data.completed) {
          router.push("/");
        }
      },
      onError: (error) => {
        console.error("Failed to check onboarding status:", error);
      },
      onSettled: () => setLoading(false),
      refetchOnWindowFocus: false,
    }
  );

  if (loading || query.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

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
