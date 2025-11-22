"use client";

import { ProfileForm } from "@/components/ProfileForm";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-gray-900">Your Profile</h1>
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">Please log in to edit your profile.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Edit Profile</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <ProfileForm username={user.username} />
        </div>
      </div>
    </main>
  );
}

