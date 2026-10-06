const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bbb_(?:live|test)_[A-Za-z0-9_-]+\b/g, "[REDACTED_BROWSERBASE_KEY]"],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_MODEL_KEY]"],
  [/\b(?:Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED_TOKEN]"],
  [/(?:password|secret|token|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]"],
];

export function redactText(value: string): string {
  return SECRET_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

export function redactValue<T>(value: T): T {
  const json = JSON.stringify(value, (_key, item) => {
    if (typeof item === "string") return redactText(item);
    return item;
  });
  return JSON.parse(json) as T;
}
