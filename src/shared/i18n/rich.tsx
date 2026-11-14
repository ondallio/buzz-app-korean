import { Fragment, type ReactNode } from "react";
import {
  messageTemplate,
  type TranslationArguments,
  type TranslationKey,
} from "./index";
import { formattingLocale } from "./language";
import { messageVariables } from "./messages";

/** Keeps inline code and links in one translated sentence, without HTML parsing. */
export function rich<K extends TranslationKey>(
  key: K,
  ...args: TranslationArguments<K, Exclude<ReactNode, undefined>>
): ReactNode {
  const template = messageTemplate(key);
  const values: Readonly<Record<string, ReactNode>> = args[0] ?? {};
  if (
    JSON.stringify(messageVariables(template)) !==
    JSON.stringify(Object.keys(values).sort())
  )
    throw new Error(`Rich translation parameters do not match ${key}`);
  const occurrences = new Map<string, number>();
  return template.split(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g).map((part, index) => {
    if (index % 2 === 0) return part;
    const value = values[part];
    if (value === undefined)
      throw new Error(`Missing rich translation parameter: ${part}`);
    const occurrence = (occurrences.get(part) ?? 0) + 1;
    occurrences.set(part, occurrence);
    return (
      <Fragment key={`${part}-${occurrence}`}>
        {typeof value === "number"
          ? new Intl.NumberFormat(formattingLocale()).format(value)
          : value}
      </Fragment>
    );
  });
}
