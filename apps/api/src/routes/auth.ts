import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { LoginSchema, UserResponseSchema } from "@xlog/validation";
import { getDb } from "@xlog/db";
import bcrypt from "bcryptjs";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  sessionMiddleware,
} from "../middleware/session";

export const authRoutes = new Hono().use("*", sessionMiddleware);

authRoutes.post(
  "/login",
  describeRoute({
    description: "Login with username and password",
    tags: ["auth"],
    responses: {
      200: {
        description: "Login successful",
        content: {
          "application/json": {
            schema: resolver(UserResponseSchema),
          },
        },
      },
      401: {
        description: "Invalid credentials",
      },
    },
  }),
  validator("json", LoginSchema),
  async (c) => {
    const { username, password } = c.req.valid("json");
    const db = getDb();

    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("username", "=", username)
      .executeTakeFirst();

    if (!user || !user.password_hash) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const sessionToken = await createSession(user.id);
    setSessionCookie(c, sessionToken);

    return c.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at.toISOString(),
    });
  }
);

authRoutes.post(
  "/logout",
  describeRoute({
    description: "Logout current user",
    tags: ["auth"],
    responses: {
      200: {
        description: "Logout successful",
      },
    },
  }),
  async (c) => {
    clearSessionCookie(c);
    return c.json({ message: "Logged out" });
  }
);

