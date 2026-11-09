// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { Context } from "@deepseek-ai/cordis";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PluginRuntime } from "../../plugins/runtime";
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import { setLanguage, useLanguage } from "../../shared/i18n";
import { provideNavigation } from "../navigation/service";
import { createLocalAgentActivity } from "../agents/local-activity";
import { NotificationsService } from "./service";
import { AgentCompletionNotifications } from "./AgentCompletionNotifications";

const native = vi.hoisted(() => ({ focus: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  Channel: class {
    onmessage: (value: unknown) => void;
    constructor(onmessage: (value: unknown) => void) {
      this.onmessage = onmessage;
    }
  },
  invoke: native.invoke,
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ isFocused: native.focus }),
}));
const contexts: Context[] = [];
const agent = "f".repeat(64);
beforeEach(() => {
  native.focus.mockResolvedValue(false);
  native.invoke.mockResolvedValue(null);
  setLanguage("en");
});
afterEach(async () => {
  cleanup();
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  setLanguage("en");
  localStorage.clear();
});
function setup(agentName = "Echo {agent}") {
  const ctx = new Context();
  contexts.push(ctx);
  const runtime = new PluginRuntime(ctx, async () => ({ apply() {} }));
  ctx.effect(() => () => runtime.dispose());
  const navigation = { ...provideNavigation(ctx).navigation };
  const notifications = new NotificationsService(
    ctx,
    navigation,
    undefined,
    undefined,
    (target) =>
      "scope" in target &&
      target.scope?.viewer === "a".repeat(64) &&
      target.scope.communityOrigin === "https://buzz.example",
  );
  notifications.selectViewer("a".repeat(64));
  notifications.updatePreferences({ sound: false });
  const activity = createLocalAgentActivity();
  const subscribe = vi.spyOn(activity.reader, "subscribeWork");
  const services = {
    agentActivity: activity.reader,
    agents: {
      local: () => ({
        agents: agentName ? [{ pubkey: agent, name: agentName }] : [],
      }),
    },
    navigation,
    notifications,
  } as unknown as Parameters<
    typeof AgentCompletionNotifications
  >[0]["services"];
  function Owner({
    services,
  }: {
    services: Parameters<typeof AgentCompletionNotifications>[0]["services"];
  }) {
    useLanguage();
    return <AgentCompletionNotifications services={services} />;
  }
  const element = (value = services) => (
    <StrictMode>
      <ToastProvider>
        <Owner services={value} />
      </ToastProvider>
    </StrictMode>
  );
  const view = render(element());
  const begin = (messageId: string) =>
    activity.begin({
      scope: `https://buzz.example:${"a".repeat(64)}`,
      agent: agent,
      channelId: "raw-channel",
      messageId,
      threadRootId: "d".repeat(64),
      thread: true,
      soloChat: true,
      conversationName: "User {conversation}",
    });
  return {
    activity,
    notifications,
    begin,
    subscribe,
    navigation,
    services,
    rerender: (next: typeof services) => view.rerender(element(next)),
  };
}
const sent = () =>
  native.invoke.mock.calls.filter(
    ([command]) => command === "notification_show",
  );

it("retains the pending focus decision across a locale rerender and sends current-language native payload without changing raw values", async () => {
  const h = setup();
  const preferences = h.notifications.snapshot().preferences;
  let finishFocus!: (focused: boolean) => void;
  native.focus.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFocus = resolve;
      }),
  );
  await act(async () => {
    const work = h.begin("b".repeat(64));
    work.started();
    work.finish({ ok: false, error: "Provider 401 {error}" });
  });
  expect(native.focus).toHaveBeenCalledOnce();
  const subscribed = h.subscribe.mock.calls.length;
  try {
    act(() => setLanguage("ko"));
    expect(h.subscribe).toHaveBeenCalledTimes(subscribed);
  } finally {
    await act(async () => finishFocus(false));
  }
  await vi.waitFor(() => expect(sent()).toHaveLength(1));
  const payload = sent()[0]?.[1];
  expect(payload).toMatchObject({
    title: "Echo {agent}에서 오류가 발생했습니다",
    body: "User {conversation}에서 보기 · Provider 401 {error}",
  });
  expect(Object.keys(payload).sort()).toEqual([
    "body",
    "id",
    "onEvent",
    "title",
  ]);
  expect(typeof payload.id).toBe("string");
  const work = h.activity.reader.work()[0];
  expect(work).toMatchObject({
    channelId: "raw-channel",
    messageId: "b".repeat(64),
    threadRootId: "d".repeat(64),
    agent: agent,
    conversationName: "User {conversation}",
    error: "Provider 401 {error}",
    state: "error",
  });
  act(() => setLanguage("en"));
  await act(async () => {
    const next = h.begin("c".repeat(64));
    next.started();
    next.finish({ ok: false, error: "Provider 401 {error}" });
  });
  await vi.waitFor(() => expect(sent()).toHaveLength(2));
  expect(sent()[1]?.[1]).toMatchObject({
    title: "Echo {agent} encountered an error",
    body: "View in User {conversation} · Provider 401 {error}",
  });
  expect(h.notifications.snapshot().preferences).toBe(preferences);
});

