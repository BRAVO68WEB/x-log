import { AuthGuard } from "@/components/AuthGuard";
import type { Metadata } from "next";
import AnalyticsDashboard from "./AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Analytics — x-log",
  description: "First-party page view analytics",
};

export default function AnalyticsPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <AnalyticsDashboard />
        </div>
      </main>
    </AuthGuard>
  );
}
