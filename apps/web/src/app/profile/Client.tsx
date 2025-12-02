"use client";

import { ProfileForm } from "@/components/ProfileForm";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileClient() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen p-8 bg-light-base dark:bg-dark-base">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen py-8 px-4 bg-light-base dark:bg-dark-base">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-light-text dark:text-dark-text">Your Profile</h1>
          <div className="bg-light-surface dark:bg-dark-surface rounded-lg shadow-md p-8 text-center border border-light-highlight-med dark:border-dark-highlight-med">
            <p className="text-light-muted dark:text-dark-muted">Please log in to edit your profile.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-transparent py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-light-text dark:text-dark-text">Edit Profile</h1>
        <div className="bg-light-surface dark:bg-dark-surface rounded-lg shadow-md p-6 border border-light-highlight-med dark:border-dark-highlight-med">
          <ProfileForm username={user.username} />
        </div>
      </div>
    </main>
  );
}
