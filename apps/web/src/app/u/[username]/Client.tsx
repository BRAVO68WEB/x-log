"use client";

import { useState, use } from "react";
import { PostList } from "@/components/PostList";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { useQuery } from "react-query";
import Image from "next/image";
import {
  FaGithub,
  FaGlobe,
  FaLinkedin,
  FaMastodon,
  FaReddit,
  FaTwitter,
  FaYoutube,
} from "react-icons/fa";

function actorUrlToHandle(data: {
  remote_actor: string;
  remote_domain: string;
  remote_username: string;
}): {
  url: string;
  handle: string;
} {
  try {
    if (data.remote_username && data.remote_domain) {
      return {
        url: `https://${data.remote_domain}/@${data.remote_username}`,
        handle: `@${data.remote_username}@${data.remote_domain}`,
      };
    }
    const parsed = new URL(data.remote_actor);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const username = segments[segments.length - 1] || data.remote_actor;
    return {
      url: data.remote_actor,
      handle: `@${username}@${parsed.hostname}`,
    };
  } catch {
    return {
      url: data.remote_actor,
      handle: data.remote_actor,
    };
  }
}

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
  const [followers, setFollowers] = useState<
    Array<{
      remote_actor: string;
      approved: boolean;
      created_at: string;
      remote_domain: string;
      remote_username: string;
    }>
  >([]);
  const [following, setFollowing] = useState<
    Array<{
      remote_actor: string;
      accepted: boolean;
      created_at: string;
      remote_domain: string;
      remote_username: string;
    }>
  >([]);
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

  const followersQuery = useQuery<{
    items: {
      remote_actor: string;
      inbox_url: string;
      approved: boolean;
      created_at: string;
      remote_domain: string;
      remote_username: string;
    }[];
  }>(
    ["followers", params.username],
    async () => {
      const res = await fetch(
        `/api/profiles/${params.username}/followers`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to load followers" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: (data) =>
        setFollowers(
          data.items.map((i) => ({
            remote_actor: i.remote_actor,
            approved: i.approved,
            created_at: i.created_at,
            remote_domain: i.remote_domain,
            remote_username: i.remote_username,
          }))
        ),
    }
  );

  const followingQuery = useQuery<{
    items: {
      remote_actor: string;
      inbox_url: string;
      activity_id: string;
      accepted: boolean;
      created_at: string;
      remote_domain: string;
      remote_username: string;
    }[];
  }>(
    ["following", params.username],
    async () => {
      const res = await fetch(
        `/api/profiles/${params.username}/following`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to load following" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    {
      onSuccess: (data) =>
        setFollowing(
          data.items.map((i) => ({
            remote_actor: i.remote_actor,
            accepted: i.accepted,
            created_at: i.created_at,
            remote_domain: i.remote_domain,
            remote_username: i.remote_username,
          }))
        ),
    }
  );

  const handleCopyHandle = () => {
    if (!profile?.instance_domain) return;
    const handle = `@${params.username}@${profile.instance_domain}`;
    navigator.clipboard.writeText(handle).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
        <BentoGrid columns={3}>
          <BentoCard size="full" index={0}>
            <BentoCardContent className="p-8 text-center">
              <h1 className="text-4xl font-bold mb-4 font-heading">
                Profile not found
              </h1>
              <p className="text-muted-foreground">
                The user you&apos;re looking for doesn&apos;t exist.
              </p>
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </main>
    );
  }

  const socialLinks = [
    { url: profile.social_github, icon: FaGithub, label: "GitHub" },
    { url: profile.social_website, icon: FaGlobe, label: "Website" },
    { url: profile.social_twitter, icon: FaTwitter, label: "Twitter" },
    { url: profile.social_reddit, icon: FaReddit, label: "Reddit" },
    { url: profile.social_youtube, icon: FaYoutube, label: "YouTube" },
    { url: profile.social_linkedin, icon: FaLinkedin, label: "LinkedIn" },
  ].filter((link) => link.url);

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <BentoGrid columns={3}>
          {/* Banner + Avatar + Bio */}
          <BentoCard size="full" index={0}>
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
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20" />
              )}
              {profile.avatar_url && (
                <div className="absolute left-6 -bottom-12">
                  <Avatar className="h-[120px] w-[120px] border-4 border-card">
                    <AvatarImage
                      src={profile.avatar_url}
                      alt={
                        profile.full_name?.split(" ")[0] || params.username
                      }
                    />
                    <AvatarFallback className="text-3xl">
                      {(profile.full_name || params.username)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
            <div className="px-6 pt-16 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold font-heading">
                    {profile.full_name || params.username}
                  </h1>
                  <p className="mt-1 text-primary font-mono text-sm">
                    @{params.username}
                    {profile.instance_domain && `@${profile.instance_domain}`}
                  </p>
                </div>
              </div>
              {profile.bio && (
                <p className="mt-4 leading-relaxed">{profile.bio}</p>
              )}
              {profile.support_url && (
                <div className="mt-4">
                  <a
                    href={profile.support_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black">
                      {profile.support_text || "Support me !!"}
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </BentoCard>

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <BentoCard size="2x1" index={1} accent>
              <BentoCardHeader>
                <h2 className="text-lg font-semibold font-heading">Links</h2>
              </BentoCardHeader>
              <BentoCardContent>
                <div className="flex flex-wrap gap-2">
                  {socialLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-accent gap-1.5 py-1"
                      >
                        <link.icon className="text-sm" />
                        {link.label}
                      </Badge>
                    </a>
                  ))}
                </div>
              </BentoCardContent>
            </BentoCard>
          )}

          {/* Fediverse Handle */}
          {profile.instance_domain && (
            <BentoCard size="1x1" index={2} accent>
              <BentoCardHeader>
                <h2 className="text-lg font-semibold font-heading">Fediverse</h2>
              </BentoCardHeader>
              <BentoCardContent>
                <p className="text-sm text-muted-foreground font-mono mb-3">
                  @{params.username}@{profile.instance_domain}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyHandle}
                >
                  {copied ? (
                    "Copied!"
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy Handle
                    </>
                  )}
                </Button>
              </BentoCardContent>
            </BentoCard>
          )}

          {/* Posts section heading */}
          <BentoCard size="full" index={3} className="bg-transparent border-none shadow-none">
            <BentoCardContent className="px-0 py-2">
              <h2 className="text-2xl font-bold font-heading">Posts</h2>
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>

        {/* Posts list - uses its own grid internally */}
        <div className="mb-8">
          <PostList author={params.username} />
        </div>

        {/* Followers & Following */}
        <BentoGrid columns={2}>
          <BentoCard size="1x1" index={0} accent>
            <CardHeader>
              <CardTitle className="text-xl font-heading">Followers</CardTitle>
            </CardHeader>
            <CardContent>
              {followersQuery.isLoading ? (
                <div className="py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : followers.length === 0 ? (
                <p className="text-muted-foreground">No followers yet</p>
              ) : (
                <ul className="space-y-2">
                  {followers.map((f) => (
                    <li
                      key={f.remote_actor}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <a
                        href={actorUrlToHandle(f).url}
                        target="_blank"
                        rel="noreferrer"
                        title={f.remote_actor}
                        className="text-primary hover:underline truncate"
                      >
                        {actorUrlToHandle(f).handle}
                      </a>
                      <Badge variant={f.approved ? "default" : "secondary"}>
                        {f.approved ? "approved" : "pending"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </BentoCard>

          <BentoCard size="1x1" index={1} accent>
            <CardHeader>
              <CardTitle className="text-xl font-heading">Following</CardTitle>
            </CardHeader>
            <CardContent>
              {followingQuery.isLoading ? (
                <div className="py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : following.length === 0 ? (
                <p className="text-muted-foreground">
                  Not following anyone yet
                </p>
              ) : (
                <ul className="space-y-2">
                  {following.map((f) => (
                    <li
                      key={f.remote_actor}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <a
                        href={actorUrlToHandle(f).url}
                        target="_blank"
                        rel="noreferrer"
                        title={f.remote_actor}
                        className="text-primary hover:underline truncate"
                      >
                        {actorUrlToHandle(f).handle}
                      </a>
                      <Badge variant={f.accepted ? "default" : "secondary"}>
                        {f.accepted ? "accepted" : "pending"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    </main>
  );
}
