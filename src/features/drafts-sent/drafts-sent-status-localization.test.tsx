import { setLanguage } from "../../shared/i18n";
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DraftsSentPage } from "./DraftsSentPage";
import { DraftsSentBadge } from "./DraftsSentBadge";
import type { RelayData } from "../relay/service";
import type { Navigation } from "../navigation/controller";
import type { ReadEvent } from "./model";

const emptyPanels: never[] = [];
const panels = {
  subscribe: () => () => {},
  snapshot: () => emptyPanels,
  resolve: () => undefined,
} as unknown as import("../panels/service").Panels;

const viewer = "a".repeat(64);
const root = "b".repeat(64);
const id = "c".repeat(64);
const friend = "e".repeat(64);
const scout = "5".repeat(64);
const relay = "7".repeat(64);
const origin = "https://demo.invalid";
const scope = `${origin}:${viewer}`;
const NOW = Date.UTC(2026, 10, 4, 18, 0, 0);
const team = ["h", "team"];
const inThread = [team, ["e", root, "", "reply"]];
const event = (overrides: Partial<ReadEvent> = {}) =>
  ({
    id,
    pubkey: viewer,
    kind: 9,
    created_at: NOW / 1000 - 600,
    content: "Recently shipped",
    tags: [team],
    ...overrides,
  }) as ReadEvent;
