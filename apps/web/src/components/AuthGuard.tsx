"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingSpinner } from "./LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const publicRoutes = ["/", "/onboarding", "/login", "/search", "/u/", "/post/"];
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route));

  useEffect(() => {
    if (isPublicRoute) return;
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, pathname, router, isPublicRoute]);

  // Show loading spinner while checking auth
  if (!isPublicRoute && (loading || !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
