import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import {
  ProfileResponseSchema,
  ProfileUpdateSchema,
} from "@xlog/validation";
import { getDb, getInstanceSettings } from "@xlog/db";
import { getActorUrlSync, signRequest } from "@xlog/ap";
import {
  sessionMiddleware,
  requireAuth,
} from "../middleware/session";

export const profilesRoutes = new Hono().use("*", sessionMiddleware);

profilesRoutes.get(
  "/:username",
  describeRoute({
    description: "Get user profile",
    tags: ["profiles"],
    responses: {
      200: {
        description: "Profile",
        content: {
          "application/json": {
            schema: resolver(ProfileResponseSchema),
          },
        },
      },
      404: {
        description: "Profile not found",
      },
    },
  }),
  validator("param", z.object({
    username: z.string(),
  })),
  async (c) => {
    const { username } = c.req.valid("param");
    const db = getDb();

    const user = await db
      .selectFrom("users")
      .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "users.username",
        "user_profiles.full_name",
        "user_profiles.bio",
        "user_profiles.social_github",
        "user_profiles.social_x",
        "user_profiles.social_youtube",
        "user_profiles.social_reddit",
        "user_profiles.social_linkedin",
        "user_profiles.social_website",
        "user_profiles.support_url",
        "user_profiles.support_text",
        "user_profiles.avatar_url",
        "user_profiles.banner_url",
        "user_profiles.nostr_pubkey",
        "user_profiles.nostr_privkey",
      ])
      .where("users.username", "=", username)
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "Profile not found" }, 404);
    }

    const settings = await getInstanceSettings();
    const actorUrl = getActorUrlSync(username, settings.instance_domain);

    const { nostr_privkey, ...rest } = user;
    return c.json({
      ...rest,
      has_nostr_privkey: !!nostr_privkey,
      instance_domain: settings.instance_domain,
      actor_url: actorUrl,
    });
  }
);

profilesRoutes.get(
  "/:username/followers",
  describeRoute({
    description: "List followers of a local user",
    tags: ["profiles"],
    responses: {
      200: {
        description: "Followers",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                items: z.array(
                  z.object({
                    remote_actor: z.string(),
                    remote_username: z.string().nullable(),
                    remote_domain: z.string().nullable(),
                    handle: z.string(),
                    inbox_url: z.string(),
                    approved: z.boolean(),
                    created_at: z.string(),
                  })
                ),
              })
            ),
          },
        },
      },
      404: { description: "User not found" },
    },
  }),
  validator("param", z.object({ username: z.string() })),
  async (c) => {
    const { username } = c.req.valid("param");
    const db = getDb();

    const user = await db
      .selectFrom("users")
      .select(["id"])
      .where("username", "=", username)
      .executeTakeFirst();

    if (!user) return c.json({ error: "User not found" }, 404);

    const rows = await db
      .selectFrom("followers")
      .select(["remote_actor", "remote_username", "remote_domain", "inbox_url", "approved", "created_at"])
      .where("local_user_id", "=", user.id)
      .orderBy("created_at", "desc")
      .limit(200)
      .execute();

    return c.json({
      items: rows.map((r) => {
        const domain = r.remote_domain || new URL(r.remote_actor).hostname;
        const name = r.remote_username || r.remote_actor.split("/").pop() || "unknown";
        return {
          remote_actor: r.remote_actor,
          remote_username: r.remote_username,
          remote_domain: r.remote_domain,
          handle: `@${name}@${domain}`,
          inbox_url: r.inbox_url,
          approved: r.approved,
          created_at: r.created_at.toISOString(),
        };
      }),
    });
  }
);

profilesRoutes.get(
  "/:username/following",
  describeRoute({
    description: "List accounts a local user is following",
    tags: ["profiles"],
    responses: {
      200: {
        description: "Following",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                items: z.array(
                  z.object({
                    remote_actor: z.string(),
                    inbox_url: z.string(),
                    activity_id: z.string(),
                    accepted: z.boolean(),
                    created_at: z.string(),
                  })
                ),
              })
            ),
          },
        },
      },
      404: { description: "User not found" },
    },
  }),
  validator("param", z.object({ username: z.string() })),
  async (c) => {
    const settings = await getInstanceSettings();
    if (!settings.following_enabled) {
      return c.json({ items: [] });
    }

    const { username } = c.req.valid("param");
    const db = getDb();

    const user = await db
      .selectFrom("users")
      .select(["id"])
      .where("username", "=", username)
      .executeTakeFirst();

    if (!user) return c.json({ error: "User not found" }, 404);

    const rows = await db
      .selectFrom("following")
      .select(["remote_actor", "inbox_url", "activity_id", "accepted", "created_at"])
      .where("local_user_id", "=", user.id)
      .orderBy("created_at", "desc")
      .limit(200)
      .execute();

    return c.json({
      items: rows.map((r) => ({
        remote_actor: r.remote_actor,
        inbox_url: r.inbox_url,
        activity_id: r.activity_id,
        accepted: r.accepted,
        created_at: r.created_at.toISOString(),
      })),
    });
  }
);

