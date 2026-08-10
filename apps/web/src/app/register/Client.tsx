"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { useAuth } from "@/hooks/useAuth";

export default function RegisterClient() {
  const router = useRouter();
  const { user, refetch } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const statusQuery = useQuery(["registration-status"], async () => {
    const res = await fetch("/api/auth/registration-status", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load registration status");
    return res.json() as Promise<{
      open_registrations: boolean;
      can_register: boolean;
      max_local_authors: number;
      active_author_count: number;
    }>;
  });

  const registerMutation = useMutation(
    async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          email: email.trim() || null,
          full_name: fullName.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
    {
      onSuccess: async () => {
        await refetch();
        router.replace("/editor");
      },
      onError: (err) => setError(err instanceof Error ? err.message : "Registration failed"),
    }
  );

  if (statusQuery.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  const status = statusQuery.data;
  const closed = !status?.can_register;

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <BentoGrid columns={2}>
          <BentoCard size="full" index={0} accent>
            <BentoCardHeader>
              <h1 className="text-3xl font-heading tracking-[-0.02em]">Create author account</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Public signup{" "}
                {status?.open_registrations ? "is open" : "is closed"} ·{" "}
                {status?.active_author_count ?? 0}/{status?.max_local_authors ?? "?"} authors
              </p>
            </BentoCardHeader>
            <BentoCardContent className="space-y-4">
              {closed ? (
                <div className="rounded-md border border-border bg-secondary/40 p-4 text-sm space-y-2">
                  <p className="font-medium">Registration is not available</p>
                  <p className="text-muted-foreground">
                    {!status?.open_registrations
                      ? "This instance is invite-only. Ask an admin for an invite link."
                      : "Author limit reached. Try again later or contact an admin."}
                  </p>
                  <Link href="/login" className="text-primary hover:underline text-sm">
                    Back to sign in
                  </Link>
                </div>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError(null);
                    registerMutation.mutate();
                  }}
                >
                  {error && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      placeholder="jane"
                    />
                    <p className="text-xs text-muted-foreground">
                      3–32 chars: a–z, 0–9, underscore. Your Fediverse handle.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Display name (optional)</Label>
                    <Input
                      id="full_name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                    <p className="text-xs text-muted-foreground">
                      If SMTP is configured, a verification link is sent.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      registerMutation.isLoading || username.length < 3 || password.length < 8
                    }
                  >
                    {registerMutation.isLoading ? "Creating…" : "Create account"}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login" className="text-primary hover:underline">
                      Sign in
                    </Link>
                  </p>
                </form>
              )}
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    </main>
  );
}
