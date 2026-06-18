import type { Metadata } from "next";
import { AuthGuard } from "@/components/AuthGuard";
import DraftsClient from "./Client";

export default function DraftsPage() {
  return (
    <AuthGuard>
      <DraftsClient />
    </AuthGuard>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "My Posts — x-log",
    description: "Your published and draft posts",
  };
}
