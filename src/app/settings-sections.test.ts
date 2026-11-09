// @vitest-environment jsdom
import { isTauri } from "@tauri-apps/api/core";
import { afterEach, expect, it, vi } from "vitest";
import type { SettingsCard } from "../features/settings/service";
import type { Contribution } from "../plugins/contributions";
import {
  developerMode,
  isBuiltInSettingsSection,
  settingsSections,
} from "./settings-sections";

const card = (
  key: string,
  extra: Partial<SettingsCard> = {},
): Contribution<SettingsCard> => {
  const [pluginId = "", id = ""] = key.split("/");
  return {
    id,
    key,
    pluginId,
    revision: "one",
    title: key,
    component: () => null,
    ...extra,
  };
};
const cards = [
  // Plugin activation/re-enable order must not determine community navigation.
  card("buzz.pairing/mobile", { personal: true }),
  card("buzz.emoji/custom-emoji"),
  card("buzz.channels/templates", { group: "App" }),
  card("example/groups"),
  card("other/groups"),
  card("example/membership", { section: "administration" }),
  card("example/hosted", { group: "Communities" }),
  card("block.builderlab/login", {
    group: "Plugins",
    title: "Builderlab",
  }),
];
vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn(() => false) }));

const primary = { id: "primary", name: "Primary" };
const app = [
  "identity",
  "appearance",
  "notifications",
  "shortcuts",
  "agents",
  "decisions",
  "buzz.channels/templates",
  "updates",
  ...(developerMode ? ["developer"] : []),
];
const plugins = ["plugins", "block.builderlab/login"];
const outline = (model: ReturnType<typeof settingsSections>) =>
  model.groups.map((group) => [
    group.id,
    group.label,
    group.sections.map((section) => section.id),
  ]);

it.each([
  [
    "a selected community",
    primary,
    "profile",
    [
      [
        "community",
        "Community",
        [
          "profile",
          "local-settings",
          "buzz.emoji/custom-emoji",
          "example/groups",
          "other/groups",
          "buzz.pairing/mobile",
          "leave-community",
        ],
      ],
      ["administration", "Community admin", ["example/membership"]],
      ["app", "Buzz", app],
      ["plugins", "Plugins", plugins],
      ["group:Communities", "Communities", ["example/hosted"]],
    ],
  ],
  [
    "Personal",
    undefined,
    "appearance",
    [
      ["personal", "Personal space", ["profile", "buzz.pairing/mobile"]],
      ["app", "Buzz", app],
      ["plugins", "Plugins", plugins],
      ["group:Communities", "Communities", ["example/hosted"]],
    ],
  ],
])(
  "orders Settings groups and defaults for %s",
  (_, community, initial, groups) => {
    const model = settingsSections(cards, community);
    expect(outline(model)).toEqual(groups);
    expect(model.defaultSection).toBe(initial);
    expect(model.sections.map((section) => section.id)).toEqual(
      groups.flatMap(([, , ids]) => ids),
    );
  },
);

it("classifies built-in sections apart from plugin card keys", () => {
  for (const id of [
    "profile",
    "identity",
    "local-settings",
    "plugins",
    "leave-community",
    ...app.filter((id) => id !== "buzz.channels/templates"),
  ])
    expect(isBuiltInSettingsSection(id)).toBe(true);
  expect(isBuiltInSettingsSection("developer")).toBe(developerMode);
  for (const id of [
    "example/groups",
    "buzz.channels/templates",
    "Profile",
    "",
    "administration",
  ])
    expect(isBuiltInSettingsSection(id)).toBe(false);
});

it("keeps Local settings after Profile under the host’s Community heading", () => {
  const model = settingsSections(cards, {
    name: "Saved",
    publishedName: "Published",
    localName: "Local label",
  });
  expect(model.groups[0]?.label).toBe("Community");
  expect(
    model.groups[0]?.sections.slice(0, 2).map((section) => section.id),
  ).toEqual(["profile", "local-settings"]);
});

it("lists Security after Identity only in the desktop app", () => {
  const ids = () =>
    settingsSections([], undefined)
      .groups.find((group) => group.id === "app")
      ?.sections.map((section) => section.id)
      .slice(0, 2);
  expect(ids()).toEqual(["identity", "appearance"]);
  vi.mocked(isTauri).mockReturnValue(true);
  expect(ids()).toEqual(["identity", "security"]);
  vi.mocked(isTauri).mockReturnValue(false);
});

