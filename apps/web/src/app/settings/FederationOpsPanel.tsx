"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { adminApi } from "@/lib/api";

export default function FederationOpsPanel() {
  const queryClient = useQueryClient();
  const [blockDomain, setBlockDomain] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const statsQuery = useQuery(["federation-stats"], () => adminApi.getFederationStats(), {
    refetchInterval: 30_000,
  });
  const blocksQuery = useQuery(["federation-blocks"], () => adminApi.listFederationBlocks());

  const retryOne = useMutation(
    async (id: string) => adminApi.retryDelivery(id),
    {
      onSuccess: () => {
        setSuccess("Delivery re-queued");
        statsQuery.refetch();
        setTimeout(() => setSuccess(null), 2500);
      },
      onError: (err) => setError(err instanceof Error ? err.message : "Retry failed"),
    }
  );

  const retryAll = useMutation(
    async () => adminApi.retryAllFailedDeliveries(),
    {
      onSuccess: (data) => {
        setSuccess(`Re-queued ${data.enqueued} deliveries`);
        statsQuery.refetch();
        setTimeout(() => setSuccess(null), 3000);
      },
      onError: (err) => setError(err instanceof Error ? err.message : "Retry failed"),
    }
  );

  const addBlock = useMutation(
    async () =>
      adminApi.addFederationBlock({
        domain: blockDomain.trim(),
        reason: blockReason.trim() || null,
      }),
    {
      onSuccess: () => {
        setBlockDomain("");
        setBlockReason("");
        setSuccess("Domain blocked");
        blocksQuery.refetch();
        setTimeout(() => setSuccess(null), 2500);
      },
      onError: (err) => setError(err instanceof Error ? err.message : "Block failed"),
    }
  );

  const removeBlock = useMutation(
    async (id: string) => adminApi.removeFederationBlock(id),
    {
      onSuccess: () => {
        blocksQuery.refetch();
        setSuccess("Block removed");
        setTimeout(() => setSuccess(null), 2500);
      },
      onError: (err) => setError(err instanceof Error ? err.message : "Unblock failed"),
    }
  );

  if (statsQuery.isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (statsQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        {(statsQuery.error as Error)?.message || "Failed to load federation stats"}
      </p>
    );
  }

  const stats = statsQuery.data!;
  const failures = stats.recent_failures || [];
  const blocks = blocksQuery.data?.blocks || [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-primary/10 border border-primary/20 p-3 text-sm text-primary">
          {success}
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-lg font-semibold font-heading">Delivery (last 24h)</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={retryAll.isLoading || failures.length === 0}
            onClick={() => {
              setError(null);
              retryAll.mutate();
            }}
          >
            {retryAll.isLoading ? "Queueing…" : "Retry all failed"}
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total },
            { label: "Sent", value: stats.by_status.sent },
            { label: "Failed", value: stats.by_status.failed },
            { label: "Pending", value: stats.by_status.pending + stats.by_status.retrying },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold font-heading mb-3">Recent failures</h3>
        {failures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failed deliveries.</p>
        ) : (
          <ul className="space-y-2 text-sm max-h-80 overflow-y-auto">
            {failures.map((f) => (
              <li
                key={f.id}
                className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium truncate">
                    {f.remote_host || f.remote_inbox}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    attempts {f.attempt_count} · {new Date(f.updated_at).toLocaleString()}
                  </p>
                  {f.last_error && (
                    <p className="text-xs text-destructive line-clamp-2">{f.last_error}</p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={retryOne.isLoading}
                  onClick={() => {
                    setError(null);
                    retryOne.mutate(f.id);
                  }}
                >
                  Retry
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold font-heading mb-3">Domain blocklist</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Blocked domains are rejected on inbox and skipped for outbound delivery.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end mb-4">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="block-domain">Domain</Label>
            <Input
              id="block-domain"
              placeholder="spam.example"
              value={blockDomain}
              onChange={(e) => setBlockDomain(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="block-reason">Reason (optional)</Label>
            <Input
              id="block-reason"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={addBlock.isLoading || blockDomain.trim().length < 3}
            onClick={() => {
              setError(null);
              addBlock.mutate();
            }}
          >
            Block
          </Button>
        </div>
        {blocksQuery.isLoading ? (
          <LoadingSpinner />
        ) : blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No domains blocked.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span>
                  <span className="font-medium">{b.domain}</span>
                  {b.reason && (
                    <span className="text-muted-foreground"> · {b.reason}</span>
                  )}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={removeBlock.isLoading}
                  onClick={() => removeBlock.mutate(b.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
