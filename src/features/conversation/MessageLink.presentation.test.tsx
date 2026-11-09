import { useContext, useEffect } from "react";
import { languagePreference, setLanguage } from "../../shared/i18n/language";
import { LinkPreviewContext, type LinkPreview } from "./LinkLabelContext";
import type { Contribution } from "../../plugins/contributions";
import type { LinkRenderer } from "./contracts";
// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { PREVIEW_REST_MS } from "../../shared/design-system/ui/hoverIntent";
import { afterEach, expect, it, vi } from "vitest";
import { MessageLink } from "./MessageLink";
import { ConversationPresentation } from "./ConversationPresentation";
import type { RelaySession } from "../relay/session";
import type { ThreadSnapshot } from "../relay/threads";

afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
});
it("withholds a body-bearing preview and does not reopen its exact reader on recovery", async () => {
  vi.useFakeTimers();
  HTMLElement.prototype.showPopover = function () {
    this.style.display = "block";
  };
  const id = "a".repeat(64);
  const snapshot: ThreadSnapshot = {
    status: "ready",
    replies: [],
    canLoadMore: false,
    limited: false,
    error: undefined,
    root: {
      id,
      channelId: "channel",
      authorId: "b".repeat(64),
      content: "Referenced body",
      createdAt: 1,
      mentions: [],
      participants: [],
      attachments: [],
      reactions: [],
      replyCount: 0,
    },
  };
  const dispose = vi.fn();
  const thread = vi.fn(() => ({
    snapshot: () => snapshot,
    subscribe: () => () => {},
    refresh: async () => {},
    dispose,
  }));
  const profiles = new Map();
  const list = { channels: [{ id: "channel", name: "General" }] };
  const session = {
    unread: undefined,
    thread,
    profiles: {
      snapshot: () => profiles,
      subscribe: () => () => {},
      ensure: async () => {},
    },
    channels: { list: () => list, subscribeList: () => () => {} },
    media: () => undefined,
  } as unknown as RelaySession;
  const tree = (active: boolean) => (
    <ConversationPresentation value={active}>
      <div hidden={!active} inert={!active}>
        <MessageLink
          url={`buzz://channel/channel/${id}`}
          registry={undefined}
          onOpenLink={() => false}
          session={session}
        >
          Source link
        </MessageLink>
      </div>
    </ConversationPresentation>
  );
  const view = render(tree(true));
  fireEvent.mouseEnter(screen.getByRole("link", { name: "Source link" }));
  fireEvent.mouseMove(screen.getByRole("link", { name: "Source link" }));
  await act(() => vi.advanceTimersByTimeAsync(PREVIEW_REST_MS));
  expect(screen.getByText("Referenced body")).toBeTruthy();
  expect(thread).toHaveBeenCalledOnce();
  view.rerender(tree(false));
  expect(document.body.textContent).not.toContain("Referenced body");
  expect(dispose).toHaveBeenCalledOnce();
  view.rerender(tree(true));
  await act(() => vi.runOnlyPendingTimersAsync());
  expect(document.body.textContent).not.toContain("Referenced body");
  expect(thread).toHaveBeenCalledOnce();
});
it("keeps a failed message preview the link's destination, and reads again when reopened", async () => {
  HTMLElement.prototype.showPopover = function () {
    this.style.display = "block";
  };
  const user = userEvent.setup();
  const url = `buzz://message?channel=channel&id=${"a".repeat(64)}`;
  const failed: ThreadSnapshot = {
    status: "error",
    replies: [],
    canLoadMore: false,
    limited: false,
    error: "read failed",
    root: undefined,
  };
  const refresh = vi.fn(async () => {});
  const thread = vi.fn(() => ({
    snapshot: () => failed,
    subscribe: () => () => {},
    refresh,
    dispose: () => {},
  }));
  const profiles = new Map();
  const list = { channels: [] };
  const session = {
    unread: undefined,
    thread,
    profiles: {
      snapshot: () => profiles,
      subscribe: () => () => {},
      ensure: async () => {},
    },
    channels: { list: () => list, subscribeList: () => () => {} },
    media: () => undefined,
  } as unknown as RelaySession;
  const onOpenLink = vi.fn(() => true);
  render(
    <>
      <button type="button">Before</button>
      <MessageLink
        url={url}
        registry={undefined}
        onOpenLink={onOpenLink}
        session={session}
      >
        Source link
      </MessageLink>
    </>,
  );
  // Keyboard focus opens a preview at once.
  await user.tab();
  await user.tab();
  let card = await screen.findByRole("link", { name: "Message preview" });
  expect(card.textContent).toContain("Couldn’t load this preview.");
  expect(card.textContent).toContain("Open link");
  expect(card.getAttribute("href")).toBe(url);
  await user.tab();
  expect(card).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(onOpenLink).toHaveBeenCalledWith(url);
  // Opening closes the card; reopening it reads again.
  await waitFor(() =>
    expect(screen.queryByRole("link", { name: "Message preview" })).toBeNull(),
  );
  await user.tab({ shift: true });
  await user.tab();
  card = await screen.findByRole("link", { name: "Message preview" });
  expect(thread).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledTimes(2);
  await user.click(card);
  expect(onOpenLink).toHaveBeenCalledTimes(2);
});

