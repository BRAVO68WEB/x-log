"use client";

import { useState } from "react";
import { useQuery } from "react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Copy, Check, Plus, Search } from "lucide-react";

interface Snippet {
  id: string;
  title: string;
  description: string | null;
  language: string;
  code: string;
  visibility: string;
  tags: string[];
  current_version: number;
  fork_of: string | null;
  created_at: string;
  updated_at: string;
}

function CodePreview({
  code,
  language,
  expanded,
}: {
  code: string;
  language: string;
  expanded: boolean;
}) {
  const lines = code.split("\n");
  const displayCode = expanded ? code : lines.slice(0, 8).join("\n");
  const isTruncated = lines.length > 8;

  return (
    <div className="relative">
      <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code>{displayCode}</code>
      </pre>
      {isTruncated && !expanded && (
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted to-transparent" />
      )}
    </div>
  );
}

export default function SnippetsClient() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const query = useQuery<Snippet[]>(
    ["snippets"],
    async () => {
      const res = await fetch("/api/content/snippets", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load snippets");
      const data = await res.json();
      return data.items ?? data;
    },
    {
      onSuccess: (data) => setSnippets(data),
      onSettled: () => setLoading(false),
    }
  );

  const filteredSnippets = snippets.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.language.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading && query.isLoading) {
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
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Code Snippets</h1>
            <p className="text-muted-foreground mt-2">
              {filteredSnippets.length} of {snippets.length} snippets
            </p>
          </div>
          <a href="/snippets/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Snippet
            </Button>
          </a>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search snippets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <BentoGrid columns={2}>
          {filteredSnippets.length === 0 ? (
            <BentoCard size="full" index={0}>
              <BentoCardContent className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-normal tracking-[-0.02em] font-heading mb-2">
                  {search ? "No matching snippets" : "No snippets yet"}
                </h2>
                <p className="text-muted-foreground mb-4">
                  {search
                    ? "Try a different search term"
                    : "Save code snippets for quick reference"}
                </p>
                {!search && (
                  <a href="/snippets/new">
                    <Button variant="outline">Create your first snippet</Button>
                  </a>
                )}
              </BentoCardContent>
            </BentoCard>
          ) : (
            filteredSnippets.map((snippet, index) => {
              const lines = snippet.code.split("\n");
              const isLong = lines.length > 8;
              const isExpanded = expanded === snippet.id;

              return (
                <BentoCard key={snippet.id} size="full" index={index}>
                  <BentoCardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <a href={`/snippets/${snippet.id}`} className="hover:underline">
                          <CardTitle className="text-xl font-heading">{snippet.title}</CardTitle>
                        </a>
                        {snippet.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {snippet.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{snippet.language}</Badge>
                        {snippet.visibility === "private" && (
                          <Badge variant="secondary">Private</Badge>
                        )}
                      </div>
                    </div>
                  </BentoCardHeader>
                  <BentoCardContent>
                    {snippet.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {snippet.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <CodePreview
                      code={snippet.code}
                      language={snippet.language}
                      expanded={isExpanded}
                    />

                    {isLong && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setExpanded(isExpanded ? null : snippet.id)}
                      >
                        {isExpanded ? "Show less" : `Show more (${lines.length} lines)`}
                      </Button>
                    )}

                    <div className="flex items-center gap-2 mt-4">
                      <a href={`/snippets/${snippet.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(snippet.id, snippet.code)}
                      >
                        {copied === snippet.id ? (
                          <Check className="mr-1 h-4 w-4" />
                        ) : (
                          <Copy className="mr-1 h-4 w-4" />
                        )}
                        {copied === snippet.id ? "Copied!" : "Copy"}
                      </Button>
                      {snippet.fork_of && (
                        <Badge variant="outline" className="text-xs">
                          Forked
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        v{snippet.current_version} •{" "}
                        {new Date(snippet.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </BentoCardContent>
                </BentoCard>
              );
            })
          )}
        </BentoGrid>
      </div>
    </main>
  );
}
