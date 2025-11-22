"use client";

import { useEffect, useState } from "react";
import { PostList } from "@/components/PostList";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import Link from "next/link";
import { profilesApi } from "@/lib/api";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const [username, setUsername] = useState<string>("");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => {
      setUsername(p.username);
      loadProfile(p.username);
    });
  }, [params]);

  const loadProfile = async (user: string) => {
    try {
      const data = await profilesApi.get(user);
      setProfile(data);
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">Profile not found</h1>
          <p className="text-gray-600">The user you're looking for doesn't exist.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8 border border-gray-200">
          {profile.banner_url && (
            <img
              src={profile.banner_url}
              alt="Banner"
              className="w-full h-48 object-cover"
            />
          )}
          <div className="p-6">
            <div className="flex items-start gap-4">
              {profile.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || username}
                  className="w-20 h-20 rounded-full border-2 border-gray-200"
                />
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">
                  {profile.full_name || username}
                </h1>
                <p className="text-gray-600">@{username}</p>
                {profile.bio && (
                  <p className="mt-4 text-gray-700 leading-relaxed">{profile.bio}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-4">
                  {profile.social_github && (
                    <a href={profile.social_github} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">
                      GitHub
                    </a>
                  )}
                  {profile.social_website && (
                    <a href={profile.social_website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">
                      Website
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Posts</h2>
        <PostList author={username} />
      </div>
    </main>
  );
}
