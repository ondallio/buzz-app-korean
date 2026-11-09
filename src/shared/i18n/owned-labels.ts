import { languagePreference, translate } from "./index";
import type { en } from "./catalogs/navigation";
import type { Language } from "./language";

type OwnedLabel = readonly [source: string, key: keyof typeof en];
const pages: Readonly<Record<string, OwnedLabel>> = {
  "buzz.channels/channels": ["Channels", "navigation.messages"],
  "buzz.inbox/inbox": ["Activity", "navigation.activity"],
  "buzz.drafts-and-sent/drafts-sent": [
    "Drafts & sent",
    "navigation.draftsSent",
  ],
  "buzz.reminders/reminders": ["Reminders", "navigation.reminders"],
  "buzz.agents/agents": ["Agents", "navigation.agents"],
  "buzz.workflows/workflows": ["Workflows", "navigation.workflows"],
  "buzz.relay-notes/notes": ["Shared notes", "navigation.sharedNotes"],
  "buzz.repos/repos": ["Repository", "navigation.repository"],
};
const settings: Readonly<Record<string, OwnedLabel>> = {
  profile: ["Profile", "navigation.profile"],
  appearance: ["Appearance", "navigation.appearance"],
  notifications: ["Notifications", "navigation.notifications"],
  shortcuts: ["Shortcuts", "navigation.shortcuts"],
  agents: ["Agent setup", "navigation.agentSetup"],
  decisions: ["Decisions API", "navigation.decisions"],
  updates: ["Software updates", "navigation.updates"],
  plugins: ["Manage plugins", "navigation.managePlugins"],
  developer: ["Developer", "navigation.developer"],
  "leave-community": ["Leave or remove", "navigation.leaveCommunity"],
  identity: ["Identity", "navigation.identity"],
  security: ["Security", "navigation.security"],
  "local-settings": ["Local settings", "navigation.localSettings"],
  "buzz.pairing/mobile": ["Pair mobile", "navigation.pairMobile"],
  "buzz.emoji/custom-emoji": ["Custom emoji", "navigation.customEmoji"],
  "buzz.channels/templates": ["Channel templates", "navigation.templates"],
  "buzz.agents/external-apps": ["External apps", "navigation.externalApps"],
  "buzz.moderation/membership": ["Membership", "navigation.membership"],
  "buzz.mesh-compute/mesh": ["Shared compute", "navigation.sharedCompute"],
  "buzz.terminal/settings": ["Terminal", "navigation.terminal"],
  "buzz.focus/focus": ["Focus", "navigation.focus"],
  "buzz.usage/usage": ["Usage", "navigation.usage"],
  "buzz.relay-staff/reports": ["Reports", "navigation.reports"],
  "buzz.relay-staff/feedback": ["Feedback", "navigation.feedback"],
  "buzz.relay-staff/communities": ["Communities", "navigation.communities"],
  "buzz.relay-staff/staff": ["Staff", "navigation.staff"],
};
const groups: Readonly<Record<string, OwnedLabel>> = {
  community: ["Community", "navigation.community"],
  personal: ["Personal space", "navigation.personal"],
  administration: ["Community admin", "navigation.communityAdmin"],
  plugins: ["Plugins", "navigation.plugins"],
};

function label(
  table: Readonly<Record<string, OwnedLabel>>,
  id: string,
  source: string,
  language: Language,
): string {
  const owned = Object.hasOwn(table, id) ? table[id] : undefined;
  return owned?.[0] === source ? translate(language, owned[1]) : source;
}

/** Localizes only an exact bundled contribution identity and its original title. */
export function ownedPageLabel(
  key: string,
  title: string,
  language = languagePreference(),
): string {
  return label(pages, key, title, language);
}

/** Projects navigation labels without mutating cards or their registration data. */
export function ownedSettingsLabel(
  key: string,
  title: string,
  language: Language,
): string {
  return label(settings, key, title, language);
}

/** Host group IDs are separate from arbitrary contributed group names. */
export function ownedSettingsGroupLabel(
  id: string,
  title: string,
  sections: readonly { id: string; label: string }[],
  language: Language,
): string {
  if (
    id === "group:Moderation" &&
    title === "Moderation" &&
    sections.length > 0 &&
    sections.every(
      (section) =>
        section.id.startsWith("buzz.relay-staff/") &&
        settings[section.id]?.[0] === section.label,
    )
  )
    return translate(language, "navigation.moderation");
  return label(groups, id, title, language);
}
