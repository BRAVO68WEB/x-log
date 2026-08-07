import crypto from "crypto";
import type { getDb } from "@xlog/db";
import { getInstanceSettings } from "@xlog/db";
import { getActorUrlSync, signRequest, fetchRemoteActorInbox } from "@xlog/ap";

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

export async function fetchRemoteActor(
  actorUrl: string,
  opts?: { signerUserId?: string }
): Promise<{
  inbox: string;
  sharedInbox?: string;
  preferredUsername?: string;
}> {
  return fetchRemoteActorInbox(actorUrl, opts);
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
  const { inbox, sharedInbox } = await fetchRemoteActor(remoteActorUrl, {
    signerUserId: localUser.id,
  });
  const inboxUrl = sharedInbox || inbox;
  const settings = await getInstanceSettings();
  const actorId = getActorUrlSync(localUser.username, settings.instance_domain);

  const followActivity = {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`,
    type: "Follow" as const,
    actor: actorId,
    object: remoteActorUrl,
    to: [remoteActorUrl],
  };

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
      oc.columns(["local_user_id", "remote_actor"]).doUpdateSet({
        activity_id: followActivity.id,
        inbox_url: inboxUrl,
        accepted: false,
      })
    )
    .execute();

  const body = JSON.stringify(followActivity);
  const signed = await signRequest({
    method: "POST",
    url: inboxUrl,
    body,
    userId: localUser.id,
  });

  const response = await fetch(signed.url, {
    method: signed.method,
    headers: signed.headers,
    body: signed.body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Follow delivery failed: ${response.status} ${text.slice(0, 500)}`);
  }

  return { actor: remoteActorUrl, inbox_url: inboxUrl, accepted: false };
}
