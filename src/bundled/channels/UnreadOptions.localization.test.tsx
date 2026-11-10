// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import {
  createRelaySession,
  type RelaySession,
} from "../../features/relay/session";
import type { ReadFilter, RelayEvent } from "../../features/relay/events";
import type { LiveCallbacks } from "../../features/relay/live";
import {
  readJournal,
  type ReadJournal,
} from "../../features/relay/read-state-storage";
import {
  keypair,
  metadata,
  roster,
  message,
  signed,
  bounds,
} from "../../features/relay/testing";
import type { ReadStateSigning } from "../../features/relay/read-state-host";
import {
  decodeReadState,
  signReadState,
  // @ts-expect-error Existing production Node codec has no TypeScript declaration.
} from "../../../browser-host/read-state.mjs";
import { UnreadOptions } from "./UnreadBadge";

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
function fixture(
  capability: "unsupported" | "read-only" | "frontier-sync" = "read-only",
) {
  const viewer = keypair(),
    relay = keypair(),
    peer = keypair();
  let journal: ReadJournal | undefined;
  let live: LiveCallbacks | undefined;
  let scripted:
    | {
        reject: boolean;
        reason?: unknown;
        gate?: Promise<void>;
        started: ReturnType<typeof deferred<void>>;
      }
    | undefined;
  let signGate: Promise<void> | undefined;
  const signStarted = deferred<void>();
  const update = vi.fn(
    async (change: (current: ReadJournal | undefined) => ReadJournal) => {
      const next = scripted;
      if (next) {
        scripted = undefined;
        next.started.resolve();
        await next.gate;
        if (next.reject) throw next.reason;
      }
      journal = readJournal(change(journal), viewer.pubkey);
      return journal;
    },
  );
  const query = vi.fn(
    async (filters: readonly ReadFilter[]): Promise<RelayEvent[]> =>
      filters.some(
        (filter) => filter.top_level && filter["#h"]?.includes("room"),
      )
        ? [
            bounds(relay, "room", "head", {
              has_more: false,
              next_cursor: null,
            }),
          ]
        : [],
  );
  const sign = vi.fn(async (intent: ReadStateSigning): Promise<RelayEvent> => {
    signStarted.resolve();
    await signGate;
    return signReadState(intent, viewer.secret);
  });
  const publish = vi.fn(async () => undefined);
  const owner = createRelaySession(
    {
      viewer: viewer.pubkey,
      relayAuthor: relay.pubkey,
      query,
      media: () => undefined,
      ...(capability === "unsupported"
        ? {}
        : {
            readState: {
              decode: async (events: readonly RelayEvent[]) =>
                decodeReadState(events, viewer.secret),
              ...(capability === "frontier-sync" ? { sign, publish } : {}),
            },
          }),
      subscribe(callbacks) {
        live = callbacks;
        return { update() {}, retry() {}, dispose() {} };
      },
    },
    {
      readStateFloor: () => 0,
      readStateStorage: { update, read: async () => journal, close() {} },
      readPublisherLock: async (_signal, work) => work(),
    },
  );
  const base = owner.session;
  const unread = {
    ...base.unread,
    markUnreadLocal: vi.fn(base.unread.markUnreadLocal),
    markThrough: vi.fn(base.unread.markThrough),
    refresh: vi.fn(base.unread.refresh),
    retrySync: vi.fn(base.unread.retrySync),
    subscribeSync: vi.fn(base.unread.subscribeSync),
  };
  const session: RelaySession = { ...base, unread };
  const emit = (events: readonly RelayEvent[]) => {
    if (!live) throw new Error("Missing actual live fixture");
    live.receive(events);
  };
  emit([
    roster(relay, "room", [viewer.pubkey], 10),
    metadata(relay, "room", "Raw channel 1000 {status}", 10),
  ]);
  const dispose = () => {
    owner.dispose();
    disposers.delete(dispose);
  };
  disposers.add(dispose);
  return {
    session,
    target: { kind: "channel" as const, channelId: "room" },
    unread,
    viewer,
    relay,
    peer,
    emit,
    query,
    update,
    sign,
    publish,
    signStarted,
    journal: () => journal,
    fail(reason: unknown, gate?: Promise<void>) {
      const started = deferred<void>();
      scripted = { reject: true, reason, ...(gate ? { gate } : {}), started };
      return started.promise;
    },
    holdUpdate(gate: Promise<void>) {
      const started = deferred<void>();
      scripted = { reject: false, gate, started };
      return started.promise;
    },
    holdSign(gate: Promise<void>) {
      signGate = gate;
    },
    dispose,
  };
}

