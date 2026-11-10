import { readDrafts } from "./drafts";
import * as clipboard from "../../shared/clipboard";
import { setLanguage } from "../../shared/i18n";
import { threadBinding } from "../relay/thread-window";
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DraftsSentBadge } from "./DraftsSentBadge";
import { DraftPreview } from "./DraftPreview";
import type { ConversationExtensions } from "../conversation/contracts";
import { DraftsSentPage } from "./DraftsSentPage";
import { PublishRejected } from "../relay/outbox";
import type { ComposerInputElement } from "../messages/composer-dom";
import { attachmentDraft } from "../messages/attachment-draft";
import type { UploadedAttachment } from "../relay/attachments";
import { mentionDraft } from "../messages/mention-draft";
import { createRelaySession } from "../relay/session";
import type { RelayData, RelaySnapshot } from "../relay/service";
import type { Navigation } from "../navigation/controller";
import type { Panels } from "../panels/service";
import type { RelayEvent } from "../relay/events";
import { matchesEvent } from "../relay/projection";
import {
  bounds,
  keypair,
  message,
  metadata,
  roster,
  signed,
} from "../relay/testing";
import { composerDOMFixture } from "../messages/composer-testing";
import { readView, writeView } from "../../shared/view-state";

// jsdom has no measured viewport. Keep real rows/composer/services, replacing
// only virtualization geometry; browser acceptance covers actual layout.
vi.mock("virtua", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    Virtualizer: forwardRef(function Virtualizer(
      { children }: { children: import("react").ReactNode },
      ref,
    ) {
      useImperativeHandle(ref, () => ({
        cache: undefined,
        scrollSize: 600,
        findItemIndex: () => 0,
        getItemOffset: () => 0,
        scrollToIndex() {},
        scrollTo() {},
      }));
      return <div>{children}</div>;
    }),
  };
});
composerDOMFixture();
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);
beforeEach(() => setLanguage("en"));
const owners: ReturnType<typeof createRelaySession>[] = [];
afterEach(() => {
  cleanup();
  setLanguage("en");
  if (originalScrollIntoView)
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScrollIntoView,
    );
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  for (const owner of owners.splice(0)) owner.dispose();
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function fixture(upload?: () => Promise<UploadedAttachment>) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const viewer = keypair(),
    other = keypair(),
    relayKey = keypair();
  const root = message(other, "room", "Discuss launch", 20);
  const events: RelayEvent[] = [
    metadata(relayKey, "room", "Design", 10, [["t", "stream"]]),
    roster(relayKey, "room", [viewer.pubkey, other.pubkey], 10),
    metadata(relayKey, "other", "Planning", 10, [["t", "stream"]]),
    roster(relayKey, "other", [viewer.pubkey, other.pubkey], 10),
    root,
  ];
  let emit: (events: readonly RelayEvent[]) => void = () => {};
  let fail = false;
  let gate: Promise<void> | undefined;
  let historyGate: Promise<void> | undefined;
  let historyStarted = () => {};
  const published: RelayEvent[] = [];
  const publish = vi.fn(async (event: RelayEvent) => {
    if (gate) await gate;
    if (fail) throw new PublishRejected("Send rejected");
    published.push(event);
    events.push(event);
    emit([event]);
  });
  const owner = createRelaySession(
    {
      viewer: viewer.pubkey,
      relayAuthor: relayKey.pubkey,
      scope: "https://relay.test",
      query: async (filters) =>
        (
          await Promise.all(
            filters.map(async (filter) => {
              if (
                historyGate &&
                (filter.top_level ||
                  filter.thread_window ||
                  filter["#e"]?.includes(root.id))
              ) {
                historyStarted();
                await historyGate;
              }
              const found = events.filter(
                (event) =>
                  matchesEvent(event, filter) &&
                  (filter.thread_cursor === undefined ||
                    event.created_at > filter.thread_cursor ||
                    (event.created_at === filter.thread_cursor &&
                      event.id > (filter.thread_cursor_id ?? ""))),
              );
              const channelId = filter["#h"]?.[0];
              const rootId = filter["#e"]?.[0];
              if (filter.thread_window && channelId && rootId)
                return [
                  ...found,
                  signed(relayKey, {
                    kind: 39007,
                    created_at: 30,
                    tags: [
                      [
                        "d",
                        await threadBinding(
                          filter,
                          "https://relay.test",
                          viewer.pubkey,
                        ),
                      ],
                      ["h", channelId],
                      ["e", rootId],
                    ],
                    content: JSON.stringify({
                      version: 1,
                      direction: "older",
                      has_more: false,
                      next_cursor: null,
                    }),
                  }),
                ];
              if (filter.top_level && channelId) {
                const ordered = found.sort(
                  (a, b) =>
                    b.created_at - a.created_at || a.id.localeCompare(b.id),
                );
                const rows = ordered.slice(0, filter.limit);
                const more = ordered.length > rows.length;
                const last = rows.at(-1);
                return [
                  ...rows,
                  bounds(
                    relayKey,
                    channelId,
                    filter.until !== undefined && filter.before_id
                      ? `${filter.until}:${filter.before_id}`
                      : "head",
                    {
                      has_more: more,
                      next_cursor:
                        more && last
                          ? { created_at: last.created_at, id: last.id }
                          : null,
                    },
                  ),
                ];
              }
              return found;
            }),
          )
        ).flat(),
      media: () => undefined,
      ...(upload ? { uploadAttachment: upload } : {}),
      writer: {
        kinds: [9, 9007, 40003, 5],
        sign: async (template) => signed(viewer, template),
        publish,
      },
      subscribe(callbacks) {
        callbacks.state({ status: "connected", routes: [] });
        emit = callbacks.receive;
        return { update() {}, retry() {}, dispose() {} };
      },
    },
    { outboxStorage: { load: () => [], save: () => {} } },
  );
  owners.push(owner);
  emit(events);
  const session = owner.session;
  const connection: RelaySnapshot = {
    status: "ready",
    generation: 1,
    scope: session.scope,
    viewer: viewer.pubkey,
    session,
  };
  const relay = {
    snapshot: () => connection,
    subscribe: () => () => {},
    retry() {},
    disconnect() {},
    clearCache: owner.clearCache,
  } as RelayData;
  const open = vi.fn<Navigation["open"]>(async () => ({ status: "opened" }));
  const empty: never[] = [];
  const panels = {
    snapshot: () => empty,
    subscribe: () => () => {},
    resolve: () => undefined,
  } as unknown as Panels;
  return {
    session,
    relay,
    selfChat: () => {
      const next = [
        metadata(relayKey, "self", "Notes to self", 50, [["t", "dm"]]),
        roster(relayKey, "self", [viewer.pubkey], 50),
      ];
      events.push(...next);
      emit(next);
    },
    holdHistory: () => {
      let release!: () => void;
      const started = new Promise<void>((resolve) => {
        historyStarted = resolve;
      });
      historyGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return {
        started,
        release: () => {
          historyGate = undefined;
          release();
        },
      };
    },
    liveMessage: () => {
      const next = message(other, "room", "New live message", 1000000);
      events.push(next);
      emit([next]);
      return next;
    },
    seedHistory: (thread: boolean) => {
      const history = Array.from({ length: 150 }, (_, i) =>
        message(
          other,
          "room",
          `Later message ${i}`,
          100 + i * 3600,
          thread
            ? [
                ["e", root.id, "", "root"],
                ["e", root.id, "", "reply"],
              ]
            : [],
        ),
      );
      events.push(...history);
    },
    makeReadOnly: () => {
      const update = signed(relayKey, {
        kind: 39002,
        content: "",
        created_at: 200,
        tags: [
          ["d", "room"],
          ["p", viewer.pubkey, "", "guest"],
          ["p", other.pubkey],
        ],
      });
      events.push(update);
      emit([update]);
    },
    archive: () => {
      const update = metadata(relayKey, "room", "Design", 200, [
        ["t", "stream"],
        ["archived", "true"],
      ]);
      events.push(update);
      emit([update]);
    },
    seedSent: (
      thread: boolean,
      channelId = "room",
      text = "Already sent",
      createdAt = 25,
    ) => {
      const sent = message(
        viewer,
        channelId,
        text,
        createdAt,
        thread
          ? [
              ["e", root.id, "", "root"],
              ["e", root.id, "", "reply"],
            ]
          : [],
      );
      events.push(sent);
      emit([sent]);
      return sent;
    },
    panels,
    host: { panels, relay, navigation: { open } as unknown as Navigation },
    root,
    published,
    publish,
    open,
    render: (extensions?: ConversationExtensions) =>
      render(
        <DraftsSentPage
          relay={relay}
          navigator={{ open } as unknown as Navigation}
          panels={panels}
          extensions={extensions}
        />,
      ),
    reject: () => {
      fail = true;
    },
    accept: () => {
      fail = false;
    },
    hold: () => {
      let release = () => {};
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    revoke: () => {
      const update = roster(relayKey, "room", [other.pubkey], 100);
      events.push(update);
      emit([update]);
    },
  };
}

it("keeps the same draft badge and raw draft through EN/KO/EN", () => {
  const h = fixture();
  writeView(h.session.scope, "draft:room", "Drafts 초안 {name}");
  render(<DraftsSentBadge relay={h.relay} />);
  const badge = screen.getByRole("img", { name: "1 draft" });
  const before = JSON.stringify(readView(h.session.scope, "draft:room", null));
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("img", {
        name: language === "ko" ? "초안 1개" : "1 draft",
      }),
    ).toBe(badge);
    expect(badge).toHaveTextContent("1");
    expect(JSON.stringify(readView(h.session.scope, "draft:room", null))).toBe(
      before,
    );
    expect(h.publish).not.toHaveBeenCalled();
  }
});

