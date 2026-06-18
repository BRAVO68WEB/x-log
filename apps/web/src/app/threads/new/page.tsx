import type { Metadata } from "next";
import { AuthGuard } from "@/components/AuthGuard";
import NewThreadClient from "./Client";

export default function NewThreadPage() {
  return (
    <AuthGuard>
      <NewThreadClient />
    </AuthGuard>
  );
}

export const metadata: Metadata = {
  title: "New Thread — x-log",
  description: "Create a new thread",
};
