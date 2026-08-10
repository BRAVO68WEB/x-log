"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NovelEditor from "@/components/NovelEditor";
import PostMetaPanel from "@/components/PostMetaPanel";
import PostVersionHistory from "@/components/PostVersionHistory";
import toast, { Toaster } from "react-hot-toast";
import { useMutation } from "react-query";
import type { JSONContent } from "@tiptap/core";
import { withCsrf } from "@/lib/csrf";

interface EditorClientProps {
  postId?: string;
  initialContent?: JSONContent | string;
  initialTitle?: string;
  initialSummary?: string;
  initialHashtags?: string[];
  initialBannerUrl?: string;
  isPublished?: boolean;
}

export default function EditorClient({
  postId: initialPostId,
  initialContent,
  initialTitle,
  initialSummary,
  initialHashtags,
  initialBannerUrl,
  isPublished = false,
}: EditorClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [postId, setPostId] = useState<string | null>(initialPostId || null);
  const [editorKey, setEditorKey] = useState(0);
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [hashtags, setHashtags] = useState(initialHashtags);
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl);

  const createMutation = useMutation(
    async (payload: {
      title: string;
      content_markdown: string;
      content_blocks?: JSONContent | string;
      banner_url?: string;
      hashtags: string[];
      visibility: "public" | "unlisted" | "private";
      summary?: string;
    }) => {
      const res = await fetch(`/api/posts`, withCsrf({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create post" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ id: string }>;
    }
  );

  const updateMutation = useMutation(
    async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        title?: string;
        content_markdown?: string;
        content_blocks?: JSONContent | string;
        banner_url?: string;
        hashtags?: string[];
        visibility?: "public" | "unlisted" | "private";
        summary?: string;
      };
    }) => {
      const res = await fetch(`/api/posts/${id}`, withCsrf({
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update post" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    }
  );

  const publishMutation = useMutation(async (id: string) => {
    const res = await fetch(`/api/posts/${id}/publish`, withCsrf({
      method: "POST",
      credentials: "include",
    }));
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to publish post" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  });

  const handleSave = async (
    content: JSONContent | string,
    markdown: string,
    bannerUrl?: string
  ) => {
    try {
      setSaving(true);
      if (postId) {
        await updateMutation.mutateAsync({
          id: postId,
          payload: {
            content_markdown: markdown,
            content_blocks: content,
            banner_url: bannerUrl,
          },
        });
      } else {
        const post = await createMutation.mutateAsync({
          title: "Untitled",
          content_markdown: markdown,
          content_blocks: content,
          banner_url: bannerUrl,
          hashtags: [],
          visibility: "private",
        });
        setPostId(post.id);
      }
      toast.success("Draft saved!");
    } catch (error) {
      console.error("Failed to save draft:", error);
      toast.error(`Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (
    content: JSONContent | string,
    markdown: string,
    title: string,
    hashtags: string[],
    bannerUrl?: string,
    summary?: string
  ) => {
    try {
      setSaving(true);

      let id = postId;

      if (!id) {
        const post = await createMutation.mutateAsync({
          title: title || "Untitled",
          content_markdown: markdown,
          content_blocks: content,
          banner_url: bannerUrl,
          hashtags,
          visibility: "public",
          summary,
        });
        id = post.id;
        setPostId(id);
      } else {
        await updateMutation.mutateAsync({
          id,
          payload: {
            title: title || "Untitled",
            content_markdown: markdown,
            content_blocks: content,
            banner_url: bannerUrl,
            hashtags,
            visibility: "public",
            summary,
          },
        });
      }

      // Skip publish call for already-published posts (PATCH alone triggers federation Update)
      if (!isPublished && id) {
        await publishMutation.mutateAsync(id);
      }

      toast.success(isPublished ? "Post updated!" : "Post published!");
      router.push(`/post/${id}`);
    } catch (error) {
      console.error("Failed to publish:", error);
      toast.error(`Failed to publish: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <NovelEditor
        key={editorKey}
        initialContent={content}
        initialTitle={title}
        initialSummary={summary}
        initialHashtags={hashtags}
        initialBannerUrl={bannerUrl}
        onSave={handleSave}
        onPublish={handlePublish}
        saving={saving}
        publishLabel={isPublished ? "Update" : "Publish"}
        sidebar={
          postId ? (
            <div className="space-y-4">
              <PostVersionHistory
                postId={postId}
                onRestored={(snap) => {
                  setTitle(snap.title);
                  setSummary(snap.summary || undefined);
                  setHashtags(snap.hashtags);
                  setBannerUrl(snap.banner_url || undefined);
                  setContent(
                    (snap.content_blocks_json as JSONContent) || snap.content_markdown
                  );
                  setEditorKey((k) => k + 1);
                }}
              />
              <PostMetaPanel postId={postId} />
            </div>
          ) : undefined
        }
      />
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </>
  );
}
