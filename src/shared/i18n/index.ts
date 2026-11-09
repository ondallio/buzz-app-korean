import { en as adminStaffEn, ko as adminStaffKo } from "./catalogs/admin-staff";
import { en as huddleMainEn, ko as huddleMainKo } from "./catalogs/huddle-main";
import { en as huddleCallEn, ko as huddleCallKo } from "./catalogs/huddle-call";
import {
  en as huddleDiscussionEn,
  ko as huddleDiscussionKo,
} from "./catalogs/huddle-discussion";
import {
  en as huddleCompanionEn,
  ko as huddleCompanionKo,
} from "./catalogs/huddle-companion";
import {
  en as githubSettingsEn,
  ko as githubSettingsKo,
} from "./catalogs/github-settings";
import {
  en as directMessageEn,
  ko as directMessageKo,
} from "./catalogs/direct-message";
import { en as agentScopeEn, ko as agentScopeKo } from "./catalogs/agent-scope";
import {
  en as relayErrorsEn,
  ko as relayErrorsKo,
} from "./catalogs/relay-errors";
import {
  en as agentMemoryEn,
  ko as agentMemoryKo,
} from "./catalogs/agent-memory";
import {
  en as communityAdminEn,
  ko as communityAdminKo,
} from "./catalogs/community-admin";
import {
  en as statusFocusEn,
  ko as statusFocusKo,
} from "./catalogs/status-focus";
import {
  en as workflowFormEn,
  ko as workflowFormKo,
} from "./catalogs/workflow-form";
import {
  en as typesafeSettingsEn,
  ko as typesafeSettingsKo,
} from "./catalogs/typesafe-settings";
import {
  en as terminalSettingsEn,
  ko as terminalSettingsKo,
} from "./catalogs/terminal-settings";
import {
  en as mentionPickerEn,
  ko as mentionPickerKo,
} from "./catalogs/mention-picker";
import {
  en as workflowFieldsEn,
  ko as workflowFieldsKo,
} from "./catalogs/workflow-fields";
import {
  en as agentsErrorsEn,
  ko as agentsErrorsKo,
} from "./catalogs/agents-errors";
import {
  en as resourcePickerEn,
  ko as resourcePickerKo,
} from "./catalogs/resource-picker";
import {
  en as agentsDetailsEn,
  ko as agentsDetailsKo,
} from "./catalogs/agents-details";
import {
  en as workflowsListEn,
  ko as workflowsListKo,
} from "./catalogs/workflows-list";
import {
  en as repositoryPageEn,
  ko as repositoryPageKo,
} from "./catalogs/repository-page";
import {
  en as agentsBrowseEn,
  ko as agentsBrowseKo,
} from "./catalogs/agents-browse";
import {
  en as completionDisplayEn,
  ko as completionDisplayKo,
} from "./catalogs/completion-display";
import { en as inboxEn, ko as inboxKo } from "./catalogs/inbox";
import {
  en as channelPagesEn,
  ko as channelPagesKo,
} from "./catalogs/channel-pages";
import {
  en as customEmojiEn,
  ko as customEmojiKo,
} from "./catalogs/custom-emoji";
import {
  en as emojiPickerEn,
  ko as emojiPickerKo,
} from "./catalogs/emoji-picker";
import { en as coreEn, ko as coreKo } from "./catalogs/core";
import { en as appEn, ko as appKo } from "./catalogs/app";
import { en as shellEn, ko as shellKo } from "./catalogs/shell";
import { en as identityEn, ko as identityKo } from "./catalogs/identity";
import { en as appearanceEn, ko as appearanceKo } from "./catalogs/appearance";
import { en as navigationEn, ko as navigationKo } from "./catalogs/navigation";
import { en as searchEn, ko as searchKo } from "./catalogs/search";
import { en as settingsEn, ko as settingsKo } from "./catalogs/settings";
import {
  en as channelMenusEn,
  ko as channelMenusKo,
} from "./catalogs/channels-menus";
import { en as messagesEn, ko as messagesKo } from "./catalogs/messages";
import {
  en as notificationsEn,
  ko as notificationsKo,
} from "./catalogs/notifications";
import {
  en as identityMoreEn,
  ko as identityMoreKo,
} from "./catalogs/identity-more";
import {
  en as messageNoticesEn,
  ko as messageNoticesKo,
} from "./catalogs/message-notices";
import {
  en as profileEditingEn,
  ko as profileEditingKo,
} from "./catalogs/profile-editing";
import { en as sharedUiEn, ko as sharedUiKo } from "./catalogs/shared-ui";
import {
  en as pluginRequestsEn,
  ko as pluginRequestsKo,
} from "./catalogs/plugin-requests";
import {
  en as pluginManagementEn,
  ko as pluginManagementKo,
} from "./catalogs/plugin-management";
import {
  en as channelFormsEn,
  ko as channelFormsKo,
} from "./catalogs/channel-forms";
import {
  en as mediaViewingEn,
  ko as mediaViewingKo,
} from "./catalogs/media-viewing";
import {
  en as accessDialogsEn,
  ko as accessDialogsKo,
} from "./catalogs/access-dialogs";
import {
  en as messageActionsEn,
  ko as messageActionsKo,
} from "./catalogs/message-actions";
import {
  en as settingsHostEn,
  ko as settingsHostKo,
} from "./catalogs/settings-host";
import { languagePreference, type Language } from "./language";
import { formatMessage } from "./messages";

