import type { Metadata } from "next";
import BookmarksClient from "./Client";

export default function BookmarksPage() {
  return <BookmarksClient />;
}

export const metadata: Metadata = {
  title: "Bookmarks — x-log",
  description: "Your personal bookmark collection",
};
