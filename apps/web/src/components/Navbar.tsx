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
import {
  FaBoxArchive,
  FaGear,
  FaHouse,
  FaMagnifyingGlass,
  FaNewspaper,
  FaPen,
  FaUser,
} from "react-icons/fa6";
import type { IconType } from "react-icons";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname === "/onboarding" || pathname === "/login") {
    return null;
  }

  const publicNavItems: Array<{
    href: string;
    label: string;
    icon: IconType;
  }> = [
    { href: "/", label: "Home", icon: FaHouse },
    { href: "/search", label: "Search", icon: FaMagnifyingGlass },
  ];

  const authNavItems = [
    { href: "/following", label: "Following", icon: FaNewspaper },
    { href: "/editor", label: "Write", icon: FaPen },
    { href: "/assets", label: "Assets", icon: FaBoxArchive },
    { href: "/profile", label: "Profile", icon: FaUser },
    { href: "/settings", label: "Settings", icon: FaGear },
  ];

  const allNavItems = [
    ...publicNavItems,
    ...(isAuthenticated ? authNavItems : []),
  ];

  const accountProfileHref = user?.username ? `/u/${user.username}` : "/profile";

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="flex shrink-0 items-center">
              <span className="text-2xl sm:text-3xl font-normal leading-none font-heading tracking-[-0.04em] text-foreground">
                x-log
              </span>
            </Link>
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {allNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 shrink-0",
                      active && "text-foreground"
                    )}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
                );
              })}
            </div>
          </div>
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg
                  className="h-5 w-5"
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
                  className="h-5 w-5"
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
            {menuOpen && (
              <div className="absolute right-0 top-12 w-72 rounded-lg border border-border bg-card p-2 shadow-lg">
                <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <ThemeToggle />
                </div>
                <Separator className="my-2" />
                {isAuthenticated ? (
                  <>
                    <Link
                      href={accountProfileHref}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
                    >
                      <Avatar className="h-8 w-8">
                        {user?.avatar_url ? (
                          <AvatarImage src={user.avatar_url} alt={user.username || ""} />
                        ) : (
                          <AvatarFallback className="text-xs">
                            {user?.username?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {user?.username}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          View profile
                        </div>
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      className="mt-1 w-full justify-start"
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                    >
                      Logout
                    </Button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      Login
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