beforeEach(() => setLanguage("en"));
afterEach(() => {
  setLanguage("en");
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

type Filter = Record<string, unknown>;
type FakeView = {
  filters: Filter[];
  snapshot: () => { status: string; events: ReadEvent[] };
  subscribe: (listener: () => void) => () => void;
  refresh: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};

function harness() {
  let list: {
    status: string;
    channels: import("../relay/contracts").ChannelSummary[];
  } = {
    status: "ready",
    channels: [
      { id: "team", name: "launch-room", channelType: "stream" },
      {
        id: "solo",
        name: "Research helper",
        channelType: "solo",
        members: [viewer, scout],
      },
      { id: "dm", name: "DM", channelType: "dm", participants: [friend] },
      { id: "room", name: "Huddle", channelType: "stream", huddle: true },
    ],
  };
  const profiles = new Map<
    string,
    { name: string; isAgent?: true; picture?: string }
  >([
    [friend, { name: "You’re last" }],
    [scout, { name: "Scout", isAgent: true }],
  ]);
  const relayListeners = new Set<() => void>();
  const channelListeners = new Set<() => void>();
  let events: ReadEvent[] = [event()];
  let status = "ready";
  const viewListeners = new Set<() => void>();
  const view = {
    snapshot: () => ({ status, events }),
    subscribe: (listener: () => void) => {
      viewListeners.add(listener);
      return () => viewListeners.delete(listener);
    },
    refresh: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
  // Conversation context: one shared, filter-matched pool of other people's messages.
  let others: ReadEvent[] = [];
  // A view that is still loading (or failed) has no events yet, as a rebuilt host view does.
  let contextStatus = "ready";
  const contextListeners = new Set<() => void>();
  const contextViews: FakeView[] = [];
  const contextView = (filters: Filter[]) => {
    const matching = () =>
      others.filter((e) =>
        filters.some(
          (f) =>
            (!f.ids || (f.ids as string[]).includes(e.id)) &&
            (!f["#e"] ||
              e.tags.some(
                (t) =>
                  t[0] === "e" && (f["#e"] as string[]).includes(t[1] ?? ""),
              )) &&
            (!f["#h"] ||
              e.tags.some(
                (t) =>
                  t[0] === "h" && (f["#h"] as string[]).includes(t[1] ?? ""),
              )) &&
            (f.since === undefined || e.created_at >= (f.since as number)),
        ),
      );
    const made: FakeView = {
      filters,
      snapshot: () => ({
        status: contextStatus,
        events: contextStatus === "ready" ? matching() : [],
      }),
      subscribe: (listener: () => void) => {
        contextListeners.add(listener);
        return () => contextListeners.delete(listener);
      },
      refresh: vi.fn(async () => {}),
      dispose: vi.fn(),
    };
    contextViews.push(made);
    return made;
  };
  const session = {
    scope,
    relayAuthor: relay,
    channels: {
      list: () => list,
      subscribeList: (listener: () => void) => {
        channelListeners.add(listener);
        return () => channelListeners.delete(listener);
      },
      ensureList: vi.fn(),
      refreshList: vi.fn(),
    },
    profiles: {
      snapshot: () => profiles,
      subscribe: () => () => {},
      ensure: vi.fn(async () => {}),
    },
    names: {
      snapshot: () => 0,
      subscribe: () => () => {},
      resolve: (_key: string, fallback: string) => fallback,
    },
    media: (url: string) => url,
    observe: vi.fn((filters: Filter[]) =>
      (filters[0]?.authors as string[] | undefined)?.includes(viewer)
        ? view
        : contextView(filters),
    ),
  };
  let connection = {
    status: "ready",
    generation: 1,
    scope,
    viewer,
    origin,
    session,
  };
  const open = vi.fn(async () => ({ status: "opened" }));
  const relayData = {
    snapshot: () => connection,
    subscribe: (f: () => void) => {
      relayListeners.add(f);
      return () => relayListeners.delete(f);
    },
  } as unknown as RelayData;
  const navigator = { open } as unknown as Navigation;
  const page = {
    component: () => (
      <DraftsSentPage panels={panels} relay={relayData} navigator={navigator} />
    ),
    badge: () => <DraftsSentBadge relay={relayData} />,
  };
  return {
    page,
    hideSelected() {
      list = {
        ...list,
        channels: list.channels.map((channel, index) =>
          index === 0 ? { ...channel, huddle: true } : channel,
        ),
      };
      for (const listener of channelListeners) listener();
    },
    open,
    view,
    session,
    contextViews,
    replies(next: ReadEvent[], nextStatus = "ready") {
      others = next;
      contextStatus = nextStatus;
      for (const f of contextListeners) f();
    },
    emit(next: ReadEvent[], nextStatus = "ready") {
      events = next;
      status = nextStatus;
      for (const f of viewListeners) f();
    },
    switchIdentity() {
      const other = "d".repeat(64);
      connection = {
        ...connection,
        generation: 2,
        viewer: other,
        scope: `${origin}:${other}`,
        session: { ...session, scope: `${origin}:${other}` },
      };
      for (const f of relayListeners) f();
    },
  };
}

it.each([false, true])(
  "retains complete reply evidence and raw UI-identical author names, thread=%s",
  async (thread) => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const h = harness();
    const at = NOW / 1000;
    const mine = event({
      content: "Posted raw",
      created_at: at - 600,
      tags: thread ? inThread : [team],
    });
    h.emit([mine]);
    h.replies([
      event({
        id: "f".repeat(64),
        pubkey: friend,
        content: "Opaque reply 한글",
        created_at: at - 300,
        tags: [team, ["e", thread ? root : mine.id, "", "reply"]],
      }),
    ]);
    const Page = h.page.component;
    render(<Page />);
    fireEvent.click(screen.getByRole("tab", { name: "Sent" }));
    const en = thread
      ? "View message in #launch-room, thread: Posted raw. 1 reply after yours, latest from You’re last, 5 minutes ago"
      : "View message in #launch-room: Posted raw. 1 reply, latest from You’re last, 5 minutes ago";
    const row = screen.getByRole("button", { name: en });
    row.focus();
    const pill = row.querySelector("[data-tone]");
    expect(pill).toHaveAttribute("data-tone", "new");
    const reads = h.session.observe.mock.calls.length;
    act(() => setLanguage("ko"));
    const detail = thread
      ? "내 메시지 이후 답글 1개, 최근 작성자 You’re last, 5분 전"
      : "답글 1개, 최근 작성자 You’re last, 5분 전";
    expect(row).toHaveAccessibleName(
      `${thread ? "#launch-room 스레드의 메시지 보기" : "#launch-room의 메시지 보기"}: Posted raw. ${detail}`,
    );
    expect(pill).toHaveAttribute("title", detail);
    expect(row).toHaveFocus();
    expect(row.querySelector("[data-tone]")).toBe(pill);
    expect(h.session.observe).toHaveBeenCalledTimes(reads);
    act(() => setLanguage("en"));
    expect(row).toHaveAccessibleName(en);
    expect(h.session.observe).toHaveBeenCalledTimes(reads);
    expect(h.open).not.toHaveBeenCalled();
  },
);

it("keeps capped minimum room evidence distinct from complete and settled reads in both languages", () => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  const h = harness(),
    at = NOW / 1000;
  h.emit([
    event({ content: "Raw DM", created_at: at - 1000, tags: [["h", "dm"]] }),
  ]);
  const replies = Array.from({ length: 100 }, (_, i) =>
    event({
      id: `f${String(i).padStart(63, "0")}`,
      pubkey: friend,
      created_at: at - 600 + i,
      tags: [["h", "dm"]],
    }),
  );
  h.replies(replies);
  const Page = h.page.component;
  render(<Page />);
  fireEvent.click(screen.getByRole("tab", { name: "Sent" }));
  const row = screen.getByRole("button", {
    name: "View message in You’re last: Raw DM. At least 100 messages after yours, latest from You’re last, 8 minutes ago",
  });
  const pill = row.querySelector("[data-tone]");
  row.focus();
  expect(pill).toHaveTextContent("99+ after you");
  act(() => setLanguage("ko"));
  expect(pill).toHaveTextContent("내 메시지 이후 99개 이상");
  expect(pill).toHaveAttribute(
    "title",
    "내 메시지 이후 메시지가 최소 100개, 최근 작성자 You’re last, 8분 전",
  );
  expect(row).toHaveFocus();
  act(() => h.replies(replies.slice(-2)));
  expect(pill).toHaveTextContent("내 메시지 이후 2개");
  expect(pill).toHaveAttribute(
    "title",
    "내 메시지 이후 메시지 2개, 최근 작성자 You’re last, 8분 전",
  );
  act(() => h.replies([]));
  expect(pill).toHaveAttribute("data-tone", "last");
  expect(pill).toHaveTextContent("내가 마지막으로 보냄");
  expect(pill).toHaveAttribute("title", "내 메시지 이후 메시지가 없습니다");
  act(() => setLanguage("en"));
  expect(pill).toHaveTextContent("You’re last");
  expect(pill).toHaveAttribute("title", "No messages after yours");
  expect(row).toHaveFocus();
  expect(h.open).not.toHaveBeenCalled();
});
