import type { Metadata } from "next";
import LoginClient from "./Client";

export default function LoginPage() {
  return <LoginClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Sign In — x-log",
    description: "Log in to your account",
    openGraph: {
      title: "Sign In — x-log",
      description: "Log in to your account",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Sign In — x-log",
      description: "Log in to your account",
    },
  };
}
