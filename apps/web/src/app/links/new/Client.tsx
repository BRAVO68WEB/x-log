"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { linksApi } from "@/lib/api";
import { X, Plus, Globe } from "lucide-react";

export default function NewLinkPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValidUrl, setIsValidUrl] = useState(true);

  const createMutation = useMutation(
    async () => {
      return linksApi.create({
        url,
        title: title || undefined,
        description: description || undefined,
        tags,
      });
    },
    {
      onSuccess: () => router.push("/links"),
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to archive"),
    }
  );

  const handleUrlBlur = () => {
    try {
      const parsed = new URL(url);
      setIsValidUrl(true);
      if (!title) setTitle(parsed.hostname);
    } catch {
      setIsValidUrl(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidUrl) { setError("Please enter a valid URL"); return; }
    createMutation.mutate();
  };

  if (createMutation.isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Add Link</h1>
            <p className="text-muted-foreground mt-2">Archive a link with OGP preview</p>
          </div>
          <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">URL</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={url} onChange={(e) => setUrl(e.target.value)} onBlur={handleUrlBlur}
                placeholder="https://example.com/article" className="pl-10" required />
            </div>
            {!isValidUrl && <p className="text-sm text-destructive">Please enter a valid URL</p>}
          </div>

          <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="The article title" />

          <div className="space-y-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description..." rows={3}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-y" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (optional)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                placeholder="Add a tag..." className="flex-1" />
              <Button type="button" variant="outline" onClick={handleAddTag}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isLoading || !isValidUrl}>
              {createMutation.isLoading ? "Archiving..." : "Archive Link"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
