import type { Metadata } from "next";
import { AuthGuard } from "@/components/AuthGuard";
import NewSnippetClient from "./Client";

export default function NewSnippetPage() {
  return (
    <AuthGuard>
      <NewSnippetClient />
    </AuthGuard>
  );
}

export const metadata: Metadata = {
  title: "New Snippet — x-log",
  description: "Create a new code snippet",
};
