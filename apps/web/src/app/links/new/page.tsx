import type { Metadata } from "next";
import { AuthGuard } from "@/components/AuthGuard";
import NewLinkClient from "./Client";

export default function NewLinkPage() {
  return (
    <AuthGuard>
      <NewLinkClient />
    </AuthGuard>
  );
}

export const metadata: Metadata = {
  title: "Add Link — x-log",
  description: "Archive a link with OGP preview",
};
