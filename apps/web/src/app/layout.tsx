import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { OnboardingGuard } from "@/components/OnboardingGuard";

export const metadata: Metadata = {
  title: "x-log",
  description: "A federated blog platform built on ActivityPub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50">
        <OnboardingGuard>
          <Navbar />
          <div className="min-h-[calc(100vh-4rem)]">
            {children}
          </div>
        </OnboardingGuard>
      </body>
    </html>
  );
}

