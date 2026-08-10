"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Verification failed");
          return;
        }
        setStatus("ok");
        setMessage("Email verified successfully.");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Verification failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full rounded-lg border border-border bg-card p-8 text-center space-y-4">
        {status === "loading" && <LoadingSpinner size="lg" />}
        {status === "ok" && (
          <>
            <h1 className="text-2xl font-heading">Email verified</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link href="/" className="text-primary hover:underline text-sm">
              Go home
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-heading">Verification failed</h1>
            <p className="text-sm text-destructive">{message}</p>
            <Link href="/login" className="text-primary hover:underline text-sm">
              Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
