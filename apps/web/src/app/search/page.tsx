import type { Metadata } from "next";
import SearchClient from "./Client";

export default function SearchPage() {
  return <SearchClient />;
}

export async function generateMetadata(
  { searchParams }: { searchParams: { q?: string; type?: string; hashtag?: string } }
): Promise<Metadata> {
  const q = searchParams.q || "";
  const hashtag = searchParams.hashtag || "";
  const type = searchParams.type === "profile" ? "Profiles" : "Posts";
  const title = hashtag
    ? `Search Posts by #${hashtag} — x-log`
    : q
    ? `Search ${type}: ${q} — x-log`
    : `Search — x-log`;
  const description = hashtag
    ? `Posts tagged with #${hashtag}`
    : q
    ? `Results for “${q}” in ${type.toLowerCase()}`
    : "Search posts and profiles";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
