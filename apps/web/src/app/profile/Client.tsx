"use client";

import { ProfileForm } from "@/components/ProfileForm";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { OIDCAccountsSection } from "@/components/OIDCAccountsSection";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileClient() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 font-heading">
            Your Profile
          </h1>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Please log in to edit your profile.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-transparent py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold font-heading">Edit Profile</h1>

        <Card>
          <CardContent className="p-6">
            <ProfileForm username={user.username} />
          </CardContent>
        </Card>

        <OIDCAccountsSection />
      </div>
    </main>
  );
}
