"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { useMutation } from "react-query";
import { useAuth } from "@/hooks/useAuth";

export default function LoginClient() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refetch } = useAuth();

  useEffect(() => {
    if (user) {
      const redirect = searchParams.get("redirect") || "/";
      router.replace(redirect);
    }

    const oidcError = searchParams.get("error");
    const oidcDescription = searchParams.get("description");
    if (oidcError) {
      setError(oidcDescription || `OIDC Error: ${oidcError}`);
    }
  }, [user, router, searchParams]);

  const loginMutation = useMutation(
    async () => {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Login failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: async () => {
        await refetch();
        const redirect = searchParams.get("redirect") || "/";
        router.replace(redirect);
      },
      onError: (err) =>
        setError(err instanceof Error ? err.message : "Login failed"),
      onSettled: () => setLoading(false),
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    loginMutation.mutate();
  };

  const handleOIDCLogin = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/auth/oidc/login`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to initiate OIDC login" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { auth_url: string };
      window.location.href = data.auth_url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initiate OIDC login"
      );
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-4xl">
        <BentoGrid columns={3}>
          <BentoCard size="2x2" index={0} className="hidden md:flex">
            <div className="flex min-h-[300px] flex-col justify-end gap-3 p-8">
              <h2 className="text-5xl font-normal tracking-[-0.04em] font-heading">
                x-log
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                A federated writing space built on ActivityPub.
              </p>
            </div>
          </BentoCard>

          {/* Login form */}
          <BentoCard size="1x2" index={1}>
            <BentoCardHeader>
              <h1 className="text-3xl font-heading font-normal tracking-[-0.02em] text-center">
                Sign in
              </h1>
            </BentoCardHeader>
            <BentoCardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="Enter your username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 border border-destructive/20">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !username || !password}
                  className="w-full"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingSpinner size="sm" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="mt-6 space-y-4">
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleOIDCLogin}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  Sign in with OIDC
                </Button>
              </div>
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    </main>
  );
}
