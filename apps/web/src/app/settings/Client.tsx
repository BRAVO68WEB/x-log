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
  FaEnvelope,
  FaGear,
  FaPalette,
  FaShieldHalved,
  FaShareNodes,
} from "react-icons/fa6";

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
    theme_id: "system" as InstanceThemeId,
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
        theme_id: InstanceThemeId;
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
          theme_id: normalizeThemeId(data.theme_id),
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
          theme_id: settings.theme_id,
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
