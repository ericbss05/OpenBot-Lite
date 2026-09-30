/**
 * Version allégée de server/src/agents/endpoint.ts — refuse SSRF évident.
 */

const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
]);

export function checkAgentEndpoint(
  raw: string,
  allowPrivateHosts: boolean,
): { allowed: true; url: string } | { allowed: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { allowed: false, reason: "URL invalide." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { allowed: false, reason: "Seuls http et https sont acceptés." };
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    return { allowed: false, reason: "Hôte interdit." };
  }
  const isPrivateHost =
    host === "localhost" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    host.startsWith("[::1]");
  if (isPrivateHost && !allowPrivateHosts) {
    return { allowed: false, reason: "Hôte privé refusé (ALLOW_PRIVATE_HOSTS=false)." };
  }
  return { allowed: true, url: url.toString() };
}
