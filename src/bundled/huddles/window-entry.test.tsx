// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import type { HuddleView } from "../../features/huddle/window";
import { composerDOMFixture } from "../../features/messages/composer-testing";
import { stubAvatarBrowserApis } from "../../features/agents/avatar-testing";

const native = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
  roots: [] as Root[],
}));
vi.mock("@tauri-apps/api/core", async (original) => ({
  ...(await original<typeof import("@tauri-apps/api/core")>()),
  invoke: native.invoke,
  isTauri: native.isTauri,
  Channel: class {
    onmessage = (_view: HuddleView) => {};
  },
}));
vi.mock("react-dom/client", async (original) => {
  const actual = await original<typeof import("react-dom/client")>();
  return {
    ...actual,
    createRoot: (...args: Parameters<typeof actual.createRoot>) => {
      const root = actual.createRoot(...args);
      native.roots.push(root);
      return root;
    },
  };
});
composerDOMFixture();
stubAvatarBrowserApis();
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);
function held<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
let watch: ReturnType<typeof held<void>>;
let action: ReturnType<typeof held<void>>;
let language: typeof import("../../shared/i18n/language");
const view = (): HuddleView & { discussionOpen: boolean } => ({
  id: "raw-call",
  title: "Raw Huddle 한글",
  phase: "connected",
  muted: false,
  level: 0,
  dark: true,
  participants: [],
  discussionOpen: false,
});
const calls = (command: string) =>
  native.invoke.mock.calls.filter(([name]) => name === command);