it("keeps real read-only details and focused controls through EN/KO/EN without changing diagnostics or operations", async () => {
  const f = fixture();
  await f.session.unread.ensure();
  expect(f.session.unread.sync()).toMatchObject({
    capability: "read-only",
    status: "reconciled",
  });
  const view = render(<UnreadOptions session={f.session} channelId="room" />);
  const user = userEvent.setup();
  try {
    const summary = screen.getByText("Unread status", { selector: "summary" });
    await user.click(summary);
    const details = summary.closest("details");
    expect(details).toHaveAttribute("open");
    const button = screen.getByRole("button", {
      name: "Mark unread on this device",
    });
    const refresh = screen.getByRole("button", {
      name: "Refresh unread observations",
    });
    const diagnostic = screen.getByText("Read sync: read-only · reconciled");
    button.focus();
    const snapshot = f.session.unread.sync();
    const calls = [
      f.query.mock.calls.length,
      f.update.mock.calls.length,
      f.unread.subscribeSync.mock.calls.length,
    ];
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name:
            language === "ko"
              ? "이 기기에서 읽지 않음으로 표시"
              : "Mark unread on this device",
        }),
      ).toBe(button);
      expect(
        screen.getByRole("button", {
          name:
            language === "ko"
              ? "읽지 않음 정보 새로고침"
              : "Refresh unread observations",
        }),
      ).toBe(refresh);
      expect(
        screen.getByText(
          language === "ko" ? "읽지 않음 상태" : "Unread status",
          { selector: "summary" },
        ),
      ).toBe(summary);
      expect(diagnostic).toHaveTextContent(
        language === "ko"
          ? "읽음 동기화: read-only · reconciled"
          : "Read sync: read-only · reconciled",
      );
      expect(details).toHaveAttribute("open");
      expect(button).toHaveFocus();
      expect(f.session.unread.sync()).toBe(snapshot);
      expect([
        f.query.mock.calls.length,
        f.update.mock.calls.length,
        f.unread.subscribeSync.mock.calls.length,
      ]).toEqual(calls);
      expect(f.unread.markUnreadLocal).not.toHaveBeenCalled();
      expect(f.unread.refresh).not.toHaveBeenCalled();
      expect(f.sign).not.toHaveBeenCalled();
      expect(f.publish).not.toHaveBeenCalled();
    }
    await user.click(button);
    await waitFor(() =>
      expect(f.session.unread.snapshot(f.target).manual).toBe("local-only"),
    );
    expect(f.unread.markUnreadLocal).toHaveBeenCalledExactlyOnceWith({
      kind: "channel",
      channelId: "room",
    });
    await user.click(refresh);
    const refreshed = f.unread.refresh.mock.results[0];
    if (refreshed?.type !== "return")
      throw new Error("Missing actual refresh operation");
    await act(async () => {
      await refreshed.value;
    });
    expect(f.unread.refresh.mock.calls).toEqual([[]]);
    expect(f.sign).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    f.dispose();
  }
});

