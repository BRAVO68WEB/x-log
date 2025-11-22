"use client";

import { useState, useEffect } from "react";
import { Button } from "./Button";
import { Input, Textarea } from "./Input";
import { LoadingSpinner } from "./LoadingSpinner";
import { profilesApi } from "@/lib/api";

interface ProfileData {
  full_name?: string;
  bio?: string;
  social_github?: string;
  social_x?: string;
  social_youtube?: string;
  social_reddit?: string;
  social_linkedin?: string;
  social_website?: string;
  support_url?: string;
  support_text?: string;
  avatar_url?: string;
  banner_url?: string;
}

export function ProfileForm({ username }: { username: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ProfileData>({});

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    try {
      const profile = await profilesApi.get(username) as ProfileData;
      setData(profile);
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await profilesApi.update(username, data);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert(`Failed to update profile: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Full Name"
          value={data.full_name || ""}
          onChange={(e) => setData({ ...data, full_name: e.target.value })}
        />
        <Input
          label="Avatar URL"
          type="url"
          value={data.avatar_url || ""}
          onChange={(e) => setData({ ...data, avatar_url: e.target.value })}
        />
        <Input
          label="Banner URL"
          type="url"
          value={data.banner_url || ""}
          onChange={(e) => setData({ ...data, banner_url: e.target.value })}
          className="md:col-span-2"
        />
        <Textarea
          label="Bio"
          value={data.bio || ""}
          onChange={(e) => setData({ ...data, bio: e.target.value })}
          rows={4}
          className="md:col-span-2"
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Social Links</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="GitHub"
            type="url"
            value={data.social_github || ""}
            onChange={(e) => setData({ ...data, social_github: e.target.value })}
            placeholder="https://github.com/username"
          />
          <Input
            label="X (Twitter)"
            type="url"
            value={data.social_x || ""}
            onChange={(e) => setData({ ...data, social_x: e.target.value })}
            placeholder="https://x.com/username"
          />
          <Input
            label="YouTube"
            type="url"
            value={data.social_youtube || ""}
            onChange={(e) => setData({ ...data, social_youtube: e.target.value })}
            placeholder="https://youtube.com/@username"
          />
          <Input
            label="Reddit"
            type="url"
            value={data.social_reddit || ""}
            onChange={(e) => setData({ ...data, social_reddit: e.target.value })}
            placeholder="https://reddit.com/user/username"
          />
          <Input
            label="LinkedIn"
            type="url"
            value={data.social_linkedin || ""}
            onChange={(e) => setData({ ...data, social_linkedin: e.target.value })}
            placeholder="https://linkedin.com/in/username"
          />
          <Input
            label="Website"
            type="url"
            value={data.social_website || ""}
            onChange={(e) => setData({ ...data, social_website: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Support</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Support URL"
            type="url"
            value={data.support_url || ""}
            onChange={(e) => setData({ ...data, support_url: e.target.value })}
            placeholder="https://ko-fi.com/username"
          />
          <Input
            label="Support Text"
            value={data.support_text || ""}
            onChange={(e) => setData({ ...data, support_text: e.target.value })}
            placeholder="Buy me a coffee"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}

