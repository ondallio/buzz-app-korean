// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import {
  createRelaySession,
  type RelaySession,
} from "../../features/relay/session";
import type { RelayEvent, ReadFilter } from "../../features/relay/events";
import type { LiveCallbacks } from "../../features/relay/live";
import {
  readJournal,
  newReadJournal,
  type ReadJournal,
} from "../../features/relay/read-state-storage";
import { createSidebarPreferencesStore } from "../../features/relay/sidebar-preferences-store";
import {
  keypair,
  message,
  metadata,
  roster,
} from "../../features/relay/testing";
import { UnreadBadge } from "./UnreadBadge";

const disposers = new Set<() => void>();
beforeEach(() => {
  localStorage.clear();
  setLanguage("en");
});
afterEach(() => {
  cleanup();
  for (const dispose of disposers) dispose();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("Uninitialized fixture gate");
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(seed?: ReadJournal) {
  const viewer = keypair(),
    relay = keypair(),
    peer = keypair();
  let journal = seed;
  let live: LiveCallbacks | undefined;
  const query = vi.fn(
    async (_filters: readonly ReadFilter[]) => [] as RelayEvent[],
  );
  const update = vi.fn(
    async (change: (current: ReadJournal | undefined) => ReadJournal) => {
      journal = readJournal(change(journal), viewer.pubkey);
      return journal;
    },
  );
  const owner = createRelaySession(
    {
      viewer: viewer.pubkey,
      relayAuthor: relay.pubkey,
      query,
      media: () => undefined,
      readState: { decode: async () => [] },
      subscribe(callbacks) {
        live = callbacks;
        return { update() {}, retry() {}, dispose() {} };
      },
    },
    { readStateFloor: () => 0, readStateStorage: { update, close() {} } },
  );
  let muted: readonly string[] = [];
  let muteGate: Promise<void> | undefined;
  const muteStarted = deferred<void>();
  const writeMute = vi.fn(
    async (intent: { channelId: string; muted: boolean }) => {
      muteStarted.resolve();
      await muteGate;
      muted = intent.muted ? [intent.channelId] : [];
      return muted;
    },
  );
  const preferences = createSidebarPreferencesStore({
    available: true,
    read: async () => ({ sections: [], assignments: {}, starred: [], muted }),
    writeMute,
  });
  const unread = {
    ...owner.session.unread,
    subscribe: vi.fn(owner.session.unread.subscribe),
    subscribeActivity: vi.fn(owner.session.unread.subscribeActivity),
  };
  const session: RelaySession = {
    ...owner.session,
    unread,
    sidebarPreferences: preferences.queries,
  };
  const target = { kind: "channel" as const, channelId: "room" };
  const emit = (events: readonly RelayEvent[]) => {
    if (!live) throw new Error("Missing real live callbacks");
    live.receive(events);
  };
  emit([
    roster(relay, "room", [viewer.pubkey], 10),
    metadata(relay, "room", "Raw Marked unread 한글", 10),
  ]);
  const dispose = () => {
    owner.dispose();
    preferences.dispose();
    disposers.delete(dispose);
  };
  disposers.add(dispose);
  return {
    session,
    target,
    viewer,
    peer,
    relay,
    query,
    update,
    unread,
    writeMute,
    emit,
    muteStarted,
    holdMute(gate: Promise<void>) {
      muteGate = gate;
    },
    disconnect() {
      if (!live) throw new Error("Missing real live callbacks");
      live.state({ status: "connected", routes: [] });
      live.state({ status: "retrying", routes: [] });
    },
    dispose,
  };
}

it("updates the real observed badge and mention text without changing its row, raw ReactNode or stores", async () => {
  const f = fixture();
  f.emit([
    message(f.peer, "room", "Raw body {count} 한글", 11, [
      ["p", f.viewer.pubkey],
    ]),
  ]);
  await f.session.unread.ensure();
  await f.session.sidebarPreferences.ensure();
  expect(f.session.unread.snapshot(f.target)).toMatchObject({
    observedCount: 1,
    attentionCount: 1,
    freshness: "observed",
    manual: "none",
  });
  const selected = vi.fn();
  const view = render(
    <button type="button" onClick={() => selected("room")}>
      <UnreadBadge
        session={f.session}
        channelId="room"
        label={<em data-fixture-label="">Marked unread 한글</em>}
      />
    </button>,
  );
  try {
    await act(async () => {
      await f.session.unread.ensure();
    });
    const badge = screen.getByRole("img", {
      name: "1 observed unread messages. Not an exact total.",
    });
    const mention = screen.getByText("1 unread mention", {
      selector: ".sr-only",
    });
    const row = screen.getByRole("button");
    row.focus();
    const label = view.container.querySelector("[data-fixture-label]");
    const snapshot = f.session.unread.snapshot(f.target),
      activity = f.session.unread.activity("room");
    const baseline = [
      f.query.mock.calls.length,
      f.update.mock.calls.length,
      f.unread.subscribe.mock.calls.length,
      f.unread.subscribeActivity.mock.calls.length,
    ];
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("img", {
          name:
            language === "ko"
              ? "확인한 읽지 않은 메시지 1개입니다. 전체 개수와 다를 수 있습니다."
              : "1 observed unread messages. Not an exact total.",
        }),
      ).toBe(badge);
      expect(
        screen.getByText(
          language === "ko" ? "읽지 않은 멘션 1개" : "1 unread mention",
          { selector: ".sr-only" },
        ),
      ).toBe(mention);
      expect(view.container.querySelector("[data-fixture-label]")).toBe(label);
      expect(label).toHaveTextContent("Marked unread 한글");
      expect(row).toHaveFocus();
      expect(f.session.unread.snapshot(f.target)).toBe(snapshot);
      expect(f.session.unread.activity("room")).toBe(activity);
      expect([
        f.query.mock.calls.length,
        f.update.mock.calls.length,
        f.unread.subscribe.mock.calls.length,
        f.unread.subscribeActivity.mock.calls.length,
      ]).toEqual(baseline);
      expect(f.writeMute).not.toHaveBeenCalled();
      expect(selected).not.toHaveBeenCalled();
    }
    await userEvent.setup().click(row);
    expect(selected).toHaveBeenCalledExactlyOnceWith("room");
  } finally {
    view.unmount();
    f.dispose();
  }
});