it("uses the localized completion fallback/action and preserves the navigation target", async () => {
  const h = setup("");
  let finishFocus!: (focused: boolean) => void;
  native.focus.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFocus = resolve;
      }),
  );
  const open = vi
    .spyOn(h.navigation, "open")
    .mockResolvedValue({ status: "opened" });
  await act(async () => {
    const work = h.begin("b".repeat(64));
    work.started();
    work.finish({ ok: true });
  });
  const subscribed = h.subscribe.mock.calls.length;
  try {
    act(() => setLanguage("ko"));
    expect(h.subscribe).toHaveBeenCalledTimes(subscribed);
  } finally {
    await act(async () => finishFocus(true));
  }
  expect(
    await screen.findByText(
      "User {conversation}에서 에이전트 작업이 완료되었습니다",
    ),
  ).toBeInTheDocument();
  const dialog = screen.getByRole("dialog");
  const action = screen.getByRole("button", { name: "보기" });
  act(() => setLanguage("en"));
  expect(
    screen.getByText("Agent is done in User {conversation}"),
  ).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(screen.getByRole("button", { name: "View" })).toBe(action);
  act(() => setLanguage("ko"));
  expect(
    screen.getByText("User {conversation}에서 에이전트 작업이 완료되었습니다"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "보기" })).toBe(action);
  expect(h.subscribe).toHaveBeenCalledTimes(subscribed);
  fireEvent.click(screen.getByRole("button", { name: "보기" }));
  expect(open).toHaveBeenCalledWith({
    version: 1,
    kind: "conversation",
    scope: { viewer: "a".repeat(64), communityOrigin: "https://buzz.example" },
    channelId: "raw-channel",
    threadRootId: "d".repeat(64),
    messageId: "b".repeat(64),
  });
  expect(sent()).toHaveLength(0);
});

it("cleans up the old services observer and rejects its pending completion before binding replacement services", async () => {
  const h = setup();
  let finishFocus!: (focused: boolean) => void;
  native.focus.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFocus = resolve;
      }),
  );
  await act(async () => {
    const work = h.begin("e".repeat(64));
    work.started();
    work.finish({ ok: true });
  });
  expect(native.focus).toHaveBeenCalledOnce();
  const replacement = createLocalAgentActivity();
  const subscribe = vi.spyOn(replacement.reader, "subscribeWork");
  h.rerender({ ...h.services, agentActivity: replacement.reader });
  expect(subscribe).toHaveBeenCalledOnce();
  await act(async () => finishFocus(false));
  expect(sent()).toHaveLength(0);
  await act(async () => {
    const work = replacement.begin({
      scope: `https://buzz.example:${"a".repeat(64)}`,
      agent: agent,
      channelId: "replacement-channel",
      messageId: "9".repeat(64),
      threadRootId: "9".repeat(64),
      soloChat: true,
    });
    work.started();
    work.finish({ ok: true });
  });
  await vi.waitFor(() => expect(sent()).toHaveLength(1));
  expect(sent()[0]?.[1]).toMatchObject({
    title: "Echo {agent} is done",
    body: "View conversation",
  });
});

it.each([
  ["ko", "en", "Agent is done", "View in User {conversation}"],
  [
    "en",
    "ko",
    "에이전트 작업이 완료되었습니다",
    "User {conversation}에서 보기",
  ],
] as const)(
  "keeps an unnamed queued native notification wholly in %s→%s delivery language",
  async (before, after, title, body) => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const h = setup("");
    act(() => setLanguage(before));
    let finishPermission!: (value: unknown) => void;
    native.invoke.mockImplementation((command: string) =>
      command === "notification_permission_state"
        ? new Promise((resolve) => {
            finishPermission = resolve;
          })
        : Promise.resolve(null),
    );
    await act(async () => {
      const work = h.begin("b".repeat(64));
      work.started();
      work.finish({ ok: true });
    });
    await vi.waitFor(() => expect(finishPermission).toBeTypeOf("function"));
    expect(sent()).toHaveLength(0);
    const subscribed = h.subscribe.mock.calls.length;
    act(() => setLanguage(after));
    await act(async () => finishPermission("granted"));
    await vi.waitFor(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.[1]).toMatchObject({ title, body });
    expect(h.subscribe).toHaveBeenCalledTimes(subscribed);
  },
);
