"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { withCsrf } from "@/lib/csrf";

type Notification = {
  id: string;
  type: string;
  actor_label: string;
  actor_url: string | null;
  post_id: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsClient() {
  const queryClient = useQueryClient();

  const query = useQuery(["notifications"], async () => {
    const res = await fetch("/api/notifications?limit=50", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load notifications");
    return res.json() as Promise<{ items: Notification[]; unread_count: number }>;
  });

  const markAll = useMutation(
    async () => {
      const res = await fetch("/api/notifications/read", withCsrf({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }));
      if (!res.ok) throw new Error("Failed to mark read");
      return res.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["notifications"]);
        queryClient.invalidateQueries(["notifications-unread"]);
      },
    }
  );

  if (query.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  const items = query.data?.items || [];
  const unread = query.data?.unread_count || 0;

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-heading tracking-[-0.03em]">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unread} unread · follows and likes
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markAll.isLoading || unread === 0}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        </div>

        <BentoGrid columns={2}>
          <BentoCard size="full" index={0} accent>
            <BentoCardContent className="p-0">
              {items.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground text-sm">
                  No notifications yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 text-sm ${
                        n.read_at ? "opacity-70" : "bg-primary/5"
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p>
                          <span className="font-medium">{n.actor_label}</span>{" "}
                          {n.type === "follow" ? (
                            <span>followed you</span>
                          ) : (
                            <span>
                              liked{" "}
                              {n.post_id ? (
                                <Link
                                  href={`/post/${n.post_id}`}
                                  className="text-primary hover:underline"
                                >
                                  your post
                                </Link>
                              ) : (
                                "your post"
                              )}
                            </span>
                          )}
                        </p>
                        <time className="text-xs text-muted-foreground shrink-0">
                          {new Date(n.created_at).toLocaleString()}
                        </time>
                      </div>
                      {n.body && n.type === "like" && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {n.body}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    </main>
  );
}
