import type { Metadata } from "next";
import InviteClient from "./Client";

export const metadata: Metadata = {
  title: "Accept invite — x-log",
  description: "Join this x-log instance as an author",
};

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <InviteClient params={params} />;
}
