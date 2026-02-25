import { getEnv } from "@xlog/config";
import { getInstanceSettings } from "@xlog/db";
import type { Database } from "@xlog/db";

export interface ActivityPubActor {
  "@context": (string | Record<string, string>)[];
  id: string;
  type: "Person";
  preferredUsername: string;
  name: string;
  summary: string;
  url: string;
  inbox: string;
  outbox: string;
  followers: string;
  following: string;
  published?: string;
  discoverable: boolean;
  manuallyApprovesFollowers: boolean;
  icon?: { type: "Image"; mediaType?: string; url: string };
  image?: { type: "Image"; mediaType?: string; url: string };
  endpoints?: { sharedInbox: string };
  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
}

export interface ActivityPubArticle {
  "@context": string[];
  id: string;
  url: string;
  type: "Article";
  attributedTo: string;
  name: string;
  summary?: string;
  content: string;
  tag?: Array<{ type: "Hashtag"; name: string; href?: string }>;
  image?: string;
  published: string;
  updated?: string;
  to?: string[];
  cc?: string[];
  sensitive?: boolean;
}

export interface ActivityPubCreate {
  "@context": string[];
  id: string;
  type: "Create";
  actor: string;
  published: string;
  to: string[];
  cc?: string[];
  object: ActivityPubArticle;
}

export interface ActivityPubUpdate {
  "@context": string[];
  id: string;
  type: "Update";
  actor: string;
  published: string;
  to: string[];
  cc?: string[];
  object: ActivityPubArticle;
}

export interface ActivityPubDelete {
  "@context": string[];
  id: string;
  type: "Delete";
  actor: string;
  to: string[];
  cc?: string[];
  object: {
    id: string;
    type: "Tombstone";
    formerType: "Article";
  };
}

export interface ActivityPubFollow {
  "@context": string[];
  id: string;
  type: "Follow";
  actor: string;
  object: string;
}

export interface ActivityPubAccept {
  "@context": string[];
  id: string;
  type: "Accept";
  actor: string;
  object: string;
}

export interface ActivityPubLike {
  "@context": string[];
  id: string;
  type: "Like";
  actor: string;
  object: string;
}

export async function getActorUrl(username: string): Promise<string> {
  const settings = await getInstanceSettings();
  return `https://${settings.instance_domain}/ap/users/${username}`;
}

export function getActorUrlSync(username: string, domain: string): string {
  return `https://${domain}/ap/users/${username}`;
}

export async function getInboxUrl(username: string): Promise<string> {
  const actorUrl = await getActorUrl(username);
  return `${actorUrl}/inbox`;
}

export function getInboxUrlSync(username: string, domain: string): string {
  return `${getActorUrlSync(username, domain)}/inbox`;
}

export async function getOutboxUrl(username: string): Promise<string> {
  const actorUrl = await getActorUrl(username);
  return `${actorUrl}/outbox`;
}

export function getOutboxUrlSync(username: string, domain: string): string {
  return `${getActorUrlSync(username, domain)}/outbox`;
}

export async function getFollowersUrl(username: string): Promise<string> {
  const actorUrl = await getActorUrl(username);
  return `${actorUrl}/followers`;
}

export function getFollowersUrlSync(username: string, domain: string): string {
  return `${getActorUrlSync(username, domain)}/followers`;
}

export async function getFollowingUrl(username: string): Promise<string> {
  const actorUrl = await getActorUrl(username);
  return `${actorUrl}/following`;
}

export function getFollowingUrlSync(username: string, domain: string): string {
  return `${getActorUrlSync(username, domain)}/following`;
}

export async function getPostUrl(postId: string): Promise<string> {
  const settings = await getInstanceSettings();
  return `https://${settings.instance_domain}/post/${postId}`;
}

export function getPostUrlSync(postId: string, domain: string): string {
  return `https://${domain}/post/${postId}`;
}

export interface ActorOptions {
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  createdAt?: Date | null;
}

export async function createActorObject(
  username: string,
  name: string,
  summary: string,
  publicKeyPem: string,
  options?: ActorOptions
): Promise<ActivityPubActor> {
  const settings = await getInstanceSettings();
  const actorId = await getActorUrl(username);
  const keyId = `${actorId}#main-key`;

  const actor: ActivityPubActor = {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      {
        manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
        toot: "http://joinmastodon.org/ns#",
        discoverable: "toot:discoverable",
      },
    ],
    id: actorId,
    type: "Person",
    preferredUsername: username,
    name,
    summary,
    url: `https://${settings.instance_domain}/u/${username}`,
    inbox: await getInboxUrl(username),
    outbox: await getOutboxUrl(username),
    followers: await getFollowersUrl(username),
    following: await getFollowingUrl(username),
    discoverable: true,
    manuallyApprovesFollowers: false,
    endpoints: {
      sharedInbox: `https://${settings.instance_domain}/ap/inbox`,
    },
    publicKey: {
      id: keyId,
      owner: actorId,
      publicKeyPem,
    },
  };

  if (options?.avatarUrl) {
    actor.icon = { type: "Image", url: options.avatarUrl };
  }
  if (options?.bannerUrl) {
    actor.image = { type: "Image", url: options.bannerUrl };
  }
  if (options?.createdAt) {
    actor.published = options.createdAt.toISOString();
  }

  return actor;
}

