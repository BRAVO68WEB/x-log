"use client";

import { useState } from "react";
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

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const requestMutation = useMutation(
    async () => {
      const res = await fetch(`/api/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: () => setSent(true),
      onError: (err) =>
        setError(err instanceof Error ? err.message : "Request failed"),
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    requestMutation.mutate();
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

          <BentoCard size="1x2" index={1}>
            <BentoCardHeader>
              <h1 className="text-3xl font-heading font-normal tracking-[-0.02em] text-center">
                Reset password
              </h1>
            </BentoCardHeader>
            <BentoCardContent>
              {sent ? (
                <div className="space-y-4 text-center">
                  <div className="rounded-md bg-primary/10 p-4 border border-primary/20">
                    <p className="text-sm text-primary">
                      If an account with that email exists, we&apos;ve sent a
                      reset link. Check your inbox.
                    </p>
                  </div>
                  <Link href="/login">
                    <Button variant="outline" className="w-full">
                      Back to sign in
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Enter your email address and we&apos;ll send you a link to
                    reset your password.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md bg-destructive/10 p-3 border border-destructive/20">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={requestMutation.isLoading || !email}
                    className="w-full"
                  >
                    {requestMutation.isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoadingSpinner size="sm" />
                        Sending...
                      </span>
                    ) : (
                      "Send reset link"
                    )}
                  </Button>

                  <div className="text-center">
                    <Link
                      href="/login"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Back to sign in
                    </Link>
                  </div>
                </form>
              )}
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    </main>
  );
}
