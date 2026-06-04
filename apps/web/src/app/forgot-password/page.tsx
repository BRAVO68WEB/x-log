import type { Metadata } from "next";
import ForgotPasswordClient from "./Client";

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Forgot Password — x-log",
    description: "Reset your password",
    openGraph: {
      title: "Forgot Password — x-log",
      description: "Reset your password",
      type: "website",
    },
  };
}