export function createActorObjectSync(
  username: string,
  name: string,
  summary: string,
  publicKeyPem: string,
  domain: string,
  options?: ActorOptions
): ActivityPubActor {
  const actorId = getActorUrlSync(username, domain);
  const keyId = `${actorId}#main-key`;

  const actor: ActivityPubActor = {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      {
        manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
        toot: "http://joinmastodon.org/ns#",
        discoverable: "toot:discoverable",
      },
    ],
    id: actorId,
    type: "Person",
    preferredUsername: username,
    name,
    summary,
    url: `https://${domain}/u/${username}`,
    inbox: getInboxUrlSync(username, domain),
    outbox: getOutboxUrlSync(username, domain),
    followers: getFollowersUrlSync(username, domain),
    following: getFollowingUrlSync(username, domain),
    discoverable: true,
    manuallyApprovesFollowers: false,
    endpoints: {
      sharedInbox: `https://${domain}/ap/inbox`,
    },
    publicKey: {
      id: keyId,
      owner: actorId,
      publicKeyPem,
    },
  };

  if (options?.avatarUrl) {
    actor.icon = { type: "Image", url: options.avatarUrl };
  }
  if (options?.bannerUrl) {
    actor.image = { type: "Image", url: options.bannerUrl };
  }
  if (options?.createdAt) {
    actor.published = options.createdAt.toISOString();
  }

  return actor;
}

export interface ArticleOptions {
  updated?: Date;
  visibility?: "public" | "unlisted" | "private";
  followersUrl?: string;
  sensitive?: boolean;
}

export async function createArticleObject(
  postId: string,
  actorId: string,
  title: string,
  contentHtml: string,
  published: Date,
  hashtags: string[],
  summary?: string,
  bannerUrl?: string | null,
  options?: ArticleOptions
): Promise<ActivityPubArticle> {
  const settings = await getInstanceSettings();
  const articleId = await getPostUrl(postId);
  const domain = settings.instance_domain;

  const { to, cc } = computeAddressing(options?.visibility, options?.followersUrl);

  return {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: articleId,
    url: articleId,
    type: "Article",
    attributedTo: actorId,
    name: title,
    summary,
    content: contentHtml,
    tag: hashtags.map((tag) => ({
      type: "Hashtag" as const,
      name: `#${tag}`,
      href: `https://${domain}/search?hashtag=${encodeURIComponent(tag)}`,
    })),
    image: bannerUrl || undefined,
    published: published.toISOString(),
    updated: options?.updated?.toISOString(),
    to,
    cc,
    sensitive: options?.sensitive,
  };
}

export function createArticleObjectSync(
  postId: string,
  actorId: string,
  title: string,
  contentHtml: string,
  published: Date,
  hashtags: string[],
  domain: string,
  summary?: string,
  bannerUrl?: string | null,
  options?: ArticleOptions
): ActivityPubArticle {
  const articleId = getPostUrlSync(postId, domain);

  const { to, cc } = computeAddressing(options?.visibility, options?.followersUrl);

  return {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: articleId,
    url: articleId,
    type: "Article",
    attributedTo: actorId,
    name: title,
    summary,
    content: contentHtml,
    tag: hashtags.map((tag) => ({
      type: "Hashtag" as const,
      name: `#${tag}`,
      href: `https://${domain}/search?hashtag=${encodeURIComponent(tag)}`,
    })),
    image: bannerUrl || undefined,
    published: published.toISOString(),
    updated: options?.updated?.toISOString(),
    to,
    cc,
    sensitive: options?.sensitive,
  };
}

function computeAddressing(
  visibility?: "public" | "unlisted" | "private",
  followersUrl?: string
): { to: string[]; cc: string[] } {
  const publicAddress = "https://www.w3.org/ns/activitystreams#Public";
  const followers = followersUrl ? [followersUrl] : [];

  switch (visibility) {
    case "unlisted":
      return { to: followers, cc: [publicAddress] };
    case "private":
      return { to: followers, cc: [] };
    case "public":
    default:
      return { to: [publicAddress], cc: followers };
  }
}

export function createCreateActivity(
  activityId: string,
  actorId: string,
  article: ActivityPubArticle,
  published: Date
): ActivityPubCreate {
  return {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: activityId,
    type: "Create",
    actor: actorId,
    published: published.toISOString(),
    to: article.to || ["https://www.w3.org/ns/activitystreams#Public"],
    cc: article.cc,
    object: article,
  };
}

export function createUpdateActivity(
  activityId: string,
  actorId: string,
  article: ActivityPubArticle,
  published: Date
): ActivityPubUpdate {
  return {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: activityId,
    type: "Update",
    actor: actorId,
    published: published.toISOString(),
    to: article.to || ["https://www.w3.org/ns/activitystreams#Public"],
    cc: article.cc,
    object: article,
  };
}

export function createDeleteActivity(
  activityId: string,
  actorId: string,
  objectId: string,
  followersUrl?: string
): ActivityPubDelete {
  const { to, cc } = computeAddressing("public", followersUrl);
  return {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: activityId,
    type: "Delete",
    actor: actorId,
    to,
    cc,
    object: {
      id: objectId,
      type: "Tombstone",
      formerType: "Article",
    },
  };
}

export function createAcceptActivity(
  activityId: string,
  actorId: string,
  followActivityId: string
): ActivityPubAccept {
  return {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: activityId,
    type: "Accept",
    actor: actorId,
    object: followActivityId,
  };
}

export * from "./signature";
