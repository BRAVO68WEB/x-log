"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();

  // Hide navbar on onboarding and login pages
  if (pathname === "/onboarding" || pathname === "/login") {
    return null;
  }

  const publicNavItems = [
    { href: "/", label: "Home" },
    { href: "/search", label: "Search" },
  ];

  const authNavItems = [
    { href: "/editor", label: "Write" },
    { href: "/profile", label: "Profile" },
    { href: "/settings", label: "Settings" },
  ];

  const allNavItems = [...publicNavItems, ...(isAuthenticated ? authNavItems : [])];

  return (
    <nav className="border-b border-light-highlight-med dark:border-dark-highlight-med bg-light-surface dark:bg-dark-surface opacity-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center mr-8">
              <span className="relative inline-block" aria-label="x-log">
                <span className="text-2xl sm:text-3xl font-extrabold leading-none text-white dark:text-white">x-log</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 blur-lg opacity-35 pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #8b5cf6 0%, #60a5fa 20%, #22c55e 40%, #f59e0b 60%, #ef4444 80%, #ec4899 100%)",
                    filter: "blur(10px)",
                  }}
                />
              </span>
            </Link>
            <div className="hidden sm:flex sm:space-x-4">
              {allNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-light-pine/10 dark:bg-dark-pine/20 text-light-pine dark:text-dark-foam"
                      : "text-light-muted dark:text-dark-muted hover:bg-light-overlay dark:hover:bg-dark-overlay hover:text-light-text dark:hover:text-dark-text"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <span className="text-sm text-light-muted dark:text-dark-muted hidden sm:inline">
                  {user?.username}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="text-sm"
                >
                  Logout
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm" className="text-sm">
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
