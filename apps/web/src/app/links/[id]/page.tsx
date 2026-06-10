import type { Metadata } from "next";
import LinkDetailClient from "./Client";

export default function LinkDetailPage() {
  return <LinkDetailClient />;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  return {
    title: "Link — x-log",
    description: "View and edit archived link",
  };
};
