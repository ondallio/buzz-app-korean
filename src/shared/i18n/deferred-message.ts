import {
  english,
  messageTemplate,
  type TranslationArguments,
  type TranslationKey,
} from "./index";
import { languagePreference } from "./language";
import { formatMessage } from "./messages";

/** Ephemeral app-owned feedback. Never persist this as user or protocol data. */
export type LocalMessage = Readonly<{
  kind: "localized-message";
  key: TranslationKey;
  values: Readonly<Record<string, string | number>>;
}>;
/** External diagnostics stay literal; only explicitly constructed messages translate. */
export type DisplayMessage = string | LocalMessage;

/** Captures one whole-message key and a stable snapshot of its parameters. */
export function localMessage<K extends TranslationKey>(
  key: K,
  ...args: TranslationArguments<K>
): LocalMessage {
  return Object.freeze({
    kind: "localized-message",
    key,
    values: Object.freeze({ ...args[0] }),
  });
}

class LocalMessageError extends Error {
  readonly #display: LocalMessage;
  constructor(display: LocalMessage) {
    const source = english[display.key];
    if (source === undefined)
      throw new Error(`Unknown translation key: ${display.key}`);
    const rawValues = Object.fromEntries(
      Object.entries(display.values).map(([name, value]) => [
        name,
        String(value),
      ]),
    );
    super(formatMessage(source, rawValues, "en"));
    this.#display = display;
  }
  get display(): LocalMessage {
    return this.#display;
  }
}

/** Keeps canonical English diagnostics while attaching app-owned display provenance. */
export function localError<K extends TranslationKey>(
  key: K,
  ...args: TranslationArguments<K>
): Error {
  return new LocalMessageError(localMessage(key, ...args));
}

/** Only this module's own error class carries translations; external diagnostics stay raw. */
export function errorMessage(reason: unknown): DisplayMessage {
  if (reason instanceof LocalMessageError) return reason.display;
  return reason instanceof Error ? reason.message : String(reason);
}

/** Resolves app feedback at render time without guessing from arbitrary English. */
export function resolveMessage(value: DisplayMessage): string;
export function resolveMessage(
  value: DisplayMessage | undefined,
): string | undefined;
export function resolveMessage(value: DisplayMessage | null): string | null;
export function resolveMessage(
  value: DisplayMessage | null | undefined,
): string | null | undefined;
export function resolveMessage(
  value: DisplayMessage | null | undefined,
): string | null | undefined {
  if (value == null || typeof value === "string") return value;
  return formatMessage(
    messageTemplate(value.key),
    value.values,
    languagePreference(),
  );
}
