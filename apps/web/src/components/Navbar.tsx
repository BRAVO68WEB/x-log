"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import {
  FaBell,
  FaBoxArchive,
  FaChartSimple,
  FaGear,
  FaHouse,
  FaMagnifyingGlass,
  FaNewspaper,
  FaPen,
  FaUser,
  FaBookmark,
  FaCode,
  FaLink,
  FaFileLines,
} from "react-icons/fa6";
import type { IconType } from "react-icons";
import { useQuery } from "react-query";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const unreadQuery = useQuery(
    ["notifications-unread"],
    async () => {
      const res = await fetch("/api/notifications/unread-count", {
        credentials: "include",
      });
      if (!res.ok) return { count: 0 };
      return res.json() as Promise<{ count: number }>;
    },
    {
      enabled: isAuthenticated,
      refetchInterval: 60_000,
      staleTime: 30_000,
    }
  );
  const unread = unreadQuery.data?.count || 0;

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Outside click + Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [menuOpen]);

  if (
    pathname === "/onboarding" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/verify-email" ||
    pathname.startsWith("/invite/")
  ) {
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
    { href: "/drafts", label: "My Posts", icon: FaFileLines },
    { href: "/notifications", label: "Notifications", icon: FaBell },
    { href: "/snippets", label: "Snippets", icon: FaCode },
    { href: "/links", label: "Links", icon: FaLink },
    { href: "/bookmarks", label: "Bookmarks", icon: FaBookmark },
    { href: "/assets", label: "Assets", icon: FaBoxArchive },
    { href: "/analytics", label: "Analytics", icon: FaChartSimple },
    { href: "/profile", label: "Profile", icon: FaUser },
    { href: "/settings", label: "Settings", icon: FaGear },
  ];

  const allNavItems = [...publicNavItems, ...(isAuthenticated ? authNavItems : [])];

  // Desktop: core icons only (rest in account menu is too heavy); keep full set but hide overflow on small screens
  const desktopNavItems = allNavItems;

  const accountProfileHref = user?.username ? `/u/${user.username}` : "/profile";

  const NavLink = ({
    href,
    label,
    icon: Icon,
    compact,
  }: {
    href: string;
    label: string;
    icon: IconType;
    compact?: boolean;
  }) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    const showBadge = href === "/notifications" && unread > 0;
    if (compact) {
      return (
        <Link href={href} className="relative shrink-0" onClick={() => setMenuOpen(false)}>
          <Button
            variant={active ? "secondary" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 shrink-0", active && "text-foreground")}
            aria-label={showBadge ? `${label} (${unread} unread)` : label}
            title={label}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </Button>
          {showBadge && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      );
    }
    return (
      <Link
        href={href}
        onClick={() => setMenuOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent min-h-11",
          active && "bg-secondary font-medium"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{label}</span>
        {showBadge && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16 gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link href="/" className="flex shrink-0 items-center">
              <span className="text-xl sm:text-2xl md:text-3xl font-normal leading-none font-heading tracking-[-0.04em] text-foreground">
                x-log
              </span>
            </Link>
            {/* Desktop / tablet icon rail */}
            <div className="hidden md:flex min-w-0 items-center gap-0.5 overflow-x-auto scrollbar-none max-w-[min(100vw-12rem,42rem)]">
              {desktopNavItems.map((item) => (
                <NavLink key={item.href} {...item} compact />
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-1.5 sm:gap-2" ref={menuRef}>
            {/* Quick write on mobile when logged in */}
            {isAuthenticated && (
              <Link href="/editor" className="md:hidden">
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Write">
                  <FaPen className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
            >
              {menuOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>

            {/* Desktop account control */}
            <button
              type="button"
              className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close account menu" : "Open account menu"}
              aria-expanded={menuOpen}
            >
              {isAuthenticated && user ? (
                <Avatar className="h-7 w-7">
                  {user.avatar_url ? (
                    <AvatarImage src={user.avatar_url} alt={user.username || ""} />
                  ) : (
                    <AvatarFallback className="text-xs">
                      {user.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
              ) : (
                <FaUser className="h-4 w-4" />
              )}
            </button>

            {menuOpen && (
              <div
                id="mobile-nav-menu"
                className="absolute right-0 top-11 sm:top-12 w-[min(100vw-1.5rem,18rem)] max-h-[min(80vh,32rem)] overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg overscroll-contain"
              >
                <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <ThemeToggle />
                </div>
                <Separator className="my-2" />

                {/* Mobile: full nav list */}
                <div className="md:hidden space-y-0.5 pb-2">
                  {allNavItems.map((item) => (
                    <NavLink key={item.href} {...item} />
                  ))}
                  <Separator className="my-2" />
                </div>

                {isAuthenticated ? (
                  <>
                    <Link
                      href={accountProfileHref}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent min-h-11"
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
                        <div className="truncate text-sm font-medium">{user?.username}</div>
                        <div className="text-xs text-muted-foreground">View profile</div>
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      className="mt-1 w-full justify-start min-h-11"
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
                    <Button variant="ghost" className="w-full justify-start min-h-11">
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
