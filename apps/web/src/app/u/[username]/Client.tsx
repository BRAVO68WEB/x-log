"use client";

import { useState, use } from "react";
import { PostList } from "@/components/PostList";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useQuery } from "react-query";
import Image from "next/image";

export default function UserProfileClient(
  props: { params: Promise<{ username: string }> }
) {
  const params = use(props.params);
  interface Profile {
    full_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    banner_url?: string | null;
    instance_domain?: string | null;
    actor_url?: string | null;
    social_github?: string | null;
    social_website?: string | null;
  }
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const query = useQuery<Profile>(
    ["profile", params.username],
    async () => {
      const res = await fetch(`/api/profiles/${params.username}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to load profile" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<Profile>;
    },
    {
      onSuccess: (data) => setProfile(data),
      onSettled: () => setLoading(false),
    }
  );

  const copyFediUrl = async () => {
    if (!profile?.actor_url) return;
    try {
      await navigator.clipboard.writeText(profile.actor_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (loading || query.isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto bg-light-surface dark:bg-dark-surface opacity-100 rounded-lg shadow-md p-8 text-center border border-light-highlight-med dark:border-dark-highlight-med">
          <h1 className="text-4xl font-bold mb-4 text-light-text dark:text-dark-text">Profile not found</h1>
          <p className="text-light-muted dark:text-dark-muted">The user&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-light-surface dark:bg-dark-surface opacity-100 rounded-lg shadow-md overflow-hidden mb-8 border border-light-highlight-med dark:border-dark-highlight-med">
          {profile.banner_url && (
            <div className="relative w-full h-48">
              <Image
                src={profile.banner_url}
                alt="Banner"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="p-6">
            <div className="flex items-start gap-4">
              {profile.avatar_url && (
                <Image
                  src={profile.avatar_url}
                  alt={profile.full_name || params.username}
                  width={80}
                  height={80}
                  className="rounded-full border-2 border-light-highlight-med dark:border-dark-highlight-med"
                  unoptimized
                />
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">
                  {profile.full_name || params.username}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-light-muted dark:text-dark-muted">
                    @{params.username}
                    {profile.instance_domain && `@${profile.instance_domain}`}
                  </p>
                  {profile.actor_url && (
                    <button
                      onClick={copyFediUrl}
                      className="text-xs px-2 py-1 text-light-subtle dark:text-dark-subtle hover:text-light-text dark:hover:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay rounded transition-colors"
                      title={`Copy ActivityPub URL: ${profile.actor_url}`}
                    >
                      {copied ? "✓ Copied" : "📋 Copy Fedi URL"}
                    </button>
                  )}
                </div>
                {profile.bio && (
                  <p className="mt-4 text-light-text dark:text-dark-text leading-relaxed">
                    {profile.bio}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 mt-4">
                  {profile.social_github && (
                    <a
                      href={profile.social_github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-light-pine dark:text-dark-foam hover:text-light-foam dark:hover:text-dark-pine hover:underline transition-colors"
                    >
                      GitHub
                    </a>
                  )}
                  {profile.social_website && (
                    <a
                      href={profile.social_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-light-pine dark:text-dark-foam hover:text-light-foam dark:hover:text-dark-pine hover:underline transition-colors"
                    >
                      Website
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-6 text-light-text dark:text-dark-text">Posts</h2>
        <PostList author={params.username} />
      </div>
    </main>
  );
}
