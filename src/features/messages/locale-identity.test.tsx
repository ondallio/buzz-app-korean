// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { Context } from "@deepseek-ai/cordis";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { registerAppShortcuts } from "../../app/shortcuts";
import { setLanguage, t, useLanguage } from "../../shared/i18n";
import { createAppearance } from "../../shared/theme/service";
import type { ChannelMessage } from "../relay/contracts";
import { createShortcutBindings } from "../shortcuts/preferences";
import { ShortcutsService } from "../shortcuts/service";
import { MessageActionBar } from "./MessageActionBar";
import {
  registerMessageList,
  replyTrigger,
  selectMessage,
} from "./message-selection";
import { ReplyBranch } from "./ReplyBranch";

const disposals: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  cleanup();
  for (const dispose of disposals.splice(0)) await dispose();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});

const message: ChannelMessage = {
  id: "raw-message-id",
  channelId: "raw-channel-id",
  authorId: "raw-author-id",
  content: "Raw message {name} 한글",
  createdAt: 1,
  mentions: [],
  attachments: [],
  reactions: [],
  participants: [],
  replyCount: 0,
};

function shortcutsFor(list: HTMLElement) {
  const ctx = new Context();
  ctx.provide("pluginStatus", {
    isActive: () => true,
    subscribe: () => () => {},
  });
  const bindings = createShortcutBindings(window);
  const shortcuts = new ShortcutsService(ctx, window, bindings);
  const appearance = createAppearance(window);
  const remove = registerAppShortcuts(shortcuts, appearance, vi.fn(), true);
  disposals.push(async () => {
    remove();
    appearance.dispose();
    bindings.dispose();
    await ctx.fiber.dispose();
  });
  disposals.push(
    registerMessageList(list, {
      row: (id) => (id === message.id ? message : undefined),
      newest: () => message.id,
      canEdit: () => false,
      edit: vi.fn(),
      canDelete: () => false,
      remove: vi.fn(),
      canMarkUnread: () => false,
      markUnread: vi.fn(),
      composer: () => null,
    }),
  );
}

it("dispatches real t and ArrowRight reply shortcuts to the same raw row through EN/KO/EN", () => {
  const reply = vi.fn();
  render(
    <section data-testid="list">
      <article data-message-id={message.id} data-testid="row">
        <div data-layout="timeline">
          <span>{message.content}</span>
          <MessageActionBar
            onReply={() => reply(message.id)}
            copyText={() => message.content}
          />
        </div>
      </article>
    </section>,
  );
  const row = screen.getByTestId("row"),
    button = screen.getByRole("button", { name: "Reply" });
  shortcutsFor(screen.getByTestId("list"));
  for (const [index, language] of (["en", "ko", "en"] as const).entries()) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("button", {
        name: language === "ko" ? "답글" : "Reply",
      }),
    ).toBe(button);
    expect(replyTrigger(row)).toBe(button);
    for (const key of ["t", "ArrowRight"]) {
      selectMessage(row);
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      document.activeElement?.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(button).toHaveFocus();
    }
    expect(reply).toHaveBeenCalledTimes((index + 1) * 2);
    expect(row).toHaveAttribute("data-message-id", message.id);
    expect(row).toHaveTextContent("Raw message {name} 한글");
  }
  expect(reply.mock.calls).toEqual(
    Array.from({ length: 6 }, () => [message.id]),
  );
});

it("keeps disabled and nearest-row ownership guards instead of selecting a nested reply", () => {
  const own = vi.fn(),
    nested = vi.fn();
  function Rows({ disabled }: { disabled: boolean }) {
    return (
      <article data-message-id="outer" data-testid="outer">
        <div data-testid="own-actions">
          <MessageActionBar
            onReply={own}
            replyDisabled={disabled}
            copyText={() => "Raw outer"}
          />
        </div>
        <article data-message-id="nested" data-testid="nested">
          <MessageActionBar onReply={nested} copyText={() => "Raw nested"} />
        </article>
      </article>
    );
  }
  const view = render(<Rows disabled />);
  const outer = screen.getByTestId("outer"),
    inner = screen.getByTestId("nested"),
    button = within(screen.getByTestId("own-actions")).getByRole("button", {
      name: "Reply",
    });
  act(() => setLanguage("ko"));
  expect(button).toHaveAccessibleName("답글");
  expect(button).toBeDisabled();
  expect(replyTrigger(outer)).toBeUndefined();
  expect(replyTrigger(inner)).toBe(
    within(inner).getByRole("button", { name: "답글" }),
  );
  fireEvent.click(button);
  expect(own).not.toHaveBeenCalled();
  expect(nested).not.toHaveBeenCalled();
  view.rerender(<Rows disabled={false} />);
  expect(replyTrigger(outer)).toBe(button);
  expect(button).not.toBeDisabled();
  fireEvent.click(button);
  expect(own).toHaveBeenCalledExactlyOnceWith();
  expect(nested).not.toHaveBeenCalled();
});