it("updates a stable offered preview label without withdrawing its renderer or moving focus", async () => {
  HTMLElement.prototype.showPopover = function () {
    this.style.display = "block";
  };
  const offered = vi.fn();
  const withdrawn = vi.fn();
  const target = "buzz://agent/new?card=av_fixture";
  const preview: LinkPreview = {
    get label() {
      return languagePreference() === "ko"
        ? "테스트 미리보기"
        : "Fixture preview";
    },
    render: (open) => (
      <button type="button" onClick={() => open(target)}>
        Open original
      </button>
    ),
  };
  function Offer() {
    const offer = useContext(LinkPreviewContext);
    useEffect(() => {
      offered();
      offer?.(preview);
      return () => {
        withdrawn();
        offer?.(undefined);
      };
    }, [offer]);
    return <span>Raw link name 한국어</span>;
  }
  const renderer: Contribution<LinkRenderer> = {
    id: "fixture",
    key: "fixture/preview",
    pluginId: "fixture",
    revision: "one",
    title: "Fixture",
    matches: () => true,
    component: Offer,
  };
  const entries = [renderer];
  const session = {
    unread: undefined,
    channels: { list: () => ({ channels: [] }), subscribeList: () => () => {} },
  } as unknown as RelaySession;
  const open = vi.fn(() => true);
  const view = render(
    <MessageLink
      url="https://example.com/raw"
      registry={{ snapshot: () => entries, subscribe: () => () => {} }}
      onOpenLink={open}
      session={session}
    />,
  );
  const user = userEvent.setup();
  await user.tab();
  const dialog = await screen.findByRole("dialog", { name: "Fixture preview" });
  const button = screen.getByRole("button", { name: "Open original" });
  button.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("dialog", { name: "테스트 미리보기" })).toBe(dialog);
  expect(screen.getByRole("button", { name: "Open original" })).toBe(button);
  expect(button).toHaveFocus();
  expect(
    screen.getByRole("link", { name: "Raw link name 한국어" }),
  ).toHaveAttribute("href", "https://example.com/raw");
  expect(offered).toHaveBeenCalledTimes(1);
  expect(withdrawn).not.toHaveBeenCalled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("dialog", { name: "Fixture preview" })).toBe(dialog);
  expect(button).toHaveFocus();
  await user.click(button);
  expect(open).toHaveBeenCalledExactlyOnceWith(target);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(withdrawn).not.toHaveBeenCalled();
  view.unmount();
  expect(withdrawn).toHaveBeenCalledTimes(1);
});
