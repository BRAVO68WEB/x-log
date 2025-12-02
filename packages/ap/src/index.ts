import { getEnv } from "@xlog/config";
import { getInstanceSettings } from "@xlog/db";
import type { Database } from "@xlog/db";

export interface ActivityPubActor {
  "@context": string[];
  id: string;
  type: "Person";
  preferredUsername: string;
  name: string;
  summary: string;
  inbox: string;
  outbox: string;
  followers: string;
  following: string;
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
  tag?: Array<{ type: "Hashtag"; name: string }>;
  image?: string;
  published: string;
}

export interface ActivityPubCreate {
  "@context": string[];
  id: string;
  type: "Create";
  actor: string;
  published: string;
  to: string[];
  object: ActivityPubArticle;
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

export async function createActorObject(
  username: string,
  name: string,
  summary: string,
  publicKeyPem: string
): Promise<ActivityPubActor> {
  const settings = await getInstanceSettings();
  const actorId = await getActorUrl(username);
  const keyId = `${actorId}#main-key`;

  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
    ],
    id: actorId,
    type: "Person",
    preferredUsername: username,
    name,
    summary,
    inbox: await getInboxUrl(username),
    outbox: await getOutboxUrl(username),
    followers: await getFollowersUrl(username),
    following: await getFollowingUrl(username),
    publicKey: {
      id: keyId,
      owner: actorId,
      publicKeyPem,
    },
  };
}

export function createActorObjectSync(
  username: string,
  name: string,
  summary: string,
  publicKeyPem: string,
  domain: string
): ActivityPubActor {
  const actorId = getActorUrlSync(username, domain);
  const keyId = `${actorId}#main-key`;

  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
    ],
    id: actorId,
    type: "Person",
    preferredUsername: username,
    name,
    summary,
    inbox: getInboxUrlSync(username, domain),
    outbox: getOutboxUrlSync(username, domain),
    followers: getFollowersUrlSync(username, domain),
    following: getFollowingUrlSync(username, domain),
    publicKey: {
      id: keyId,
      owner: actorId,
      publicKeyPem,
    },
  };
}

export async function createArticleObject(
  postId: string,
  actorId: string,
  title: string,
  contentHtml: string,
  published: Date,
  hashtags: string[],
  summary?: string,
  bannerUrl?: string | null
): Promise<ActivityPubArticle> {
  const articleId = await getPostUrl(postId);

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
    })),
    image: bannerUrl || undefined,
    published: published.toISOString(),
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
  bannerUrl?: string | null
): ActivityPubArticle {
  const articleId = getPostUrlSync(postId, domain);

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
    })),
    image: bannerUrl || undefined,
    published: published.toISOString(),
  };
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
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    object: article,
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

