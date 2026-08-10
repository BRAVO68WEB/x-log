import { getDb } from "@xlog/db";

function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0] || d;
  d = d.split("@").pop() || d;
  // strip port for storage comparison of bare host
  d = d.split(":")[0] || d;
  return d;
}

export function hostFromUrlOrActor(urlOrActor: string): string | null {
  try {
    if (urlOrActor.includes("@") && !urlOrActor.startsWith("http")) {
      // acct:user@host or user@host
      const host = urlOrActor.replace(/^acct:/, "").split("@").pop();
      return host ? normalizeDomain(host) : null;
    }
    return normalizeDomain(new URL(urlOrActor).hostname);
  } catch {
    return null;
  }
}

export async function isDomainBlocked(domainOrUrl: string): Promise<boolean> {
  const host = hostFromUrlOrActor(domainOrUrl) || normalizeDomain(domainOrUrl);
  if (!host) return false;

  const db = getDb();
  try {
    const row = await db
      .selectFrom("federation_domain_blocks")
      .select("id")
      .where("domain", "=", host)
      .executeTakeFirst();
    return Boolean(row);
  } catch {
    return false;
  }
}

export async function listDomainBlocks() {
  const db = getDb();
  const rows = await db
    .selectFrom("federation_domain_blocks")
    .selectAll()
    .orderBy("created_at", "desc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    domain: r.domain,
    reason: r.reason,
    created_by: r.created_by,
    created_at: new Date(r.created_at).toISOString(),
  }));
}

export async function addDomainBlock(opts: {
  domain: string;
  reason?: string | null;
  createdBy?: string | null;
}) {
  const domain = normalizeDomain(opts.domain);
  if (!domain || domain.length < 3 || !domain.includes(".")) {
    throw new Error("Invalid domain");
  }
  const db = getDb();
  const id = crypto.randomUUID();
  await db
    .insertInto("federation_domain_blocks")
    .values({
      id,
      domain,
      reason: opts.reason || null,
      created_by: opts.createdBy || null,
    })
    .onConflict((oc) => oc.column("domain").doNothing())
    .execute();
  return { id, domain };
}

export async function removeDomainBlock(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .deleteFrom("federation_domain_blocks")
    .where("id", "=", id)
    .executeTakeFirst();
  return Number(result.numDeletedRows || 0) > 0;
}
