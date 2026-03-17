"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "react-query";
import { useAuth } from "@/hooks/useAuth";
import { postsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import EditorClient from "../Client";

export default function EditPostClient(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const { data: post, isLoading, error } = useQuery(
    ["post-edit", params.id],
    () => postsApi.get(params.id),
    { enabled: !!user }
  );

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold mb-2">Post not found</h1>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : "The post could not be loaded."}
          </p>
        </div>
      </main>
    );
  }

  // Check authorization: only author or admin can edit
  if (user && user.id !== post.author_id && user.role !== "admin") {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold mb-2">Forbidden</h1>
          <p className="text-muted-foreground">You don&apos;t have permission to edit this post.</p>
        </div>
      </main>
    );
  }

  // Use content_blocks_json if available, otherwise fall back to content_html (TipTap parses HTML natively)
  const initialContent = post.content_blocks_json || post.content_html;

  return (
    <EditorClient
      postId={post.id}
      initialContent={initialContent}
      initialTitle={post.title}
      initialSummary={post.summary || undefined}
      initialHashtags={post.hashtags}
      initialBannerUrl={post.banner_url || undefined}
      isPublished={!!post.published_at}
    />
  );
}