it("retains the actual preview composer, selection and delayed-send handoff across EN/KO/EN", async () => {
  const h = fixture();
  const raw = "Draft raw 한글 {title} Notes to self";
  writeView(h.session.scope, "draft:room", raw);
  writeView(h.session.scope, "draft:other", "Next raw draft");
  h.render();
  const row = await screen.findByRole("button", {
    name: `Continue draft in #Design: ${raw}`,
  });
  fireEvent.click(row);
  const region = screen.getByRole("region", { name: "Draft for #Design" });
  const editor = (await within(region).findByRole("textbox", {
    name: "Message #Design",
  })) as ComposerInputElement;
  editor.focus();
  editor.setSelectionRange(3, 9);
  const before = JSON.stringify(readView(h.session.scope, "draft:room", null));
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("region", {
        name: language === "ko" ? "#Design 초안" : "Draft for #Design",
      }),
    ).toBe(region);
    expect(
      within(region).getByRole("textbox", {
        name: language === "ko" ? "#Design에 메시지 보내기" : "Message #Design",
      }),
    ).toBe(editor);
    expect(editor).toHaveFocus();
    expect(editor.value).toBe(raw);
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([3, 9]);
    expect(JSON.stringify(readView(h.session.scope, "draft:room", null))).toBe(
      before,
    );
    expect(h.publish).not.toHaveBeenCalled();
  }
  const release = h.hold();
  try {
    fireEvent.click(
      within(region).getByRole("button", { name: "Send message" }),
    );
    await waitFor(() => expect(h.publish).toHaveBeenCalledTimes(1));
    const search = screen.getByRole("searchbox");
    search.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("region", { name: "#Design 초안" })).toBe(region);
    expect(search).toHaveFocus();
    expect(h.publish).toHaveBeenCalledTimes(1);
    await act(async () => release());
    await waitFor(() => expect(region).not.toBeInTheDocument());
    expect(search).toHaveFocus();
    expect(screen.getByText("#Design에 보냈습니다.")).toBeVisible();
    act(() => setLanguage("en"));
    expect(screen.getByText("Sent to #Design.")).toBeVisible();
    expect(h.published).toHaveLength(1);
    expect(h.published[0]).toMatchObject({
      kind: 9,
      content: raw,
      pubkey: h.session.viewer,
    });
    expect(h.published[0]?.tags).toContainEqual(["h", "room"]);
    expect(mentionDraft(readView(h.session.scope, "draft:room", "")).text).toBe(
      "",
    );
    expect(
      mentionDraft(readView(h.session.scope, "draft:other", "")).text,
    ).toBe("Next raw draft");
  } finally {
    await act(async () => release());
  }
});

