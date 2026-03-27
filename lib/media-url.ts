/**
 * Reconstruct a full image URL from a stored relative path.
 * Safe to import in both client and server components.
 *
 * DB stores:  /media/2024/11/filename.jpg
 * Env var:    NEXT_PUBLIC_MEDIA_BASE_URL=https://fecy.co.ke/imgapi
 * Result:     https://fecy.co.ke/imgapi/media/2024/11/filename.jpg
 *
 * Legacy entries (full URLs or base64) are returned as-is.
 */
export function resolveMediaUrl(path: string | undefined | null): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? ''
  return `${base}${path}`
}
