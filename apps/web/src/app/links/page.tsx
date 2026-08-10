import type { Metadata } from "next";
import LinksListClient from "./Client";

export default function LinksPage() {
  return <LinksListClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Link Archive — x-log",
    description: "Public archived links",
    openGraph: { title: "Link Archive — x-log", description: "Public archived links", type: "website" },
    twitter: { card: "summary", title: "Link Archive — x-log", description: "Public archived links" },
  };
}