class FixtureFailure extends Error {
  constructor() {
    super("Load a verified message before marking through it.");
    this.name = "FixtureFailure";
  }
}
const failures = [
  { name: "empty Error", reason: () => new Error(""), raw: "", own: false },
  {
    name: "same-English Error",
    reason: () => new Error("Read-state operation failed"),
    raw: "Read-state operation failed",
    own: false,
  },
  {
    name: "opaque numeric Error",
    reason: () => new Error("1000 {status} · opaque"),
    raw: "1000 {status} · opaque",
    own: false,
  },
  {
    name: "Error subclass",
    reason: () => new FixtureFailure(),
    raw: "Load a verified message before marking through it.",
    own: false,
  },
  {
    name: "same-English string",
    reason: () => "Read-state operation failed",
    raw: "Read state unavailable",
    own: true,
  },
  {
    name: "null",
    reason: () => null,
    raw: "Read state unavailable",
    own: true,
  },
  {
    name: "undefined",
    reason: () => undefined,
    raw: "Read state unavailable",
    own: true,
  },
  {
    name: "opaque number",
    reason: () => 1000,
    raw: "Read state unavailable",
    own: true,
  },
  {
    name: "message-shaped object",
    reason: () => ({
      message: "Load a verified message before marking through it.",
    }),
    raw: "Read state unavailable",
    own: true,
  },
];
it.each(failures)(
  "keeps actual $name failure provenance and original empty-message truthiness",
  async (c) => {
    const f = fixture();
    await f.session.unread.ensure();
    const reason = c.reason();
    f.fail(reason);
    const view = render(<UnreadOptions session={f.session} channelId="room" />);
    const user = userEvent.setup();
    try {
      const summary = screen.getByText("Unread status", {
        selector: "summary",
      });
      await user.click(summary);
      const button = screen.getByRole("button", {
        name: "Mark unread on this device",
      });
      const before = f.journal();
      await user.click(button);
      const operation = f.unread.markUnreadLocal.mock.results[0];
      if (operation?.type !== "return")
        throw new Error("Missing real read operation");
      await expect(operation.value).rejects.toBe(reason);
      await waitFor(() =>
        expect(f.session.unread.sync()).toMatchObject({
          status: "error",
          error: c.raw,
        }),
      );
      await waitFor(() =>
        expect(screen.queryAllByRole("alert")).toHaveLength(c.raw ? 2 : 0),
      );
      const alerts = screen.queryAllByRole("alert");
      const snapshot = f.session.unread.sync();
      const calls = [
        f.query.mock.calls.length,
        f.update.mock.calls.length,
        f.unread.markUnreadLocal.mock.calls.length,
        f.unread.subscribeSync.mock.calls.length,
      ];
      button.focus();
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(screen.queryAllByRole("alert")).toEqual(alerts);
        if (c.raw) {
          const local = c.own
            ? language === "ko"
              ? "읽음 상태 작업에 실패했습니다."
              : "Read-state operation failed"
            : c.raw;
          expect(alerts.map((alert) => alert.textContent)).toEqual([
            local,
            c.raw,
          ]);
        }
        expect(button).toHaveFocus();
        expect(summary.closest("details")).toHaveAttribute("open");
        expect(f.session.unread.sync()).toBe(snapshot);
        expect(f.journal()).toBe(before);
        expect([
          f.query.mock.calls.length,
          f.update.mock.calls.length,
          f.unread.markUnreadLocal.mock.calls.length,
          f.unread.subscribeSync.mock.calls.length,
        ]).toEqual(calls);
        expect(f.sign).not.toHaveBeenCalled();
        expect(f.publish).not.toHaveBeenCalled();
      }
    } finally {
      view.unmount();
      f.dispose();
    }
  },
);

it("clears the old local fallback before the real held retry and preserves pending diagnostics without another operation", async () => {
  const f = fixture();
  await f.session.unread.ensure();
  f.fail(null);
  const view = render(<UnreadOptions session={f.session} channelId="room" />);
  const user = userEvent.setup(),
    gate = deferred<void>();
  let pending:
    | ReturnType<RelaySession["unread"]["markUnreadLocal"]>
    | undefined;
  try {
    const summary = screen.getByText("Unread status", { selector: "summary" });
    await user.click(summary);
    const button = screen.getByRole("button", {
      name: "Mark unread on this device",
    });
    await user.click(button);
    await screen.findByText("Read-state operation failed", {
      selector: "[role=alert]",
    });
    const started = f.holdUpdate(gate.promise);
    await user.click(button);
    await started;
    const result = f.unread.markUnreadLocal.mock.results[1];
    if (result?.type !== "return")
      throw new Error("Missing actual retry operation");
    pending = result.value;
    expect(
      screen.getAllByRole("alert").map((node) => node.textContent),
    ).toEqual(["Read state unavailable"]);
    const calls = [
      f.query.mock.calls.length,
      f.update.mock.calls.length,
      f.unread.markUnreadLocal.mock.calls.length,
    ];
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getAllByRole("alert").map((node) => node.textContent),
      ).toEqual(["Read state unavailable"]);
      expect(
        screen.getByRole("button", {
          name:
            language === "ko"
              ? "이 기기에서 읽지 않음으로 표시"
              : "Mark unread on this device",
        }),
      ).toBe(button);
      expect(button).toHaveFocus();
      expect(summary.closest("details")).toHaveAttribute("open");
      expect([
        f.query.mock.calls.length,
        f.update.mock.calls.length,
        f.unread.markUnreadLocal.mock.calls.length,
      ]).toEqual(calls);
    }
    await act(async () => {
      gate.resolve();
      await pending;
    });
    expect(screen.queryAllByRole("alert")).toEqual([]);
    expect(f.session.unread.snapshot(f.target).manual).toBe("local-only");
    expect(f.journal()).toMatchObject({
      revision: 1,
      localUnread: { room: 1 },
    });
    expect(f.unread.markUnreadLocal.mock.calls).toEqual([
      [{ kind: "channel", channelId: "room" }],
      [{ kind: "channel", channelId: "room" }],
    ]);
    expect(f.session.unread.sync()).toMatchObject({
      capability: "read-only",
      status: "local",
    });
  } finally {
    await act(async () => {
      gate.resolve();
      await pending;
    });
    view.unmount();
    f.dispose();
  }
});

