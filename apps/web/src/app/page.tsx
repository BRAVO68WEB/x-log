import { PostList } from "@/components/PostList";
import type { Metadata } from "next";

export default function Home() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-light-text dark:text-dark-text">Latest Posts</h1>
        <PostList />
      </div>
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const res = await fetch(`/api/settings`, { cache: "no-store" });
    if (!res.ok) {
      return {
        title: "x-log",
        description: "A federated blog platform built on ActivityPub",
      };
    }
    const s = (await res.json()) as {
      instance_name: string;
      instance_description: string | null;
    };
    return {
      title: s.instance_name || "x-log",
      description: s.instance_description || "A federated blog platform built on ActivityPub",
      openGraph: {
        title: s.instance_name || "x-log",
        description: s.instance_description || undefined,
        type: "website",
      },
      twitter: {
        card: "summary",
        title: s.instance_name || "x-log",
        description: s.instance_description || undefined,
      },
    };
  } catch {
    return {
      title: "x-log",
      description: "A federated blog platform built on ActivityPub",
    };
  }
}
