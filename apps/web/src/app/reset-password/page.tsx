import type { Metadata } from "next";
import ResetPasswordClient from "./Client";

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Reset Password — x-log",
    description: "Reset your password",
    openGraph: {
      title: "Reset Password — x-log",
      description: "Reset your password",
      type: "website",
    },
  };
}
