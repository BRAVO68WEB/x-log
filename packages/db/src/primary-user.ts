import { getDb } from "./index";

export type PrimaryUser = {
  id: string;
  username: string;
  role: string;
};

/**
 * Resolve the instance primary author (site owner).
 * Order: instance_settings.primary_user_id → oldest admin → oldest user.
 */
export async function getPrimaryUser(): Promise<PrimaryUser | null> {
  const db = getDb();

  try {
    const settings = await db
      .selectFrom("instance_settings")
      .select("primary_user_id")
      .where("id", "=", 1)
      .executeTakeFirst();

    if (settings?.primary_user_id) {
      const user = await db
        .selectFrom("users")
        .select(["id", "username", "role"])
        .where("id", "=", settings.primary_user_id)
        .executeTakeFirst();
      if (user) return user;
    }
  } catch (error) {
    // Column may not exist before migration 026
    const dbError = error as { code?: string };
    if (dbError?.code && dbError.code !== "42703") {
      throw error;
    }
  }

  const admin = await db
    .selectFrom("users")
    .select(["id", "username", "role"])
    .where("role", "=", "admin")
    .orderBy("created_at", "asc")
    .executeTakeFirst();
  if (admin) return admin;

  return (
    (await db
      .selectFrom("users")
      .select(["id", "username", "role"])
      .orderBy("created_at", "asc")
      .executeTakeFirst()) ?? null
  );
}

/**
 * Set primary user; validates the user exists.
 * Clears instance settings cache if available.
 */
export async function setPrimaryUserId(userId: string): Promise<PrimaryUser> {
  const db = getDb();
  const user = await db
    .selectFrom("users")
    .select(["id", "username", "role"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!user) {
    throw new Error("User not found");
  }

  await db
    .updateTable("instance_settings")
    .set({ primary_user_id: userId, updated_at: new Date() })
    .where("id", "=", 1)
    .execute();

  try {
    const { clearInstanceSettingsCache } = await import("./instance-settings");
    clearInstanceSettingsCache();
  } catch {
    /* ignore */
  }

  return user;
}

/** Local author count (for solo vs multi-derived mode). */
export async function countLocalUsers(): Promise<number> {
  const db = getDb();
  const row = await db
    .selectFrom("users")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirst();
  return Number(row?.count || 0);
}

export function deriveInstanceMode(userCount: number): "solo" | "multi" {
  return userCount <= 1 ? "solo" : "multi";
}
