import type { Metadata } from "next";
import BookmarkDetailClient from "./Client";

export default function BookmarkDetailPage() {
  return <BookmarkDetailClient />;
}

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: "Bookmark — x-log",
    description: "View bookmarked post",
  };
};
