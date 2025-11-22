"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Editor } from "@/components/Editor";
import { postsApi } from "@/lib/api";

export default function EditorPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);

  const handleSave = async (content: any, markdown: string) => {
    try {
      setSaving(true);
      
      if (postId) {
        // Update existing post
        await postsApi.update(postId, {
          content_markdown: markdown,
          content_blocks: content,
        });
      } else {
        // Create new draft post
        const post = await postsApi.create({
          title: "Untitled",
          content_markdown: markdown,
          content_blocks: content,
          hashtags: [],
          visibility: "private", // Drafts are private
        }) as { id: string };
        setPostId(post.id);
      }
      
      alert("Draft saved!");
    } catch (error) {
      console.error("Failed to save draft:", error);
      alert(`Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (content: any, markdown: string, title: string, hashtags: string[]) => {
    try {
      setSaving(true);
      
      let id = postId;
      
      if (!id) {
        // Create new post
        const post = await postsApi.create({
          title: title || "Untitled",
          content_markdown: markdown,
          content_blocks: content,
          hashtags,
          visibility: "public",
        }) as { id: string };
        id = post.id;
        setPostId(id);
      } else {
        // Update existing post
        await postsApi.update(id, {
          title: title || "Untitled",
          content_markdown: markdown,
          content_blocks: content,
          hashtags,
          visibility: "public",
        });
      }
      
      // Publish the post
      if (id) {
        await postsApi.publish(id);
      }
      
      alert("Post published!");
      router.push(`/post/${id}`);
    } catch (error) {
      console.error("Failed to publish:", error);
      alert(`Failed to publish: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <Editor 
        onSave={handleSave} 
        onPublish={handlePublish}
        saving={saving}
      />
    </main>
  );
}

