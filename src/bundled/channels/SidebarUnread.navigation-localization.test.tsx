// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { Context } from "@deepseek-ai/cordis";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRef } from "react";
import userEvent from "@testing-library/user-event";
import { SidebarUnread } from "./SidebarUnread";
import { conversationRows } from "./conversation-rows";
import { apply } from "./index";
import {
  ShortcutsService,
  type Shortcut,
} from "../../features/shortcuts/service";
import { setLanguage } from "../../shared/i18n";
import { SidebarList } from "../../features/channel-navigation/SidebarList";

vi.mock("./canvas-panel", () => ({ registerCanvas: () => {} }));
let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
beforeEach(() => {
  setLanguage("en");
  frames = new Map();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const top = this.tagName === "NAV" ? 100 : Number(this.dataset.top ?? 0);
      const height = this.tagName === "NAV" ? 200 : 20;
      return {
        top,
        bottom: top + height,
        left: 0,
        right: 240,
        width: 240,
        height,
        x: 0,
        y: top,
        toJSON() {},
      };
    },
  );
});

it.each([
  ["above", 60, 1],
  ["above", 60, 2],
  ["below", 340, 1],
  ["below", 340, 2],
] as const)(
  "retains the %s cue with %i geometry and %i raw destinations across locale and Enter reveal",
  async (edge, top, count) => {
    const clicked = vi.fn();
    const ids = Array.from({ length: count }, (_, i) => `raw-${i}`);
    const names = ["Unread", "Starred"];
    try {
      render(
        <SidebarUnread
          dmPreviews={
            new Map(ids.map((id, i) => [id, { name: names[i] ?? "Raw" }]))
          }
        >
          {ids.map((id, i) => (
            <button
              key={id}
              type="button"
              data-channel-id={id}
              data-top={top}
              onClick={() => clicked(id)}
            >
              {names[i]}
              <span data-channel-unread="" />
            </button>
          ))}
        </SidebarUnread>,
      );
      await measure();
      const english = `${count} unread ${count === 1 ? "conversation" : "conversations"} ${edge}`;
      const cue = screen.getByRole("button", { name: english });
      const previewIds = [
        ...cue.querySelectorAll<HTMLElement>("[data-unread-dm]"),
      ].map((node) => node.dataset.unreadDm);
      const nav = screen.getByRole("navigation", {
        name: "Subscribed channels",
      });
      const initialScroll = nav.scrollTop;
      cue.focus();
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("button", {
            name:
              language === "ko"
                ? `${edge === "above" ? "위쪽" : "아래쪽"}에 읽지 않은 대화 ${count}개`
                : english,
          }),
        ).toBe(cue);
        expect(cue).toHaveTextContent(
          language === "ko" ? `읽지 않음 ${count}개` : `${count} unread`,
        );
        expect(cue).toHaveFocus();
        expect(
          [...cue.querySelectorAll<HTMLElement>("[data-unread-dm]")].map(
            (node) => node.dataset.unreadDm,
          ),
        ).toEqual(previewIds);
        expect(nav.scrollTop).toBe(initialScroll);
        expect(conversationRows().map((row) => row.dataset.channelId)).toEqual(
          ids,
        );
        expect(clicked).not.toHaveBeenCalled();
        for (const [index, id] of ids.entries())
          expect(
            nav.querySelector(`[data-channel-id="${id}"]`),
          ).toHaveTextContent(names[index] ?? "Raw");
      }
      await userEvent.keyboard("{Enter}");
      await measure();
      const target = edge === "above" ? ids[count - 1] : ids[0];
      expect(document.activeElement).toBe(
        nav.querySelector(`[data-channel-id="${target}"]`),
      );
      expect(clicked).not.toHaveBeenCalled();
      expect(nav.scrollTop).toBe(top - 100 - 90);
    } finally {
      cleanup();
      frames.clear();
    }
  },
);

it("uses a marked arbitrary-label navigation and ignores an unmarked English-label decoy", () => {
  render(
    <>
      <nav aria-label="Subscribed channels">
        <button type="button" data-channel-id="decoy">
          Decoy
        </button>
      </nav>
      <SidebarList navigation={{ label: "Raw 任意 {name}" }}>
        <button type="button" data-channel-id="raw">
          Raw row
        </button>
      </SidebarList>
    </>,
  );
  const nav = screen.getByRole("navigation", { name: "Raw 任意 {name}" });
  expect(nav).toHaveAttribute("data-conversation-list", "");
  expect(conversationRows().map((row) => row.dataset.channelId)).toEqual([
    "raw",
  ]);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("navigation", { name: "Raw 任意 {name}" })).toBe(nav);
  expect(conversationRows().map((row) => row.dataset.channelId)).toEqual([
    "raw",
  ]);
});

