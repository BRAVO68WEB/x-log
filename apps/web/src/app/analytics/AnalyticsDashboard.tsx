"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useQuery } from "react-query";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { Label } from "@/components/ui/label";
import { analyticsApi, type AnalyticsSummary } from "@/lib/api";

const DAY_OPTIONS = [7, 30, 90] as const;

function DailyChart({ daily }: { daily: AnalyticsSummary["daily"] }) {
  if (daily.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No views in this range yet.
      </p>
    );
  }

  const max = Math.max(...daily.map((d) => d.views), 1);

  return (
    <div className="space-y-3">
      <div
        className="flex items-end gap-0.5 h-36 w-full"
        role="img"
        aria-label="Daily views chart"
      >
        {daily.map((d) => {
          const pct = (d.views / max) * 100;
          return (
            <div
              key={d.day}
              className="group relative flex-1 min-w-0 flex flex-col justify-end h-full"
              title={`${d.day}: ${d.views} views`}
            >
              <div
                className="w-full rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(pct, d.views > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{daily[0]?.day}</span>
        <span>{daily[daily.length - 1]?.day}</span>
      </div>
    </div>
  );
}

function RankedList({
  items,
  empty,
}: {
  items: Array<{ key: string; label: ReactNode; views: number; href?: string }>;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{empty}</p>;
  }

  const max = Math.max(...items.map((i) => i.views), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            {item.href ? (
              <Link href={item.href} className="truncate font-medium hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="truncate font-medium">{item.label}</span>
            )}
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.views.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${(item.views / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AnalyticsDashboard({ embedded = false }: { embedded?: boolean }) {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);

  const query = useQuery(
    ["analytics-summary", days],
    () => analyticsApi.getSummary(days),
    {
      retry: false,
    }
  );

  const disabled = query.isError && (query.error as { status?: number })?.status === 404;
  // apiRequest may throw Error without status — detect by message
  const isDisabled =
    query.isError &&
    (String((query.error as Error)?.message || "").toLowerCase().includes("disabled") ||
      String((query.error as Error)?.message || "").includes("404"));

  if (query.isLoading) {
    return (
      <div className={embedded ? "py-12 flex justify-center" : "min-h-[40vh] flex justify-center items-center"}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isDisabled || disabled) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center space-y-2">
        <h2 className="text-lg font-semibold font-heading">Analytics is off</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Enable the <strong>analytics</strong> feature flag under Settings → Features to
          collect page views and show this dashboard.
        </p>
        <Link
          href="/settings"
          className="inline-block text-sm text-primary hover:underline mt-2"
        >
          Open Features settings
        </Link>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
        <p className="text-sm text-destructive">
          {(query.error as Error)?.message || "Failed to load analytics"}
        </p>
      </div>
    );
  }

  const data = query.data!;
  const avg =
    data.daily.length > 0
      ? Math.round(data.total_views / data.daily.length)
      : 0;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Analytics</h1>
            <p className="text-muted-foreground mt-2">
              First-party page views
              {data.scope === "own" ? " for your posts" : " across the instance"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="analytics-days" className="text-sm text-muted-foreground">
              Range
            </Label>
            <select
              id="analytics-days"
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value) as (typeof DAY_OPTIONS)[number])}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  Last {d} days
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex justify-end">
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as (typeof DAY_OPTIONS)[number])}
            aria-label="Analytics range"
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </div>
      )}

      <BentoGrid columns={3}>
        <BentoCard index={0} accent>
          <BentoCardHeader>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total views</p>
          </BentoCardHeader>
          <BentoCardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {data.total_views.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Last {data.days} days</p>
          </BentoCardContent>
        </BentoCard>
        <BentoCard index={1}>
          <BentoCardHeader>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Daily average</p>
          </BentoCardHeader>
          <BentoCardContent>
            <p className="text-3xl font-semibold tabular-nums">{avg.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Across {data.daily.length} active day{data.daily.length === 1 ? "" : "s"}
            </p>
          </BentoCardContent>
        </BentoCard>
        <BentoCard index={2}>
          <BentoCardHeader>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Scope</p>
          </BentoCardHeader>
          <BentoCardContent>
            <p className="text-3xl font-semibold capitalize">{data.scope}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.scope === "all" ? "Admin · all authors" : "Your posts only"}
            </p>
          </BentoCardContent>
        </BentoCard>
      </BentoGrid>

      <BentoGrid columns={2}>
        <BentoCard size="full" index={0} accent>
          <BentoCardHeader>
            <h2 className="text-xl font-semibold font-heading">Views per day</h2>
          </BentoCardHeader>
          <BentoCardContent>
            <DailyChart daily={data.daily} />
          </BentoCardContent>
        </BentoCard>

        <BentoCard index={1}>
          <BentoCardHeader>
            <h2 className="text-lg font-semibold font-heading">Top posts</h2>
          </BentoCardHeader>
          <BentoCardContent>
            <RankedList
              empty="No post views in this range."
              items={data.top_posts.map((p) => ({
                key: p.post_id || "unknown",
                label: p.title || (p.post_id ? `Post ${p.post_id.slice(0, 8)}…` : "Unknown"),
                views: p.views,
                href: p.post_id ? `/post/${p.post_id}` : undefined,
              }))}
            />
          </BentoCardContent>
        </BentoCard>

        <BentoCard index={2}>
          <BentoCardHeader>
            <h2 className="text-lg font-semibold font-heading">Top referrers</h2>
          </BentoCardHeader>
          <BentoCardContent>
            <RankedList
              empty="No referrer data in this range."
              items={data.top_referrers.map((r) => ({
                key: r.host || "direct",
                label: r.host || "(direct)",
                views: r.views,
              }))}
            />
          </BentoCardContent>
        </BentoCard>

        <BentoCard size="full" index={3}>
          <BentoCardHeader>
            <h2 className="text-lg font-semibold font-heading">Privacy</h2>
          </BentoCardHeader>
          <BentoCardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              First-party analytics stores path, optional post id, referrer host, user-agent,
              and a hashed IP. Bots and empty user-agents are ignored.
            </p>
            <ul className="grid gap-2 sm:grid-cols-3">
              <li className="rounded-md border border-border p-3">
                <span className="block text-xs uppercase tracking-wide mb-1">Raw IP storage</span>
                <span className="font-medium text-foreground">
                  {data.privacy.store_raw_ip ? "Enabled" : "Off (hashed only)"}
                </span>
              </li>
              <li className="rounded-md border border-border p-3">
                <span className="block text-xs uppercase tracking-wide mb-1">DNT / GPC</span>
                <span className="font-medium text-foreground">
                  {data.privacy.respect_dnt ? "Respected" : "Ignored"}
                </span>
              </li>
              <li className="rounded-md border border-border p-3">
                <span className="block text-xs uppercase tracking-wide mb-1">Retention</span>
                <span className="font-medium text-foreground">
                  {data.privacy.retention_days} days
                </span>
              </li>
            </ul>
            <p className="text-xs">
              Env: <code className="text-foreground">ANALYTICS_STORE_RAW_IP</code>,{" "}
              <code className="text-foreground">ANALYTICS_RESPECT_DNT</code>,{" "}
              <code className="text-foreground">ANALYTICS_RETENTION_DAYS</code>
            </p>
          </BentoCardContent>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