it.each([
  { capability: "unsupported", channelId: undefined, mark: false, sync: false },
  { capability: "read-only", channelId: "", mark: false, sync: false },
  { capability: "frontier-sync", channelId: "room", mark: true, sync: true },
] as const)(
  "preserves the actual $capability/$channelId action guards and whole guidance",
  async (c) => {
    const f = fixture(c.capability);
    await f.session.unread.ensure();
    const view = render(
      <UnreadOptions session={f.session} channelId={c.channelId} />,
    );
    try {
      const summary = screen.getByText("Unread status", {
        selector: "summary",
      });
      await userEvent.setup().click(summary);
      const state = f.session.unread.sync();
      expect(state.capability).toBe(c.capability);
      const diagnostic = screen.getByText(
        `Read sync: ${state.capability} · ${state.status}`,
      );
      const guidance = screen.getByText(
        "Observed messages only—not exact totals. Manual unread is local to this device. Older read hints can expire; this is not an everlasting read receipt log.",
      );
      const calls = [f.query.mock.calls.length, f.update.mock.calls.length];
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.queryByRole("button", {
            name:
              language === "ko"
                ? "이 기기에서 읽지 않음으로 표시"
                : "Mark unread on this device",
          }) !== null,
        ).toBe(c.mark);
        expect(
          screen.queryByRole("button", {
            name:
              language === "ko"
                ? "불러온 메시지까지 읽음으로 표시"
                : "Mark read through loaded messages",
          }) !== null,
        ).toBe(c.sync);
        expect(
          screen.queryByRole("button", {
            name:
              language === "ko" ? "읽음 동기화 다시 시도" : "Retry read sync",
          }) !== null,
        ).toBe(c.sync);
        expect(guidance).toHaveTextContent(
          language === "ko"
            ? "확인한 메시지만 표시하며 전체 개수를 뜻하지 않습니다. 읽지 않음 표시는 이 기기에만 적용됩니다. 오래된 읽음 정보는 만료될 수 있으므로 영구적인 읽음 확인 기록이 아닙니다."
            : "Observed messages only—not exact totals. Manual unread is local to this device. Older read hints can expire; this is not an everlasting read receipt log.",
        );
        expect(diagnostic).toHaveTextContent(
          language === "ko"
            ? `읽음 동기화: ${state.capability} · ${state.status}`
            : `Read sync: ${state.capability} · ${state.status}`,
        );
        expect(f.session.unread.sync()).toBe(state);
        expect([f.query.mock.calls.length, f.update.mock.calls.length]).toEqual(
          calls,
        );
      }
    } finally {
      view.unmount();
      f.dispose();
    }
  },
);

it("retains the owned verified-message guard without a write and preserves the same alert and focus", async () => {
  const f = fixture("frontier-sync");
  await f.session.unread.ensure();
  const view = render(<UnreadOptions session={f.session} channelId="room" />);
  try {
    const button = screen.getByRole("button", {
      name: "Mark read through loaded messages",
    });
    expect(f.session.channels.window("room").rows).toEqual([]);
    const writes = f.update.mock.calls.length;
    await userEvent.setup().click(button);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Load a verified message before marking through it.",
    );
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("alert")).toBe(alert);
      expect(alert).toHaveTextContent(
        language === "ko"
          ? "먼저 검증된 메시지를 불러온 후 해당 메시지까지 읽음으로 표시하세요."
          : "Load a verified message before marking through it.",
      );
      expect(button).toHaveFocus();
      expect(f.unread.markThrough).not.toHaveBeenCalled();
      expect(f.update).toHaveBeenCalledTimes(writes);
      expect(f.sign).not.toHaveBeenCalled();
      expect(f.publish).not.toHaveBeenCalled();
    }
  } finally {
    view.unmount();
    f.dispose();
  }
});

