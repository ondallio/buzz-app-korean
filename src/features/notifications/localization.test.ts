// @vitest-environment jsdom
import { Context } from "@deepseek-ai/cordis";
import {
  en as notificationEnglish,
  ko as notificationKorean,
} from "../../shared/i18n/catalogs/notifications";
import { validateCatalogs } from "../../shared/i18n/messages";
import { PluginRuntime } from "../../plugins/runtime";
import { provideNavigation } from "../navigation/service";
import { NotificationsService, type Notifications } from "./service";
import type { NotificationPresentation } from "./platform";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import {
  messageNotificationText,
  messagePreview,
  plainText,
  pluginNotificationText,
  notificationCategoryLabel,
} from "./content";
import {
  completionBody,
  completionTitle,
  completionToast,
} from "./agent-completions";

afterEach(() => {
  setLanguage("en");
  localStorage.clear();
});

it("localizes complete message titles while keeping sanitized user values and preview markers unchanged", () => {
  const message = {
    channelId: "room",
    messageId: "b".repeat(64),
    authorId: "a".repeat(64),
    createdAt: 1,
    previewContent:
      "User {sender} English 한글 ||secret|| ![private](https://example.org/image)",
  };
  const source = message.previewContent;
  setLanguage("en");
  const english = messageNotificationText(
    message,
    "mention",
    { id: "room", name: "Deploy {name}" },
    { name: "Echo {sender}" },
  );
  expect(english.title).toBe("Echo {sender} mentioned you in #Deploy {name}");
  setLanguage("ko");
  const korean = messageNotificationText(
    message,
    "mention",
    { id: "room", name: "Deploy {name}" },
    { name: "Echo {sender}" },
  );
  expect(korean.title).toBe(
    "Echo {sender}님이 #Deploy {name} 채널에서 나를 언급했습니다",
  );
  expect(korean.body).toBe(english.body);
  expect(korean.body).toBe("User {sender} English 한글 [Spoiler] [Image]");
  expect(message.previewContent).toBe(source);
  expect(messagePreview("")).toBe("New message");
  expect(plainText("||secret|| ![private](https://example.org/image)")).toBe(
    "[Spoiler] [Image]",
  );
  expect(
    messageNotificationText(
      { ...message, previewContent: "" },
      "direct",
      undefined,
      { name: "Echo" },
    ).body,
  ).toBe("새 메시지");
  setLanguage("en");
  expect(
    messageNotificationText(
      message,
      "mention",
      { id: "room", name: "Deploy {name}" },
      { name: "Echo {sender}" },
    ),
  ).toEqual(english);
});

it("uses whole workflow and DM variants without exposing internal DM names or changing plugin text", () => {
  setLanguage("ko");
  const message = {
    channelId: "room",
    messageId: "b".repeat(64),
    authorId: "a".repeat(64),
    workflowOwnerId: "c".repeat(64),
    createdAt: 1,
    previewContent: "Raw English {owner}",
  };
  expect(
    messageNotificationText(
      message,
      "mention",
      { id: "room", channelType: "dm", name: "internal-do-not-display" },
      { name: "Owner {owner}" },
    ),
  ).toEqual({
    title:
      "워크플로 · 소유자 Owner {owner}: 다이렉트 메시지에서 나를 언급했습니다",
    body: "Raw English {owner}",
  });
  const raw = { title: "Plugin {title} 제목", body: "Message {body} 원문" };
  expect(pluginNotificationText(raw, "External category")).toEqual(raw);
  expect(pluginNotificationText({}, "External {category}").body).toBe(
    "새 external {category}",
  );
});

it("translates complete completion variants while retaining user names, diagnostics and event data", () => {
  const done = { state: "done" as const, conversationName: "Launch {agent}" };
  const failed = {
    state: "error" as const,
    error: "Provider raw error: 401 {error}",
    conversationName: "Launch {agent}",
  };
  setLanguage("en");
  expect(completionToast("Echo {name}", done)).toBe(
    "Echo {name} is done in Launch {agent}",
  );
  setLanguage("ko");
  expect(completionTitle("Echo {name}", done)).toBe(
    "Echo {name} 작업이 완료되었습니다",
  );
  expect(completionToast("Echo {name}", done)).toBe(
    "Launch {agent}에서 Echo {name} 작업이 완료되었습니다",
  );
  expect(completionToast("Echo {name}", failed)).toBe(
    "Launch {agent}에서 Echo {name} 오류가 발생했습니다",
  );
  expect(completionBody(failed)).toBe(
    "Launch {agent}에서 보기 · Provider raw error: 401 {error}",
  );
  expect(completionBody({ state: "error", error: "Raw {error}" })).toBe(
    "대화 보기 · Raw {error}",
  );
  expect(failed.error).toBe("Provider raw error: 401 {error}");
  expect(done.conversationName).toBe("Launch {agent}");
  setLanguage("en");
  expect(completionBody(failed)).toBe(
    "View in Launch {agent} · Provider raw error: 401 {error}",
  );
});

