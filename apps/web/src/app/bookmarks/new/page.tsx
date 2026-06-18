import type { Metadata } from "next";
import NewBookmarkClient from "./Client";

export default function NewBookmarkPage() {
  return <NewBookmarkClient />;
}

export const metadata: Metadata = {
  title: "Add Bookmark — x-log",
  description: "Add a post to bookmarks",
};
