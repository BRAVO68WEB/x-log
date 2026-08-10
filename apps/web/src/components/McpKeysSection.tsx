"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { usersApi, type McpKeyItem } from "@/lib/api";

export function McpKeysSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("default");
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  const keysQuery = useQuery(["mcp-keys"], () => usersApi.listMcpKeys(), {
    retry: false,
  });

  const createMutation = useMutation(
    async () => usersApi.createMcpKey({ name: name.trim() || "default" }),
    {
      onSuccess: (data) => {
        setNewKey(data.key);
        setError(null);
        queryClient.invalidateQueries(["mcp-keys"]);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to create key");
      },
    }
  );

  const revokeMutation = useMutation(
    async (id: string) => usersApi.revokeMcpKey(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["mcp-keys"]);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to revoke key");
      },
    }
  );

  // Hide for non-authors (403)
  if (keysQuery.isError) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold font-heading">MCP API keys</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Personal keys for Cursor/Claude MCP. Tools run as{" "}
            <strong>you</strong> only. Instance{" "}
            <code className="text-xs">MCP_API_KEY</code> still acts as the primary author.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {newKey && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Copy now — the full key is shown only once.
            </p>
            <code className="block text-sm break-all select-all">{newKey}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(newKey);
              }}
            >
              Copy key
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="mcp-key-name">Label</Label>
            <Input
              id="mcp-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cursor laptop"
            />
          </div>
          <Button
            type="button"
            disabled={createMutation.isLoading}
            onClick={() => {
              setNewKey(null);
              createMutation.mutate();
            }}
          >
            {createMutation.isLoading ? "Creating…" : "Create key"}
          </Button>
        </div>

        {keysQuery.isLoading ? (
          <LoadingSpinner />
        ) : (
          <ul className="space-y-2 text-sm">
            {(keysQuery.data?.keys || []).length === 0 ? (
              <li className="text-muted-foreground">No keys yet.</li>
            ) : (
              (keysQuery.data!.keys as McpKeyItem[]).map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span>
                    <span className="font-medium">{k.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {k.key_prefix}… · {k.scopes}
                      {k.last_used_at
                        ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`
                        : " · never used"}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={revokeMutation.isLoading}
                    onClick={() => revokeMutation.mutate(k.id)}
                  >
                    Revoke
                  </Button>
                </li>
              ))
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
