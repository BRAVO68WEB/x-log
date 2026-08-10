"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { linksApi, type LinkItem } from "@/lib/api";
import { ExternalLink, Archive, X, Plus, ArrowLeft, Trash2 } from "lucide-react";

export default function LinkDetailClient() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: link, isLoading, refetch } = useQuery(["link", id], () => linksApi.get(id));

  const updateMutation = useMutation(
    async () => {
      await linksApi.update(id, { title: title || undefined, description: description || undefined, tags });
    },
    {
      onSuccess: () => { setIsEditing(false); refetch(); },
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to update"),
    }
  );

  const archiveMutation = useMutation(
    async () => { return linksApi.archive(id); },
    {
      onSuccess: () => refetch(),
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to archive"),
    }
  );

  const deleteMutation = useMutation(
    async () => { await linksApi.delete(id); },
    {
      onSuccess: () => router.push("/links"),
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to delete"),
    }
  );

  useEffect(() => {
    if (link) {
      setTitle(link.title || "");
      setDescription(link.description || "");
      setTags(Array.isArray(link.tags) ? link.tags : []);
    }
  }, [link]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  if (isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (!link) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-heading">Link not found</h1>
          <Button variant="ghost" className="mt-4" onClick={() => router.push("/links")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to links
          </Button>
        </div>
      </main>
    );
  }

  const waybackUrl = `https://web.archive.org/web/*/${link.url}`;

  if (isEditing) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Edit Link</h1>
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
          {error && (
            <div className="mb-6 rounded-md bg-destructive/10 p-4 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-6">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-y" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
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
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isLoading}>
                {updateMutation.isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push("/links")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-normal tracking-[-0.03em] font-heading truncate">
              {link.title || link.url}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {link.view_count} views · Added {new Date(link.archived_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {link.og_image && (
          <div className="relative h-64 -mx-4 -mt-8 mb-6 overflow-hidden rounded-lg">
            <img src={link.og_image} alt="" className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
        )}

        {link.description && <p className="text-muted-foreground mb-6">{link.description}</p>}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
          </div>
        )}

        <div className="flex flex-wrap gap-4 mb-8">
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            <Button><ExternalLink className="mr-2 h-4 w-4" /> Visit Original</Button>
          </a>
          <a href={waybackUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline"><Archive className="mr-2 h-4 w-4" /> View on Wayback</Button>
          </a>
          {!link.archived_url && (
            <Button variant="outline" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isLoading}>
              {archiveMutation.isLoading ? "Archiving..." : "Save to Wayback"}
            </Button>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4 mb-8">
          <h3 className="text-sm font-medium mb-2">URL</h3>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
            {link.url}
          </a>
          {link.archived_url && (
            <>
              <h3 className="text-sm font-medium mb-2 mt-4">Archived URL</h3>
              <a href={link.archived_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                {link.archived_url}
              </a>
            </>
          )}
        </div>

        <div className="pt-8 border-t">
          <Button variant="destructive" onClick={() => { if (confirm("Delete this link?")) deleteMutation.mutate(); }}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete Link
          </Button>
        </div>
      </div>
    </main>
  );
}
