import "@testing-library/jest-dom/vitest";
import { setLanguage } from "../../shared/i18n";
// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, assert, expect, it, vi } from "vitest";
import { createRelaySession } from "../../features/relay/session";
import type { RelayData } from "../../features/relay/service";
import { foldMessages } from "../../features/relay/fold";
import { createHuddles } from "../../features/huddle/service";
import { HuddleCard, huddleTarget } from "./HuddleCard";

afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.restoreAllMocks();
});
it.each([-3601, 86400, -30, 0])(
  "preserves View and prevents joining expired, future, ended, or archived starts (%s)",
  async (offset) => {
    const parent = "00000000-0000-4000-8000-000000000001";
    const room = "00000000-0000-4000-8000-000000000002";
    const viewer = "ab".repeat(32);
    const store = createRelaySession(null);
    let status: "loading" | "error" = "loading";
    let notify = () => {};
    const dispose = vi.fn();
    const session = {
      ...store.session,
      channels: {
        ...store.session.channels,
        list: () => ({
          status: "ready" as const,
          channels: [
            {
              id: parent,
              name: "Parent",
              ...(offset === 0 ? { archived: true as const } : {}),
            },
          ],
        }),
      },
      observe: () => ({
        snapshot: () => ({ status, events: [] }),
        subscribe: (listener: () => void) => {
          notify = listener;
          return () => {
            notify = () => {};
          };
        },
        refresh: async () => {
          status = "error";
          notify();
        },
        dispose,
      }),
    };
    const snapshot = {
      status: "ready" as const,
      generation: 1,
      scope: "expired-card",
      viewer,
      session,
    };
    const relay: RelayData = {
      snapshot: () => snapshot,
      subscribe: () => () => {},
      retry() {},
      disconnect() {},
      async clearCache() {},
    };
    const huddles = createHuddles(
      relay,
      {
        available: false,
        open: async () => {},
        close: async () => {},
        touch: async () => {},
        send: async () => {},
      },
      async () => {
        throw new Error("No call expected");
      },
    );
    const [message] = foldMessages(parent, viewer, [
      {
        id: "1".repeat(64),
        pubkey: viewer,
        kind: 48100,
        created_at: Math.floor(Date.now() / 1000) + offset,
        tags: [["h", parent]],
        content: JSON.stringify({ ephemeral_channel_id: room }),
      },
      ...(offset === -30
        ? [
            {
              id: "2".repeat(64),
              pubkey: viewer,
              kind: 48103,
              created_at: Math.floor(Date.now() / 1000) - 10,
              tags: [["h", parent]],
              content: JSON.stringify({ ephemeral_channel_id: room }),
            },
          ]
        : []),
    ]);
    assert.exists(message);
    const open = vi.fn(() => true);
    const view = render(
      <HuddleCard
        message={message}
        relay={relay}
        huddles={huddles}
        open={open}
        showWindow={async () => {}}
      />,
    );
    if (offset === 0) {
      const join = screen.getByRole("button", {
        name: "Join",
      }) as HTMLButtonElement;
      expect(join.disabled).toBe(true);
    } else {
      fireEvent.click(await screen.findByRole("button", { name: "View" }));
      expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
      expect(open).toHaveBeenCalledWith(huddleTarget(parent, room));
    }
    view.unmount();
    expect(dispose).toHaveBeenCalledOnce();
    huddles.dispose();
    store.dispose();
  },
);