it("keeps canonical search membership and raw fallback-like authored content while localizing clear controls", async () => {
  const user = userEvent.setup();
  const h = fixture();
  const raw = "Attachment Notes to self {query} 한글";
  writeView(h.session.scope, "draft:room", raw);
  h.render();
  const row = await screen.findByRole("button", {
    name: `Continue draft in #Design: ${raw}`,
  });
  const search = screen.getByRole("searchbox", {
    name: "Search drafts and sent messages",
  });
  await user.type(search, "Notes to self");
  expect(
    screen.getByRole("button", { name: `Continue draft in #Design: ${raw}` }),
  ).toBe(row);
  const before = JSON.stringify(readView(h.session.scope, "draft:room", null));
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("searchbox", { name: "초안 및 보낸 메시지 검색" }),
  ).toBe(search);
  expect(
    screen.getByRole("button", { name: `#Design의 초안 이어 쓰기: ${raw}` }),
  ).toBe(row);
  expect(search).toHaveValue("Notes to self");
  expect(search).toHaveFocus();
  await user.click(
    screen.getByRole("button", { name: "초안 및 보낸 메시지 검색 지우기" }),
  );
  expect(search).toHaveValue("");
  expect(search).toHaveFocus();
  expect(JSON.stringify(readView(h.session.scope, "draft:room", null))).toBe(
    before,
  );
  expect(h.publish).not.toHaveBeenCalled();
  expect(h.open).not.toHaveBeenCalled();
});

