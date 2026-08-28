const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Normalize an Idempotency-Key header. Invalid or missing keys are ignored so
 * legacy clients keep working; checkout always sends a session-stable UUID.
 */
export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (!IDEMPOTENCY_KEY_RE.test(key)) return null;
  return key;
}

export function isUniqueViolation(err: unknown, constraintName: string): boolean {
  const walk = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== "object" || depth > 4) return false;
    const record = value as { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };
    if (record.code === "23505") {
      const constraint = typeof record.constraint === "string" ? record.constraint : "";
      const message = typeof record.message === "string" ? record.message : "";
      if (!constraint && !message) return true;
      return constraint.includes(constraintName) || message.includes(constraintName);
    }
    if (typeof record.constraint === "string" && record.constraint.includes(constraintName)) return true;
    if (typeof record.message === "string" && record.message.includes(constraintName) && /duplicate|unique/i.test(record.message)) {
      return true;
    }
    return walk(record.cause, depth + 1);
  };
  return walk(err);
}
