import { languagePreference, translate } from "./index";
import type { en } from "./catalogs/navigation";
import type { en as pluginsEn } from "./catalogs/fu-plugins";
import type { Language } from "./language";

type OwnedLabel = readonly [
  source: string,
  key: keyof typeof en | keyof typeof pluginsEn,
];
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
  "buzz.bestie/bestie": ["Bestie", "fuplugins.page.bestie"],
};
const panels: Readonly<Record<string, OwnedLabel>> = {
  "buzz.channels/canvas": ["Canvas", "fuplugins.panel.canvas"],
  "buzz.terminal/terminal": ["Terminal", "fuplugins.panel.terminal"],
  "buzz.changesets/changes": ["Changes", "fuplugins.panel.changes"],
  "block.builderlab/app": ["App", "fuplugins.panel.app"],
  "buzz.file-viewer/file-viewer": ["File viewer", "fuplugins.panel.fileViewer"],
  "buzz.huddles/huddles": ["Huddles", "fuplugins.panel.huddles"],
  "buzz.profiles/profile": ["Profile", "fuplugins.panel.profile"],
};
const agentSettingsTab = ["Settings", "fuplugins.agentTab.settings"] as const;
/** Agent type tabs by `typeKey#tabId`, and added tabs by contribution key. */
const agentTabs: Readonly<Record<string, OwnedLabel>> = {
  "buzz.claude-code/claude-code#settings": agentSettingsTab,
  "buzz.codex/codex#settings": agentSettingsTab,
  "buzz.goose/goose#settings": agentSettingsTab,
  "buzz.pi/pi#settings": agentSettingsTab,
  "block.builderlab/builderlab#settings": agentSettingsTab,
  "buzz.mesh-compute/mesh#prompt": agentSettingsTab,
  "buzz.mesh-compute/mesh#transcript": [
    "Transcripts",
    "fuplugins.agentTab.transcripts",
  ],
  "buzz.bestie/bestie": ["Bestie", "fuplugins.page.bestie"],
  "buzz.bestie/former-bestie": [
    "Former Bestie",
    "fuplugins.agentTab.formerBestie",
  ],
};
const agentTypes: Readonly<Record<string, OwnedLabel>> = {
  "buzz.mesh-compute/mesh": ["Shared Compute", "fuplugins.agentType.mesh"],
  "buzz.mesh-compute/mesh#summary": [
    "Shared compute",
    "fuplugins.agentType.meshSummary",
  ],
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

/** Panel tab and header titles, matched like {@link ownedPageLabel}. */
export function ownedPanelLabel(
  panel: { readonly key: string; readonly title: string },
  language = languagePreference(),
): string {
  return label(panels, panel.key, panel.title, language);
}

/** Agent tab titles: `key` is `typeKey#tabId` for a type's tab, or an added tab's contribution key. */
export function ownedAgentTabLabel(
  key: string,
  title: string,
  language = languagePreference(),
): string {
  return label(agentTabs, key, title, language);
}

/** Bundled agent type title, or with `#summary` its one-line summary. */
export function ownedAgentTypeLabel(
  key: string,
  title: string,
  language = languagePreference(),
): string {
  return label(agentTypes, key, title, language);
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
