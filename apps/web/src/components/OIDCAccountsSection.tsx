"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          err instanceof Error
            ? err.message
            : "Failed to load OIDC accounts"
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
          err instanceof Error
            ? err.message
            : "Failed to unlink account"
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
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to initiate OIDC login" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { auth_url: string };
      window.location.href = data.auth_url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to initiate OIDC login"
      );
    }
  };

  if (accountsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center min-h-[200px]">
          <LoadingSpinner size="md" />
        </CardContent>
      </Card>
    );
  }

  const accounts = accountsQuery.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-heading">
          Linked OIDC Accounts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage your linked OpenID Connect authentication accounts
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No OIDC accounts linked yet
              </p>
              <Button onClick={handleLinkNew}>Link OIDC Account</Button>
            </div>
          ) : (
            <>
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.provider}</span>
                      {account.email && (
                        <span className="text-sm text-muted-foreground">
                          · {account.email}
                        </span>
                      )}
                    </div>
                    {account.name && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {account.name}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Linked on{" "}
                      {new Date(account.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnlink(account.id)}
                    disabled={unlinkMutation.isLoading}
                  >
                    {unlinkMutation.isLoading ? "Unlinking..." : "Unlink"}
                  </Button>
                </div>
              ))}
              <div className="pt-4">
                <Button
                  onClick={handleLinkNew}
                  variant="outline"
                  className="w-full"
                >
                  Link Another OIDC Account
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
