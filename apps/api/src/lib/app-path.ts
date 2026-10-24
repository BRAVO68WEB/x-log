/** Same-origin path only. Rejects protocol-relative and backslash tricks. */
export function safeAppPath(value: string | undefined | null): string {
  if (!value) return "/";
  const q = value.indexOf("?");
  const path = q === -1 ? value : value.slice(0, q);
  const search = q === -1 ? "" : value.slice(q);
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  if (path.includes("\\") || path.includes("://") || path.includes("\0")) return "/";
  if (search.includes("\\") || search.includes("://") || search.includes("\0")) return path;
  return path + search;
}
