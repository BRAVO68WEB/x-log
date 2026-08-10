import { Hono } from "hono";
import { z } from "zod";
import { validator } from "hono-openapi";
import { getInviteByToken, inviteStatus, acceptInvite } from "../lib/invites";
import { createSession, setSessionCookie } from "../middleware/session";

// Public invite accept routes (no admin)
export const invitesRoutes = new Hono();

invitesRoutes.get("/:token", async (c) => {
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
});

const AcceptSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
  full_name: z.string().max(120).optional().nullable(),
});

invitesRoutes.post("/:token/accept", validator("json", AcceptSchema), async (c) => {
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
});
