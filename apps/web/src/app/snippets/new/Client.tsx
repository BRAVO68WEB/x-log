"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { snippetsApi } from "@/lib/api";
import { X, Plus } from "lucide-react";
import MonacoEditor from "@monaco-editor/react";

const LANGUAGES = [
  "javascript", "typescript", "python", "go", "rust", "java", "c", "cpp",
  "csharp", "ruby", "php", "swift", "kotlin", "sql", "bash", "json",
  "yaml", "html", "css", "markdown", "other",
];

export default function NewSnippetPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [code, setCode] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation(
    async () => {
      return snippetsApi.create({
        title,
        description: description || undefined,
        language,
        code,
        visibility,
        tags,
      });
    },
    {
      onSuccess: (data) => router.push(`/snippets/${data.id}`),
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to create"),
    }
  );

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  if (createMutation.isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">New Snippet</h1>
            <p className="text-muted-foreground mt-2">Create a new code snippet</p>
          </div>
          <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My awesome snippet" required />

          <div className="space-y-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this snippet do?"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                {LANGUAGES.map((l) => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Code</label>
            <div className="rounded-lg border overflow-hidden">
              <MonacoEditor
                height="400px"
                language={language === "other" ? "plaintext" : language}
                value={code}
                onChange={(v) => setCode(v || "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            </div>
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
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }} placeholder="Add a tag..." className="flex-1" />
              <Button type="button" variant="outline" onClick={handleAddTag}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isLoading || !title.trim() || !code.trim()}>
              {createMutation.isLoading ? "Creating..." : "Create Snippet"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