it.each([
  [0, "just now", "방금"],
  [-60, "just now", "방금"],
  [60, "1 minute ago", "1분 전"],
  [120, "2 minutes ago", "2분 전"],
  [3600, "1 hour ago", "1시간 전"],
  [7200, "2 hours ago", "2시간 전"],
  [86400, "1 day ago", "1일 전"],
  [172800, "2 days ago", "2일 전"],
  [604800, undefined, undefined],
] as const)(
  "keeps the original relative draft ladder at age %s while the row survives locale changes",
  async (age, en, ko) => {
    const now = Date.UTC(2026, 10, 4, 18) / 1000;
    vi.spyOn(Date, "now").mockReturnValue(now * 1000);
    const h = fixture();
    writeView(h.session.scope, "draft:room", "Raw timestamp");
    readDrafts(h.session, now - age);
    h.render();
    const row = await screen.findByRole("button", {
      name: "Continue draft in #Design: Raw timestamp",
    });
    const time = row.querySelector("time");
    expect(time).not.toBeNull();
    row.focus();
    const date = new Date((now - age) * 1000);
    expect(time).toHaveTextContent(
      en ??
        `on ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)}`,
    );
    const iso = date.toISOString();
    expect(time).toHaveAttribute("datetime", iso);
    act(() => setLanguage("ko"));
    expect(
      screen.getByRole("button", {
        name: "#Design의 초안 이어 쓰기: Raw timestamp",
      }),
    ).toBe(row);
    expect(row).toHaveFocus();
    expect(row.querySelector("time")).toBe(time);
    expect(time).toHaveTextContent(
      ko ??
        new Intl.DateTimeFormat("ko-KR", {
          month: "short",
          day: "numeric",
        }).format(date),
    );
    expect(time).toHaveAttribute("datetime", iso);
    expect(h.publish).not.toHaveBeenCalled();
  },
);

