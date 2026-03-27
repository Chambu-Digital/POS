// ─── fecy.co.ke Media Upload Utility ──────────────────────────────────────────

const UPLOAD_URL = process.env.FECY_UPLOAD_URL!
const API_KEY = process.env.FECY_API_KEY!
const BASE_URL = process.env.NEXT_PUBLIC_MEDIA_BASE_URL!

export interface UploadResult {
  /** Relative path to store in DB, e.g. /media/2024/11/filename.jpg */
  path: string
}

/**
 * Upload a file to fecy.co.ke.
 * Returns only the relative path (full URL minus the base) so the DB stays
 * base-URL-agnostic. Reconstruct the full URL with resolveMediaUrl().
 */
export async function uploadMediaFile(file: File): Promise<UploadResult> {
  const fd = new FormData()
  fd.append('media', file)

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: fd,
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `Upload failed (${res.status})`)
  }

  // Strip the base URL to get just the relative path
  // data.url = "https://fecy.co.ke/imgapi/media/2024/11/filename.jpg"
  // BASE_URL  = "https://fecy.co.ke/imgapi"
  // path      = "/media/2024/11/filename.jpg"
  const path = (data.url as string).replace(BASE_URL, '')

  return { path }
}

/**
 * Reconstruct the full URL from a stored relative path.
 * Works on both server and client (NEXT_PUBLIC_ prefix makes it available to both).
 */
export function resolveMediaUrl(path: string): string {
  if (!path) return ''
  // Already a full URL (legacy base64 or old full-URL entries) — return as-is
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? ''
  return `${base}${path}`
}
