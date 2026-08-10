"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";

export default function InviteClient(props: { params: Promise<{ token: string }> }) {
  const params = use(props.params);
  const token = params.token;

  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inviteQuery = useQuery(
    ["invite", token],
    async () => {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Invite unavailable (${res.status})`);
      }
      return data as {
        status: string;
        email: string | null;
        role: string;
        expires_at: string;
      };
    },
    { enabled: Boolean(token), retry: false }
  );

  const acceptMutation = useMutation(
    async () => {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          full_name: fullName || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data as { username: string; actor_url: string };
    },
    {
      onSuccess: () => {
        router.replace("/editor");
        router.refresh();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to accept invite");
      },
    }
  );

  if (!token) {
    return (
      <main className="min-h-screen py-16 px-4">
        <p className="text-center text-muted-foreground">Missing invite token.</p>
      </main>
    );
  }

  if (inviteQuery.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  if (inviteQuery.isError) {
    return (
      <main className="min-h-screen py-16 px-4">
        <div className="max-w-md mx-auto rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
          <h1 className="text-xl font-heading font-semibold mb-2">Invite unavailable</h1>
          <p className="text-sm text-destructive">
            {(inviteQuery.error as Error)?.message || "Invalid or expired invite"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        <BentoGrid columns={2}>
          <BentoCard size="full" index={0} accent>
            <BentoCardHeader>
              <h1 className="text-3xl font-heading tracking-[-0.03em]">Join as author</h1>
              <p className="text-sm text-muted-foreground mt-2">
                You were invited to write on this instance
                {inviteQuery.data?.email ? ` (${inviteQuery.data.email})` : ""}.
              </p>
            </BentoCardHeader>
            <BentoCardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="jane"
                required
                autoComplete="username"
              />
              <p className="text-xs text-muted-foreground -mt-2">
                3–32 characters: a–z, 0–9, underscore. Becomes your Fediverse handle.
              </p>
              <Input
                label="Display name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Button
                className="w-full"
                disabled={
                  acceptMutation.isLoading ||
                  username.length < 3 ||
                  password.length < 8
                }
                onClick={() => {
                  setError(null);
                  acceptMutation.mutate();
                }}
              >
                {acceptMutation.isLoading ? "Creating account…" : "Accept invite"}
              </Button>
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    </main>
  );
}
