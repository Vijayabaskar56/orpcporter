/**
 * SSRF protection: validates URLs against private IP ranges.
 * RFC 1918 ranges are blocked by default. Localhost (127.x) is ALLOWED.
 * Use --allow-private flag to bypass all checks.
 */

/**
 * Check if a hostname is a private IP address (RFC 1918 ranges only).
 * Localhost (127.x.x.x) is explicitly ALLOWED — only blocks:
 * - 10.0.0.0/8
 * - 172.16.0.0/12 (172.16-31.x.x)
 * - 192.168.0.0/16
 *
 * Returns false for hostnames (non-IP strings) — only checks literal IPv4 addresses.
 */
export function isPrivateIP(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;

  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return false;

  const [a, b] = nums as [number, number, number, number];

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12 (172.16-31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  return false;
}

/**
 * Validate a URL is safe to fetch (not targeting private networks).
 * Throws if the URL hostname is a private IP.
 * Silently returns for non-URL strings (file paths) or when allowPrivate is true.
 */
export function validateUrlSafety(url: string, allowPrivate: boolean): void {
  if (allowPrivate) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not a valid URL (could be a file path) — skip validation
    return;
  }

  if (isPrivateIP(parsed.hostname)) {
    throw new Error(
      `Blocked: ${parsed.hostname} is a private IP address. Use --allow-private to override.`
    );
  }
}

/**
 * Validate OpenAPI spec server URLs don't point to private networks.
 * Throws if any server URL hostname is a private IP.
 * Skips relative URLs (no hostname to check) and when allowPrivate is true.
 */
export function validateServerUrls(
  servers: Array<{ url: string }> | undefined,
  allowPrivate: boolean
): void {
  if (allowPrivate || !servers) return;

  for (const server of servers) {
    let parsed: URL;
    try {
      parsed = new URL(server.url);
    } catch {
      // Relative URL or invalid — skip validation
      continue;
    }

    if (isPrivateIP(parsed.hostname)) {
      throw new Error(
        `Blocked: Server URL "${server.url}" points to private IP ${parsed.hostname}. Use --allow-private to override.`
      );
    }
  }
}
