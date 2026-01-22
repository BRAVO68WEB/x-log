"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useMutation, useQuery, useQueryClient } from "react-query";

interface OIDCAccount {
  id: string;
  provider: string;
  email: string | null;
  name: string | null;
  created_at: string;
}

export function OIDCAccountsSection() {
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const accountsQuery = useQuery<OIDCAccount[]>(
    ["oidc-accounts"],
    async () => {
      const res = await fetch(`/api/auth/oidc/accounts`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          return [];
        }
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to load OIDC accounts" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onError: (err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load OIDC accounts"
        );
      },
    }
  );

  const unlinkMutation = useMutation(
    async (accountId: string) => {
      const res = await fetch(`/api/auth/oidc/accounts/${accountId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to unlink account" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["oidc-accounts"]);
      },
      onError: (err) => {
        setError(
          err instanceof Error ? err.message : "Failed to unlink account"
        );
      },
    }
  );

  const handleUnlink = (accountId: string) => {
    if (confirm("Are you sure you want to unlink this OIDC account?")) {
      unlinkMutation.mutate(accountId);
    }
  };

  const handleLinkNew = async () => {
    try {
      setError(null);
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
    }
  };

  if (accountsQuery.isLoading) {
    return (
      <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-md p-8 border border-light-highlight-med dark:border-dark-highlight-med">
        <div className="flex justify-center items-center min-h-[200px]">
          <LoadingSpinner size="md" />
        </div>
      </div>
    );
  }

  const accounts = accountsQuery.data || [];

  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-md p-8 border border-light-highlight-med dark:border-dark-highlight-med">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-light-text dark:text-dark-text">
          Linked OIDC Accounts
        </h2>
        <p className="text-sm text-light-muted dark:text-dark-muted mt-1">
          Manage your linked OpenID Connect authentication accounts
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-light-love/10 dark:bg-dark-love/20 p-4 border border-light-love/20 dark:border-dark-love/20">
          <div className="text-sm text-light-love dark:text-dark-love">
            {error}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-light-muted dark:text-dark-muted mb-4">
              No OIDC accounts linked yet
            </p>
            <Button onClick={handleLinkNew}>Link OIDC Account</Button>
          </div>
        ) : (
          <>
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 rounded-lg border border-light-highlight-med dark:border-dark-highlight-med bg-light-overlay/50 dark:bg-dark-overlay/40"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-light-text dark:text-dark-text">
                      {account.provider}
                    </span>
                    {account.email && (
                      <span className="text-sm text-light-muted dark:text-dark-muted">
                        • {account.email}
                      </span>
                    )}
                  </div>
                  {account.name && (
                    <div className="text-sm text-light-subtle dark:text-dark-subtle mt-1">
                      {account.name}
                    </div>
                  )}
                  <div className="text-xs text-light-subtle dark:text-dark-subtle mt-1">
                    Linked on {new Date(account.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUnlink(account.id)}
                  disabled={unlinkMutation.isLoading}
                >
                  {unlinkMutation.isLoading ? "Unlinking..." : "Unlink"}
                </Button>
              </div>
            ))}
            <div className="pt-4">
              <Button onClick={handleLinkNew} variant="secondary" className="w-full">
                Link Another OIDC Account
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
