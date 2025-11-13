type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { constructor?: unknown }).constructor === Object
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, val]) => [key, val] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
      .join(",")}}`;
  }
  if (typeof value === "string") {
    return JSON.stringify(value.trim().toLowerCase());
  }
  return JSON.stringify(value);
}

function normalizeString(value: string): string {
  return value.trim();
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const normalizedItems = value.map((item) => sanitizeValue(item));
    const seen = new Set<string>();
    const result: unknown[] = [];
    for (const item of normalizedItems) {
      const key =
        typeof item === "string"
          ? normalizeString(item).toLowerCase()
          : stableStringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(
          typeof item === "string" ? normalizeString(item) : item ?? null
        );
      }
    }
    return result;
  }
  if (isPlainObject(value)) {
    const out: PlainObject = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = sanitizeValue(val);
    }
    return out;
  }
  if (typeof value === "string") {
    return normalizeString(value);
  }
  return value;
}

export function sanitizeStructuredValue<T>(value: T): T {
  return sanitizeValue(value) as T;
}

export function mergeStructuredValues(
  target: unknown,
  source: unknown
): unknown {
  if (Array.isArray(target) && Array.isArray(source)) {
    return sanitizeValue([...target, ...source]);
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const result: PlainObject = {};
    const keys = new Set([
      ...Object.keys(target as PlainObject),
      ...Object.keys(source as PlainObject),
    ]);
    for (const key of keys) {
      const hasTarget = Object.prototype.hasOwnProperty.call(target, key);
      const hasSource = Object.prototype.hasOwnProperty.call(source, key);
      if (hasTarget && hasSource) {
        result[key] = mergeStructuredValues(
          (target as PlainObject)[key],
          (source as PlainObject)[key]
        );
      } else if (hasTarget) {
        result[key] = sanitizeValue((target as PlainObject)[key]);
      } else if (hasSource) {
        result[key] = sanitizeValue((source as PlainObject)[key]);
      }
    }
    return result;
  }
  if (source !== undefined) {
    return sanitizeValue(source);
  }
  return sanitizeValue(target);
}

export function sanitizeStructuredObject(
  value: Record<string, unknown> | undefined | null
): Record<string, unknown> {
  const sanitized = sanitizeStructuredValue(value ?? {});
  return isPlainObject(sanitized) ? sanitized : {};
}