profilesRoutes.post(
  "/:username/follow",
  describeRoute({
    description: "Follow a remote ActivityPub actor",
    tags: ["profiles"],
    responses: {
      202: {
        description: "Follow request sent",
        content: {
          "application/json": {
            schema: resolver(
              z.object({ success: z.boolean(), actor: z.string() })
            ),
          },
        },
      },
      400: { description: "Invalid request" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
    },
  }),
  validator(
    "param",
    z.object({
      username: z.string(),
    })
  ),
  validator(
    "json",
    z.object({
      remote: z.string(), // actor URL or @user@domain
    })
  ),
  requireAuth,
  async (c) => {
    const settings = await getInstanceSettings();
    if (!settings.following_enabled) {
      return c.json({ error: "Following is currently disabled" }, 403);
    }

    const currentUser = c.get("user")!;
    const { username } = c.req.valid("param");
    const { remote } = c.req.valid("json");
    const db = getDb();

    // Authorization: only the profile owner or admin can initiate follow
    const user = await db
      .selectFrom("users")
      .select(["id", "username"])
      .where("username", "=", username)
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.id !== currentUser.id && currentUser.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Resolve remote actor URL
    async function resolveActorUrl(input: string): Promise<string> {
      if (input.startsWith("http://") || input.startsWith("https://")) {
        return input;
      }
      const handle = input.replace(/^@/, "");
      const parts = handle.split("@");
      if (parts.length !== 2) {
        throw new Error("Invalid remote handle");
      }
      const [remoteUser, remoteDomain] = parts;
      const webfingerUrl = `https://${remoteDomain}/.well-known/webfinger?resource=acct:${remoteUser}@${remoteDomain}`;
      const resp = await fetch(webfingerUrl);
      if (!resp.ok) {
        throw new Error("WebFinger lookup failed");
      }
      const data = await resp.json();
      const selfLink = (data.links || []).find(
        (l: any) => l.rel === "self" && typeof l.href === "string"
      );
      if (!selfLink) {
        throw new Error("Actor URL not found in WebFinger response");
      }
      return selfLink.href as string;
    }

  try {
    const remoteActorUrl = await resolveActorUrl(remote);

    // Fetch the remote actor to get the correct inbox URL
    let inboxUrl: string;
    try {
      const actorResp = await fetch(remoteActorUrl, {
        headers: { Accept: "application/activity+json, application/ld+json" },
      });
      if (actorResp.ok) {
        const actorData = (await actorResp.json()) as { inbox?: string };
        inboxUrl = actorData.inbox || remoteActorUrl.replace(/\/$/, "") + "/inbox";
      } else {
        inboxUrl = remoteActorUrl.replace(/\/$/, "") + "/inbox";
      }
    } catch {
      inboxUrl = remoteActorUrl.replace(/\/$/, "") + "/inbox";
    }
    const settings = await getInstanceSettings();
    const actorId = getActorUrlSync(username, settings.instance_domain);

      const followActivity = {
        "@context": ["https://www.w3.org/ns/activitystreams"],
        id: `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`,
        type: "Follow" as const,
        actor: actorId,
        object: remoteActorUrl,
      };

      const body = JSON.stringify(followActivity);
      const signature = await signRequest("POST", inboxUrl, body, user.id);

      await fetch(inboxUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/activity+json",
          Signature: signature,
          Date: new Date().toUTCString(),
          Host: new URL(inboxUrl).host,
        },
        body,
      });

      await db
        .insertInto("following")
        .values({
          id: crypto.randomUUID(),
          local_user_id: user.id,
          remote_actor: remoteActorUrl,
          inbox_url: inboxUrl,
          activity_id: followActivity.id,
          accepted: false,
        })
        .onConflict((oc) =>
          oc
            .columns(["local_user_id", "remote_actor"])
            .doUpdateSet({ activity_id: followActivity.id })
        )
        .execute();

      return c.json({ success: true, actor: remoteActorUrl }, 202);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  }
);

profilesRoutes.patch(
  "/:username",
  describeRoute({
    description: "Update user profile",
    tags: ["profiles"],
    responses: {
      200: {
        description: "Profile updated",
        content: {
          "application/json": {
            schema: resolver(ProfileResponseSchema),
          },
        },
      },
    },
  }),
  validator("param", z.object({
    username: z.string(),
  })),
  validator("json", ProfileUpdateSchema),
  requireAuth,
  async (c) => {
    const currentUser = c.get("user")!;
    const { username } = c.req.valid("param");
    const data = c.req.valid("json");
    const db = getDb();

    // Check authorization
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("username", "=", username)
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.id !== currentUser.id && currentUser.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db
      .updateTable("user_profiles")
      .set(data)
      .where("user_id", "=", user.id)
      .execute();

    const updated = await db
      .selectFrom("users")
      .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "users.username",
        "user_profiles.full_name",
        "user_profiles.bio",
        "user_profiles.social_github",
        "user_profiles.social_x",
        "user_profiles.social_youtube",
        "user_profiles.social_reddit",
        "user_profiles.social_linkedin",
        "user_profiles.social_website",
        "user_profiles.support_url",
        "user_profiles.support_text",
        "user_profiles.avatar_url",
        "user_profiles.banner_url",
        "user_profiles.nostr_pubkey",
        "user_profiles.nostr_privkey",
      ])
      .where("users.username", "=", username)
      .executeTakeFirst();

    const { nostr_privkey: _, ...rest } = updated!;
    return c.json({ ...rest, has_nostr_privkey: !!updated!.nostr_privkey });
  }
);
