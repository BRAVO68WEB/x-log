import { Hono } from "hono";
import { authRoutes } from "./auth";
import { onboardingRoutes } from "./onboarding";
import { usersRoutes } from "./users";
import { profilesRoutes } from "./profiles";
import { postsRoutes } from "./posts";
import { feedsRoutes } from "./feeds";
import { searchRoutes } from "./search";
import { mediaRoutes } from "./media";
import { settingsRoutes } from "./settings";
import { mcpRoutes } from "./mcp";
import { adminRoutes } from "./admin";

export const apiRoutes = new Hono()
  .route("/auth", authRoutes)
  .route("/onboarding", onboardingRoutes)
  .route("/users", usersRoutes)
  .route("/profiles", profilesRoutes)
  .route("/posts", postsRoutes)
  .route("/feeds", feedsRoutes)
  .route("/search", searchRoutes)
  .route("/media", mediaRoutes)
  .route("/settings", settingsRoutes)
  .route("/mcp", mcpRoutes);

export const adminApiRoutes = new Hono().route("/admin", adminRoutes);
