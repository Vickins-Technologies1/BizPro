export function redactSensitiveText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/(authorization|proxy-authorization)(\s*[:=]\s*)[^\r\n,;]+/gi, "$1$2[redacted]")
    .replace(/(password|token|secret|api[_ -]?key|mpesa[_ -]?(?:consumer|passkey)|client[_ -]?secret)(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1$2[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .slice(0, maxLength);
}