export {
  formattingLocale,
  useLanguage,
  languagePreference,
  setLanguage,
} from "./language";
export const english = {
  ...coreEn,
  ...appEn,
  ...shellEn,
  ...identityEn,
  ...appearanceEn,
  ...navigationEn,
  ...identityMoreEn,
  ...searchEn,
  ...notificationsEn,
  ...messagesEn,
  ...settingsEn,
  ...settingsHostEn,
  ...messageActionsEn,
  ...accessDialogsEn,
  ...mediaViewingEn,
  ...channelFormsEn,
  ...sharedUiEn,
  ...emojiPickerEn,
  ...customEmojiEn,
  ...resourcePickerEn,
  ...agentsErrorsEn,
  ...workflowFieldsEn,
  ...workflowFormEn,
  ...mentionPickerEn,
  ...terminalSettingsEn,
  ...typesafeSettingsEn,
  ...adminStaffEn,
  ...huddleMainEn,
  ...huddleCallEn,
  ...huddleDiscussionEn,
  ...huddleCompanionEn,
  ...githubSettingsEn,
  ...directMessageEn,
  ...agentScopeEn,
  ...relayErrorsEn,
  ...agentMemoryEn,
  ...communityAdminEn,
  ...statusFocusEn,
  ...agentsDetailsEn,
  ...workflowsListEn,
  ...repositoryPageEn,
  ...agentsBrowseEn,
  ...completionDisplayEn,
  ...inboxEn,
  ...channelPagesEn,
  ...pluginRequestsEn,
  ...pluginManagementEn,
  ...profileEditingEn,
  ...messageNoticesEn,
  ...channelMenusEn,
} as const;
export const korean: Partial<Record<keyof typeof english, string>> = {
  ...coreKo,
  ...appKo,
  ...shellKo,
  ...identityKo,
  ...appearanceKo,
  ...navigationKo,
  ...identityMoreKo,
  ...searchKo,
  ...notificationsKo,
  ...messagesKo,
  ...settingsKo,
  ...settingsHostKo,
  ...messageActionsKo,
  ...accessDialogsKo,
  ...mediaViewingKo,
  ...channelFormsKo,
  ...sharedUiKo,
  ...emojiPickerKo,
  ...customEmojiKo,
  ...resourcePickerKo,
  ...agentsErrorsKo,
  ...workflowFieldsKo,
  ...workflowFormKo,
  ...mentionPickerKo,
  ...terminalSettingsKo,
  ...typesafeSettingsKo,
  ...adminStaffKo,
  ...huddleMainKo,
  ...huddleCallKo,
  ...huddleDiscussionKo,
  ...huddleCompanionKo,
  ...githubSettingsKo,
  ...directMessageKo,
  ...agentScopeKo,
  ...relayErrorsKo,
  ...agentMemoryKo,
  ...communityAdminKo,
  ...statusFocusKo,
  ...agentsDetailsKo,
  ...workflowsListKo,
  ...repositoryPageKo,
  ...agentsBrowseKo,
  ...completionDisplayKo,
  ...inboxKo,
  ...channelPagesKo,
  ...pluginRequestsKo,
  ...pluginManagementKo,
  ...profileEditingKo,
  ...messageNoticesKo,
  ...channelMenusKo,
};
export type TranslationKey = keyof typeof english;
type Variables<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Variables<Rest>
    : never;
export type TranslationArguments<
  K extends TranslationKey,
  V = string | number,
> = [Variables<(typeof english)[K]>] extends [never]
  ? [values?: Record<string, never>]
  : [values: Record<Variables<(typeof english)[K]>, V>];
const missing = new Set<TranslationKey>();

/** Missing Korean entries stay inspectable and are never counted as translated. */
export function missingTranslations(): readonly TranslationKey[] {
  return [...missing].sort();
}

/** Resolves one complete template and records Korean fallback use. */
export function messageTemplate<K extends TranslationKey>(
  key: K,
  language = languagePreference(),
): string {
  const source = english[key];
  if (source === undefined) throw new Error(`Unknown translation key: ${key}`);
  const translated = korean[key];
  if (language === "ko" && !translated?.trim()) missing.add(key);
  return language === "ko" && translated?.trim() ? translated : source;
}

/** Translates a complete app-owned message with compile-time checked parameters. */
export function t<K extends TranslationKey>(
  key: K,
  ...args: TranslationArguments<K>
): string {
  return translate(languagePreference(), key, ...args);
}

/** Explicit-language display projection, for memoized frozen contributions. */
export function translate<K extends TranslationKey>(
  language: Language,
  key: K,
  ...args: TranslationArguments<K>
): string {
  return formatMessage(messageTemplate(key, language), args[0] ?? {}, language);
}
