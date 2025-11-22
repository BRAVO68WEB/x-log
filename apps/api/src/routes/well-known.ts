import { Hono } from "hono";
import { getDb } from "@xlog/db";
import { getActorUrl } from "@xlog/ap";
import { getEnv } from "@xlog/config";

export const wellKnownRoutes = new Hono();

// WebFinger endpoint
wellKnownRoutes.get("/.well-known/webfinger", async (c) => {
  const resource = c.req.query("resource");
  if (!resource || !resource.startsWith("acct:")) {
    return c.json({ error: "Invalid resource parameter" }, 400);
  }

  const match = resource.match(/^acct:(.+)@(.+)$/);
  if (!match) {
    return c.json({ error: "Invalid resource format" }, 400);
  }

  const [, username, domain] = match;
  const env = getEnv();

  if (domain !== env.INSTANCE_DOMAIN) {
    return c.json({ error: "Resource not found" }, 404);
  }

  const db = getDb();
  const user = await db
    .selectFrom("users")
    .select("username")
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const actorId = getActorUrl(username);
  const profileUrl = `https://${env.INSTANCE_DOMAIN}/u/${username}`;

  const jrd = {
    subject: resource,
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: actorId,
      },
      {
        rel: "http://webfinger.net/rel/profile-page",
        type: "text/html",
        href: profileUrl,
      },
    ],
  };

  return c.json(jrd, 200, {
    "Content-Type": "application/jrd+json",
  });
});

// NodeInfo discovery
wellKnownRoutes.get("/.well-known/nodeinfo", async (c) => {
  const env = getEnv();
  const nodeInfo = {
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        href: `https://${env.INSTANCE_DOMAIN}/nodeinfo/2.1`,
      },
    ],
  };

  return c.json(nodeInfo, 200, {
    "Content-Type": "application/json",
  });
});

// NodeInfo 2.1
wellKnownRoutes.get("/nodeinfo/2.1", async (c) => {
  const db = getDb();
  const env = getEnv();

  const userCount = await db
    .selectFrom("users")
    .select((eb) => eb.fn.count<number>("id").as("count"))
    .executeTakeFirst();

  const postCount = await db
    .selectFrom("posts")
    .select((eb) => eb.fn.count<number>("id").as("count"))
    .where("published_at", "is not", null)
    .executeTakeFirst();

  const settings = await db
    .selectFrom("instance_settings")
    .selectAll()
    .where("id", "=", 1)
    .executeTakeFirst();

  const nodeInfo = {
    version: "2.1",
    software: {
      name: "x-log",
      version: "0.1.0",
    },
    protocols: ["activitypub"],
    services: {
      inbound: [],
      outbound: [],
    },
    openRegistrations: settings?.open_registrations || false,
    usage: {
      users: {
        total: Number(userCount?.count || 0),
      },
      localPosts: Number(postCount?.count || 0),
    },
    metadata: {
      nodeName: settings?.instance_name || "x-log",
      nodeDescription: settings?.instance_description || null,
    },
  };

  return c.json(nodeInfo, 200, {
    "Content-Type": "application/json",
  });
});

// Host-meta (optional)
wellKnownRoutes.get("/.well-known/host-meta", async (c) => {
  const env = getEnv();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" template="https://${env.INSTANCE_DOMAIN}/.well-known/webfinger?resource={uri}"/>
</XRD>`;

  return c.text(xml, 200, {
    "Content-Type": "application/xrd+xml",
  });
});

wellKnownRoutes.get("/.well-known/host-meta.json", async (c) => {
  const env = getEnv();
  const jrd = {
    links: [
      {
        rel: "lrdd",
        template: `https://${env.INSTANCE_DOMAIN}/.well-known/webfinger?resource={uri}`,
      },
    ],
  };

  return c.json(jrd, 200, {
    "Content-Type": "application/jrd+json",
  });
});

