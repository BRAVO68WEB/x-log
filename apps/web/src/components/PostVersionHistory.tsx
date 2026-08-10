"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { postsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { History } from "lucide-react";
import toast from "react-hot-toast";

type Props = {
  postId: string;
  /** Called after a successful restore so the editor can reload content. */
  onRestored?: (payload: {
    version: number;
    title: string;
    content_markdown: string;
    content_blocks_json: unknown;
    summary: string | null;
    banner_url: string | null;
    hashtags: string[];
  }) => void;
};

export default function PostVersionHistory({ postId, onRestored }: Props) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const listQuery = useQuery(
    ["post-versions", postId],
    () => postsApi.listVersions(postId),
    { enabled: open && !!postId }
  );

  const restoreMutation = useMutation(
    async (version: number) => {
      const restored = await postsApi.restoreVersion(postId, version);
      const snapshot = await postsApi.getVersion(postId, restored.current_version);
      return { restored, snapshot };
    },
    {
      onSuccess: ({ restored, snapshot }) => {
        toast.success(restored.message);
        queryClient.invalidateQueries(["post-versions", postId]);
        onRestored?.({
          version: snapshot.version,
          title: snapshot.title,
          content_markdown: snapshot.content_markdown,
          content_blocks_json: snapshot.content_blocks_json,
          summary: snapshot.summary,
          banner_url: snapshot.banner_url,
          hashtags: snapshot.hashtags,
        });
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Restore failed");
      },
    }
  );

  return (
    <div className="border rounded-lg p-3 bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          <History className="h-4 w-4" />
          Version history
        </span>
        <span className="text-muted-foreground text-xs">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {listQuery.isLoading && (
            <div className="flex justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          )}
          {listQuery.isError && (
            <p className="text-sm text-destructive">Failed to load versions</p>
          )}
          {listQuery.data && listQuery.data.items.length === 0 && (
            <p className="text-sm text-muted-foreground">No versions yet. Save the post to start history.</p>
          )}
          {listQuery.data?.items.map((item) => (
            <div
              key={item.version}
              className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">v{item.version}</span>
                  {item.is_current && <Badge variant="secondary">current</Badge>}
                </div>
                <p className="truncate text-muted-foreground text-xs">
                  {item.changelog || item.title || "—"} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={item.is_current || restoreMutation.isLoading}
                onClick={() => {
                  if (
                    confirm(
                      `Restore v${item.version}? This creates a new version with that content; history is kept.`
                    )
                  ) {
                    restoreMutation.mutate(item.version);
                  }
                }}
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