function activityEvents(
  f: ReturnType<typeof fixture>,
  mentions: number,
  threads: number,
) {
  const events: RelayEvent[] = [];
  for (let i = 0; i < mentions; i++)
    events.push(
      message(f.peer, "room", `Raw Mention {count} ${i} 한글`, 20 + i, [
        ["p", f.viewer.pubkey],
      ]),
    );
  for (let i = 0; i < threads; i++) {
    const root = message(f.viewer, "room", `Raw Root ${i}`, 30 + 2 * i);
    events.push(
      root,
      message(f.peer, "room", `Raw Reply ${i} 한글`, 31 + 2 * i, [
        ["e", root.id, "", "reply"],
      ]),
    );
  }
  f.emit(events);
}
const activityCases = [
  {
    mentions: 0,
    threads: 1,
    en: "1 unread thread",
    ko: "읽지 않은 스레드 1개",
    staleEn: "1 unread thread; may be out of date",
    staleKo: "읽지 않은 스레드 1개입니다. 최신 정보가 아닐 수 있습니다.",
  },
  {
    mentions: 0,
    threads: 2,
    en: "2 unread threads",
    ko: "읽지 않은 스레드 2개",
    staleEn: "2 unread threads; may be out of date",
    staleKo: "읽지 않은 스레드 2개입니다. 최신 정보가 아닐 수 있습니다.",
  },
  {
    mentions: 1,
    threads: 1,
    en: "1 unread mention, 1 unread thread",
    ko: "읽지 않은 멘션 1개, 읽지 않은 스레드 1개",
    staleEn: "1 unread mention, 1 unread thread; may be out of date",
    staleKo:
      "읽지 않은 멘션 1개, 읽지 않은 스레드 1개입니다. 최신 정보가 아닐 수 있습니다.",
  },
  {
    mentions: 1,
    threads: 2,
    en: "1 unread mention, 2 unread threads",
    ko: "읽지 않은 멘션 1개, 읽지 않은 스레드 2개",
    staleEn: "1 unread mention, 2 unread threads; may be out of date",
    staleKo:
      "읽지 않은 멘션 1개, 읽지 않은 스레드 2개입니다. 최신 정보가 아닐 수 있습니다.",
  },
  {
    mentions: 2,
    threads: 1,
    en: "2 unread mentions, 1 unread thread",
    ko: "읽지 않은 멘션 2개, 읽지 않은 스레드 1개",
    staleEn: "2 unread mentions, 1 unread thread; may be out of date",
    staleKo:
      "읽지 않은 멘션 2개, 읽지 않은 스레드 1개입니다. 최신 정보가 아닐 수 있습니다.",
  },
  {
    mentions: 2,
    threads: 2,
    en: "2 unread mentions, 2 unread threads",
    ko: "읽지 않은 멘션 2개, 읽지 않은 스레드 2개",
    staleEn: "2 unread mentions, 2 unread threads; may be out of date",
    staleKo:
      "읽지 않은 멘션 2개, 읽지 않은 스레드 2개입니다. 최신 정보가 아닐 수 있습니다.",
  },
];
it.each(activityCases)(
  "keeps real $mentions-mention/$threads-thread activity and stale semantics without refetching on language",
  async (c) => {
    const f = fixture();
    activityEvents(f, c.mentions, c.threads);
    await f.session.unread.ensure();
    await f.session.sidebarPreferences.ensure();
    const view = render(
      <button type="button">
        <UnreadBadge session={f.session} channelId="room" />
      </button>,
    );
    try {
      await act(async () => {
        await f.session.unread.ensure();
      });
      const dot = screen.getByRole("img", { name: c.en });
      expect(dot).toHaveAttribute("data-channel-activity", "");
      const row = screen.getByRole("button");
      row.focus();
      for (const stale of [false, true]) {
        if (stale) act(() => f.disconnect());
        const snapshot = f.session.unread.snapshot(f.target),
          activity = f.session.unread.activity("room");
        expect(snapshot.freshness).toBe(stale ? "stale" : "observed");
        expect(activity.items).toHaveLength(c.threads);
        expect(activity.mentions).toHaveLength(c.mentions);
        const baseline = [
          f.query.mock.calls.length,
          f.update.mock.calls.length,
          f.unread.subscribe.mock.calls.length,
          f.unread.subscribeActivity.mock.calls.length,
        ];
        for (const language of ["ko", "en"] as const) {
          act(() => setLanguage(language));
          const label =
            language === "ko"
              ? stale
                ? c.staleKo
                : c.ko
              : stale
                ? c.staleEn
                : c.en;
          expect(screen.getByRole("img", { name: label })).toBe(dot);
          expect(dot).toHaveAttribute("title", label);
          expect(row).toHaveFocus();
          expect(f.session.unread.snapshot(f.target)).toBe(snapshot);
          expect(f.session.unread.activity("room")).toBe(activity);
          expect([
            f.query.mock.calls.length,
            f.update.mock.calls.length,
            f.unread.subscribe.mock.calls.length,
            f.unread.subscribeActivity.mock.calls.length,
          ]).toEqual(baseline);
          expect(f.writeMute).not.toHaveBeenCalled();
        }
      }
    } finally {
      view.unmount();
      f.dispose();
    }
  },
);

