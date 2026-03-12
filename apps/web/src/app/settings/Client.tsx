"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { useMutation, useQuery } from "react-query";

export default function SettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState({
    instance_name: "",
    instance_description: "",
    instance_domain: "",
    admin_email: "",
    smtp_url: "",
    federation_enabled: true,
    following_enabled: false,
  });

  const settingsQuery = useQuery(
    ["settings"],
    async () => {
      const res = await fetch(`/api/settings`, { credentials: "include" });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to load settings" }));
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
        });
      },
      onError: (err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load settings"
        );
      },
      onSettled: () => setLoading(false),
    }
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
        }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to save settings" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        settingsQuery.refetch();
      },
      onError: (err) => {
        setError(
          err instanceof Error ? err.message : "Failed to save settings"
        );
      },
      onSettled: () => setSaving(false),
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    updateMutation.mutate();
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
          <h1 className="text-4xl font-bold font-heading">
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
            <p className="text-sm text-primary">
              Settings saved successfully!
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <BentoGrid columns={3}>
            {/* General settings - 2x1 */}
            <BentoCard size="2x1" index={0} accent>
              <BentoCardHeader>
                <h2 className="text-xl font-semibold font-heading">General</h2>
              </BentoCardHeader>
              <BentoCardContent className="space-y-6">
                <Input
                  label="Instance Name"
                  value={settings.instance_name}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      instance_name: e.target.value,
                    })
                  }
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
                    setSettings({
                      ...settings,
                      instance_domain: e.target.value,
                    })
                  }
                  placeholder="example.com"
                  required
                />
              </BentoCardContent>
            </BentoCard>

            {/* Federation - 1x1 */}
            <BentoCard size="1x1" index={1} accent>
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
                      setSettings({
                        ...settings,
                        federation_enabled: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="font-medium">Enable following</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow local users to follow remote actors
                    </p>
                  </div>
                  <Switch
                    checked={settings.following_enabled}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        following_enabled: checked,
                      })
                    }
                  />
                </div>
              </BentoCardContent>
            </BentoCard>

            {/* Email settings - full */}
            <BentoCard size="full" index={2} accent>
              <BentoCardHeader>
                <h2 className="text-xl font-semibold font-heading">Email Settings</h2>
              </BentoCardHeader>
              <BentoCardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Admin Email"
                    type="email"
                    value={settings.admin_email}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        admin_email: e.target.value,
                      })
                    }
                    placeholder="admin@example.com"
                  />
                  <Input
                    label="SMTP URL"
                    type="url"
                    value={settings.smtp_url}
                    onChange={(e) =>
                      setSettings({ ...settings, smtp_url: e.target.value })
                    }
                    placeholder="smtp://user:pass@smtp.example.com:587"
                  />
                </div>
              </BentoCardContent>
            </BentoCard>
          </BentoGrid>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
