"use client";

import { useState, useEffect } from "react";
import { usersApi } from "@/lib/api";

interface User {
  id: string;
  username: string;
  email?: string;
  role: "admin" | "user";
  created_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const userData = await usersApi.getMe() as User;
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    refetch: loadUser,
  };
}

