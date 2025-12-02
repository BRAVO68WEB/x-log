"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
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
    open_registrations: false,
    admin_email: "",
    smtp_url: "",
    federation_enabled: true,
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
        open_registrations: boolean;
        admin_email: string | null;
        smtp_url: string | null;
        federation_enabled: boolean;
      }>;
    },
    {
      onSuccess: (data) => {
        setSettings({
          instance_name: data.instance_name,
          instance_description: data.instance_description || "",
          instance_domain: data.instance_domain,
          open_registrations: data.open_registrations,
          admin_email: data.admin_email || "",
          smtp_url: data.smtp_url || "",
          federation_enabled: data.federation_enabled,
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
          open_registrations: settings.open_registrations,
          admin_email: settings.admin_email || null,
          smtp_url: settings.smtp_url || null,
          federation_enabled: settings.federation_enabled,
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
          <h1 className="text-4xl font-bold text-light-text dark:text-dark-text">Instance Settings</h1>
          <p className="text-light-muted dark:text-dark-muted mt-2">Configure general, federation, and email settings for your instance.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-light-love/10 dark:bg-dark-love/20 p-4 border border-light-love/20 dark:border-dark-love/20">
            <div className="text-sm text-light-love dark:text-dark-love">{error}</div>
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-md bg-light-pine/10 dark:bg-dark-pine/20 p-4 border border-light-pine/20 dark:border-dark-pine/20">
            <div className="text-sm text-light-pine dark:text-dark-pine">Settings saved successfully!</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-light-surface dark:bg-dark-surface rounded-xl shadow-md p-8 border border-light-highlight-med dark:border-dark-highlight-med">
              <div className="space-y-6">
                <Input
                  label="Instance Name"
                  value={settings.instance_name}
                  onChange={(e) =>
                    setSettings({ ...settings, instance_name: e.target.value })
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
                    setSettings({ ...settings, instance_domain: e.target.value })
                  }
                  placeholder="example.com"
                  required
                />
              </div>
            </div>

            <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-md p-8 border border-light-highlight-med dark:border-dark-highlight-med">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-light-highlight-med dark:border-dark-highlight-med bg-light-overlay/50 dark:bg-dark-overlay/40">
                  <div>
                    <div className="font-medium text-light-text dark:text-dark-text">Allow open registrations</div>
                    <div className="text-sm text-light-muted dark:text-dark-muted">Users can sign up without invite</div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.open_registrations}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          open_registrations: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-light-highlight-med dark:bg-dark-highlight-med rounded-full relative transition peer-checked:bg-light-pine dark:peer-checked:bg-dark-pine">
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition peer-checked:translate-x-6" />
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-light-highlight-med dark:border-dark-highlight-med bg-light-overlay/50 dark:bg-dark-overlay/40">
                  <div>
                    <div className="font-medium text-light-text dark:text-dark-text">Enable federation</div>
                    <div className="text-sm text-light-muted dark:text-dark-muted">ActivityPub support for federated interactions</div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.federation_enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          federation_enabled: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-light-highlight-med dark:bg-dark-highlight-med rounded-full relative transition peer-checked:bg-light-pine dark:peer-checked:bg-dark-pine">
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition peer-checked:translate-x-6" />
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-md p-8 border border-light-highlight-med dark:border-dark-highlight-med">
            <h2 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Email Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Admin Email"
                type="email"
                value={settings.admin_email}
                onChange={(e) =>
                  setSettings({ ...settings, admin_email: e.target.value })
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
          </div>

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