function updates() {
  const request = calls("huddle_window_watch")[0];
  if (!request) throw new Error("Missing production watch");
  return request[1].updates as {
    onmessage(next: HuddleView & { discussionOpen: boolean }): void;
  };
}
async function boot() {
  await act(async () => {
    await import("./window-entry");
  });
}
function switchLanguage(next: "en" | "ko") {
  localStorage.setItem(language.localeStorageKey, next);
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: language.localeStorageKey,
        newValue: next,
      }),
    ),
  );
}
beforeEach(async () => {
  vi.resetModules();
  language = await import("../../shared/i18n/language");
  localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  document.documentElement.lang = "en";
  document.documentElement.classList.remove("dark");
  document.title = "Huddle — Buzz";
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  watch = held<void>();
  action = held<void>();
  native.isTauri.mockReturnValue(true);
  native.invoke.mockImplementation((command: string) => {
    if (command === "system_language") return Promise.resolve("en-US");
    if (command === "huddle_window_watch") return watch.promise;
    if (command === "huddle_window_action") return action.promise;
    throw new Error(`Unexpected IPC: ${command}`);
  });
});
afterEach(async () => {
  await act(async () => {
    for (const root of native.roots.splice(0)) root.unmount();
  });
  watch.resolve();
  action.resolve();
  localStorage.clear();
  language.initializeSystemLanguage(null);
  document.body.replaceChildren();
  document.documentElement.classList.remove("dark");
  if (originalScrollIntoView)
    Object.defineProperty(
      Element.prototype,
      "scrollIntoView",
      originalScrollIntoView,
    );
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  native.invoke.mockReset();
});
it("waits for the one OS lookup before mounting once and localizes a retained watch failure", async () => {
  const os = held<string>();
  native.invoke.mockImplementation((command: string) =>
    command === "system_language" ? os.promise : watch.promise,
  );
  await boot();
  expect(calls("system_language")).toEqual([["system_language"]]);
  expect(native.roots).toHaveLength(0);
  expect(calls("huddle_window_watch")).toHaveLength(0);
  await act(async () => os.resolve("ko-KR"));
  expect(native.roots).toHaveLength(1);
  expect(calls("huddle_window_watch")).toHaveLength(1);
  expect(document.documentElement.lang).toBe("ko");
  expect(document.title).toBe("허들 — Buzz");
  await act(async () => watch.reject(new Error("opaque native rejection")));
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(
    "이 허들 창을 사용할 수 없습니다. Buzz에서 다시 열어 주세요.",
  );
  switchLanguage("en");
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent(
    "This Huddle window is unavailable. Reopen it from Buzz.",
  );
  expect(document.title).toBe("Huddle — Buzz");
  switchLanguage("ko");
  expect(screen.getByRole("alert")).toBe(alert);
  expect(document.title).toBe("허들 — Buzz");
  expect(native.invoke.mock.calls.map(([name]) => name)).toEqual([
    "system_language",
    "huddle_window_watch",
  ]);
});
it.each([
  ["en", "ko-KR", true, false, "en"],
  ["ko", "en-US", true, true, "ko"],
  [null, "ko-KR", true, false, "ko"],
  [null, "en-US", true, true, "en"],
  [null, "ko-KR", false, false, "en"],
] as const)(
  "keeps saved %s precedence with OS %s/native %s/failure %s",
  async (saved, os, tauri, fail, expected) => {
    if (saved) localStorage.setItem(language.localeStorageKey, saved);
    native.isTauri.mockReturnValue(tauri);
    native.invoke.mockImplementation((command: string) =>
      command === "system_language"
        ? fail
          ? Promise.reject(new Error("OS unavailable"))
          : Promise.resolve(os)
        : watch.promise,
    );
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await boot();
    expect(native.roots).toHaveLength(1);
    expect(document.documentElement.lang).toBe(expected);
    expect(document.title).toBe(
      expected === "ko" ? "허들 — Buzz" : "Huddle — Buzz",
    );
    expect(calls("system_language")).toHaveLength(tauri ? 1 : 0);
    expect(calls("huddle_window_watch")).toHaveLength(1);
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(language.localeStorageKey)).toBe(saved);
    expect(language.systemLanguageProblem()).toBe(fail && !saved);
  },
);
it("keeps the real detached editor, selection, action payload and discussion merge across languages", async () => {
  const { createRelaySession } = await import("../../features/relay/session");
  const { createHuddleComposerOwner } = await import(
    "../../features/huddle/composer-owner"
  );
  const { writeView, readView } = await import("../../shared/view-state");
  const store = createRelaySession(null),
    viewer = "ab".repeat(32),
    room = "raw-call";
  const scope = `https://example.test:${viewer}`;
  const send = vi.fn(() => "raw-event");
  const session = {
    ...store.session,
    scope,
    viewer,
    channels: {
      ...store.session.channels,
      get: () => ({
        id: room,
        name: "Huddle",
        huddle: true as const,
        parentChannelId: "raw-parent",
        members: [viewer],
      }),
    },
    messages: { ...store.session.messages, send },
  };
  const owner = createHuddleComposerOwner(
    session,
    room,
    "raw-parent",
    undefined,
    () => true,
  );
  const raw = "Raw 한글 draft\nsecond line";
  writeView(scope, `draft:${room}`, { text: raw, recipients: [] });
  const discussion = {
    version: 0,
    historyLimited: false,
    status: "ready" as const,
    writable: true,
    sending: false,
    sent: 0,
    hasMore: false,
    rows: [],
    composer: owner.token,
  };
  try {
    await boot();
    const first = { ...view(), discussionOpen: true, discussion };
    act(() => updates().onmessage(first));
    const editor = await screen.findByRole("textbox", {
      name: "Message this Huddle",
    });
    await waitFor(() => expect(editor.textContent).toBe(raw));
    const mute = screen.getByRole("button", { name: "Mute" });
    editor.focus();
    const text = editor.querySelector("p")?.firstChild;
    if (!text) throw new Error("Missing real editor text");
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 3);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const draft = readView(scope, `draft:${room}`, null);
    for (const next of ["ko", "en"] as const) {
      switchLanguage(next);
      expect(
        screen.getByRole("textbox", {
          name:
            next === "ko" ? "이 허들에 메시지 보내기" : "Message this Huddle",
        }),
      ).toBe(editor);
      expect(editor).toHaveFocus();
      expect(editor.textContent).toBe(raw);
      expect(window.getSelection()?.toString()).toBe("Raw");
      expect(readView(scope, `draft:${room}`, null)).toEqual(draft);
      expect(
        screen.getByRole("button", { name: next === "ko" ? "음소거" : "Mute" }),
      ).toBe(mute);
      expect(document.documentElement.lang).toBe(next);
      expect(document.title).toBe(
        next === "ko" ? "허들 — Buzz" : "Huddle — Buzz",
      );
      expect(
        screen.getByRole("region", {
          name: next === "ko" ? "앱 알림" : "App notifications",
        }),
      ).toBeInTheDocument();
    }
    expect(calls("huddle_window_action")).toHaveLength(0);
    fireEvent.click(mute);
    expect(calls("huddle_window_action")).toEqual([
      ["huddle_window_action", { id: room, action: "mute", text: undefined }],
    ]);
    switchLanguage("ko");
    expect(calls("huddle_window_action")).toHaveLength(1);
    await act(async () => action.reject(new Error("external raw failure")));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "통화를 업데이트하지 못했습니다. Buzz에서 다시 시도해 주세요.",
    );
    switchLanguage("en");
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent(
      "Couldn’t update the call. Try again from Buzz.",
    );
    action = held<void>();
    fireEvent.click(mute);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    act(() => updates().onmessage({ ...view(), discussionOpen: true }));
    expect(screen.getByRole("textbox", { name: "Message this Huddle" })).toBe(
      editor,
    );
    expect(document.documentElement).toHaveClass("dark");
    const rawError = "Couldn’t update the call. Try again from Buzz.";
    act(() => updates().onmessage({ ...view(), error: rawError }));
    switchLanguage("ko");
    expect(screen.getByRole("alert")).toHaveTextContent(rawError);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
    expect(calls("system_language")).toHaveLength(1);
    expect(calls("huddle_window_watch")).toHaveLength(1);
    expect(calls("huddle_window_action")).toHaveLength(2);
  } finally {
    await act(async () => {
      for (const root of native.roots.splice(0)) root.unmount();
    });
    owner.dispose();
    store.dispose();
  }
});
it("ignores late watch updates and rejection after the real root unmounts", async () => {
  await boot();
  const channel = updates();
  await act(async () => {
    for (const root of native.roots.splice(0)) root.unmount();
  });
  await act(async () => {
    channel.onmessage(view());
    watch.reject(new Error("late"));
  });
  expect(document.getElementById("root")).toBeEmptyDOMElement();
  expect(document.documentElement).not.toHaveClass("dark");
  expect(calls("huddle_window_action")).toHaveLength(0);
});

