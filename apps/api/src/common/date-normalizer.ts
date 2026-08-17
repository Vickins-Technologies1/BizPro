export function toSafeDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

export function toSafeIsoString(value: unknown, fallback = new Date()) {
  return toSafeDate(value, fallback).toISOString();
}

export function toSafeIsoDateString(value: unknown, fallback = new Date()) {
  return toSafeIsoString(value, fallback).slice(0, 10);
}
