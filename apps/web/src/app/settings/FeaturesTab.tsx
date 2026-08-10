"use client";

import { useQuery, useMutation, useQueryClient } from "react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { withCsrf } from "@/lib/csrf";

const FEATURE_NAMES: Record<string, string> = {
  code_snippets: "Code Snippets",
  link_archive: "Link Archive",
  ai_writer: "AI Writer",
  password_reset: "Password Reset",
  custom_post_meta: "Custom Post Meta",
  bookmarks: "Bookmarks",
  reposts: "Reposts",
  threads: "Threads",
  short_posts: "Short Posts",
  scheduled_posts: "Scheduled Posts",
  trending: "Trending",
  analytics: "Analytics",
  dms: "DMs",
  custom_themes: "Custom Themes",
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  code_snippets: "Personal code archive with syntax highlighting",
  link_archive: "Public link archive with OGP and Wayback snapshots",
  ai_writer: "AI-powered writing assistant",
  password_reset: "Allow users to reset their password via email",
  custom_post_meta: "Custom key-value metadata for posts",
  bookmarks: "Personal save collection for posts",
  reposts: "Repost functionality for posts",
  threads: "Threaded conversations",
  short_posts: "Short-form posts (microblogging)",
  scheduled_posts: "Schedule posts for future publishing",
  trending: "Trending hashtags tracking",
  analytics: "Analytics dashboard and insights",
  dms: "Direct messaging between users",
  custom_themes: "Custom theme creation and editing",
};

export default function FeaturesTab() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: features, isLoading } = useQuery<
    Array<{
      feature: string;
      enabled: boolean;
      envOverride: boolean;
      envValue: string | null;
    }>
  >(["admin-features"], async () => {
    const res = await fetch(`/api/admin/features`, { credentials: "include" });
    if (!res.ok) {
      throw new Error("Failed to load features");
    }
    const json = await res.json();
    return json.features;
  });

  const updateMutation = useMutation(
    async ({ feature, enabled }: { feature: string; enabled: boolean }) => {
      const res = await fetch(`/api/admin/features/${feature}`, withCsrf({
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }));
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update feature" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: (data) => {
        setSuccess(
          `${FEATURE_NAMES[data.feature] || data.feature} ${data.enabled ? "enabled" : "disabled"}`
        );
        queryClient.invalidateQueries({ queryKey: ["admin-features"] });
        setTimeout(() => setSuccess(null), 3000);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to update feature");
        setTimeout(() => setError(null), 3000);
      },
    }
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

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

      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold font-heading">Feature Flags</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle features on or off. Environment variables take precedence over these settings.
          </p>
        </div>
        <div className="divide-y">
          {features?.map((feature) => (
            <div key={feature.feature} className="flex items-center justify-between p-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label className="font-medium">
                    {FEATURE_NAMES[feature.feature] || feature.feature}
                  </Label>
                  {feature.envOverride && (
                    <Badge variant="outline" className="text-xs">
                      ENV
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {FEATURE_DESCRIPTIONS[feature.feature] || feature.feature}
                </p>
                {feature.envOverride && feature.envValue && (
                  <p className="text-xs text-muted-foreground">
                    ENV value: <code className="bg-muted px-1 rounded">{feature.envValue}</code>
                  </p>
                )}
              </div>
              <Switch
                checked={feature.enabled}
                disabled={feature.envOverride || updateMutation.isLoading}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({ feature: feature.feature, enabled: checked })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
