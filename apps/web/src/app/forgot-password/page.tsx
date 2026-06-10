import type { Metadata } from "next";
import ForgotPasswordClient from "./Client";

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Forgot Password — x-log",
    description: "Request a password reset",
    openGraph: {
      title: "Forgot Password — x-log",
      description: "Request a password reset",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Forgot Password — x-log",
      description: "Request a password reset",
    },
  };
}
