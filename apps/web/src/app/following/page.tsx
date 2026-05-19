import type { Metadata } from "next";
import FollowingClient from "./Client";

export default function FollowingPage() {
  return <FollowingClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Following — x-log",
    description: "Latest posts from followed ActivityPub actors",
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: "Following — x-log",
      description: "Latest posts from followed ActivityPub actors",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Following — x-log",
      description: "Latest posts from followed ActivityPub actors",
    },
  };
}
