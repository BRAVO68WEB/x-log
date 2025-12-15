import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./theme.css";
import { Navbar } from "@/components/Navbar";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { Dotted } from "@/components/Backgrounds/Dotted";
import { ThemeProvider } from 'next-themes'
import { QueryProvider } from "@/components/QueryProvider";
import localFont from "next/font/local";

const mcfont = localFont({
  src: [
    {
      path: "../fonts/Monocraft.ttf",
      weight: "400",
    },
  ],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const hdrs = await headers();
    const host = hdrs.get("host") || "localhost:4000";
    const proto = hdrs.get("x-forwarded-proto") || "http";
    const base = `${proto}://${host}`;
    const res = await fetch(`${base}/api/settings`, { cache: "no-store" });
    if (!res.ok) {
      return {
        title: "x-log",
        description: "A federated blog platform built on ActivityPub",
      };
    }
    const settings = (await res.json()) as {
      instance_name: string;
      instance_description: string | null;
      instance_domain: string;
    };
    return {
      title: settings.instance_name || "x-log",
      description: settings.instance_description || "A federated blog platform built on ActivityPub",
      openGraph: {
        title: settings.instance_name || "x-log",
        description: settings.instance_description || undefined,
        siteName: settings.instance_name || "x-log",
        url: settings.instance_domain ? `https://${settings.instance_domain}` : undefined,
        type: "website",
      },
      twitter: {
        card: "summary",
        title: settings.instance_name || "x-log",
        description: settings.instance_description || undefined,
      },
    };
  } catch {
    return {
      title: "x-log",
      description: "A federated blog platform built on ActivityPub",
    };
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`min-h-full bg-light-base dark:bg-dark-base transition-colors font-sans ${mcfont.className}`} >
        <OnboardingGuard>
          <QueryProvider>
            <Navbar />
            <div className="min-h-[calc(100vh-4rem)]">
              <ThemeProvider>{children}</ThemeProvider>
            </div>
          </QueryProvider>
        </OnboardingGuard>
        <Dotted />
      </body>
    </html>
  );
}
