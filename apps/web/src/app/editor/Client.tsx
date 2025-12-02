"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Editor } from "@/components/Editor";
import toast, { Toaster } from "react-hot-toast";
import { useMutation } from "react-query";
import type { JSONContent } from "@tiptap/core";

export default function EditorClient() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);

  const createMutation = useMutation(async (payload: {
    title: string;
    content_markdown: string;
    content_blocks?: JSONContent | string;
    banner_url?: string;
    hashtags: string[];
    visibility: "public" | "unlisted" | "private";
  }) => {
    const res = await fetch(`/api/posts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Failed to create post" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ id: string }>;
  });

  const updateMutation = useMutation(async ({
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
    };
  }) => {
    const res = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Failed to update post" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  });

  const publishMutation = useMutation(async (id: string) => {
    const res = await fetch(`/api/posts/${id}/publish`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Failed to publish post" }));
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
      toast.error(
        `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (
    content: JSONContent | string,
    markdown: string,
    title: string,
    hashtags: string[],
    bannerUrl?: string
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
          },
        });
      }

      if (id) {
        await publishMutation.mutateAsync(id);
      }

      toast.success("Post published!");
      router.push(`/post/${id}`);
    } catch (error) {
      console.error("Failed to publish:", error);
      toast.error(
        `Failed to publish: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Editor onSave={handleSave} onPublish={handlePublish} saving={saving} />
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </>
  );
}
