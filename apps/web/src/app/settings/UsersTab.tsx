"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { adminApi, type AdminUser, type AdminInvite } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";

export default function UsersTab() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [openReg, setOpenReg] = useState(false);

  const usersQuery = useQuery(["admin-users"], () => adminApi.listUsers());
  const invitesQuery = useQuery(["admin-invites"], () => adminApi.listInvites());
  const settingsQuery = useQuery(["settings-open-reg"], async () => {
    const res = await fetch("/api/settings", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load settings");
    return res.json() as Promise<{ open_registrations: boolean }>;
  }, {
    onSuccess: (data) => setOpenReg(Boolean(data.open_registrations)),
  });

  const inviteMutation = useMutation(
    async () => adminApi.createInvite(email.trim() || null),
    {
      onSuccess: (data) => {
        setError(null);
        const url =
          typeof window !== "undefined"
            ? `${window.location.origin}${data.invite_path}`
            : data.invite_path;
        setLastInviteUrl(url);
        setSuccess("Invite created. Copy the link below — it is shown once.");
        setEmail("");
        invitesQuery.refetch();
        usersQuery.refetch();
      },
      onError: (err) => {
        setSuccess(null);
        setError(err instanceof Error ? err.message : "Failed to create invite");
      },
    }
  );

  const patchUser = useMutation(
    async (vars: { id: string; is_active?: boolean; role?: "admin" | "author" }) =>
      adminApi.updateUser(vars.id, {
        is_active: vars.is_active,
        role: vars.role,
      }),
    {
      onSuccess: () => {
        setError(null);
        setSuccess("User updated");
        queryClient.invalidateQueries(["admin-users"]);
        setTimeout(() => setSuccess(null), 2500);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to update user");
      },
    }
  );

  const revokeInvite = useMutation(
    async (id: string) => adminApi.revokeInvite(id),
    {
      onSuccess: () => {
        invitesQuery.refetch();
        setSuccess("Invite revoked");
        setTimeout(() => setSuccess(null), 2500);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to revoke invite");
      },
    }
  );

  const openRegMutation = useMutation(
    async (enabled: boolean) => {
      const res = await fetch("/api/settings", withCsrf({
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open_registrations: enabled }),
      }));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data as { open_registrations: boolean };
    },
    {
      onSuccess: (data) => {
        setOpenReg(Boolean(data.open_registrations));
        setSuccess(
          data.open_registrations
            ? "Public registration enabled"
            : "Public registration closed (invite-only)"
        );
        setTimeout(() => setSuccess(null), 2500);
        settingsQuery.refetch();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to update registration mode");
      },
    }
  );

  if (usersQuery.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (usersQuery.isError) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
        <p className="text-sm text-destructive">
          {(usersQuery.error as Error)?.message || "Failed to load users"}
        </p>
      </div>
    );
  }

  const data = usersQuery.data!;
  const invites: AdminInvite[] = invitesQuery.data?.invites || [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-md bg-primary/10 p-4 border border-primary/20">
          <p className="text-sm text-primary">{success}</p>
        </div>
      )}

      <BentoGrid columns={2}>
        <BentoCard size="full" index={0}>
          <BentoCardHeader>
            <h2 className="text-xl font-semibold font-heading">Registration mode</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Default is invite-only. Open registration creates authors only (never admins).
              Env <code className="text-xs">OPEN_REGISTRATIONS=true</code> forces open.
            </p>
          </BentoCardHeader>
          <BentoCardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5 pr-4">
                <Label className="font-medium">Open public registration</Label>
                <p className="text-xs text-muted-foreground">
                  Allows /register for new authors up to MAX_LOCAL_AUTHORS
                </p>
              </div>
              <Switch
                checked={openReg}
                disabled={openRegMutation.isLoading || settingsQuery.isLoading}
                onCheckedChange={(checked) => openRegMutation.mutate(checked)}
              />
            </div>
          </BentoCardContent>
        </BentoCard>

        <BentoCard size="full" index={1} accent>
          <BentoCardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold font-heading">Local users</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Active authors/admins: {data.active_author_count} / {data.max_local_authors}{" "}
                  (MAX_LOCAL_AUTHORS)
                </p>
              </div>
            </div>
          </BentoCardHeader>
          <BentoCardContent>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {data.users.map((u: AdminUser) => (
                <li
                  key={u.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      @{u.username}{" "}
                      <span className="text-xs font-normal text-muted-foreground capitalize">
                        · {u.role}
                        {!u.is_active && " · deactivated"}
                      </span>
                    </p>
                    {u.email && (
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {u.role === "author" && u.is_active && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={patchUser.isLoading}
                        onClick={() => patchUser.mutate({ id: u.id, role: "admin" })}
                      >
                        Make admin
                      </Button>
                    )}
                    {u.role === "admin" && u.is_active && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={patchUser.isLoading}
                        onClick={() => patchUser.mutate({ id: u.id, role: "author" })}
                      >
                        Make author
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={u.is_active ? "destructive" : "secondary"}
                      disabled={patchUser.isLoading}
                      onClick={() =>
                        patchUser.mutate({ id: u.id, is_active: !u.is_active })
                      }
                    >
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </BentoCardContent>
        </BentoCard>

        <BentoCard size="full" index={2}>
          <BentoCardHeader>
            <h2 className="text-xl font-semibold font-heading">Invite author</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Invite-only multi-user. Share the one-time link; they pick username and password.
            </p>
          </BentoCardHeader>
          <BentoCardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email (optional note)</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="author@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={inviteMutation.isLoading}
                onClick={() => inviteMutation.mutate()}
              >
                {inviteMutation.isLoading ? "Creating…" : "Create invite"}
              </Button>
            </div>
            {lastInviteUrl && (
              <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Invite link (copy now)</p>
                <code className="block text-sm break-all select-all">{lastInviteUrl}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(lastInviteUrl);
                    setSuccess("Invite link copied");
                  }}
                >
                  Copy link
                </Button>
              </div>
            )}
          </BentoCardContent>
        </BentoCard>

        <BentoCard size="full" index={3}>
          <BentoCardHeader>
            <h2 className="text-lg font-semibold font-heading">Recent invites</h2>
          </BentoCardHeader>
          <BentoCardContent>
            {invitesQuery.isLoading ? (
              <LoadingSpinner />
            ) : invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invites yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <span>
                      <span className="capitalize font-medium">{inv.status}</span>
                      {inv.email ? ` · ${inv.email}` : ""}
                      <span className="text-muted-foreground">
                        {" "}
                        · expires {new Date(inv.expires_at).toLocaleDateString()}
                      </span>
                    </span>
                    {inv.status === "valid" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={revokeInvite.isLoading}
                        onClick={() => revokeInvite.mutate(inv.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </BentoCardContent>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
