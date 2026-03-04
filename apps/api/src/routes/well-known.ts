import { Hono } from "hono";
import { getDb, getInstanceSettings } from "@xlog/db";
import { getActorUrlSync } from "@xlog/ap";

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
  const settings = await getInstanceSettings();

  if (domain !== settings.instance_domain) {
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

  const actorId = getActorUrlSync(username, settings.instance_domain);
  const profileUrl = `https://${settings.instance_domain}/u/${username}`;

  const jrd = {
    subject: resource,
    aliases: [profileUrl, actorId],
    links: [
      {
        rel: "http://webfinger.net/rel/profile-page",
        type: "text/html",
        href: profileUrl,
      },
      {
        rel: "self",
        type: "application/activity+json",
        href: actorId,
      },
      {
        rel: "http://ostatus.org/schema/1.0/subscribe",
        template: `https://${settings.instance_domain}/authorize_interaction?uri={uri}`,
      },
    ],
  };

  return c.json(jrd, 200, {
    "Content-Type": "application/jrd+json",
    "Cache-Control": "max-age=300",
    "Access-Control-Allow-Origin": "*",
  });
});

// NodeInfo discovery
wellKnownRoutes.get("/.well-known/nodeinfo", async (c) => {
  const settings = await getInstanceSettings();
  const nodeInfo = {
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
        href: `https://${settings.instance_domain}/nodeinfo/2.0`,
      },
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        href: `https://${settings.instance_domain}/nodeinfo/2.1`,
      },
    ],
  };

  return c.json(nodeInfo, 200, {
    "Content-Type": "application/json",
    "Cache-Control": "max-age=1800",
  });
});

// NodeInfo 2.1
wellKnownRoutes.get("/nodeinfo/2.1", async (c) => {
  const db = getDb();

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
      version: "0.3.0",
      repository: "https://github.com/BRAVO68WEB/x-log",
      homepage: "https://github.com/BRAVO68WEB/x-log",
    },
    protocols: ["activitypub"],
    services: {
      inbound: [],
      outbound: [],
    },
    openRegistrations: false,
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
    "Content-Type":
      'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.1#"',
    "Cache-Control": "max-age=1800",
  });
});

// NodeInfo 2.0
wellKnownRoutes.get("/nodeinfo/2.0", async (c) => {
  const db = getDb();

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
    version: "2.0",
    software: {
      name: "x-log",
      version: "0.3.0",
    },
    protocols: ["activitypub"],
    services: {
      inbound: [],
      outbound: [],
    },
    openRegistrations: false,
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
    "Content-Type":
      'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.0#"',
    "Cache-Control": "max-age=1800",
  });
});

// Host-meta (optional)
wellKnownRoutes.get("/.well-known/host-meta", async (c) => {
  const settings = await getInstanceSettings();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" template="https://${settings.instance_domain}/.well-known/webfinger?resource={uri}"/>
</XRD>`;

  return c.text(xml, 200, {
    "Content-Type": "application/xrd+xml",
    "Cache-Control": "max-age=1800",
  });
});

wellKnownRoutes.get("/.well-known/host-meta.json", async (c) => {
  const settings = await getInstanceSettings();
  const jrd = {
    links: [
      {
        rel: "lrdd",
        template: `https://${settings.instance_domain}/.well-known/webfinger?resource={uri}`,
      },
    ],
  };

  return c.json(jrd, 200, {
    "Content-Type": "application/jrd+json",
    "Cache-Control": "max-age=1800",
  });
});

// NodeInfo2 (x-nodeinfo2) — direct document without discovery step
wellKnownRoutes.get("/.well-known/x-nodeinfo2", async (c) => {
  const settings = await getInstanceSettings();
  const db = getDb();
  const userCount = await db
    .selectFrom("users")
    .select(db.fn.countAll().as("count"))
    .executeTakeFirst();
  const postCount = await db
    .selectFrom("posts")
    .select(db.fn.countAll().as("count"))
    .where("visibility", "=", "public")
    .executeTakeFirst();

  return c.json({
    version: "1.0",
    server: {
      baseUrl: `https://${settings.instance_domain}`,
      name: settings.instance_name,
      software: "x-log",
      version: "0.3.0",
    },
    openRegistrations: false,
    protocols: ["activitypub"],
    usage: {
      users: { total: Number(userCount?.count || 0) },
      localPosts: Number(postCount?.count || 0),
    },
  }, 200, {
    "Content-Type": "application/json",
    "Cache-Control": "max-age=1800",
  });
});

// NIP-05 Nostr verification
wellKnownRoutes.get("/.well-known/nostr.json", async (c) => {
  const name = c.req.query("name");
  if (!name) {
    return c.json({ names: {}, relays: {} });
  }

  const db = getDb();
  const user = await db
    .selectFrom("users")
    .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
    .select(["users.username", "user_profiles.nostr_pubkey"])
    .where("users.username", "=", name)
    .executeTakeFirst();

  if (!user || !user.nostr_pubkey) {
    return c.json({ names: {}, relays: {} });
  }

  return c.json({
    names: {
      [user.username]: user.nostr_pubkey,
    },
    relays: {},
  }, 200, {
    "Access-Control-Allow-Origin": "*",
  });
});