it("ignores loaded membership/huddle rows and sends the last verified message ID unchanged through held sync and retry", async () => {
  const f = fixture("frontier-sync");
  await f.session.unread.ensure();
  f.session.channels.ensure("room");
  await waitFor(() =>
    expect(f.session.channels.window("room").status).toBe("ready"),
  );
  const membership = signed(f.relay, {
    kind: 40099,
    created_at: 20,
    tags: [["h", "room"]],
    content: JSON.stringify({
      type: "member_joined",
      actor: f.peer.pubkey,
      target: f.viewer.pubkey,
    }),
  });
  const huddle = signed(f.relay, {
    kind: 48100,
    created_at: 21,
    tags: [["h", "room"]],
    content: JSON.stringify({
      ephemeral_channel_id: "00000000-0000-4000-8000-000000000002",
    }),
  });
  act(() => f.emit([membership, huddle]));
  expect(f.session.channels.window("room").rows.map((row) => row.id)).toEqual([
    membership.id,
    huddle.id,
  ]);
  expect(f.session.channels.window("room").rows[0]?.membership).toMatchObject({
    type: "member_joined",
    actor: f.peer.pubkey,
    target: f.viewer.pubkey,
  });
  expect(f.session.channels.window("room").rows[1]?.huddle).toMatchObject({
    state: "started",
  });
  const view = render(<UnreadOptions session={f.session} channelId="room" />);
  const user = userEvent.setup(),
    gate = deferred<void>();
  let retry: ReturnType<RelaySession["unread"]["retrySync"]> | undefined;
  try {
    const read = screen.getByRole("button", {
      name: "Mark read through loaded messages",
    });
    const before = f.update.mock.calls.length;
    await user.click(read);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Load a verified message before marking through it.",
    );
    expect(f.unread.markThrough).not.toHaveBeenCalled();
    expect(f.update).toHaveBeenCalledTimes(before);
    const first = message(f.peer, "room", "Raw First 1000 {status}", 11),
      last = message(f.peer, "room", "Raw Last 한글", 13);
    act(() => f.emit([first, last]));
    expect(f.session.channels.window("room").rows.map((row) => row.id)).toEqual(
      [first.id, last.id, membership.id, huddle.id],
    );
    f.holdSign(gate.promise);
    await user.click(read);
    const readOperation = f.unread.markThrough.mock.results[0];
    if (readOperation?.type !== "return")
      throw new Error("Missing real verified read");
    await act(async () => {
      await readOperation.value;
    });
    expect(f.unread.markThrough).toHaveBeenCalledExactlyOnceWith(
      { kind: "channel", channelId: "room" },
      last.id,
    );
    expect(f.journal()?.state.frontiers.room).toBe(13);
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(
      screen.getByText("Unread status", { selector: "summary" }),
    );
    const button = screen.getByRole("button", { name: "Retry read sync" });
    await user.click(button);
    await f.signStarted.promise;
    const retried = f.unread.retrySync.mock.results[0];
    if (retried?.type !== "return")
      throw new Error("Missing actual sync retry");
    retry = retried.value;
    expect(f.session.unread.sync()).toMatchObject({
      capability: "frontier-sync",
      status: "pending",
    });
    const paragraph = screen.getByText("Read sync: frontier-sync · pending");
    const snapshot = f.session.unread.sync();
    const calls = [
      f.query.mock.calls.length,
      f.update.mock.calls.length,
      f.sign.mock.calls.length,
      f.publish.mock.calls.length,
      f.unread.retrySync.mock.calls.length,
    ];
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "읽음 동기화 다시 시도" : "Retry read sync",
        }),
      ).toBe(button);
      expect(paragraph).toHaveTextContent(
        language === "ko"
          ? "읽음 동기화: frontier-sync · pending"
          : "Read sync: frontier-sync · pending",
      );
      expect(button).toHaveFocus();
      expect(f.session.unread.sync()).toBe(snapshot);
      expect([
        f.query.mock.calls.length,
        f.update.mock.calls.length,
        f.sign.mock.calls.length,
        f.publish.mock.calls.length,
        f.unread.retrySync.mock.calls.length,
      ]).toEqual(calls);
    }
    await act(async () => {
      gate.resolve();
      await retry;
    });
    expect(f.unread.retrySync.mock.calls).toEqual([[]]);
    expect(f.sign).toHaveBeenCalledOnce();
    expect(f.publish).toHaveBeenCalledOnce();
    expect(f.sign.mock.calls[0]?.[0].blob.contexts.room).toBe(13);
    expect(f.journal()?.state.frontiers.room).toBe(13);
    expect(f.session.channels.window("room").rows.map((row) => row.id)).toEqual(
      [first.id, last.id, membership.id, huddle.id],
    );
  } finally {
    await act(async () => {
      gate.resolve();
      await retry;
    });
    view.unmount();
    f.dispose();
  }
});
