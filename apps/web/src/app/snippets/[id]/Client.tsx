"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { snippetsApi, type SnippetItem, type SnippetVersion } from "@/lib/api";
import { Copy, Check, X, Plus, ArrowLeft, GitFork } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import MonacoEditor from "@monaco-editor/react";

const LANGUAGES = [
  "javascript", "typescript", "python", "go", "rust", "java", "c", "cpp",
  "csharp", "ruby", "php", "swift", "kotlin", "sql", "bash", "json",
  "yaml", "html", "css", "markdown", "other",
];

export default function SnippetDetailClient() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [code, setCode] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [changelog, setChangelog] = useState("");

  const { data, isLoading, refetch } = useQuery(
    ["snippet", id],
    () => snippetsApi.get(id)
  );

  const updateMutation = useMutation(
    async () => {
      await snippetsApi.update(id, {
        title,
        description: description || undefined,
        language,
        code,
        visibility,
        tags,
        changelog: changelog || undefined,
      });
    },
    {
      onSuccess: () => {
        setIsEditing(false);
        setChangelog("");
        refetch();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to update");
      },
    }
  );

  const deleteMutation = useMutation(
    async () => { await snippetsApi.delete(id); },
    {
      onSuccess: () => router.push("/snippets"),
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to delete"),
    }
  );

  const forkMutation = useMutation(
    async () => { return snippetsApi.fork(id); },
    {
      onSuccess: (data) => router.push(`/snippets/${data.id}`),
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to fork"),
    }
  );

  useEffect(() => {
    if (data?.snippet) {
      setTitle(data.snippet.title);
      setDescription(data.snippet.description || "");
      setLanguage(data.snippet.language);
      setCode(data.snippet.code);
      setVisibility(data.snippet.visibility as typeof visibility);
      setTags(Array.isArray(data.snippet.tags) ? data.snippet.tags : []);
    }
  }, [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  if (isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (!data?.snippet) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-heading">Snippet not found</h1>
          <Button variant="ghost" className="mt-4" onClick={() => router.push("/snippets")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to snippets
          </Button>
        </div>
      </main>
    );
  }

  const { snippet, versions } = data;
  const isOwner = user?.id === snippet.user.id;

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/snippets")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-2xl font-heading" />
            ) : (
              <h1 className="text-3xl font-normal tracking-[-0.03em] font-heading truncate">
                {snippet.title}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline">{snippet.language}</Badge>
              {snippet.visibility !== "public" && <Badge variant="secondary">{snippet.visibility}</Badge>}
              <span className="text-sm text-muted-foreground">
                v{snippet.current_version} · {snippet.view_count} views ·{" "}
                {new Date(snippet.updated_at).toLocaleDateString()}
              </span>
              {snippet.user.username && (
                <span className="text-sm text-muted-foreground">
                  by {snippet.user.full_name || snippet.user.username}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            {!isOwner && user && (
              <Button variant="outline" size="sm" onClick={() => forkMutation.mutate()} disabled={forkMutation.isLoading}>
                <GitFork className="h-4 w-4 mr-1" /> Fork
              </Button>
            )}
            {isOwner && !isEditing && (
              <Button size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Description */}
        {isEditing ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)..."
            rows={2}
            className="w-full px-3 py-2 mb-4 rounded-md border border-input bg-background text-sm resize-none"
          />
        ) : (
          snippet.description && <p className="text-muted-foreground mb-4">{snippet.description}</p>
        )}

        {/* Tags */}
        {(tags.length > 0 || isEditing) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                {isEditing && (
                  <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
            {isEditing && (
              <div className="flex gap-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                  placeholder="Add tag..."
                  className="h-7 w-24 text-xs"
                />
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={handleAddTag}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Editor options (when editing) */}
        {isEditing && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Changelog</label>
              <Input value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="What changed..." className="h-9 text-sm" />
            </div>
          </div>
        )}

        {/* Code */}
        <div className="rounded-lg border overflow-hidden mb-6">
          {isEditing ? (
            <MonacoEditor
              height="500px"
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
          ) : (
            <pre className="p-4 overflow-x-auto text-sm font-mono bg-card min-h-[200px]">
              <code>{code}</code>
            </pre>
          )}
        </div>

        {/* Edit actions */}
        {isEditing && (
          <div className="flex justify-end gap-3 mb-8">
            <Button variant="ghost" onClick={() => { setIsEditing(false); refetch(); }}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isLoading}>
              {updateMutation.isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}

        {/* Version History */}
        {versions.length > 1 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold font-heading mb-3">Version History</h2>
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div>
                    <span className="font-medium">v{v.version}</span>
                    {v.changelog && <span className="text-muted-foreground ml-2">— {v.changelog}</span>}
                  </div>
                  <span className="text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Danger zone */}
        {isOwner && !isEditing && (
          <div className="pt-6 border-t">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { if (confirm("Delete this snippet?")) deleteMutation.mutate(); }}
            >
              Delete Snippet
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
