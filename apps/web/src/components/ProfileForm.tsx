"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Button } from "./Button";
import { Input, Textarea } from "./Input";
import { LoadingSpinner } from "./LoadingSpinner";
import toast from "react-hot-toast";
import { FaTwitter, FaYoutube, FaReddit, FaLinkedin, FaGlobe, FaMoneyBill, FaFont, FaGithub } from "react-icons/fa";
import { useMutation, useQuery } from "react-query";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/curves/utils.js";
import { bech32 } from "@scure/base";

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
  nostr_pubkey?: string;
  nostr_privkey?: string;
  has_nostr_privkey?: boolean;
}

export function ProfileForm({ username }: { username: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ProfileData>({});
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [bannerPreview, setBannerPreview] = useState<string>("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery<ProfileData>(["profile", username], async () => {
    const res = await fetch(`/api/profiles/${username}`, { credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to load profile" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as ProfileData;
  }, {
    onSuccess: (profile) => {
      setData(profile);
    },
    onSettled: () => setLoading(false),
  });

  useEffect(() => {
    setAvatarPreview(data.avatar_url || "");
  }, [data.avatar_url]);

  useEffect(() => {
    setBannerPreview(data.banner_url || "");
  }, [data.banner_url]);

  const uploadAvatarMutation = useMutation(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/media/upload`, { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { url: string };
  });

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUploading(true);
      const blob = URL.createObjectURL(file);
      setAvatarPreview(blob);
      const res = await uploadAvatarMutation.mutateAsync(file);
      setData({ ...data, avatar_url: res.url });
      setAvatarPreview(res.url);
      toast.success("Avatar uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  };

  const uploadBannerMutation = useMutation(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/media/upload`, { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { url: string };
  });

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBannerUploading(true);
      const blob = URL.createObjectURL(file);
      setBannerPreview(blob);
      const res = await uploadBannerMutation.mutateAsync(file);
      setData({ ...data, banner_url: res.url });
      setBannerPreview(res.url);
      toast.success("Banner uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBannerUploading(false);
    }
  };

  const updateMutation = useMutation(async (payload: ProfileData) => {
    const res = await fetch(`/api/profiles/${username}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to update profile" }));
      const msg = typeof err.error === "string"
        ? err.error
        : Array.isArray(err.error)
          ? err.error.map((e: any) => e.message || String(e)).join(", ")
          : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  }, {
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      profileQuery.refetch();
    },
    onError: (error) => {
      console.error("Failed to update profile:", error);
      toast.error(`Failed to update profile: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
    onSettled: () => setSaving(false),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Strip null/empty values for optional URL fields to avoid validation errors
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      cleaned[key] = value;
    }
    updateMutation.mutate(cleaned as ProfileData);
  };

  if (loading || profileQuery.isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label={<span className="inline-flex items-center gap-2"><FaFont /> Full Name</span>}
          value={data.full_name || ""}
          onChange={(e) => setData({ ...data, full_name: e.target.value })}
        />
        <div className="space-y-2">
          <Input
            label={<span className="inline-flex items-center gap-2"><FaGlobe /> Avatar URL</span>}
            type="url"
            value={data.avatar_url || ""}
            onChange={(e) => setData({ ...data, avatar_url: e.target.value })}
          />
          <div className="flex items-center gap-3">
            {(avatarPreview || data.avatar_url) && (
              <Image
                src={avatarPreview || data.avatar_url!}
                alt="Avatar"
                width={48}
                height={48}
                className="rounded-full border border-light-highlight-med dark:border-dark-highlight-med"
                unoptimized
              />
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => avatarFileRef.current?.click()}
              disabled={avatarUploading}
            >
              {avatarUploading ? "Uploading..." : "Upload Avatar"}
            </Button>
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
            {data.avatar_url && (
              <a
                href={data.avatar_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-light-pine dark:text-dark-foam"
              >
                View
              </a>
            )}
          </div>
        </div>
        <div className="md:col-span-2 space-y-2">
          <Input
            label={<span className="inline-flex items-center gap-2"><FaGlobe /> Banner URL</span>}
            type="url"
            value={data.banner_url || ""}
            onChange={(e) => setData({ ...data, banner_url: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => bannerFileRef.current?.click()}
              disabled={bannerUploading}
            >
              {bannerUploading ? "Uploading..." : "Upload Banner"}
            </Button>
            <input
              ref={bannerFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerFileChange}
            />
            {data.banner_url && (
              <a
                href={data.banner_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-light-pine dark:text-dark-foam"
              >
                View
              </a>
            )}
          </div>
          {(bannerPreview || data.banner_url) && (
            <div className="relative w-full h-32">
              <Image
                src={bannerPreview || data.banner_url || ""}
                alt="Banner"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
                className="object-cover rounded-lg border border-light-highlight-med dark:border-dark-highlight-med"
                unoptimized
              />
            </div>
          )}
        </div>
        <Textarea
          label={<span className="inline-flex items-center gap-2"><FaFont /> Bio</span>}
          value={data.bio || ""}
          onChange={(e) => setData({ ...data, bio: e.target.value })}
          rows={4}
          className="md:col-span-2"
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-light-text dark:text-dark-text">Social Links</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={<span className="inline-flex items-center gap-2"><FaGithub /> GitHub</span>}
            type="url"
            value={data.social_github || ""}
            onChange={(e) => setData({ ...data, social_github: e.target.value })}
            placeholder="https://github.com/username"
          />
          <Input
            label={<span className="inline-flex items-center gap-2"><FaTwitter /> X (Twitter)</span>}
            type="url"
            value={data.social_x || ""}
            onChange={(e) => setData({ ...data, social_x: e.target.value })}
            placeholder="https://x.com/username"
          />
          <Input
            label={<span className="inline-flex items-center gap-2"><FaYoutube /> YouTube</span>}
            type="url"
            value={data.social_youtube || ""}
            onChange={(e) => setData({ ...data, social_youtube: e.target.value })}
            placeholder="https://youtube.com/@username"
          />
          <Input
            label={<span className="inline-flex items-center gap-2"><FaReddit /> Reddit</span>}
            type="url"
            value={data.social_reddit || ""}
            onChange={(e) => setData({ ...data, social_reddit: e.target.value })}
            placeholder="https://reddit.com/user/username"
          />
          <Input
            label={<span className="inline-flex items-center gap-2"><FaLinkedin /> LinkedIn</span>}
            type="url"
            value={data.social_linkedin || ""}
            onChange={(e) => setData({ ...data, social_linkedin: e.target.value })}
            placeholder="https://linkedin.com/in/username"
          />
          <Input
            label={<span className="inline-flex items-center gap-2"><FaGlobe /> Website</span>}
            type="url"
            value={data.social_website || ""}
            onChange={(e) => setData({ ...data, social_website: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-light-text dark:text-dark-text">Support</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={<span className="inline-flex items-center gap-2"><FaMoneyBill /> Support URL</span>}
            type="url"
            value={data.support_url || ""}
            onChange={(e) => setData({ ...data, support_url: e.target.value })}
            placeholder="https://ko-fi.com/username"
          />
          <Input
            label={<span className="inline-flex items-center gap-2"><FaFont /> Support Text</span>}
            value={data.support_text || ""}
            onChange={(e) => setData({ ...data, support_text: e.target.value })}
            placeholder="Buy me a coffee"
          />
        </div>
      </div>

      <NostrSection
        pubkey={data.nostr_pubkey || ""}
        hasStoredPrivkey={data.has_nostr_privkey || false}
        onKeysChange={(pubkey, privkey) => setData({ ...data, nostr_pubkey: pubkey, nostr_privkey: privkey })}
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}

function hexToNpub(hex: string): string {
  const bytes = Uint8Array.from(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const words = bech32.toWords(bytes);
  return bech32.encode("npub", words, 1500);
}

function hexToNsec(hex: string): string {
  const bytes = Uint8Array.from(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const words = bech32.toWords(bytes);
  return bech32.encode("nsec", words, 1500);
}

function NostrSection({
  pubkey,
  hasStoredPrivkey,
  onKeysChange,
}: {
  pubkey: string;
  hasStoredPrivkey: boolean;
  onKeysChange: (pubkey: string, privkey?: string) => void;
}) {
  const [generatedNsec, setGeneratedNsec] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerate = () => {
    const privkey = schnorr.utils.randomSecretKey();
    const pubkeyBytes = schnorr.getPublicKey(privkey);
    const privkeyHex = bytesToHex(privkey);
    const pubkeyHex = bytesToHex(pubkeyBytes);

    setGeneratedNsec(hexToNsec(privkeyHex));
    onKeysChange(pubkeyHex, privkeyHex);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Nostr</h3>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="Public Key (hex)"
            value={pubkey}
            onChange={(e) => onKeysChange(e.target.value)}
            placeholder="64-character hex pubkey"
            maxLength={64}
          />
        </div>
        <Button type="button" variant="outline" onClick={handleGenerate}>
          {pubkey ? "Regenerate" : "Generate"}
        </Button>
      </div>

      {pubkey && /^[0-9a-f]{64}$/.test(pubkey) && (
        <div className="flex items-center gap-2 text-xs text-light-muted dark:text-dark-muted">
          <span className="font-mono break-all">npub: {hexToNpub(pubkey)}</span>
          {hasStoredPrivkey && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Private key stored
            </span>
          )}
        </div>
      )}

      {generatedNsec && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 font-semibold text-sm">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Copy your nsec to use in Nostr clients (Iris, Damus, etc.)
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-light-surface dark:bg-dark-surface px-3 py-2 rounded border border-light-highlight-med dark:border-dark-highlight-med font-mono break-all">
              {generatedNsec}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={() => copyToClipboard(generatedNsec, "nsec")}>
              {copied === "nsec" ? "Copied!" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            The private key will be saved to your account when you click Save Profile. You can also import this nsec into any Nostr client.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setGeneratedNsec(null)}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