import { setLanguage } from "../shared/i18n";
afterEach(() => setLanguage("en"));
it("translates exact bundled navigation metadata after canonical ordering while preserving contribution names and IDs", () => {
  const official = Object.freeze(
    card("buzz.pairing/mobile", { title: "Pair mobile" }),
  );
  const custom = Object.freeze(
    card("buzz.emoji/custom-emoji", { title: "My emoji" }),
  );
  const foreign = Object.freeze(
    card("example/mobile", { title: "Pair mobile", group: "Community" }),
  );
  const input = Object.freeze([official, custom, foreign]);
  const english = settingsSections(input, primary);
  setLanguage("ko");
  const korean = settingsSections(input, primary);
  expect(korean.groups[0]?.label).toBe("커뮤니티");
  expect(
    korean.sections.find((section) => section.id === "profile")?.label,
  ).toBe("프로필");
  expect(
    korean.sections.find((section) => section.id === official.key)?.label,
  ).toBe("모바일 기기 연결");
  expect(
    korean.sections.find((section) => section.id === custom.key)?.label,
  ).toBe("My emoji");
  expect(
    korean.sections.find((section) => section.id === foreign.key)?.label,
  ).toBe("Pair mobile");
  expect(
    korean.groups.find((group) => group.id === "group:Community")?.label,
  ).toBe("Community");
  expect(korean.sections.map((section) => section.id)).toEqual(
    english.sections.map((section) => section.id),
  );
  expect(input[0]).toBe(official);
  expect(official.title).toBe("Pair mobile");
  setLanguage("en");
  expect(settingsSections(input, primary)).toEqual(english);
});

it("projects every bundled settings navigation title without changing original plugin ordering, sections or group identities", () => {
  const titles = [
    ["buzz.pairing/mobile", "Pair mobile", "모바일 기기 연결"],
    ["buzz.emoji/custom-emoji", "Custom emoji", "사용자 지정 이모지"],
    ["buzz.channels/templates", "Channel templates", "채널 템플릿"],
    ["buzz.agents/external-apps", "External apps", "외부 앱"],
    ["buzz.moderation/membership", "Membership", "멤버 관리"],
    ["buzz.mesh-compute/mesh", "Shared compute", "공유 컴퓨팅"],
    ["buzz.terminal/settings", "Terminal", "터미널"],
    ["buzz.focus/focus", "Focus", "집중 모드"],
    ["buzz.usage/usage", "Usage", "사용량"],
    ["buzz.relay-staff/reports", "Reports", "신고"],
    ["buzz.relay-staff/feedback", "Feedback", "피드백"],
    ["buzz.relay-staff/communities", "Communities", "커뮤니티 목록"],
    ["buzz.relay-staff/staff", "Staff", "운영진"],
  ] as const;
  const input = Object.freeze(
    titles.map(([key, title]) =>
      Object.freeze(
        card(key, {
          title,
          ...(key.startsWith("buzz.relay-staff/")
            ? { group: "Moderation" }
            : key.startsWith("buzz.terminal/") ||
                key.startsWith("buzz.focus/") ||
                key.startsWith("buzz.usage/")
              ? { group: "Plugins" }
              : {}),
        }),
      ),
    ),
  );
  const english = settingsSections(input, primary);
  setLanguage("ko");
  const korean = settingsSections(input, primary);
  for (const [key, , label] of titles)
    expect(korean.sections.find((section) => section.id === key)?.label).toBe(
      label,
    );
  expect(
    korean.groups.find((group) => group.id === "group:Moderation")?.label,
  ).toBe("관리");
  expect(korean.groups.map((group) => group.id)).toEqual(
    english.groups.map((group) => group.id),
  );
  expect(korean.sections.map((section) => section.id)).toEqual(
    english.sections.map((section) => section.id),
  );
  const foreign = card("example/reports", {
    title: "Reports",
    group: "Moderation",
  });
  expect(
    settingsSections([foreign], primary).groups.find(
      (group) => group.id === "group:Moderation",
    )?.label,
  ).toBe("Moderation");
  expect(
    settingsSections([...input, foreign], primary).groups.find(
      (group) => group.id === "group:Moderation",
    )?.label,
  ).toBe("Moderation");
  setLanguage("en");
  expect(settingsSections(input, primary)).toEqual(english);
});
