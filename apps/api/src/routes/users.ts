import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { UserResponseSchema } from "@xlog/validation";
import { getDb } from "@xlog/db";
import {
  sessionMiddleware,
  requireAuth,
} from "../middleware/session";

export const usersRoutes = new Hono().use("*", sessionMiddleware);

usersRoutes.get(
  "/me",
  describeRoute({
    description: "Get current user",
    tags: ["users"],
    responses: {
      200: {
        description: "Current user",
        content: {
          "application/json": {
            schema: resolver(UserResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
      },
    },
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();

    const dbUser = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", user.id)
      .executeTakeFirst();

    if (!dbUser) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      role: dbUser.role,
      created_at: dbUser.created_at.toISOString(),
    });
  }
);

usersRoutes.patch(
  "/me",
  describeRoute({
    description: "Update current user",
    tags: ["users"],
    responses: {
      200: {
        description: "User updated",
        content: {
          "application/json": {
            schema: resolver(UserResponseSchema),
          },
        },
      },
    },
  }),
  validator("json", UserResponseSchema.partial()),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const data = c.req.valid("json");
    const db = getDb();

    await db
      .updateTable("users")
      .set({
        email: data.email ?? undefined,
        updated_at: new Date(),
      })
      .where("id", "=", user.id)
      .execute();

    const updated = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", user.id)
      .executeTakeFirst();

    return c.json({
      id: updated!.id,
      username: updated!.username,
      email: updated!.email,
      role: updated!.role,
      created_at: updated!.created_at.toISOString(),
    });
  }
);

