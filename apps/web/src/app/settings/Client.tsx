"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { settingsApi, usersApi } from "@/lib/api";
import {
  applyThemeById,
  instanceThemes,
  normalizeThemeId,
  type InstanceThemeId,
} from "@/lib/themes";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { useMutation, useQuery } from "react-query";
import {
  FaBell,
  FaChartSimple,
  FaEnvelope,
  FaGear,
  FaPalette,
  FaShieldHalved,
  FaShareNodes,
  FaPuzzlePiece,
  FaRobot,
  FaUsers,
} from "react-icons/fa6";
import FeaturesTab from "./FeaturesTab";
import UsersTab from "./UsersTab";
import AnalyticsDashboard from "../analytics/AnalyticsDashboard";

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [followInput, setFollowInput] = useState("");
  const [followSuccess, setFollowSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [settings, setSettings] = useState({
    instance_name: "",
    instance_description: "",
    instance_domain: "",
    admin_email: "",
    smtp_url: "",
    federation_enabled: true,
    following_enabled: false,
    use_profile_as_landing: false,
    primary_user_id: "" as string,
    theme_id: "system" as InstanceThemeId,
    ai_base_url: "",
    ai_api_key: "",
    ai_model: "",
    ai_max_tokens: 2048,
    ai_temperature: 0.7,
  });
  const [instanceMeta, setInstanceMeta] = useState<{
    instance_mode: "solo" | "multi";
    local_user_count: number;
    local_users: Array<{ id: string; username: string; role: string }>;
    primary_username: string | null;
  }>({
    instance_mode: "solo",
    local_user_count: 0,
    local_users: [],
    primary_username: null,
  });

  const settingsQuery = useQuery(
    ["settings"],
    async () => {
      const res = await fetch(`/api/settings`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load settings" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{
        instance_name: string;
        instance_description: string | null;
        instance_domain: string;
        admin_email: string | null;
        smtp_url: string | null;
        federation_enabled: boolean;
        following_enabled: boolean;
        use_profile_as_landing: boolean;
        primary_user_id: string | null;
        primary_username: string | null;
        instance_mode: "solo" | "multi";
        local_user_count: number;
        local_users: Array<{ id: string; username: string; role: string }>;
        theme_id: InstanceThemeId;
        ai_base_url: string | null;
        ai_api_key: string | null;
        ai_model: string | null;
        ai_max_tokens: number | null;
        ai_temperature: number | null;
      }>;
    },
    {
      onSuccess: (data) => {
        setSettings({
          instance_name: data.instance_name,
          instance_description: data.instance_description || "",
          instance_domain: data.instance_domain,
          admin_email: data.admin_email || "",
          smtp_url: data.smtp_url || "",
          federation_enabled: data.federation_enabled,
          following_enabled: data.following_enabled,
          use_profile_as_landing: data.use_profile_as_landing,
          primary_user_id: data.primary_user_id || data.local_users[0]?.id || "",
          theme_id: normalizeThemeId(data.theme_id),
          ai_base_url: data.ai_base_url || "",
          ai_api_key: data.ai_api_key || "",
          ai_model: data.ai_model || "",
          ai_max_tokens: data.ai_max_tokens || 2048,
          ai_temperature: data.ai_temperature ?? 0.7,
        });
        setInstanceMeta({
          instance_mode: data.instance_mode,
          local_user_count: data.local_user_count,
          local_users: data.local_users || [],
          primary_username: data.primary_username,
        });
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      },
      onSettled: () => setLoading(false),
    }
  );

  const publicInstanceQuery = useQuery(["public-instance-summary"], async () => {
    const res = await fetch(`/api/public/instance`, { credentials: "include" });
    if (!res.ok) {
      throw new Error("Failed to load public instance summary");
    }
    return res.json() as Promise<{
      primary_profile: {
        username: string;
        full_name: string | null;
      } | null;
    }>;
  });

  const primaryUsername = publicInstanceQuery.data?.primary_profile?.username;

  const followingQuery = useQuery(
    ["settings-following", primaryUsername],
    async () => {
      if (!primaryUsername) return { items: [] };
      const res = await fetch(`/api/profiles/${primaryUsername}/following`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load following" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{
        items: Array<{
          remote_actor: string;
          inbox_url: string;
          activity_id: string;
          accepted: boolean;
          created_at: string;
        }>;
      }>;
    },
    { enabled: Boolean(primaryUsername) }
  );

  const updateMutation = useMutation(
    async () => {
      const res = await fetch(`/api/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instance_name: settings.instance_name,
          instance_description: settings.instance_description || null,
          instance_domain: settings.instance_domain,
          admin_email: settings.admin_email || null,
          smtp_url: settings.smtp_url || null,
          federation_enabled: settings.federation_enabled,
          following_enabled: settings.following_enabled,
          use_profile_as_landing: settings.use_profile_as_landing,
          primary_user_id: settings.primary_user_id || undefined,
          theme_id: settings.theme_id,
          ai_base_url: settings.ai_base_url || null,
          ai_api_key: settings.ai_api_key || null,
          ai_model: settings.ai_model || null,
          ai_max_tokens: settings.ai_max_tokens || null,
          ai_temperature: settings.ai_temperature,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save settings" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: () => {
        setSuccess(true);
        applyThemeById(settings.theme_id);
        window.dispatchEvent(
          new CustomEvent("xlog-theme-changed", {
            detail: { themeId: settings.theme_id },
          })
        );
        setTimeout(() => setSuccess(false), 3000);
        settingsQuery.refetch();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to save settings");
      },
      onSettled: () => setSaving(false),
    }
  );

  const followMutation = useMutation(
    async (remote?: string) => settingsApi.followFromSettings(remote ?? followInput.trim()),
    {
      onSuccess: (data, remote) => {
        setFollowSuccess(data.actor);
        if (!remote) {
          setFollowInput("");
        }
        followingQuery.refetch();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to follow actor");
      },
    }
  );

  const passwordMutation = useMutation(
    async () =>
      usersApi.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      }),
    {
      onSuccess: () => {
        setPasswordSuccess(true);
        setPasswordForm({
          current_password: "",
          new_password: "",
          confirm_password: "",
        });
        setTimeout(() => setPasswordSuccess(false), 3000);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to change password");
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    updateMutation.mutate();
  };

  const handleFollow = () => {
    setError(null);
    setFollowSuccess(null);
    if (!followInput.trim()) return;
    followMutation.mutate(undefined);
  };

  const handlePasswordChange = () => {
    setError(null);
    setPasswordSuccess(false);

    if (passwordForm.new_password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError("New password and confirmation do not match.");
      return;
    }

    passwordMutation.mutate();
  };

  if (loading || settingsQuery.isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">
            Instance Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure general, federation, and email settings for your instance.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-md bg-primary/10 p-4 border border-primary/20">
            <p className="text-sm text-primary">Settings saved successfully!</p>
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="grid gap-6 lg:grid-cols-[188px_minmax(0,920px)] lg:items-start"
        >
          <TabsList className="flex h-auto max-w-full flex-row items-stretch justify-start overflow-x-auto rounded-lg border border-border bg-secondary/70 p-1.5 lg:sticky lg:top-24 lg:w-full lg:flex-col lg:overflow-visible">
            <TabsTrigger value="general" className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start">
              <FaGear className="h-3.5 w-3.5" />
              General
            </TabsTrigger>
            <TabsTrigger
              value="federation"
              className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start"
            >
              <FaShareNodes className="h-3.5 w-3.5" />
              Federation
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start"
            >
              <FaPalette className="h-3.5 w-3.5" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="follow" className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start">
              <FaBell className="h-3.5 w-3.5" />
              Follow
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start">
              <FaEnvelope className="h-3.5 w-3.5" />
              Email
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start">
              <FaShieldHalved className="h-3.5 w-3.5" />
              Security
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start">
              <FaUsers className="h-3.5 w-3.5" />
              Users
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start">
              <FaPuzzlePiece className="h-3.5 w-3.5" />
              Features
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start">
              <FaChartSimple className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2 px-3 py-2.5 lg:w-full lg:justify-start">
              <FaRobot className="h-3.5 w-3.5" />
              AI
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
            <TabsContent value="general">
              <BentoGrid columns={2}>
                <BentoCard size="full" index={0} accent>
                  <BentoCardHeader>
                    <h2 className="text-xl font-semibold font-heading">General</h2>
                  </BentoCardHeader>
                  <BentoCardContent className="space-y-6">
                    <Input
                      label="Instance Name"
                      value={settings.instance_name}
                      onChange={(e) => setSettings({ ...settings, instance_name: e.target.value })}
                      required
                    />
                    <Textarea
                      label="Instance Description"
                      value={settings.instance_description}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          instance_description: e.target.value,
                        })
                      }
                      rows={4}
                    />
                    <Input
                      label="Instance Domain"
                      value={settings.instance_domain}
                      onChange={(e) =>
                        setSettings({ ...settings, instance_domain: e.target.value })
                      }
                      placeholder="example.com"
                      required
                    />
                  </BentoCardContent>
                </BentoCard>
              </BentoGrid>
            </TabsContent>

            <TabsContent value="federation">
              <BentoGrid columns={2}>
                <BentoCard size="full" index={0} accent>
                  <BentoCardHeader>
                    <h2 className="text-xl font-semibold font-heading">Federation</h2>
                  </BentoCardHeader>
                  <BentoCardContent className="space-y-4">
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Primary author</Label>
                          <p className="text-xs text-muted-foreground">
                            Site owner for landing, MCP write tools, and instance follows
                          </p>
                        </div>
                        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium capitalize">
                          {instanceMeta.instance_mode} · {instanceMeta.local_user_count}{" "}
                          {instanceMeta.local_user_count === 1 ? "user" : "users"}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="primary_user_id" className="text-sm">
                          Local account
                        </Label>
                        <select
                          id="primary_user_id"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={settings.primary_user_id}
                          onChange={(e) =>
                            setSettings({ ...settings, primary_user_id: e.target.value })
                          }
                          disabled={instanceMeta.local_users.length === 0}
                        >
                          {instanceMeta.local_users.length === 0 ? (
                            <option value="">No local users</option>
                          ) : (
                            instanceMeta.local_users.map((u) => (
                              <option key={u.id} value={u.id}>
                                @{u.username} ({u.role})
                              </option>
                            ))
                          )}
                        </select>
                        {instanceMeta.primary_username && (
                          <p className="text-xs text-muted-foreground">
                            Current primary: @{instanceMeta.primary_username}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="font-medium">Enable federation</Label>
                        <p className="text-xs text-muted-foreground">
                          ActivityPub support for federated interactions
                        </p>
                      </div>
                      <Switch
                        checked={settings.federation_enabled}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, federation_enabled: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="font-medium">Enable following</Label>
                        <p className="text-xs text-muted-foreground">
                          Allow the primary profile to follow remote actors
                        </p>
                      </div>
                      <Switch
                        checked={settings.following_enabled}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, following_enabled: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="font-medium">Use profile as landing</Label>
                        <p className="text-xs text-muted-foreground">
                          Redirect / to the primary user profile page when enabled
                        </p>
                      </div>
                      <Switch
                        checked={settings.use_profile_as_landing}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, use_profile_as_landing: checked })
                        }
                      />
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </BentoGrid>
            </TabsContent>

            <TabsContent value="appearance">
              <BentoGrid columns={2}>
                <BentoCard size="full" index={0} accent>
                  <BentoCardHeader>
                    <h2 className="text-xl font-semibold font-heading">Appearance</h2>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {instanceThemes.map((theme) => {
                        const active = settings.theme_id === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            className={[
                              "theme-choice rounded-md border p-4 text-left transition-colors",
                              active ? "border-primary bg-primary/10" : "border-border bg-card",
                            ].join(" ")}
                            onClick={() => setSettings({ ...settings, theme_id: theme.id })}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="font-medium">{theme.label}</span>
                              <span className="flex overflow-hidden rounded-full border border-border">
                                {theme.swatches.map((color) => (
                                  <span
                                    key={color}
                                    className="h-5 w-5"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </BentoGrid>
            </TabsContent>

            <TabsContent value="follow">
              <BentoGrid columns={2}>
                <BentoCard size="full" index={0} accent>
                  <BentoCardHeader>
                    <h2 className="text-xl font-semibold font-heading">Follow</h2>
                  </BentoCardHeader>
                  <BentoCardContent className="space-y-6">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">
                        Follows are sent from{" "}
                        <span className="font-medium text-foreground">
                          {primaryUsername ? `@${primaryUsername}` : "the primary profile"}
                        </span>
                        .
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Input
                        label="Fediverse profile"
                        value={followInput}
                        onChange={(e) => setFollowInput(e.target.value)}
                        placeholder="@name@instance.xyz"
                      />
                      <Button
                        type="button"
                        className="self-end"
                        disabled={!settings.following_enabled || followMutation.isLoading}
                        onClick={handleFollow}
                      >
                        {followMutation.isLoading ? "Following..." : "Follow"}
                      </Button>
                    </div>
                    {followSuccess && (
                      <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                        Follow request sent to {followSuccess}
                      </div>
                    )}
                    <div className="space-y-3">
                      <h3 className="font-medium">Following</h3>
                      {followingQuery.isLoading ? (
                        <LoadingSpinner size="sm" />
                      ) : followingQuery.data?.items.length ? (
                        <ul className="space-y-2">
                          {followingQuery.data.items.map((item) => (
                            <li
                              key={item.remote_actor}
                              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                            >
                              <a
                                href={item.remote_actor}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-primary hover:underline"
                              >
                                {item.remote_actor}
                              </a>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {item.accepted ? "accepted" : "pending"}
                                </span>
                                {!item.accepted && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={followMutation.isLoading}
                                    onClick={() => followMutation.mutate(item.remote_actor)}
                                  >
                                    Retry
                                  </Button>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not following anyone yet.</p>
                      )}
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </BentoGrid>
            </TabsContent>

            <TabsContent value="email">
              <BentoGrid columns={2}>
                <BentoCard size="full" index={0} accent>
                  <BentoCardHeader>
                    <h2 className="text-xl font-semibold font-heading">Email Settings</h2>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        label="Admin Email"
                        type="email"
                        value={settings.admin_email}
                        onChange={(e) => setSettings({ ...settings, admin_email: e.target.value })}
                        placeholder="admin@example.com"
                      />
                      <Input
                        label="SMTP URL"
                        type="url"
                        value={settings.smtp_url}
                        onChange={(e) => setSettings({ ...settings, smtp_url: e.target.value })}
                        placeholder="smtp://user:pass@smtp.example.com:587"
                      />
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </BentoGrid>
            </TabsContent>

            <TabsContent value="security">
              <BentoGrid columns={2}>
                <BentoCard size="full" index={0} accent>
                  <BentoCardHeader>
                    <h2 className="text-xl font-semibold font-heading">Security</h2>
                  </BentoCardHeader>
                  <BentoCardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <Input
                        label="Current Password"
                        type="password"
                        value={passwordForm.current_password}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            current_password: e.target.value,
                          })
                        }
                        autoComplete="current-password"
                      />
                      <div className="hidden md:block" />
                      <Input
                        label="New Password"
                        type="password"
                        value={passwordForm.new_password}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            new_password: e.target.value,
                          })
                        }
                        autoComplete="new-password"
                      />
                      <Input
                        label="Confirm New Password"
                        type="password"
                        value={passwordForm.confirm_password}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            confirm_password: e.target.value,
                          })
                        }
                        autoComplete="new-password"
                      />
                    </div>
                    {passwordSuccess && (
                      <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                        Password changed successfully.
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        disabled={
                          passwordMutation.isLoading ||
                          !passwordForm.current_password ||
                          !passwordForm.new_password ||
                          !passwordForm.confirm_password
                        }
                        onClick={handlePasswordChange}
                      >
                        {passwordMutation.isLoading ? "Changing..." : "Change Password"}
                      </Button>
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </BentoGrid>
            </TabsContent>

            <TabsContent value="users">
              <UsersTab />
            </TabsContent>

            <TabsContent value="features">
              <FeaturesTab />
            </TabsContent>

            <TabsContent value="analytics">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold font-heading">Analytics</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    First-party views. Also available at{" "}
                    <a href="/analytics" className="text-primary hover:underline">
                      /analytics
                    </a>
                    .
                  </p>
                </div>
                <AnalyticsDashboard embedded />
              </div>
            </TabsContent>

            <TabsContent value="ai">
              <BentoGrid columns={2}>
                <BentoCard size="full" index={0} accent>
                  <BentoCardHeader>
                    <h2 className="text-xl font-semibold font-heading">AI Writer Settings</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configure the AI writing assistant. Works with any OpenAI-compatible API.
                    </p>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                          label="Base URL"
                          type="url"
                          value={settings.ai_base_url}
                          onChange={(e) => setSettings({ ...settings, ai_base_url: e.target.value })}
                          placeholder="https://api.openai.com/v1"
                        />
                        <Input
                          label="API Key"
                          type="password"
                          value={settings.ai_api_key}
                          onChange={(e) => setSettings({ ...settings, ai_api_key: e.target.value })}
                          placeholder="sk-..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input
                          label="Model"
                          value={settings.ai_model}
                          onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                          placeholder="gpt-4o"
                        />
                        <div className="space-y-2">
                          <Label htmlFor="ai_max_tokens">Max Tokens</Label>
                          <Input
                            id="ai_max_tokens"
                            type="number"
                            value={settings.ai_max_tokens}
                            onChange={(e) =>
                              setSettings({ ...settings, ai_max_tokens: parseInt(e.target.value) || 2048 })
                            }
                            min={1}
                            max={128000}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ai_temperature">Temperature ({settings.ai_temperature})</Label>
                          <input
                            id="ai_temperature"
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={settings.ai_temperature}
                            onChange={(e) =>
                              setSettings({ ...settings, ai_temperature: parseFloat(e.target.value) })
                            }
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Precise (0)</span>
                            <span>Creative (2)</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border bg-muted/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {settings.ai_api_key ? (
                            <>
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              <span className="text-sm font-medium">Configured</span>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                              <span className="text-sm font-medium">Not configured</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Supports OpenAI, Ollama, Groq, Fireworks, Together, or any OpenAI-compatible endpoint.
                          Leave Base URL empty for OpenAI default. Set API Key to enable AI features.
                        </p>
                      </div>
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </BentoGrid>
            </TabsContent>

            {activeTab !== "follow" && activeTab !== "security" && (
              <div className="flex justify-end rounded-lg border border-border bg-card p-4">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            )}
          </form>
        </Tabs>
      </div>
    </main>
  );
}
