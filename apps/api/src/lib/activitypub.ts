import crypto from "crypto";
import type { getDb } from "@xlog/db";
import { getInstanceSettings } from "@xlog/db";
import { getActorUrlSync, signRequest } from "@xlog/ap";

const ACTIVITYPUB_ACCEPT_HEADER =
  'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildRemoteActorCandidates(actorUrl: string): string[] {
  const candidates = new Set<string>();

  const add = (value: string) => {
    if (value.startsWith("https://")) {
      candidates.add(value);
    }
  };

  try {
    const url = new URL(actorUrl);
    url.hash = "";

    add(url.toString());

    const withoutSlash = new URL(url.toString());
    withoutSlash.pathname = trimTrailingSlash(withoutSlash.pathname) || "/";
    add(withoutSlash.toString());

    const withSlash = new URL(withoutSlash.toString());
    if (!withSlash.pathname.endsWith("/")) {
      withSlash.pathname = `${withSlash.pathname}/`;
      add(withSlash.toString());
    }

    const hostVariants = new Set<string>([url.hostname]);
    if (url.hostname.startsWith("www.")) {
      hostVariants.add(url.hostname.slice(4));
    } else {
      hostVariants.add(`www.${url.hostname}`);
    }

    for (const hostname of hostVariants) {
      const variant = new URL(withoutSlash.toString());
      variant.hostname = hostname;
      add(variant.toString());

      const variantWithSlash = new URL(variant.toString());
      if (!variantWithSlash.pathname.endsWith("/")) {
        variantWithSlash.pathname = `${variantWithSlash.pathname}/`;
        add(variantWithSlash.toString());
      }
    }
  } catch {
    add(actorUrl);
  }

  return [...candidates];
}

function computeDigest(body: string): string {
  return `SHA-256=${crypto.createHash("sha256").update(body).digest("base64")}`;
}

export async function getPrimaryProfileUser(
  db: ReturnType<typeof getDb>
): Promise<{ id: string; username: string } | null> {
  const admin = await db
    .selectFrom("users")
    .select(["id", "username"])
    .where("role", "=", "admin")
    .orderBy("created_at", "asc")
    .executeTakeFirst();

  if (admin) return admin;

  return (
    (await db
      .selectFrom("users")
      .select(["id", "username"])
      .orderBy("created_at", "asc")
      .executeTakeFirst()) ?? null
  );
}

export async function resolveActorUrl(input: string): Promise<string> {
  if (input.startsWith("https://")) {
    return input;
  }
  if (input.startsWith("http://")) {
    throw new Error("ActivityPub actor URLs must use https");
  }

  const handle = input.replace(/^@/, "");
  const parts = handle.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
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
    (link: any) => link.rel === "self" && typeof link.href === "string"
  );
  if (!selfLink) {
    throw new Error("Actor URL not found in WebFinger response");
  }

  return selfLink.href as string;
}

export async function fetchRemoteActor(actorUrl: string): Promise<{
  inbox: string;
  sharedInbox?: string;
  preferredUsername?: string;
}> {
  for (const candidate of buildRemoteActorCandidates(actorUrl)) {
    try {
      const resp = await fetch(candidate, {
        headers: { Accept: ACTIVITYPUB_ACCEPT_HEADER },
      });
      if (resp.ok) {
        const actor = (await resp.json()) as {
          inbox?: string;
          endpoints?: { sharedInbox?: string };
          preferredUsername?: string;
        };
        return {
          inbox: actor.inbox || candidate.replace(/\/$/, "") + "/inbox",
          sharedInbox: actor.endpoints?.sharedInbox,
          preferredUsername: actor.preferredUsername,
        };
      }
    } catch (err) {
      console.error("Failed to fetch remote actor:", err);
    }
  }

  return { inbox: actorUrl.replace(/\/$/, "") + "/inbox" };
}

export async function followRemoteActor({
  db,
  localUser,
  remote,
}: {
  db: ReturnType<typeof getDb>;
  localUser: { id: string; username: string };
  remote: string;
}): Promise<{ actor: string; inbox_url: string; accepted: boolean }> {
  const remoteActorUrl = await resolveActorUrl(remote);
  const { inbox, sharedInbox } = await fetchRemoteActor(remoteActorUrl);
  const inboxUrl = sharedInbox || inbox;
  const settings = await getInstanceSettings();
  const actorId = getActorUrlSync(localUser.username, settings.instance_domain);

  const followActivity = {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`,
    type: "Follow" as const,
    actor: actorId,
    object: remoteActorUrl,
  };

  const body = JSON.stringify(followActivity);
  const signature = await signRequest("POST", inboxUrl, body, localUser.id);

  await fetch(inboxUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/activity+json",
      Signature: signature,
      Digest: computeDigest(body),
      Date: new Date().toUTCString(),
      Host: new URL(inboxUrl).host,
    },
    body,
  });

  await db
    .insertInto("following")
    .values({
      id: crypto.randomUUID(),
      local_user_id: localUser.id,
      remote_actor: remoteActorUrl,
      inbox_url: inboxUrl,
      activity_id: followActivity.id,
      accepted: false,
    })
    .onConflict((oc) =>
      oc
        .columns(["local_user_id", "remote_actor"])
        .doUpdateSet({ activity_id: followActivity.id, inbox_url: inboxUrl })
    )
    .execute();

  return { actor: remoteActorUrl, inbox_url: inboxUrl, accepted: false };
}