it("keeps local-date groups and timestamps stable while formatting the selected language with original options", async () => {
  const now = Date.UTC(2026, 10, 4, 18);
  vi.spyOn(Date, "now").mockReturnValue(now);
  const h = fixture();
  const recent = h.seedSent(false, "room", "Recent raw", now / 1000 - 600);
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  h.seedSent(false, "room", "Yesterday raw", previous.getTime() / 1000);
  const old = Date.UTC(2026, 9, 28, 0, 30) / 1000;
  h.seedSent(false, "room", "Older raw", old);
  h.render();
  fireEvent.click(screen.getByRole("tab", { name: "Sent" }));
  const row = await screen.findByRole("button", {
    name: "View message in #Design: Recent raw",
  });
  const group = screen.getByRole("region", { name: "Today" });
  const older = screen.getByRole("button", {
    name: "View message in #Design: Older raw",
  });
  const oldGroup = older.closest("section");
  const time = row.querySelector("time");
  expect(time).not.toBeNull();
  row.focus();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    const locale = language === "ko" ? "ko-KR" : "en-US";
    expect(
      screen.getByRole("region", {
        name: language === "ko" ? "오늘" : "Today",
      }),
    ).toBe(group);
    expect(
      screen.getByRole("region", {
        name: language === "ko" ? "어제" : "Yesterday",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name:
          language === "ko"
            ? "#Design의 메시지 보기: Recent raw"
            : "View message in #Design: Recent raw",
      }),
    ).toBe(row);
    expect(row).toHaveFocus();
    expect(row.querySelector("time")).toBe(time);
    expect(time).toHaveTextContent(
      new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(recent.created_at * 1000)),
    );
    expect(time).toHaveAttribute(
      "title",
      new Intl.DateTimeFormat(locale, {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date(recent.created_at * 1000)),
    );
    expect(time).toHaveAttribute(
      "datetime",
      new Date(recent.created_at * 1000).toISOString(),
    );
    expect(oldGroup).toHaveAccessibleName(
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date(old * 1000)),
    );
    expect(older.closest("section")).toBe(oldGroup);
  }
  expect(h.open).not.toHaveBeenCalled();
  expect(h.publish).not.toHaveBeenCalled();
});

