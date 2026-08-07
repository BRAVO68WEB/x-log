import { Hono } from "hono";
import { authRoutes } from "./auth";
import { passwordResetRoutes } from "./password-reset";
import { onboardingRoutes } from "./onboarding";
import { usersRoutes } from "./users";
import { profilesRoutes } from "./profiles";
import { postsRoutes } from "./posts";
import { postMetaRoutes } from "./post-meta";
import { bookmarksRoutes } from "./bookmarks";
import { snippetsRoutes } from "./snippets";
import { linksRoutes } from "./links";
import { aiRoutes } from "./ai";
import { repostsRoutes } from "./reposts";
import { threadsRoutes } from "./threads";
import { feedsRoutes } from "./feeds";
import { searchRoutes } from "./search";
import { mediaRoutes } from "./media";
import { settingsRoutes } from "./settings";
import { adminRoutes } from "./admin";
import { mastodonRoutes } from "./mastodon";
import { publicRoutes } from "./public";
import { feedRoutes } from "./feed";

export const apiRoutes = new Hono()
  .route("/auth", authRoutes)
  .route("/auth", passwordResetRoutes)
  .route("/onboarding", onboardingRoutes)
  .route("/users", usersRoutes)
  .route("/profiles", profilesRoutes)
  .route("/posts", postsRoutes)
  .route("/posts", postMetaRoutes)
  .route("/posts", repostsRoutes)
  .route("/bookmarks", bookmarksRoutes)
  .route("/snippets", snippetsRoutes)
  .route("/links", linksRoutes)
  .route("/ai", aiRoutes)
  .route("/threads", threadsRoutes)
  .route("/feeds", feedsRoutes)
  .route("/feed", feedRoutes)
  .route("/search", searchRoutes)
  .route("/media", mediaRoutes)
  .route("/public", publicRoutes)
  .route("/settings", settingsRoutes)
  .route("/v1", mastodonRoutes);

export const adminApiRoutes = new Hono().route("/admin", adminRoutes);
