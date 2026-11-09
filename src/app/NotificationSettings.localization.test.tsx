// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { StrictMode, useState } from "react";
import { Context } from "@deepseek-ai/cordis";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ToastProvider } from "../shared/design-system/ui/Toast";
import { setLanguage, useLanguage } from "../shared/i18n";
import {
  en as notificationEnglish,
  ko as notificationKorean,
} from "../shared/i18n/catalogs/notifications";
import { PluginRuntime } from "../plugins/runtime";
import { provideNavigation } from "../features/navigation/service";
import { NotificationsService } from "../features/notifications/service";
import { NotificationSettings } from "./NotificationSettings";

const contexts: Context[] = [];
afterEach(async () => {
  cleanup();
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  setLanguage("en");
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function localizationFixture() {
  const ctx = new Context();
  contexts.push(ctx);
  const runtime = new PluginRuntime(ctx, async (plugin) => ({
    inject: ["notifications"],
    apply(ctx) {
      ctx.notifications.register(
        plugin.manifest.id === "buzz.reminders"
          ? { id: "reminders", label: "Reminders" }
          : { id: "custom", label: "Mentions" },
      );
    },
  }));
  ctx.effect(() => () => runtime.dispose());
  const platform = {
    label: "Browser",
    permission: vi.fn(async (): Promise<NotificationPermission> => "default"),
    requestPermission: vi.fn(
      async (): Promise<NotificationPermission> => "default",
    ),
    show: vi.fn(async () => {}),
    dispose() {},
  };
  const notifications = new NotificationsService(
    ctx,
    provideNavigation(ctx).navigation,
    platform,
  );
  notifications.selectViewer("a".repeat(64));
  return { notifications, platform, runtime };
}

it("changes EN→KO→EN with the same settings nodes, raw contributions, draft and atomic sound value", async () => {
  setLanguage("en");
  const h = localizationFixture();
  h.runtime.reconcile(
    ["buzz.reminders", "thirdparty.alerts"].map((id) => ({
      manifest: { id, name: id, apiVersion: 1 },
      enabled: true,
      source: "external" as const,
      revision: "v1",
      previous: null,
      reloadable: true,
      error: null,
    })),
  );
  await vi.waitFor(() =>
    expect(h.notifications.snapshot().categories).toHaveLength(6),
  );
  const categories = h.notifications.snapshot().categories;
  const write = vi.spyOn(Storage.prototype, "setItem");
  function Owner() {
    useLanguage();
    const [draft, setDraft] = useState("User {name} 한글");
    return (
      <>
        <input
          aria-label="User draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <NotificationSettings notifications={h.notifications} />
      </>
    );
  }
  render(
    <StrictMode>
      <Owner />
    </StrictMode>,
  );
  const user = userEvent.setup();
  const draft = screen.getByRole("textbox", { name: "User draft" });
  await user.type(draft, " edited");
  const sound = screen.getByRole("combobox", { name: "Direct messages" });
  await user.click(sound);
  await user.click(await screen.findByRole("option", { name: "Silent" }));
  const preferences = h.notifications.snapshot().preferences;
  const saved = localStorage.getItem(
    `buzz-notification-preferences.v1:${"a".repeat(64)}`,
  );
  expect(preferences.sounds.direct).toBe("silent");
  expect(
    write.mock.calls.filter(([key]) =>
      key.startsWith("buzz-notification-preferences.v1:"),
    ),
  ).toHaveLength(1);
  sound.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("heading", { name: "알림" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "다이렉트 메시지" })).toBe(sound);
  expect(sound).toHaveTextContent("무음");
  expect(sound).toHaveFocus();
  expect(screen.getByRole("switch", { name: "미리 알림" })).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Mentions" })).toBeInTheDocument();
  expect(draft).toHaveValue("User {name} 한글 edited");
  expect(screen.getByRole("textbox", { name: "User draft" })).toBe(draft);
  await user.click(sound);
  expect(
    await screen.findByRole("option", { name: "unison 권장" }),
  ).toBeVisible();
  await user.keyboard("{Escape}");
  act(() => setLanguage("en"));
  expect(screen.getByRole("combobox", { name: "Direct messages" })).toBe(sound);
  expect(sound).toHaveTextContent("Silent");
  expect(h.notifications.snapshot().preferences).toBe(preferences);
  expect(h.notifications.snapshot().categories).toBe(categories);
  expect(
    localStorage.getItem(`buzz-notification-preferences.v1:${"a".repeat(64)}`),
  ).toBe(saved);
  expect(
    write.mock.calls.filter(([key]) =>
      key.startsWith("buzz-notification-preferences.v1:"),
    ),
  ).toHaveLength(1);
});

it("keeps the existing permission request pending and focused across locale changes", async () => {
  setLanguage("en");
  const h = localizationFixture();
  await h.notifications.refreshPermission();
  let complete!: (permission: NotificationPermission) => void;
  h.platform.permission.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  vi.useFakeTimers();
  render(<NotificationSettings notifications={h.notifications} />);
  const button = screen.getByRole("button", { name: "Check permission" });
  const calls = h.platform.permission.mock.calls.length;
  button.focus();
  fireEvent.click(button);
  try {
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button", { name: "권한 확인" })).toBe(button);
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveFocus();
    expect(h.platform.permission).toHaveBeenCalledTimes(calls + 1);
  } finally {
    await act(async () => complete("granted"));
  }
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(button).not.toHaveAttribute("aria-busy", "true");
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Check permission" })).toBe(button);
  expect(button).toHaveFocus();
});

it("localizes only the proven preference-save failure field while preserving raw state, active intent and one-write retry", async () => {
  setLanguage("en");
  const h = localizationFixture();
  h.notifications.updatePreferences({ enabled: false });
  const originalWrite = Storage.prototype.setItem;
  const writes = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith("buzz-notification-preferences.v1:"))
        throw new Error("denied");
      return originalWrite.call(this, key, value);
    });
  h.notifications.updatePreferences({ enabled: true });
  const preferences = h.notifications.snapshot().preferences;
  expect(h.notifications.snapshot().preferencesError).toBe(
    notificationEnglish["notifications.error.saveDetails"],
  );
  render(<NotificationSettings notifications={h.notifications} />, {
    wrapper: ToastProvider,
  });
  const retry = await screen.findByRole("button", {
    name: "Retry saving choices",
  });
  screen.getByRole("switch", { name: "Desktop alerts" }).focus();
  retry.focus();
  act(() => setLanguage("ko"));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent(
    notificationKorean["notifications.error.saveDetails"],
  );
  expect(screen.getByRole("button", { name: "설정 저장 다시 시도" })).toBe(
    retry,
  );
  expect(retry).toHaveFocus();
  expect(h.notifications.snapshot().preferences).toBe(preferences);
  expect(h.notifications.snapshot().preferencesError).toBe(
    notificationEnglish["notifications.error.saveDetails"],
  );
  expect(
    writes.mock.calls.filter(([key]) =>
      key.startsWith("buzz-notification-preferences.v1:"),
    ),
  ).toHaveLength(1);
  act(() => setLanguage("en"));
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(dialog).toHaveTextContent(
    notificationEnglish["notifications.error.saveDetails"],
  );
  writes.mockRestore();
  const retryWrite = vi.spyOn(Storage.prototype, "setItem");
  fireEvent.click(retry);
  expect(h.notifications.snapshot().preferencesError).toBeNull();
  expect(h.notifications.snapshot().preferences.enabled).toBe(true);
  expect(
    retryWrite.mock.calls.filter(([key]) =>
      key.startsWith("buzz-notification-preferences.v1:"),
    ),
  ).toHaveLength(1);
});

