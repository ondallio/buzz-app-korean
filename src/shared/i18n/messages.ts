import type { Language } from "./language";

/** Names in a whole message. Values are substituted once, never parsed as templates. */
export function messageVariables(message: string): string[] {
  return [
    ...new Set(
      [...message.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].flatMap((match) =>
        match[1] ? [match[1]] : [],
      ),
    ),
  ].sort();
}

/** Exact key and parameter checks, including untranslated English fallbacks. */
export function validateCatalogs(
  english: Readonly<Record<string, string>>,
  korean: Readonly<Record<string, string>>,
) {
  return {
    missing: Object.keys(english).filter((key) => !korean[key]?.trim()),
    unexpected: Object.keys(korean).filter(
      (key) => !Object.hasOwn(english, key),
    ),
    variables: Object.keys(english).filter(
      (key) =>
        Object.hasOwn(korean, key) &&
        JSON.stringify(messageVariables(english[key] ?? "")) !==
          JSON.stringify(messageVariables(korean[key] ?? "")),
    ),
  };
}

/** Renders a complete sentence; mismatched caller parameters are programming errors. */
export function formatMessage(
  message: string,
  values: Readonly<Record<string, string | number>>,
  language: Language,
): string {
  const expected = messageVariables(message);
  const supplied = Object.keys(values).sort();
  if (JSON.stringify(expected) !== JSON.stringify(supplied))
    throw new Error(
      `Translation parameters: expected ${expected.join(", ") || "none"}; received ${supplied.join(", ") || "none"}`,
    );
  return message.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined)
      throw new Error(`Missing translation parameter: ${name}`);
    return typeof value === "number"
      ? new Intl.NumberFormat(language === "ko" ? "ko-KR" : "en-US").format(
          value,
        )
      : value;
  });
}
