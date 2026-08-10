import { AuthGuard } from "@/components/AuthGuard";
import type { Metadata } from "next";
import NotificationsClient from "./Client";

export const metadata: Metadata = {
  title: "Notifications — x-log",
};

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <NotificationsClient />
    </AuthGuard>
  );
}
