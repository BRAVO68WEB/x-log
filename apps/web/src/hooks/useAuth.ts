"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "react-query";

interface User {
  id: string;
  username: string;
  email?: string;
  role: "admin" | "author" | "reader";
  created_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const userQuery = useQuery<User>(["me"], async () => {
    const res = await fetch(`/api/users/me`, { credentials: "include" });
    if (!res.ok) {
      // 401 expected when not logged in
      if (res.status === 401) throw new Error("401 Unauthorized");
      const err = await res.json().catch(() => ({ error: "Failed to load user" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as User;
  }, {
    onSuccess: (u) => setUser(u),
    onError: (err) => {
      if (err instanceof Error && err.message.includes("401")) {
        setUser(null);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load user");
        setUser(null);
      }
    },
    refetchOnWindowFocus: false,
  });

  const logoutMutation = useMutation(async () => {
    const res = await fetch(`/api/auth/logout`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Logout failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }, {
    onSettled: () => {
      setUser(null);
      router.push("/");
    },
  });

  return {
    user,
    loading: userQuery.isLoading,
    error,
    refetch: () => userQuery.refetch(),
    logout: () => logoutMutation.mutate(),
    isAuthenticated: !!user,
  };
}
