import { AuthGuard } from "@/components/AuthGuard";
import type { Metadata } from "next";
import EditorClient from "./Client";

export default function EditorPage() {
  return (
    <AuthGuard>
      <EditorClient />
    </AuthGuard>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create Post — x-log",
    description: "Compose and publish a new post",
    openGraph: {
      title: "Create Post — x-log",
      description: "Compose and publish a new post",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Create Post — x-log",
      description: "Compose and publish a new post",
    },
  };
}