it.each([
  ["", "empty"],
  ["Raw copied 한글 {name}", "success"],
  ["Raw copied 한글 {name}", "failure"],
] as const)(
  "keeps unavailable drafts and retained copy feedback live, %s/%s",
  async (text, result) => {
    const h = fixture();
    writeView(h.session.scope, "draft:room", text);
    const copy = vi.spyOn(clipboard, "writeClipboardText");
    if (result === "failure")
      copy.mockRejectedValue(new Error("Draft text copied."));
    else copy.mockResolvedValue();
    render(
      <DraftPreview
        entry={{ id: "draft:room", channelId: "room", text }}
        title="Notes to self"
        channel={{ id: "room", name: "Notes to self", members: [] }}
        session={h.session}
        host={h.host}
        autoFocus={false}
        onClose={() => {}}
        onOpen={() => {}}
        onSaved={() => {}}
      />,
    );
    const region = screen.getByRole("region", {
      name: "Draft for Notes to self",
    });
    fireEvent.click(within(region).getByRole("button", { name: "Copy text" }));
    const en =
      result === "empty"
        ? "This draft has no text to copy."
        : result === "success"
          ? "Draft text copied."
          : "Could not copy the text. Try again.";
    await waitFor(() =>
      expect(within(region).getByRole("status")).toHaveTextContent(en),
    );
    const status = within(region).getByRole("status");
    act(() => setLanguage("ko"));
    expect(screen.getByRole("region", { name: "Notes to self 초안" })).toBe(
      region,
    );
    expect(within(region).getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(
      result === "empty"
        ? "복사할 초안 텍스트가 없습니다."
        : result === "success"
          ? "초안 텍스트를 복사했습니다."
          : "텍스트를 복사하지 못했습니다. 다시 시도하세요.",
    );
    expect(
      within(region).getByText(
        "Notes to self에 더 이상 게시할 수 없습니다. 초안은 계속 저장되어 있습니다.",
      ),
    ).toBeVisible();
    expect(mentionDraft(readView(h.session.scope, "draft:room", "")).text).toBe(
      text,
    );
    if (result === "empty") expect(copy).not.toHaveBeenCalled();
    else expect(copy).toHaveBeenCalledExactlyOnceWith(text);
    expect(h.publish).not.toHaveBeenCalled();
  },
);

it.each([undefined, "Could not load conversation."] as const)(
  "localizes only the absent conversation-error fallback, raw=%s",
  async (error) => {
    const h = fixture();
    const viewer = h.session.viewer;
    if (!viewer) throw new Error("The synthetic fixture must be signed in");
    const window = {
      channelId: "room",
      status: "error" as const,
      rows: [],
      hasMore: false,
      loadingOlder: false,
      error,
    };
    const session = {
      ...h.session,
      channels: { ...h.session.channels, window: () => window },
    };
    render(
      <DraftPreview
        entry={{ id: "draft:room", channelId: "room", text: "Raw" }}
        title="#Design"
        channel={{ id: "room", name: "Design", members: [viewer] }}
        session={session}
        host={h.host}
        autoFocus={false}
        onClose={() => {}}
        onOpen={() => {}}
        onSaved={() => {}}
      />,
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load conversation.");
    act(() => setLanguage("ko"));
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent(error ?? "대화를 불러오지 못했습니다.");
    expect(
      screen.getByRole("button", { name: "대화 다시 불러오기" }),
    ).toBeEnabled();
    expect(h.publish).not.toHaveBeenCalled();
  },
);

it("projects only proven placeholder drafts and keeps identical authored text raw", async () => {
  let release!: (value: UploadedAttachment) => void;
  const pending = new Promise<UploadedAttachment>((resolve) => {
    release = resolve;
  });
  const upload = vi.fn(() => pending);
  const h = fixture(upload);
  const store = attachmentDraft(
    h.session,
    `${h.session.scope}:draft:room`,
    "room",
  );
  try {
    act(() =>
      store.add([
        new File(["raw"], "Notes to self.txt", { type: "text/plain" }),
      ]),
    );
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    writeView(h.session.scope, "draft:room", "");
    h.render();
    const row = await screen.findByRole("button", {
      name: "Continue draft in #Design: 1 attached file",
    });
    act(() => setLanguage("ko"));
    expect(
      screen.getByRole("button", {
        name: "#Design의 초안 이어 쓰기: 첨부 파일 1개",
      }),
    ).toBe(row);
    expect(store.snapshot()[0]?.file.name).toBe("Notes to self.txt");
    act(() => writeView(h.session.scope, "draft:room", "1 attached file"));
    expect(
      screen.getByRole("button", {
        name: "#Design의 초안 이어 쓰기: 1 attached file",
      }),
    ).toBe(row);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(h.publish).not.toHaveBeenCalled();
  } finally {
    await act(async () =>
      release({
        name: "Notes to self.txt",
        url: `https://relay.test/media/${"a".repeat(64)}.txt`,
        type: "text/plain",
        size: 3,
        sha256: "a".repeat(64),
      }),
    );
  }
});

it("keeps an emptied selected editor mounted while its temporary row label translates", async () => {
  const h = fixture();
  writeView(h.session.scope, "draft:room", "Keep editor");
  h.render();
  const row = await screen.findByRole("button", {
    name: "Continue draft in #Design: Keep editor",
  });
  fireEvent.click(row);
  const editor = (await screen.findByRole("textbox")) as ComposerInputElement;
  act(() => {
    editor.value = "";
    fireEvent.input(editor);
  });
  expect(
    screen.getByRole("button", {
      name: "Continue draft in #Design: Empty draft",
    }),
  ).toBe(row);
  editor.focus();
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("button", { name: "#Design의 초안 이어 쓰기: 빈 초안" }),
  ).toBe(row);
  expect(screen.getByRole("textbox")).toBe(editor);
  expect(editor).toHaveFocus();
  expect(editor.value).toBe("");
  expect(mentionDraft(readView(h.session.scope, "draft:room", "")).text).toBe(
    "",
  );
  expect(h.publish).not.toHaveBeenCalled();
});

it("keeps canonical fallback search membership separate from localized destination display", async () => {
  const h = fixture();
  h.selfChat();
  writeView(h.session.scope, "draft:self", "Raw self memo");
  h.render();
  const row = await screen.findByRole("button", {
    name: "Continue draft in Notes to self: Raw self memo",
  });
  const search = screen.getByRole("searchbox");
  fireEvent.change(search, { target: { value: "Notes to self" } });
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("button", {
      name: "나에게 쓰는 메모의 초안 이어 쓰기: Raw self memo",
    }),
  ).toBe(row);
  fireEvent.change(search, { target: { value: "나에게 쓰는 메모" } });
  expect(
    screen.queryByRole("button", {
      name: "나에게 쓰는 메모의 초안 이어 쓰기: Raw self memo",
    }),
  ).toBeNull();
  expect(
    screen.getByText("“나에게 쓰는 메모”에 해당하는 초안이 없습니다."),
  ).toBeVisible();
  expect(mentionDraft(readView(h.session.scope, "draft:self", "")).text).toBe(
    "Raw self memo",
  );
  expect(h.publish).not.toHaveBeenCalled();
});

