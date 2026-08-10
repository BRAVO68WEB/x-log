import type { Metadata } from "next";
import SnippetDetailClient from "./Client";

export default function SnippetDetailPage() {
  return <SnippetDetailClient />;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  return {
    title: "Snippet — x-log",
    description: "View and edit code snippet",
  };
};
