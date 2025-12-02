import { AuthGuard } from "@/components/AuthGuard";
import type { Metadata } from "next";
import ProfileClient from "./Client";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileClient />
    </AuthGuard>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Edit Profile — x-log",
    description: "Update your profile information",
    openGraph: {
      title: "Edit Profile — x-log",
      description: "Update your profile information",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Edit Profile — x-log",
      description: "Update your profile information",
    },
  };
}