it.each(["active", "current", "ended"] as const)(
  "keeps %s card controls, time and exact target across languages",
  async (mode) => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 10, 9, 0));
    const now = Date.now() / 1000;
    const parent = "00000000-0000-4000-8000-000000000001",
      room = "00000000-0000-4000-8000-000000000002";
    const viewer = "ab".repeat(32);
    const scope = `https://relay.example:${viewer}`;
    const store = createRelaySession(null);
    const event = {
      id: "1".repeat(64),
      pubkey: viewer,
      kind: 48100,
      created_at: now - 65,
      tags: [["h", parent]],
      content: JSON.stringify({ ephemeral_channel_id: room }),
    };
    const events = [
      event,
      ...(mode === "ended"
        ? [{ ...event, id: "2".repeat(64), kind: 48103, created_at: now - 5 }]
        : []),
    ];
    const observe = vi.fn(() => ({
      snapshot: () => ({ status: "ready" as const, events }),
      subscribe: () => () => {},
      refresh: vi.fn(async () => {}),
      dispose: vi.fn(),
    }));
    const session = {
      ...store.session,
      observe,
      channels: {
        ...store.session.channels,
        list: () => ({
          status: "ready" as const,
          channels: [{ id: parent, name: "Raw parent 한글" }],
        }),
      },
    };
    const snapshot = {
      status: "ready" as const,
      generation: 1,
      scope,
      viewer,
      session,
    };
    const relay: RelayData = {
      snapshot: () => snapshot,
      subscribe: () => () => {},
      retry() {},
      disconnect() {},
      async clearCache() {},
    };
    const audio = vi.fn(async () => {
      throw new Error("No audio expected");
    });
    const huddles = createHuddles(
      relay,
      {
        available: false,
        open: async () => {},
        close: async () => {},
        touch: async () => {},
        send: async () => {},
      },
      audio,
    );
    if (mode === "current")
      vi.spyOn(huddles, "snapshot").mockReturnValue({
        phase: "connected",
        room,
        muted: false,
        participants: [],
        destination: {
          scope,
          viewer,
          relayUrl: "wss://relay.example",
          channelId: parent,
          channelName: "Raw parent 한글",
        },
      });
    vi.spyOn(huddles, "canJoin").mockReturnValue(true);
    const join = vi.spyOn(huddles, "join").mockResolvedValue();
    const leave = vi.spyOn(huddles, "leave").mockResolvedValue();
    const open = vi.fn(() => true),
      showWindow = vi.fn(async () => {});
    const [message] = foldMessages(parent, viewer, events);
    assert.exists(message);
    const view = render(
      <HuddleCard
        message={message}
        relay={relay}
        huddles={huddles}
        open={open}
        showWindow={showWindow}
      />,
    );
    try {
      const region = await screen.findByRole("region", {
        name: mode === "ended" ? "Huddle ended" : "Huddle",
      });
      const english =
        mode === "ended" ? "View" : mode === "current" ? "Open" : "Join";
      const korean =
        mode === "ended" ? "보기" : mode === "current" ? "열기" : "참여";
      const button = await screen.findByRole("button", { name: english });
      const time = region.querySelector("time");
      expect(time).toHaveTextContent(mode === "ended" ? "1:00" : "1:05");
      button.focus();
      act(() => setLanguage("ko"));
      expect(
        screen.getByRole("region", {
          name: mode === "ended" ? "허들 종료됨" : "허들",
        }),
      ).toBe(region);
      expect(screen.getByRole("button", { name: korean })).toBe(button);
      expect(region.querySelector("time")).toBe(time);
      expect(button).toHaveFocus();
      expect(observe).toHaveBeenCalledOnce();
      expect(join).not.toHaveBeenCalled();
      act(() => setLanguage("en"));
      expect(screen.getByRole("button", { name: english })).toBe(button);
      fireEvent.click(button);
      if (mode === "ended")
        expect(open).toHaveBeenCalledExactlyOnceWith(
          huddleTarget(parent, room),
        );
      else if (mode === "current") expect(showWindow).toHaveBeenCalledOnce();
      else
        expect(join).toHaveBeenCalledExactlyOnceWith(
          {
            scope,
            viewer,
            relayUrl: "https://relay.example",
            channelId: parent,
            channelName: "Raw parent 한글",
          },
          room,
        );
      expect(audio).not.toHaveBeenCalled();
      expect(leave).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      await huddles.dispose();
      store.dispose();
    }
  },
);
