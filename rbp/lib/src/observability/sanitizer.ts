const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey)[=:]\s*["']?([a-zA-Z0-9_-]{20,})["']?/gi,
  /(?:secret|token|password|passwd|pwd)[=:]\s*["']?([^\s"']{8,})["']?/gi,
  /(?:bearer|authorization)[=:]\s*["']?([a-zA-Z0-9._-]{20,})["']?/gi,
  /sk-[a-zA-Z0-9]{20,}/gi,
  /ghp_[a-zA-Z0-9]{36}/gi,
  /gho_[a-zA-Z0-9]{36}/gi,
  /github_pat_[a-zA-Z0-9_]{22,}/gi,
  /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/gi,
  /xoxp-[0-9]+-[0-9]+-[0-9]+-[a-f0-9]+/gi,
  /AKIA[0-9A-Z]{16}/g,
  /(?:eyJ[a-zA-Z0-9_-]*\.){2}[a-zA-Z0-9_-]*/g,
];

const REPLACEMENT = "[REDACTED]";

export function sanitize(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, REPLACEMENT);
  }
  return result;
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitize(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? sanitize(item)
          : typeof item === "object" && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
