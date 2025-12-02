import type { Metadata } from "next";
import OnboardingClient from "./Client";

export default function OnboardingPage() {
  return <OnboardingClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Onboarding — x-log",
    description: "Set up your account",
    openGraph: {
      title: "Onboarding — x-log",
      description: "Set up your account",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Onboarding — x-log",
      description: "Set up your account",
    },
  };
}
