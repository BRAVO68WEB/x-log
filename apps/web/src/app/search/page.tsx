import type { Metadata } from "next";
import SearchClient from "./Client";

export default function SearchPage() {
  return <SearchClient />;
}

export async function generateMetadata(
  { searchParams }: { searchParams: { q?: string; type?: string } }
): Promise<Metadata> {
  const q = searchParams.q || "";
  const type = searchParams.type === "profile" ? "Profiles" : "Posts";
  const title = q ? `Search ${type}: ${q} — x-log` : `Search — x-log`;
  const description = q ? `Results for “${q}” in ${type.toLowerCase()}` : "Search posts and profiles";
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