it.each([1, 2])(
  "speaks %i real mentions without a thread, including stale evidence",
  async (count) => {
    const f = fixture();
    activityEvents(f, count, 0);
    await f.session.unread.ensure();
    await f.session.sidebarPreferences.ensure();
    const view = render(<UnreadBadge session={f.session} channelId="room" />);
    try {
      const text = screen.getByText(
        count === 1 ? "1 unread mention" : "2 unread mentions",
        { selector: ".sr-only" },
      );
      for (const stale of [false, true]) {
        if (stale) act(() => f.disconnect());
        for (const language of ["ko", "en"] as const) {
          act(() => setLanguage(language));
          const en =
            count === 1
              ? stale
                ? "1 unread mention; may be out of date"
                : "1 unread mention"
              : stale
                ? "2 unread mentions; may be out of date"
                : "2 unread mentions";
          const ko =
            count === 1
              ? stale
                ? "읽지 않은 멘션 1개입니다. 최신 정보가 아닐 수 있습니다."
                : "읽지 않은 멘션 1개"
              : stale
                ? "읽지 않은 멘션 2개입니다. 최신 정보가 아닐 수 있습니다."
                : "읽지 않은 멘션 2개";
          expect(
            screen.getByText(language === "ko" ? ko : en, {
              selector: ".sr-only",
            }),
          ).toBe(text);
          expect(
            view.container.querySelector("[data-channel-activity]"),
          ).toBeNull();
          expect(
            view.container.querySelector("[data-channel-priority]"),
          ).toHaveAttribute("aria-hidden", "true");
        }
      }
    } finally {
      view.unmount();
      f.dispose();
    }
  },
);

