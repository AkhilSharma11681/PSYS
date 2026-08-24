// Lightweight in-memory rate limiter for Next.js Server Actions.
// Same simplicity tier as camera-service's slowapi usage (single-process,
// memory-backed) -- consistent with the spec's explicit decision to avoid
// adding Redis as a second infra dependency (Section 2).
// Guardrail (Section 7, item 1): "bulk student/photo upload endpoints and
// any public-facing API routes get rate limits from day one."

const buckets = new Map<string, { count: number; windowStart: number }>()

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return
  }

  bucket.count++
  if (bucket.count > limit) {
    throw new Error('Too many requests. Please wait a moment and try again.')
  }
}
