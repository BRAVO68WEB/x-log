"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useMutation } from "react-query";
import { useAuth } from "@/hooks/useAuth";

export default function OIDCLinkClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refetch } = useAuth();
  const state = searchParams.get("state");
  const oidcEmail = searchParams.get("email");
  const isLoggedIn = !!user;

  useEffect(() => {
    if (!state) {
      router.replace("/login?error=invalid_link_state");
      return;
    }
    // Don't auto-fill email - user should enter their own xLog credentials
    // If user is logged in, try to link immediately without password
    if (isLoggedIn && state) {
      const handleAutoLink = async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await fetch(`/api/auth/oidc/link`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state }), // No email/password needed when logged in
          });
          if (!res.ok) {
            const err = await res
              .json()
              .catch(() => ({ error: "Account linking failed" }));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          await refetch();
          router.replace("/settings");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Account linking failed");
          setLoading(false);
        }
      };
      handleAutoLink();
    }
  }, [state, oidcEmail, router, isLoggedIn, refetch]);

  const linkMutation = useMutation(
    async () => {
      const res = await fetch(`/api/auth/oidc/link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, state }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Account linking failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: async () => {
        await refetch();
        router.replace("/?linked=success");
      },
      onError: (err) =>
        setError(err instanceof Error ? err.message : "Account linking failed"),
      onSettled: () => setLoading(false),
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    linkMutation.mutate();
  };

  if (!state) {
    return null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-light-base dark:bg-dark-base py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-light-text dark:text-dark-text">
            Link Your Account
          </h2>
          <p className="mt-2 text-center text-sm text-light-subtle dark:text-dark-subtle">
            {isLoggedIn
              ? "Link your OIDC account to your current xLog account."
              : "Please enter your xLog account credentials to link your OIDC account. Your OIDC email and xLog email can be different."}
          </p>
          {oidcEmail && (
            <div className="mt-4 p-3 bg-light-overlay dark:bg-dark-overlay rounded-md border border-light-highlight-med dark:border-dark-highlight-med">
              <p className="text-sm text-light-text dark:text-dark-text">
                <span className="font-medium">OIDC Account Email:</span> {oidcEmail}
              </p>
              <p className="text-xs text-light-subtle dark:text-dark-subtle mt-1">
                This is the email from your OIDC provider. Enter your xLog account credentials below.
              </p>
            </div>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {!isLoggedIn && (
            <div className="rounded-md shadow-sm -space-y-px">
              <Input
                label="xLog Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="rounded-t-md"
              />
              <Input
                label="xLog Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="rounded-b-md"
              />
            </div>
          )}

          {error && (
            <div className="rounded-md bg-light-love/10 dark:bg-dark-love/20 p-4 border border-light-love/20 dark:border-dark-love/20">
              <div className="text-sm text-light-love dark:text-dark-love">{error}</div>
            </div>
          )}

          <div className="space-y-3">
            <Button 
              type="submit" 
              disabled={loading || (!isLoggedIn && (!email || !password))} 
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="mr-2">
                    <LoadingSpinner size="sm" />
                  </span>
                  Linking Account...
                </span>
              ) : (
                "Link Account"
              )}
            </Button>
            <Button 
              type="button" 
              onClick={() => router.push("/login")}
              variant="secondary"
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