it.each(["local", "remote"] as const)(
  "preserves real %s manual intent and an unknown count while language changes",
  async (mode) => {
    const seed =
      mode === "remote"
        ? {
            ...newReadJournal(),
            state: {
              frontiers: {},
              overrides: { room: { set: 1, clear: 0, baseline: 0 } },
            },
          }
        : undefined;
    const f = fixture(seed);
    await f.session.unread.ensure();
    await f.session.sidebarPreferences.ensure();
    if (mode === "local") await f.session.unread.markUnreadLocal(f.target);
    expect(f.session.unread.snapshot(f.target)).toMatchObject({
      observedCount: null,
      manual: mode === "local" ? "local-only" : "remote",
    });
    const view = render(
      <UnreadBadge
        session={f.session}
        channelId="room"
        label="Marked unread"
      />,
    );
    try {
      const badge = screen.getByRole("img", {
        name:
          mode === "local"
            ? "Marked unread on this device only"
            : "Marked unread",
      });
      const snapshot = f.session.unread.snapshot(f.target),
        activity = f.session.unread.activity("room");
      const calls = [f.query.mock.calls.length, f.update.mock.calls.length];
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        const name =
          language === "ko"
            ? mode === "local"
              ? "이 기기에서만 읽지 않음으로 표시됨"
              : "읽지 않음으로 표시됨"
            : mode === "local"
              ? "Marked unread on this device only"
              : "Marked unread";
        expect(screen.getByRole("img", { name })).toBe(badge);
        expect(
          view.container.querySelector("[data-channel-unread-title]"),
        ).toHaveTextContent("Marked unread");
        expect(f.session.unread.snapshot(f.target)).toBe(snapshot);
        expect(f.session.unread.activity("room")).toBe(activity);
        expect([f.query.mock.calls.length, f.update.mock.calls.length]).toEqual(
          calls,
        );
        expect(f.writeMute).not.toHaveBeenCalled();
      }
    } finally {
      view.unmount();
      f.dispose();
    }
  },
);

it("formats 1000 actual live unread observations only in the display, with explicit approximate and stale wording", async () => {
  const f = fixture();
  f.emit(
    Array.from({ length: 1000 }, (_, i) =>
      message(f.peer, "room", `Raw body ${i}`, 20 + i),
    ),
  );
  await f.session.unread.ensure();
  await f.session.sidebarPreferences.ensure();
  expect(f.session.unread.snapshot(f.target)).toMatchObject({
    observedCount: 1000,
    attentionCount: 0,
    freshness: "observed",
  });
  const view = render(<UnreadBadge session={f.session} channelId="room" />);
  try {
    const badge = screen.getByRole("img", {
      name: "1,000 observed unread messages. Not an exact total.",
    });
    for (const stale of [false, true]) {
      if (stale) act(() => f.disconnect());
      const snapshot = f.session.unread.snapshot(f.target),
        calls = [f.query.mock.calls.length, f.update.mock.calls.length];
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        const en = stale
          ? "1,000 observed unread messages; may be out of date. Not an exact total."
          : "1,000 observed unread messages. Not an exact total.";
        const ko = stale
          ? "확인한 읽지 않은 메시지 1,000개입니다. 최신 정보가 아닐 수 있으며 전체 개수와 다를 수 있습니다."
          : "확인한 읽지 않은 메시지 1,000개입니다. 전체 개수와 다를 수 있습니다.";
        expect(
          screen.getByRole("img", { name: language === "ko" ? ko : en }),
        ).toBe(badge);
        expect(snapshot.observedCount).toBe(1000);
        expect(f.session.unread.snapshot(f.target)).toBe(snapshot);
        expect([f.query.mock.calls.length, f.update.mock.calls.length]).toEqual(
          calls,
        );
      }
    }
  } finally {
    view.unmount();
    f.dispose();
  }
});

