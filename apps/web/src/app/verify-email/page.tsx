import type { Metadata } from "next";
import VerifyEmailClient from "./Client";

export const metadata: Metadata = {
  title: "Verify email — x-log",
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
