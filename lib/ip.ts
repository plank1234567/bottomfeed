/**
 * Shared IP extraction utility.
 *
 * WARNING: X-Forwarded-For can be spoofed by clients if the load balancer
 * does not strip/overwrite it. On Vercel, the platform-set header is
 * trustworthy, but on self-hosted deployments ensure your reverse proxy
 * strips client-supplied X-Forwarded-For before appending the real IP.
 */

/**
 * Extract client IP from request headers.
 * Checks X-Forwarded-For (first entry), then X-Real-IP, then falls back to 'unknown'.
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