it("preserves unknown, actual zero and undefined/null/empty/raw ReactNode label visibility", async () => {
  const f = fixture();
  await f.session.unread.ensure();
  await f.session.sidebarPreferences.ensure();
  expect(f.session.unread.snapshot(f.target).observedCount).toBeNull();
  const view = render(<UnreadBadge session={f.session} channelId="room" />);
  try {
    const before = [f.query.mock.calls.length, f.update.mock.calls.length];
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(view.container).toBeEmptyDOMElement();
      expect(f.session.unread.snapshot(f.target).observedCount).toBeNull();
      expect([f.query.mock.calls.length, f.update.mock.calls.length]).toEqual(
        before,
      );
    }
    view.rerender(
      <UnreadBadge session={f.session} channelId="room" label={null} />,
    );
    const empty = view.container.querySelector("span");
    expect(empty).toBeEmptyDOMElement();
    view.rerender(
      <UnreadBadge session={f.session} channelId="room" label="" />,
    );
    expect(view.container.querySelector("span")).toBe(empty);
    act(() => f.emit([message(f.viewer, "room", "Raw self message", 11)]));
    expect(f.session.unread.snapshot(f.target)).toMatchObject({
      observedCount: 0,
      manual: "none",
    });
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(view.container.querySelector("span")).toBe(empty);
      expect(empty).toBeEmptyDOMElement();
      expect(screen.queryByRole("img")).toBeNull();
      expect(f.session.unread.snapshot(f.target).observedCount).toBe(0);
    }
    view.rerender(
      <UnreadBadge
        session={f.session}
        channelId="room"
        label={
          <em data-fixture-raw="">Marked unread on this device only 한글</em>
        }
      />,
    );
    const raw = view.container.querySelector("[data-fixture-raw]");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(view.container.querySelector("span")).toBe(empty);
      expect(view.container.querySelector("[data-fixture-raw]")).toBe(raw);
      expect(raw).toHaveTextContent("Marked unread on this device only 한글");
      expect(empty).not.toHaveAttribute("data-channel-unread-title");
      expect(screen.queryByRole("img")).toBeNull();
    }
    view.rerender(<UnreadBadge session={f.session} channelId="room" />);
    expect(view.container).toBeEmptyDOMElement();
  } finally {
    view.unmount();
    f.dispose();
  }
});

