import { AuthGuard } from "@/components/AuthGuard";
import type { Metadata } from "next";
import AssetsClient from "./Client";

export default function AssetsPage() {
  return (
    <AuthGuard>
      <AssetsClient />
    </AuthGuard>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Assets — x-log",
    description: "Manage your uploaded media files",
    openGraph: {
      title: "Assets — x-log",
      description: "Manage your uploaded media files",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Assets — x-log",
      description: "Manage your uploaded media files",
    },
  };
}