it("keeps zero unread cue roots inert and outside accessible button names", async () => {
  const view = render(
    <SidebarUnread>
      <button type="button" data-channel-id="visible" data-top="150">
        Raw visible
      </button>
    </SidebarUnread>,
  );
  await measure();
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("navigation", { name: "참여 중인 채널" }),
  ).toBeInTheDocument();
  const roots = view.container.querySelectorAll("[data-edge][data-visible]");
  expect(roots).toHaveLength(2);
  for (const root of roots) {
    expect(root).toHaveAttribute("data-visible", "false");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("inert", "");
  }
  expect(
    screen.queryByRole("button", { name: /에 읽지 않은 대화/ }),
  ).not.toBeInTheDocument();
  expect(conversationRows().map((row) => row.dataset.channelId)).toEqual([
    "visible",
  ]);
});
afterEach(() => {
  cleanup();
  frames.clear();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function measure() {
  await act(async () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(0);
  });
}

it("retains the actual nav and production keyboard dispatcher through locale changes without selecting or scrolling on locale", async () => {
  const ctx = new Context();
  ctx.provide("pluginStatus", {
    isActive: () => true,
    subscribe: () => () => {},
  });
  const shortcuts = new ShortcutsService(ctx, window);
  const clicked = vi.fn();
  const list = createRef<HTMLElement>();
  try {
    apply({
      shortcuts: {
        register: (shortcut: Shortcut) => shortcuts.registerHost(shortcut),
      },
      conversation: {
        registerCompletion() {},
        registerTabs() {},
        registerMessageAction() {},
      },
      settingsCards: { register() {} },
      pages: { register() {} },
      navigation: {},
      relay: {},
      panels: {},
      agents: {},
      adminAccess: { membership: undefined },
      communityReader: {},
    } as unknown as Parameters<typeof apply>[0]);
    render(
      <SidebarUnread listRef={list}>
        <input aria-label="Raw draft" defaultValue="한글 {draft}" />
        <div className="xterm">
          <textarea aria-label="Raw terminal" defaultValue="echo unchanged" />
        </div>
        <button
          type="button"
          data-channel-id="raw-a"
          data-top="150"
          aria-current="page"
        >
          Raw A
        </button>
        <button
          type="button"
          data-channel-id="raw-b"
          data-top="340"
          onClick={() => clicked("raw-b")}
        >
          Starred
          <span data-channel-unread="" />
        </button>
      </SidebarUnread>,
    );
    await measure();
    const nav = screen.getByRole("navigation", { name: "Subscribed channels" });
    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Raw draft",
    });
    expect(list.current).toBe(nav);
    expect(conversationRows().map((row) => row.dataset.channelId)).toEqual([
      "raw-a",
      "raw-b",
    ]);
    input.focus();
    input.setSelectionRange(1, 4);
    fireEvent.keyDown(input, { key: "ArrowDown", altKey: true });
    expect(clicked.mock.calls).toEqual([["raw-b"]]);
    expect(nav.scrollTop).toBe(60);
    for (const [index, language] of (["ko", "en"] as const).entries()) {
      const scroll = nav.scrollTop;
      act(() => setLanguage(language));
      expect(
        screen.getByRole("navigation", {
          name: language === "ko" ? "참여 중인 채널" : "Subscribed channels",
        }),
      ).toBe(nav);
      expect(list.current).toBe(nav);
      expect(conversationRows().map((row) => row.dataset.channelId)).toEqual([
        "raw-a",
        "raw-b",
      ]);
      expect(nav.scrollTop).toBe(scroll);
      expect(clicked).toHaveBeenCalledTimes(index + 1);
      expect(input).toHaveFocus();
      expect(input).toHaveValue("한글 {draft}");
      expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
      fireEvent.keyDown(input, {
        key: "ArrowDown",
        altKey: true,
        shiftKey: true,
      });
      expect(clicked).toHaveBeenCalledTimes(index + 2);
      expect(clicked.mock.calls[index + 1]).toEqual(["raw-b"]);
      expect(nav.scrollTop).toBe(scroll + 60);
    }
    const terminal = screen.getByRole("textbox", { name: "Raw terminal" });
    terminal.focus();
    const beforeTerminal = nav.scrollTop;
    expect(
      fireEvent.keyDown(terminal, { key: "ArrowDown", altKey: true }),
    ).toBe(true);
    expect(clicked.mock.calls).toEqual([["raw-b"], ["raw-b"], ["raw-b"]]);
    expect(nav.scrollTop).toBe(beforeTerminal);
    expect(terminal).toHaveFocus();
    expect(terminal).toHaveValue("echo unchanged");
  } finally {
    cleanup();
    await ctx.fiber.dispose();
    frames.clear();
  }
});
