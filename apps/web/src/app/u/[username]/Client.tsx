"use client";

import { useState, use } from "react";
import { PostList } from "@/components/PostList";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useQuery } from "react-query";
import Image from "next/image";
import { FaGithub, FaGlobe, FaLinkedin, FaMastodon, FaReddit, FaTwitter, FaYoutube } from "react-icons/fa";

export default function UserProfileClient(
  props: { params: Promise<{ username: string }> }
) {
  const params = use(props.params);
  interface Profile {
    social_youtube: string | undefined;
    social_linkedin: string | undefined;
    social_reddit: string | undefined;
    social_twitter: string | undefined;
    full_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    banner_url?: string | null;
    instance_domain?: string | null;
    actor_url?: string | null;
    social_github?: string | null;
    social_website?: string | null;
    support_url?: string | null;
    support_text?: string | null;
  }
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<Array<{ remote_actor: string; approved: boolean }>>([]);
  const [following, setFollowing] = useState<Array<{ remote_actor: string; accepted: boolean }>>([]);

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

  const followersQuery = useQuery<{ items: { remote_actor: string; inbox_url: string; approved: boolean; created_at: string }[] }>(
    ["followers", params.username],
    async () => {
      const res = await fetch(`/api/profiles/${params.username}/followers`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load followers" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: (data) => setFollowers(data.items.map((i) => ({ remote_actor: i.remote_actor, approved: i.approved }))),
    }
  );

  const followingQuery = useQuery<{ items: { remote_actor: string; inbox_url: string; activity_id: string; accepted: boolean; created_at: string }[] }>(
    ["following", params.username],
    async () => {
      const res = await fetch(`/api/profiles/${params.username}/following`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load following" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: (data) => setFollowing(data.items.map((i) => ({ remote_actor: i.remote_actor, accepted: i.accepted }))),
    }
  );

  

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
        <div className="relative bg-light-surface dark:bg-dark-surface opacity-100 rounded-lg shadow-md overflow-hidden mb-8 border border-light-highlight-med dark:border-dark-highlight-med">
          <div className="relative w-full h-56 sm:h-64">
            {profile.banner_url ? (
              <Image
                src={profile.banner_url}
                alt="Banner"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(239,68,68,0.18) 0px, rgba(239,68,68,0.18) 10px, transparent 10px, transparent 20px)",
                }}
              />
            )}
            {profile.avatar_url && (
              <div className="absolute left-6 -bottom-12">
                <Image
                  src={profile.avatar_url}
                  alt={profile.full_name?.split(" ")[0] || params.username}
                  width={180}
                  height={180}
                  className="rounded-full border-2 border-light-highlight-med dark:border-dark-highlight-med bg-light-surface dark:bg-dark-surface"
                  unoptimized
                />
              </div>
            )}
          </div>
          <div className="px-6 pt-16 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">
                  {profile.full_name || params.username}
                </h1>
                <p className="mt-1 text-light-muted dark:text-dark-muted">
                  @{params.username}
                  {profile.instance_domain && `@${profile.instance_domain}`}
                </p>
              </div>
            </div>
            {profile.bio && (
              <p className="mt-4 text-light-text dark:text-dark-text leading-relaxed">
                {profile.bio}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-4">
                {profile.social_github && (
                  <a
                    href={profile.social_github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-light-pine dark:text-dark-foam hover:text-light-foam dark:hover:text-dark-pine hover:underline transition-colors"
                  >
                    <FaGithub className="inline-block mr-1 text-xl" />
                  </a>
                )}
                {profile.social_website && (
                  <a
                    href={profile.social_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-light-pine dark:text-dark-foam hover:text-light-foam dark:hover:text-dark-pine hover:underline transition-colors"
                  >
                    <FaGlobe className="inline-block mr-1 text-xl" />
                  </a>
                )}
                {profile.social_twitter && (
                  <a
                    href={profile.social_twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-light-pine dark:text-dark-foam hover:text-light-foam dark:hover:text-dark-pine hover:underline transition-colors"
                  >
                    <FaTwitter className="inline-block mr-1 text-xl" />
                  </a>
                )}
                {profile.social_reddit && (
                  <a
                    href={profile.social_reddit}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-light-pine dark:text-dark-foam hover:text-light-foam dark:hover:text-dark-pine hover:underline transition-colors"
                  >
                    <FaReddit className="inline-block mr-1 text-xl" />
                  </a>
                )}
                {profile.social_youtube && (
                  <a
                    href={profile.social_youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-light-pine dark:text-dark-foam hover:text-light-foam dark:hover:text-dark-pine hover:underline transition-colors"
                  >
                    <FaYoutube className="inline-block mr-1 text-xl" />
                  </a>
                )}
                {profile.social_linkedin && (
                  <a
                    href={profile.social_linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-light-pine dark:text-dark-foam hover:text-light-foam dark:hover:text-dark-pine hover:underline transition-colors"
                  >
                    <FaLinkedin className="inline-block mr-1 text-xl" />
                  </a>
                )}
              </div>
              {profile.support_url && (
                <a
                  href={profile.support_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border-2 border-black bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 shadow-sm"
                >
                  {profile.support_text || "Support me !!"}
                </a>
              )}
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-6 text-light-text dark:text-dark-text">Posts</h2>
        <PostList author={params.username} />
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-3 text-light-text dark:text-dark-text">Followers</h3>
            {followersQuery.isLoading ? (
              <div className="py-4"><LoadingSpinner size="sm" /></div>
            ) : followers.length === 0 ? (
              <p className="text-light-muted dark:text-dark-muted">No followers yet</p>
            ) : (
              <ul className="space-y-2">
                {followers.map((f) => (
                  <li key={f.remote_actor} className="flex items-center justify-between bg-light-surface dark:bg-dark-surface rounded border border-light-highlight-med dark:border-dark-highlight-med px-3 py-2">
                    <a href={f.remote_actor} target="_blank" rel="noreferrer" className="text-light-pine dark:text-dark-foam hover:underline truncate">
                      {f.remote_actor}
                    </a>
                    <span className="text-xs px-2 py-1 rounded bg-light-overlay dark:bg-dark-overlay text-light-muted dark:text-dark-muted">{f.approved ? "approved" : "pending"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-3 text-light-text dark:text-dark-text">Following</h3>
            {followingQuery.isLoading ? (
              <div className="py-4"><LoadingSpinner size="sm" /></div>
            ) : following.length === 0 ? (
              <p className="text-light-muted dark:text-dark-muted">Not following anyone yet</p>
            ) : (
              <ul className="space-y-2">
                {following.map((f) => (
                  <li key={f.remote_actor} className="flex items-center justify-between bg-light-surface dark:bg-dark-surface rounded border border-light-highlight-med dark:border-dark-highlight-med px-3 py-2">
                    <a href={f.remote_actor} target="_blank" rel="noreferrer" className="text-light-pine dark:text-dark-foam hover:underline truncate">
                      {f.remote_actor}
                    </a>
                    <span className="text-xs px-2 py-1 rounded bg-light-overlay dark:bg-dark-overlay text-light-muted dark:text-dark-muted">{f.accepted ? "accepted" : "pending"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