it("retains an owned clear-failure notice and every saved draft while language changes", async () => {
  const h = fixture();
  const raw = "Stubborn 초안 {name}";
  writeView(h.session.scope, "draft:room", raw);
  writeView(h.session.scope, "draft:other", "Other raw");
  h.render();
  const before = JSON.stringify(readView(h.session.scope, "draft:room", null));
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {});
  const button = await screen.findByRole("button", {
    name: `Clear draft in #Design: ${raw}`,
  });
  button.focus();
  fireEvent.click(button);
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(
    "This draft could not be cleared. Try again.",
  );
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent(
    "이 초안을 지우지 못했습니다. 다시 시도하세요.",
  );
  expect(
    screen.getByRole("button", { name: `#Design의 초안 지우기: ${raw}` }),
  ).toBe(button);
  expect(button).toHaveFocus();
  expect(JSON.stringify(readView(h.session.scope, "draft:room", null))).toBe(
    before,
  );
  expect(mentionDraft(readView(h.session.scope, "draft:other", "")).text).toBe(
    "Other raw",
  );
  expect(h.publish).not.toHaveBeenCalled();
});

it("preserves distinct DST instants and prior-year dates with locale-only clock and title projection", async () => {
  const now = Date.UTC(2026, 10, 2, 18);
  vi.spyOn(Date, "now").mockReturnValue(now);
  const h = fixture();
  const times = [
    Date.UTC(2026, 10, 1, 5, 30) / 1000,
    Date.UTC(2026, 10, 1, 6, 30) / 1000,
    Date.UTC(2025, 5, 15, 18) / 1000,
    Date.UTC(2025, 11, 31, 18) / 1000,
  ] as const;
  times.forEach((at, i) => {
    h.seedSent(false, "room", `Raw instant ${i}`, at);
  });
  h.render();
  fireEvent.click(screen.getByRole("tab", { name: "Sent" }));
  const rows = await Promise.all(
    times.map((_, i) =>
      screen.findByRole("button", {
        name: `View message in #Design: Raw instant ${i}`,
      }),
    ),
  );
  const nodes = rows.map((row) => row.querySelector("time"));
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    const locale = language === "ko" ? "ko-KR" : "en-US";
    times.forEach((at, i) => {
      const date = new Date(at * 1000),
        node = nodes[i];
      expect(rows[i]?.querySelector("time")).toBe(node);
      expect(node).toHaveTextContent(
        new Intl.DateTimeFormat(locale, {
          hour: "numeric",
          minute: "2-digit",
        }).format(date),
      );
      expect(node).toHaveAttribute(
        "title",
        new Intl.DateTimeFormat(locale, {
          dateStyle: "full",
          timeStyle: "short",
        }).format(date),
      );
      expect(node).toHaveAttribute("datetime", date.toISOString());
    });
    expect(rows[2]?.closest("section")).toHaveAccessibleName(
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(times[2] * 1000)),
    );
    const rollover = new Date(times[3] * 1000);
    expect(rows[3]?.closest("section")).toHaveAccessibleName(
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        ...(rollover.getFullYear() === new Date(now).getFullYear()
          ? {}
          : { year: "numeric" }),
      }).format(rollover),
    );
  }
  expect(h.publish).not.toHaveBeenCalled();
});