it("localizes the actual restore failure and recovers through Reload without changing stored error text", async () => {
  const originalRead = Storage.prototype.getItem;
  const reads = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(function (this: Storage, key) {
      if (key.startsWith("buzz-notification-preferences.v1:"))
        throw new Error("denied");
      return originalRead.call(this, key);
    });
  const h = localizationFixture();
  setLanguage("ko");
  render(<NotificationSettings notifications={h.notifications} />, {
    wrapper: ToastProvider,
  });
  expect(await screen.findByRole("dialog")).toHaveTextContent(
    notificationKorean["notifications.error.restoreDetails"],
  );
  expect(h.notifications.snapshot().preferences.enabled).toBe(false);
  expect(h.notifications.snapshot().preferencesError).toBe(
    notificationEnglish["notifications.error.restoreDetails"],
  );
  reads.mockRestore();
  fireEvent.click(
    screen.getByRole("button", { name: "저장된 설정 다시 불러오기" }),
  );
  expect(h.notifications.snapshot().preferencesError).toBeNull();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("preserves unknown preference diagnostics and identical native diagnostic wording outside the known field", async () => {
  const h = localizationFixture();
  h.platform.permission.mockRejectedValueOnce(
    new Error(notificationEnglish["notifications.error.restoreDetails"]),
  );
  await h.notifications.refreshPermission();
  setLanguage("ko");
  const view = render(
    <NotificationSettings notifications={h.notifications} />,
    { wrapper: ToastProvider },
  );
  expect(await screen.findByRole("dialog")).toHaveTextContent(
    notificationEnglish["notifications.error.restoreDetails"],
  );
  expect(screen.getByRole("dialog")).not.toHaveTextContent(
    notificationKorean["notifications.error.restoreDetails"],
  );
  view.unmount();
  const unknown = Object.freeze({
    ...h.notifications.snapshot(),
    error: null,
    preferencesError: "Unknown external {details}",
  });
  vi.spyOn(h.notifications, "snapshot").mockReturnValue(unknown);
  render(<NotificationSettings notifications={h.notifications} />, {
    wrapper: ToastProvider,
  });
  expect(await screen.findByRole("dialog")).toHaveTextContent(
    "Unknown external {details}",
  );
});
