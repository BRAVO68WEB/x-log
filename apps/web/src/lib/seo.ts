export function getOriginFromHeaders(headers: Headers): string {
  const host = headers.get("host") || "localhost:4000";
  const proto = headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export function getDomainFromOrigin(origin: string): string {
  return new URL(origin).host;
}

export function absoluteUrl(value: string | null | undefined, origin: string): string | undefined {
  if (!value) return undefined;

  try {
    return new URL(value, origin).toString();
  } catch {
    return undefined;
  }
}

export function getActorUrl(username: string, domain: string): string {
  return `https://${domain}/ap/users/${username}`;
}

export function getFediverseHandle(username: string, domain: string): string {
  return `@${username}@${domain}`;
}
