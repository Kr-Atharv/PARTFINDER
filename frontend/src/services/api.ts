export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || ''

export type ApiErrorCode =
  | 'NETWORK' // the server could not be reached at all
  | 'ABORTED'
  | 'BAD_RESPONSE'
  | (string & {}) // codes sent by the backend, e.g. TINYFISH_TIMEOUT

/** Every failed backend call surfaces as this, so the UI can explain it consistently. */
export class ApiError extends Error {
  status: number
  code: ApiErrorCode

  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  /** True when the backend itself is unavailable (not when it rejected the request). */
  get isUnavailable(): boolean {
    return this.code === 'NETWORK' || this.status >= 500 || this.status === 0
  }
}

export function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof ApiError && error.code === 'ABORTED')
  )
}

export async function parseErrorResponse(res: Response): Promise<ApiError> {
  let message = `The server responded with status ${res.status}.`
  let code: string = `HTTP_${res.status}`
  try {
    const json = await res.json()
    if (json?.error?.message) message = String(json.error.message)
    if (json?.error?.code) code = String(json.error.code)
  } catch {
    // Non-JSON error body (proxy error page etc.)
  }
  return new ApiError(message, res.status, code)
}

/**
 * Fetches JSON from the backend and returns the `data` payload.
 * Throws ApiError for network failures, non-2xx responses and malformed bodies.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    })
  } catch (error) {
    if (isAbort(error)) throw new ApiError('The request was cancelled.', 0, 'ABORTED')
    throw new ApiError(
      'The PartFinder server could not be reached. Check that the backend is running and your connection is working.',
      0,
      'NETWORK',
    )
  }
  if (!res.ok) throw await parseErrorResponse(res)
  try {
    const json = await res.json()
    return json.data as T
  } catch {
    throw new ApiError('The server sent a response that could not be read.', res.status, 'BAD_RESPONSE')
  }
}

export interface ErrorDescription {
  title: string
  message: string
  /** Whether trying again could plausibly help. */
  retryable: boolean
}

/** Plain-language explanation of an error, including known TinyFish codes. */
export function describeError(error: unknown, fallbackTitle = 'Something went wrong'): ErrorDescription {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'NETWORK':
        return { title: 'Server unreachable', message: error.message, retryable: true }
      case 'TINYFISH_NOT_CONFIGURED':
        return {
          title: 'Live research is not set up',
          message:
            'The backend has no TINYFISH_API_KEY. Add it to backend/.env and restart the server to enable supplier research.',
          retryable: false,
        }
      case 'TINYFISH_TIMEOUT':
        return {
          title: 'The research source timed out',
          message: 'TinyFish did not answer in time. This is usually temporary; try again.',
          retryable: true,
        }
      case 'TINYFISH_RATE_LIMIT':
        return {
          title: 'Research rate limit reached',
          message: 'TinyFish is limiting requests right now. Wait a moment, then try again.',
          retryable: true,
        }
      case 'TINYFISH_API_ERROR':
        return {
          title: 'TinyFish returned an error',
          message: error.message,
          retryable: error.status >= 500,
        }
      case 'VALIDATION_ERROR':
        return {
          title: 'The request was not valid',
          message: error.message,
          retryable: false,
        }
      default:
        return {
          title: error.status >= 500 ? 'The server had a problem' : fallbackTitle,
          message: error.message,
          retryable: error.status >= 500,
        }
    }
  }
  if (error instanceof Error) return { title: fallbackTitle, message: error.message, retryable: true }
  return { title: fallbackTitle, message: 'An unexpected error occurred.', retryable: true }
}