it("projects categories only when both the full identity and original label match", () => {
  setLanguage("ko");
  expect(notificationCategoryLabel("mention", "Mentions")).toBe("멘션");
  expect(notificationCategoryLabel("mention", "Customer mentions")).toBe(
    "Customer mentions",
  );
  expect(notificationCategoryLabel("thirdparty/mention", "Mentions")).toBe(
    "Mentions",
  );
  expect(
    notificationCategoryLabel("buzz.reminders/reminders", "Reminders"),
  ).toBe("미리 알림");
  expect(
    notificationCategoryLabel("buzz.reminders/reminders", "Custom {name}"),
  ).toBe("Custom {name}");
  expect(notificationCategoryLabel("thirdparty/reminders", "Reminders")).toBe(
    "Reminders",
  );
});

it("binds current-language default/plugin payloads through the real service without rewriting text, metadata or saved preferences", async () => {
  const ctx = new Context();
  const producers = new Map<string, ReturnType<Notifications["register"]>>();
  const runtime = new PluginRuntime(ctx, async (plugin) => ({
    inject: ["notifications"],
    apply(ctx) {
      producers.set(
        plugin.manifest.id,
        ctx.notifications.register({ id: "reminders", label: "Reminders" }),
      );
    },
  }));
  ctx.effect(() => () => runtime.dispose());
  const show = vi.fn(async (_item: NotificationPresentation) => {});
  const notifications = new NotificationsService(
    ctx,
    provideNavigation(ctx).navigation,
    {
      label: "Fixture",
      permission: async () => "granted",
      requestPermission: async () => "granted",
      show,
      dispose() {},
    },
  );
  notifications.selectViewer("a".repeat(64));
  notifications.updatePreferences({ sound: false });
  const preferences = notifications.snapshot().preferences;
  const saved = localStorage.getItem(
    `buzz-notification-preferences.v1:${"a".repeat(64)}`,
  );
  try {
    await notifications.refreshPermission();
    runtime.reconcile(
      ["buzz.reminders", "thirdparty.reminders"].map((id) => ({
        manifest: { id, name: id, apiVersion: 1 },
        enabled: true,
        source: "external" as const,
        revision: "v1",
        previous: null,
        reloadable: true,
        error: null,
      })),
    );
    await vi.waitFor(() => expect(producers.size).toBe(2));
    const categories = notifications.snapshot().categories;
    const target = {
      version: 1 as const,
      kind: "settings" as const,
      section: "notifications",
    };
    let expected = 0;
    for (const [index, language] of (["en", "ko", "en"] as const).entries()) {
      setLanguage(language);
      expect(
        await notifications.admit(
          "mention",
          "Mentions",
          { sourceKey: `default-${index}`, target },
          () => true,
        ),
      ).toBe(true);
      expected++;
      await vi.waitFor(() => expect(show).toHaveBeenCalledTimes(expected));
      expect(show.mock.calls.at(-1)?.[0]).toMatchObject({
        title: "Buzz",
        body: language === "ko" ? "새 멘션" : "New mentions",
      });
      expect(
        await producers
          .get("buzz.reminders")
          ?.submit({ sourceKey: `known-${index}`, target }),
      ).toBe(true);
      expected++;
      await vi.waitFor(() => expect(show).toHaveBeenCalledTimes(expected));
      expect(show.mock.calls.at(-1)?.[0]).toMatchObject({
        title: "Buzz",
        body: language === "ko" ? "새 미리 알림" : "New reminders",
      });
      expect(
        await producers.get("thirdparty.reminders")?.submit({
          sourceKey: `external-${index}`,
          target,
          title: "Raw {title}",
          body: "User body {body} English 한글",
        }),
      ).toBe(true);
      expected++;
      await vi.waitFor(() => expect(show).toHaveBeenCalledTimes(expected));
      expect(show.mock.calls.at(-1)?.[0]).toMatchObject({
        title: "Raw {title}",
        body: "User body {body} English 한글",
      });
      expect(notifications.snapshot().categories).toBe(categories);
      expect(
        categories.find((item) => item.key === "buzz.reminders/reminders")
          ?.label,
      ).toBe("Reminders");
      expect(notifications.snapshot().preferences).toBe(preferences);
      expect(
        localStorage.getItem(
          `buzz-notification-preferences.v1:${"a".repeat(64)}`,
        ),
      ).toBe(saved);
    }
  } finally {
    await ctx.fiber.dispose();
  }
});

it("validates the actual catalog and preserves authored text that looks like an app fallback", () => {
  expect(validateCatalogs(notificationEnglish, notificationKorean)).toEqual({
    missing: [],
    unexpected: [],
    variables: [],
  });
  setLanguage("ko");
  const message = {
    channelId: "room",
    messageId: "b".repeat(64),
    authorId: "a".repeat(64),
    createdAt: 1,
    previewContent: "New message",
  };
  expect(
    messageNotificationText(message, "direct", undefined, { name: "Agent" }),
  ).toEqual({
    title: "Agent님이 다이렉트 메시지를 보냈습니다",
    body: "New message",
  });
  expect(
    pluginNotificationText(
      { title: "Buzz", body: "New message" },
      "Reminders",
      "buzz.reminders/reminders",
    ),
  ).toEqual({ title: "Buzz", body: "New message" });
});
