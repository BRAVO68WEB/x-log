import { Hono } from "hono";
import { z } from "zod";
import { describeRoute, validator } from "hono-openapi";
import { getInviteByToken, inviteStatus, acceptInvite } from "../lib/invites";
import { createSession, setSessionCookie } from "../middleware/session";
import { checkRateLimit, clientKeyFromRequest } from "../lib/rate-limit";

// Public invite accept routes (no admin)
export const invitesRoutes = new Hono();

invitesRoutes.get(
  "/:token",
  describeRoute({
    description: "Validate an invite token (public)",
    tags: ["invites"],
    responses: {
      200: { description: "Invite valid" },
      404: { description: "Invalid token" },
      410: { description: "Expired, revoked, or already accepted" },
    },
  }),
  async (c) => {
  const token = c.req.param("token");
  const invite = await getInviteByToken(token);
  if (!invite) {
    return c.json({ error: "Invalid invite", status: "invalid" }, 404);
  }
  const status = inviteStatus(invite);
  if (status !== "valid") {
    return c.json({ error: `Invite is ${status}`, status }, 410);
  }
  return c.json({
    status: "valid",
    email: invite.email,
    role: invite.role,
    expires_at: new Date(invite.expires_at).toISOString(),
  });
  }
);

const AcceptSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
  full_name: z.string().max(120).optional().nullable(),
});

invitesRoutes.post(
  "/:token/accept",
  describeRoute({
    description: "Accept invite and create author account (public, rate-limited)",
    tags: ["invites"],
    responses: {
      201: { description: "Account created; session cookie set" },
      400: { description: "Validation error" },
      410: { description: "Invite unusable" },
      429: { description: "Rate limited" },
    },
  }),
  validator("json", AcceptSchema),
  async (c) => {
  const ip = clientKeyFromRequest(c);
  const rl = checkRateLimit(`invite-accept:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return c.json(
      { error: `Too many attempts. Retry in ${rl.retryAfterSec}s` },
      429
    );
  }

  const token = c.req.param("token");
  const body = c.req.valid("json");

  try {
    const user = await acceptInvite({
      token,
      username: body.username,
      password: body.password,
      fullName: body.full_name,
    });

    const sessionToken = await createSession(user.id);
    setSessionCookie(c, sessionToken);

    return c.json(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        actor_url: user.actor_url,
        message: "Invite accepted",
      },
      201
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to accept invite";
    const status =
      msg.includes("taken") || msg.includes("Username")
        ? 400
        : msg.includes("limit")
          ? 403
          : msg.includes("Invalid") || msg.includes("expired") || msg.includes("revoked") || msg.includes("accepted")
            ? 410
            : 400;
    return c.json({ error: msg }, status);
  }
  }
);
