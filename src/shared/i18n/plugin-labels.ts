import {
  english,
  languagePreference,
  messageTemplate,
  type TranslationKey,
} from "./index";
import type { Language } from "./language";

type PluginLabelSource = {
  readonly manifest: {
    readonly id: string;
    readonly name: string;
    readonly description?: string | undefined;
  };
  readonly source?: "bundled" | "external" | undefined;
};

function owned(
  plugin: PluginLabelSource,
  field: "name" | "description",
  language: Language,
): string | undefined {
  const text = plugin.manifest[field];
  if (text === undefined || plugin.source === "external") return text;
  const key = `fuplugins.${field}.${plugin.manifest.id}`;
  return Object.hasOwn(english, key) && english[key as TranslationKey] === text
    ? messageTemplate(key as TranslationKey, language)
    : text;
}

/** Display name of a bundled plugin; installed plugins and changed manifests keep their own text. */
export function pluginName(
  plugin: PluginLabelSource,
  language = languagePreference(),
): string {
  return owned(plugin, "name", language) ?? plugin.manifest.name;
}

/** Display description of a bundled plugin, under the same rules as {@link pluginName}. */
export function pluginDescription(
  plugin: PluginLabelSource,
  language = languagePreference(),
): string | undefined {
  return owned(plugin, "description", language);
}

/** A plugin's general-access subject noun; common English nouns read in the app language. */
export function pluginSubjectLabel(
  subject: string,
  language = languagePreference(),
): string {
  const key = `fuplugins.subject.${subject.trim().toLowerCase()}`;
  return language === "ko" && Object.hasOwn(english, key)
    ? messageTemplate(key as TranslationKey, language)
    : subject;
}
