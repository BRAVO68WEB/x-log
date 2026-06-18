"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { useMutation } from "react-query";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }

    fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
        }
      })
      .catch(() => setTokenValid(false));
  }, [token]);

  const resetMutation = useMutation(
    async () => {
      const res = await fetch(`/api/auth/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Reset failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => router.replace("/"), 2000);
      },
      onError: (err) =>
        setError(err instanceof Error ? err.message : "Reset failed"),
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    resetMutation.mutate();
  };

  // Loading state
  if (tokenValid === null) {
    return (
      <main className="min-h-screen flex items-center justify-center py-12 px-4">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  // Invalid token
  if (!tokenValid) {
    return (
      <main className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-heading">Invalid or expired link</h1>
          <p className="text-muted-foreground">
            This password reset link is invalid or has expired. Please request a
            new one.
          </p>
          <Link href="/forgot-password">
            <Button>Request new link</Button>
          </Link>
        </div>
      </main>
    );
  }

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

          <BentoCard size="1x2" index={1}>
            <BentoCardHeader>
              <h1 className="text-3xl font-heading font-normal tracking-[-0.02em] text-center">
                Set new password
              </h1>
            </BentoCardHeader>
            <BentoCardContent>
              {success ? (
                <div className="space-y-4 text-center">
                  <div className="rounded-md bg-primary/10 p-4 border border-primary/20">
                    <p className="text-sm text-primary">
                      Password reset successful! Redirecting to home...
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      minLength={8}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      minLength={8}
                    />
                  </div>

                  {error && (
                    <div className="rounded-md bg-destructive/10 p-3 border border-destructive/20">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={resetMutation.isLoading || !password || !confirmPassword}
                    className="w-full"
                  >
                    {resetMutation.isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoadingSpinner size="sm" />
                        Resetting...
                      </span>
                    ) : (
                      "Reset password"
                    )}
                  </Button>
                </form>
              )}
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    </main>
  );
}
