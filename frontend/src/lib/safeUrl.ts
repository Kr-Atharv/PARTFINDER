/**
 * Returns the URL only when it is a well-formed http(s) address. Anything else
 * (javascript:, data:, malformed strings, empty values) returns undefined so it
 * is never rendered as a link. Used for every external source link.
 */
export function safeExternalUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/** Short display form of a URL (no protocol). */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '')
}
