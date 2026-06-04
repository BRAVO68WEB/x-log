"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { useMutation, useQuery } from "react-query";
import Link from "next/link";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Verify token on mount
  const { data: tokenValid, isLoading: verifyingToken } = useQuery(
    ["verify-reset-token", token],
    async () => {
      if (!token) return { valid: false };
      const res = await fetch(`/api/auth/verify-reset-token?token=${token}`);
      if (!res.ok) return { valid: false };
      return res.json();
    },
    {
      enabled: !!token,
      retry: false,
    }
  );

  const resetPasswordMutation = useMutation(
    async () => {
      const res = await fetch(`/api/auth/reset-password`, {
        method: "POST",
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
        router.push("/login?reset=success");
      },
      onError: (err: Error) => {
        setError(err.message);
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    resetPasswordMutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <BentoGrid className="max-w-md w-full">
          <BentoCard className="col-span-full">
            <BentoCardHeader>
              <h1 className="text-2xl font-bold text-center text-destructive">
                Invalid Reset Link
              </h1>
            </BentoCardHeader>
            <BentoCardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                This password reset link is invalid or has expired.
              </p>
              <Link href="/forgot-password">
                <Button variant="outline">Request New Reset Link</Button>
              </Link>
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    );
  }

  if (verifyingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-muted-foreground">Verifying reset link...</div>
      </div>
    );
  }

  if (!tokenValid?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <BentoGrid className="max-w-md w-full">
          <BentoCard className="col-span-full">
            <BentoCardHeader>
              <h1 className="text-2xl font-bold text-center text-destructive">
                Invalid or Expired Link
              </h1>
            </BentoCardHeader>
            <BentoCardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                This password reset link has expired or has already been used.
              </p>
              <Link href="/forgot-password">
                <Button variant="outline">Request New Reset Link</Button>
              </Link>
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <BentoGrid className="max-w-md w-full">
        <BentoCard className="col-span-full">
          <BentoCardHeader>
            <h1 className="text-2xl font-bold text-center">Reset Password</h1>
            <p className="text-sm text-muted-foreground text-center">Enter your new password</p>
          </BentoCardHeader>
          <BentoCardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={resetPasswordMutation.isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={resetPasswordMutation.isLoading}
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={resetPasswordMutation.isLoading}>
                {resetPasswordMutation.isLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>

            <Separator className="my-4" />

            <div className="text-center text-sm">
              Remember your password?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </BentoCardContent>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
