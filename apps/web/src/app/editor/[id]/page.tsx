import { AuthGuard } from "@/components/AuthGuard";
import type { Metadata } from "next";
import EditPostClient from "./Client";

export default function EditPostPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AuthGuard>
      <EditPostClient params={props.params} />
    </AuthGuard>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Edit Post — x-log",
    description: "Edit an existing post",
    openGraph: {
      title: "Edit Post — x-log",
      description: "Edit an existing post",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Edit Post — x-log",
      description: "Edit an existing post",
    },
  };
}
