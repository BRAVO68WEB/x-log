"use client";

import { useRouter, useParams } from "next/navigation";
import { useMutation } from "react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Trash2, Bookmark } from "lucide-react";
import { bookmarksApi } from "@/lib/api";

export default function BookmarkDetailClient() {
  const router = useRouter();
  const params = useParams();
  const bookmarkId = params.id as string;

  const deleteMutation = useMutation(
    async () => {
      await bookmarksApi.delete(bookmarkId);
    },
    {
      onSuccess: () => {
        router.push("/bookmarks");
      },
      onError: (err) => {
        alert(err instanceof Error ? err.message : "Failed to remove bookmark");
      },
    }
  );

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push("/bookmarks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Bookmark</h1>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Bookmark className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-6">
            This bookmarked post will be removed from your collection.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => router.push("/bookmarks")}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Remove this bookmark?")) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Bookmark
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
