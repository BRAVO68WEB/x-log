import type { Metadata } from "next";
import { AuthGuard } from "@/components/AuthGuard";
import SnippetsListClient from "./Client";

export default function SnippetsPage() {
  return (
    <AuthGuard>
      <SnippetsListClient />
    </AuthGuard>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Snippets — x-log",
    description: "Browse code snippets",
    openGraph: { title: "Snippets — x-log", description: "Browse code snippets", type: "website" },
    twitter: { card: "summary", title: "Snippets — x-log", description: "Browse code snippets" },
  };
}