it.each([false, true])(
  "preserves an already requested animated discussion close with a retained owned error; locale switch %s",
  async (changeLanguage) => {
    const originalAnimations = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "getAnimations",
    );
    const animation = held<void>();
    try {
      await boot();
      act(() =>
        updates().onmessage({
          ...view(),
          discussionOpen: true,
          discussion: {
            version: 0,
            historyLimited: false,
            status: "ready",
            writable: false,
            sending: false,
            sent: 0,
            hasMore: false,
            rows: [],
          },
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Mute" }));
      await act(async () => action.reject(new Error("fixture rejection")));
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn’t update the call. Try again from Buzz.",
      );
      action = held<void>();
      Object.defineProperty(Element.prototype, "getAnimations", {
        configurable: true,
        value: () => [{ finished: animation.promise }],
      });
      document.documentElement.removeAttribute("data-keyboard-input");
      const chat = screen.getByRole("button", { name: "Huddle chat" });
      fireEvent.click(chat);
      expect(chat).toHaveAttribute("aria-expanded", "false");
      expect(calls("huddle_window_action")).toHaveLength(1);
      if (changeLanguage) switchLanguage("ko");
      await act(async () => animation.resolve());
      expect(calls("huddle_window_action")).toEqual([
        [
          "huddle_window_action",
          { id: "raw-call", action: "mute", text: undefined },
        ],
        [
          "huddle_window_action",
          { id: "raw-call", action: "thread", text: undefined },
        ],
      ]);
    } finally {
      animation.resolve();
      if (originalAnimations)
        Object.defineProperty(
          Element.prototype,
          "getAnimations",
          originalAnimations,
        );
      else Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  },
);
