import type { Metadata } from "next";
import { AuthGuard } from "@/components/AuthGuard";
import BookmarksListClient from "./Client";

export default function BookmarksPage() {
  return (
    <AuthGuard>
      <BookmarksListClient />
    </AuthGuard>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Bookmarks — x-log",
    description: "Your saved posts",
    openGraph: {
      title: "Bookmarks — x-log",
      description: "Your saved posts",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Bookmarks — x-log",
      description: "Your saved posts",
    },
  };
}
