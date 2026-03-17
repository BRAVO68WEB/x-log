"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname === "/onboarding" || pathname === "/login") {
    return null;
  }

  const publicNavItems = [
    { href: "/", label: "Home" },
    { href: "/search", label: "Search" },
  ];

  const authNavItems = [
    { href: "/editor", label: "Write" },
    { href: "/assets", label: "Assets" },
    { href: "/profile", label: "Profile" },
    { href: "/settings", label: "Settings" },
  ];

  const allNavItems = [
    ...publicNavItems,
    ...(isAuthenticated ? authNavItems : []),
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center mr-8">
              <span className="text-2xl sm:text-3xl font-extrabold leading-none font-heading bg-clip-text text-transparent bg-gradient-to-r from-violet-500 via-blue-500 to-green-500">
                x-log
              </span>
            </Link>
            <div className="hidden sm:flex sm:space-x-1">
              {allNavItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={pathname === item.href ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "text-sm",
                      pathname === item.href && "font-semibold"
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="sm:hidden p-2 rounded-md text-muted-foreground hover:bg-accent transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <Avatar className="h-7 w-7">
                  {user?.avatar_url ? (
                    <AvatarImage src={user.avatar_url} alt={user.username || ""} />
                  ) : (
                    <AvatarFallback className="text-xs">
                      {user?.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user?.username}
                </span>
                <Button variant="outline" size="sm" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-border bg-background/95 backdrop-blur-md">
          <div className="px-4 py-3 space-y-1">
            {allNavItems.map((item, index) => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button
                    variant={pathname === item.href ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    {item.label}
                  </Button>
                </Link>
                {index < allNavItems.length - 1 && (
                  <Separator className="my-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
