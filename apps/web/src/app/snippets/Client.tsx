"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { snippetsApi, type SnippetItem } from "@/lib/api";
import { Plus, Code, Eye, GitFork } from "lucide-react";

const LANGUAGES = [
  "all", "javascript", "typescript", "python", "go", "rust", "java", "c", "cpp",
  "ruby", "php", "sql", "bash", "html", "css",
];

export default function SnippetsListClient() {
  const [language, setLanguage] = useState("all");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery(
    ["snippets", language],
    ({ pageParam }) =>
      snippetsApi.list({
        limit: 20,
        cursor: pageParam,
        language: language === "all" ? undefined : language,
      }),
    {
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    }
  );

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Snippets</h1>
            <p className="text-muted-foreground mt-1">Code snippets with syntax highlighting</p>
          </div>
          <Link href="/snippets/new">
            <Button><Plus className="h-4 w-4 mr-1" /> New</Button>
          </Link>
        </div>

        {/* Language filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                language === lang
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {lang === "all" ? "All" : lang.charAt(0).toUpperCase() + lang.slice(1)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Code className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-medium mb-2">No snippets yet</h2>
            <p className="text-muted-foreground mb-6">
              {language !== "all" ? `No ${language} snippets found.` : "Create your first code snippet."}
            </p>
            <Link href="/snippets/new">
              <Button><Plus className="h-4 w-4 mr-1" /> New Snippet</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((snippet) => (
              <SnippetCard key={snippet.id} snippet={snippet} />
            ))}
            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function SnippetCard({ snippet }: { snippet: SnippetItem }) {
  const previewLines = snippet.code.split("\n").slice(0, 8).join("\n");

  return (
    <Link href={`/snippets/${snippet.id}`}>
      <Card className="overflow-hidden transition-colors hover:border-input cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium truncate">{snippet.title}</h3>
              {snippet.description && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">{snippet.description}</p>
              )}
            </div>
            <Badge variant="outline" className="ml-2 shrink-0">{snippet.language}</Badge>
          </div>

          <pre className="p-3 rounded-md bg-muted text-xs font-mono overflow-hidden max-h-[160px] mb-3">
            <code>{previewLines}</code>
          </pre>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {snippet.view_count}</span>
              <span>v{snippet.current_version}</span>
              {snippet.fork_of && <span className="flex items-center gap-1"><GitFork className="h-3 w-3" /> Fork</span>}
            </div>
            <div className="flex items-center gap-2">
              {snippet.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
              <span>{snippet.user.full_name || snippet.user.username}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
