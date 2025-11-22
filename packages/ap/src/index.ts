import { getEnv } from "@xlog/config";
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

export function getActorUrl(username: string): string {
  const env = getEnv();
  return `https://${env.INSTANCE_DOMAIN}/ap/users/${username}`;
}

export function getInboxUrl(username: string): string {
  return `${getActorUrl(username)}/inbox`;
}

export function getOutboxUrl(username: string): string {
  return `${getActorUrl(username)}/outbox`;
}

export function getFollowersUrl(username: string): string {
  return `${getActorUrl(username)}/followers`;
}

export function getFollowingUrl(username: string): string {
  return `${getActorUrl(username)}/following`;
}

export function getPostUrl(postId: string): string {
  const env = getEnv();
  return `https://${env.INSTANCE_DOMAIN}/post/${postId}`;
}

export function createActorObject(
  username: string,
  name: string,
  summary: string,
  publicKeyPem: string
): ActivityPubActor {
  const env = getEnv();
  const actorId = getActorUrl(username);
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
    inbox: getInboxUrl(username),
    outbox: getOutboxUrl(username),
    followers: getFollowersUrl(username),
    following: getFollowingUrl(username),
    publicKey: {
      id: keyId,
      owner: actorId,
      publicKeyPem,
    },
  };
}

export function createArticleObject(
  postId: string,
  actorId: string,
  title: string,
  contentHtml: string,
  published: Date,
  hashtags: string[],
  summary?: string,
  bannerUrl?: string | null
): ActivityPubArticle {
  const articleId = getPostUrl(postId);

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

