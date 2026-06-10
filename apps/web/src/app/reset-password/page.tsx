import type { Metadata } from "next";
import ResetPasswordClient from "./Client";

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Set New Password — x-log",
    description: "Set your new password",
    openGraph: {
      title: "Set New Password — x-log",
      description: "Set your new password",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Set New Password — x-log",
      description: "Set your new password",
    },
  };
}