function History({
  shown,
  parent = false,
}: {
  shown: boolean;
  parent?: boolean;
}) {
  useLanguage();
  const branch = shown ? (
    <ReplyBranch
      message={
        <article data-message-id="raw-branch" tabIndex={-1}>
          Raw branch 한글
        </article>
      }
      layout="thread"
      summary="Raw summary"
      label="Expand raw branch"
      collapseLabel="Collapse raw branch"
      hasReplies
      open
      depth={parent ? 1 : 0}
      onExpand={vi.fn()}
      onCollapse={vi.fn()}
    >
      <span>Raw child</span>
    </ReplyBranch>
  ) : null;
  return (
    <>
      <button type="button">Outside history</button>
      <section data-message-scroller aria-label="Other history" tabIndex={-1}>
        <section
          data-message-scroller
          aria-label={t("messages.thread.messages")}
          tabIndex={-1}
        >
          {parent ? (
            <ReplyBranch
              message={
                <article data-message-id="raw-parent" tabIndex={-1}>
                  Raw parent
                </article>
              }
              layout="thread"
              summary="Raw parent summary"
              label="Expand parent"
              collapseLabel="Collapse parent"
              hasReplies
              open
              depth={0}
              onExpand={vi.fn()}
              onCollapse={vi.fn()}
            >
              {branch}
            </ReplyBranch>
          ) : (
            branch
          )}
        </section>
      </section>
    </>
  );
}

it.each(["message", "collapse"] as const)(
  "recovers a removed focused %s to the nearest real thread scroller through EN/KO/EN",
  async (target) => {
    const view = render(<History shown />);
    const history = screen.getByRole("region", { name: "Thread messages" }),
      outer = screen.getByRole("region", { name: "Other history" });
    for (const language of ["en", "ko", "en"] as const) {
      view.rerender(<History shown />);
      const row = within(history).getByText("Raw branch 한글"),
        collapse = within(history).getByRole("button", {
          name: "Collapse raw branch",
        });
      const focused = target === "message" ? row : collapse;
      focused.focus();
      act(() => setLanguage(language));
      expect(
        screen.getByRole("region", {
          name: language === "ko" ? "스레드 메시지" : "Thread messages",
        }),
      ).toBe(history);
      expect(within(history).getByText("Raw branch 한글")).toBe(row);
      expect(focused).toHaveFocus();
      await act(async () => view.rerender(<History shown={false} />));
      expect(history).toHaveFocus();
      expect(outer).not.toHaveFocus();
      expect(history).toHaveAttribute("data-message-scroller");
    }
  },
);

it("does not override focus deliberately moved after a branch disappears", async () => {
  const view = render(<History shown />);
  act(() => setLanguage("ko"));
  screen.getByText("Raw branch 한글").focus();
  view.rerender(<History shown={false} />);
  const outside = screen.getByRole("button", { name: "Outside history" });
  outside.focus();
  await act(async () => {});
  expect(outside).toHaveFocus();
  expect(
    screen.getByRole("region", { name: "스레드 메시지" }),
  ).not.toHaveFocus();
});

it("prefers a surviving ancestor row to thread history when a nested branch disappears", async () => {
  const view = render(<History shown parent />);
  act(() => setLanguage("ko"));
  const parent = screen.getByText("Raw parent");
  screen.getByText("Raw branch 한글").focus();
  await act(async () => view.rerender(<History shown={false} parent />));
  expect(parent).toHaveFocus();
  expect(parent).toHaveAttribute("data-message-id", "raw-parent");
  expect(
    screen.getByRole("region", { name: "스레드 메시지" }),
  ).not.toHaveFocus();
});