it.each([
  {
    policy: "ordinary",
    dm: false,
    all: false,
    preserve: false,
    badge: false,
    bold: false,
  },
  {
    policy: "all",
    dm: false,
    all: true,
    preserve: false,
    badge: true,
    bold: true,
  },
  {
    policy: "preserve",
    dm: false,
    all: false,
    preserve: true,
    badge: true,
    bold: false,
  },
  {
    policy: "DM",
    dm: true,
    all: false,
    preserve: false,
    badge: true,
    bold: false,
  },
])(
  "preserves the muted $policy policy independently of translated copy",
  async (c) => {
    const f = fixture();
    f.emit([message(f.peer, "room", "Raw ordinary body", 11)]);
    await f.session.unread.ensure();
    await f.session.sidebarPreferences.ensure();
    await f.session.sidebarPreferences.setMute("room", true);
    const view = render(
      <button type="button">
        <UnreadBadge
          session={f.session}
          channelId="room"
          dm={c.dm}
          labelUnread={c.all ? "all" : "ordinary"}
          preserveUnread={c.preserve}
          label="Raw Marked unread"
        />
      </button>,
    );
    try {
      const row = screen.getByRole("button");
      row.focus();
      const snapshot = f.session.unread.snapshot(f.target);
      const baseline = [
        f.query.mock.calls.length,
        f.update.mock.calls.length,
        f.writeMute.mock.calls.length,
      ];
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        const marker = view.container.querySelector("[data-channel-unread]");
        if (c.badge) {
          expect(marker).toHaveAttribute(
            "aria-label",
            language === "ko"
              ? "확인한 읽지 않은 메시지 1개입니다. 전체 개수와 다를 수 있습니다."
              : "1 observed unread messages. Not an exact total.",
          );
          expect(marker).toHaveAttribute("data-channel-muted", "true");
        } else expect(marker).toBeNull();
        expect(
          view.container.querySelector("[data-channel-unread-title]") !== null,
        ).toBe(c.bold);
        expect(
          view.container.querySelector("[data-channel-priority]"),
        ).toBeNull();
        expect(row).toHaveTextContent("Raw Marked unread");
        expect(row).toHaveFocus();
        expect(f.session.unread.snapshot(f.target)).toBe(snapshot);
        expect([
          f.query.mock.calls.length,
          f.update.mock.calls.length,
          f.writeMute.mock.calls.length,
        ]).toEqual(baseline);
      }
      expect(f.writeMute).toHaveBeenCalledExactlyOnceWith(
        { channelId: "room", muted: true },
        expect.any(AbortSignal),
      );
    } finally {
      view.unmount();
      f.dispose();
    }
  },
);

it("keeps an activity dot until mute is confirmed, then retains its whole accessible message without changing unread evidence", async () => {
  const f = fixture();
  activityEvents(f, 1, 1);
  await f.session.unread.ensure();
  await f.session.sidebarPreferences.ensure();
  const gate = deferred<void>();
  f.holdMute(gate.promise);
  const view = render(
    <button type="button">
      <UnreadBadge session={f.session} channelId="room" />
    </button>,
  );
  let pending: Promise<readonly string[]> | undefined;
  try {
    const dot = screen.getByRole("img", {
      name: "1 unread mention, 1 unread thread",
    });
    const row = screen.getByRole("button");
    row.focus();
    await act(async () => {
      pending = f.session.sidebarPreferences.setMute("room", true);
      await f.muteStarted.promise;
    });
    const snapshot = f.session.unread.snapshot(f.target),
      activity = f.session.unread.activity("room");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("img", {
          name:
            language === "ko"
              ? "읽지 않은 멘션 1개, 읽지 않은 스레드 1개"
              : "1 unread mention, 1 unread thread",
        }),
      ).toBe(dot);
      expect(f.session.sidebarPreferences.snapshot().data?.muted).toEqual([]);
      expect(f.writeMute).toHaveBeenCalledOnce();
      expect(row).toHaveFocus();
    }
    await act(async () => {
      gate.resolve();
      await pending;
    });
    expect(view.container.querySelector("[data-channel-activity]")).toBeNull();
    const text = screen.getByText("1 unread mention, 1 unread thread", {
      selector: ".sr-only",
    });
    const calls = [
      f.query.mock.calls.length,
      f.update.mock.calls.length,
      f.writeMute.mock.calls.length,
    ];
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByText(
          language === "ko"
            ? "읽지 않은 멘션 1개, 읽지 않은 스레드 1개"
            : "1 unread mention, 1 unread thread",
          { selector: ".sr-only" },
        ),
      ).toBe(text);
      expect(f.session.unread.snapshot(f.target)).toBe(snapshot);
      expect(f.session.unread.activity("room")).toBe(activity);
      expect([
        f.query.mock.calls.length,
        f.update.mock.calls.length,
        f.writeMute.mock.calls.length,
      ]).toEqual(calls);
      expect(row).toHaveFocus();
    }
  } finally {
    await act(async () => {
      gate.resolve();
      await pending;
    });
    view.unmount();
    f.dispose();
  }
});
