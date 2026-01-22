"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
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
    
    // Check for OIDC errors in query params
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
        const err = await res.json().catch(() => ({ error: "Failed to initiate OIDC login" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { auth_url: string };
      window.location.href = data.auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate OIDC login");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-light-base dark:bg-dark-base py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-light-text dark:text-dark-text">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="rounded-t-md"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-b-md"
            />
          </div>

          {error && (
            <div className="rounded-md bg-light-love/10 dark:bg-dark-love/20 p-4 border border-light-love/20 dark:border-dark-love/20">
              <div className="text-sm text-light-love dark:text-dark-love">{error}</div>
            </div>
          )}

          <div>
            <Button type="submit" disabled={loading || !username || !password} className="w-full">
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="mr-2">
                    <LoadingSpinner size="sm" />
                  </span>
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-light-overlay dark:border-dark-overlay"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-light-base dark:bg-dark-base text-light-subtle dark:text-dark-subtle">
                Or continue with
              </span>
            </div>
          </div>

          <div>
            <Button 
              type="button" 
              onClick={handleOIDCLogin}
              disabled={loading}
              className="w-full"
              variant="secondary"
            >
              Sign in with OIDC
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
