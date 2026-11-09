import { setLanguage } from "../../shared/i18n";
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { createRelaySession } from "../../features/relay/session";
import type { RelayData } from "../../features/relay/service";
import { createHuddles } from "../../features/huddle/service";
import { MenuRoot, MenuPopup } from "../../shared/design-system/ui/Menu";
import { HuddleCapsule } from "./HuddleCapsule";
import { HuddleLauncher, SoloHuddleMenu } from "./HuddleLauncher";

afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.restoreAllMocks();
});

it("moves idle Solo huddles to the menu while preserving Team's header action", async () => {
  const store = createRelaySession(null);
  const channel = {
    id: "chat",
    name: "Chat",
    channelType: "solo" as "solo" | "stream",
  };
  const list = { status: "ready" as const, channels: [channel] };
  const session = {
    ...store.session,
    channels: { ...store.session.channels, list: () => list },
  };
  const snapshot = {
    status: "ready" as const,
    generation: 1,
    scope: "https://example.com:viewer",
    viewer: "viewer",
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
      throw new Error("No audio expected");
    },
  );
  const start = vi.spyOn(huddles, "start").mockResolvedValue();
  const context = {
    scope: snapshot.scope,
    viewer: "viewer",
    channelId: "chat",
    channelName: "Chat",
    relayUrl: "wss://example.com",
  };
  const props = {
    context,
    relay,
    huddles,
    showWindow: async () => {},
    available: () => true,
  };
  try {
    const view = render(<HuddleLauncher {...props} />);
    expect(screen.queryByRole("button", { name: "Start a huddle" })).toBeNull();
    view.rerender(
      <MenuRoot open>
        <MenuPopup>
          <SoloHuddleMenu {...props} session={session} channelId="chat" />
        </MenuPopup>
      </MenuRoot>,
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Start a huddle" }),
    );
    expect(start).toHaveBeenCalledWith(context);
    const connecting = {
      phase: "connecting" as const,
      muted: false,
      participants: [],
    };
    vi.spyOn(huddles, "snapshot").mockReturnValue(connecting);
    const leave = vi.spyOn(huddles, "leave").mockResolvedValue();
    const presentation = { visible: false, failed: false };
    view.rerender(
      <>
        <HuddleCapsule
          relay={relay}
          huddles={huddles}
          companion={{
            snapshot: () => presentation,
            subscribe: () => () => {},
            open: async () => {},
            dispose: async () => {},
            dismissError: () => {},
          }}
        />
        <MenuRoot open>
          <MenuPopup>
            <SoloHuddleMenu {...props} session={session} channelId="chat" />
          </MenuPopup>
        </MenuRoot>
      </>,
    );
    // Sidebar starts must remain cancellable without any channel header.
    expect(screen.queryByRole("menuitem")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(leave).toHaveBeenCalledOnce();
    leave.mockClear();
    view.rerender(<HuddleLauncher {...props} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel Huddle connection" }),
    );
    expect(leave).toHaveBeenCalledOnce();
    for (const phase of ["connecting", "connected", "leaving"] as const) {
      vi.mocked(huddles.snapshot).mockReturnValue({
        ...connecting,
        phase,
        destination: { ...context, channelId: "other-chat" },
      });
      view.rerender(
        <>
          <HuddleLauncher {...props} />
          <MenuRoot open>
            <MenuPopup>
              <SoloHuddleMenu {...props} session={session} channelId="chat" />
            </MenuPopup>
          </MenuRoot>
        </>,
      );
      const label =
        phase === "connecting"
          ? "Cancel Huddle connection"
          : "Show active Huddle";
      expect(screen.getByRole("button", { name: label })).toBeVisible();
      expect(screen.queryByRole("menuitem", { name: label })).toBeNull();
    }
    vi.mocked(huddles.snapshot).mockRestore();
    channel.channelType = "stream";
    view.rerender(<HuddleLauncher {...props} />);
    start.mockClear();
    const headphones = screen.getByRole("button", {
      name: "Start or join a huddle",
    });
    // A stray tap on the header button asks before starting a call.
    await userEvent.click(headphones);
    const dialog = screen.getByRole("alertdialog", {
      name: "Start a huddle?",
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start huddle" }),
      ).toHaveFocus(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog).not.toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
    await userEvent.click(headphones);
    await userEvent.click(screen.getByRole("button", { name: "Start huddle" }));
    expect(start).toHaveBeenCalledWith(context);
    // A pending confirmation never carries over to another conversation.
    await userEvent.click(headphones);
    const other = { ...context, channelId: "other", channelName: "Other" };
    view.rerender(<HuddleLauncher {...props} context={other} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    view.rerender(<HuddleLauncher {...props} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    view.unmount();
  } finally {
    await huddles.dispose();
    store.dispose();
  }
});

it("offers voice for a capable agent DM, explains automatic joining, and keeps ordinary calls otherwise", async () => {
  const store = createRelaySession(null);
  const agent = {
    pubkey: "agent",
    name: "Codex",
    owner: "viewer",
    place: "here",
    relay: "https://example.com",
    type: "buzz.codex/codex",
  };
  const choices = {
    ...store.session.agentChoices.snapshot(),
    identities: [agent],
    selectable: [agent],
    archives: { status: "idle" as const, archived: [] },
  };
  const ensure = vi.fn();
  const channel = {
    id: "dm",
    name: "Codex",
    channelType: "dm" as const,
    members: ["viewer", "agent"],
  };
  const list = { status: "ready" as const, channels: [channel] };
  const session = {
    ...store.session,
    channels: { ...store.session.channels, list: () => list },
    agentChoices: {
      ...store.session.agentChoices,
      ensure,
      snapshot: () =>
        choices as unknown as ReturnType<
          typeof store.session.agentChoices.snapshot
        >,
    },
  };
  const snapshot = {
    status: "ready" as const,
    generation: 1,
    scope: "scope",
    viewer: "viewer",
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
      throw new Error("No real audio");
    },
  );
  let voice = true;
  const agentSnapshot = { status: "ready", running: [agent] };
  const agents = {
    snapshot: () => agentSnapshot,
    subscribe: () => () => {},
    types: () => (voice ? [{ key: "buzz.codex/codex", voice: () => {} }] : []),
  } as unknown as import("../../features/agents/service").Agents;
  const props = {
    agents,
    relay,
    huddles,
    context: {
      scope: "scope",
      viewer: "viewer",
      channelId: "dm",
      channelName: "Codex",
      relayUrl: "wss://example.com",
    },
    available: () => true,
    showWindow: async () => {},
  };
  const start = vi.spyOn(huddles, "start").mockResolvedValue();
  try {
    const view = render(<HuddleLauncher {...props} />);
    // Archive evidence loads; until then archives fail open, as elsewhere.
    expect(ensure).toHaveBeenCalledWith(false, true);
    await userEvent.click(
      screen.getByRole("button", { name: "Talk with Codex" }),
    );
    expect(
      screen.getByText(
        "Your microphone will turn on and Codex will join automatically.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start huddle" }));
    expect(start).toHaveBeenCalledWith(props.context);
    voice = false;
    view.rerender(<HuddleLauncher {...props} />);
    expect(
      screen.getByRole("button", { name: "Start or join a huddle" }),
    ).toBeInTheDocument();
  } finally {
    await huddles.dispose();
    store.dispose();
  }
});

function localizedLauncherFixture(
  phase: "idle" | "connected" | "connecting" = "idle",
) {
  const store = createRelaySession(null);
  const parent = "00000000-0000-4000-8000-000000000001";
  const room = "00000000-0000-4000-8000-000000000002";
  const list = {
    status: "ready" as const,
    channels: [
      { id: parent, name: "Raw parent 한글", channelType: "stream" as const },
      {
        id: room,
        name: "Raw room 한글",
        huddle: true as const,
        parentChannelId: parent,
        members: [],
      },
    ],
  };
  const resolve = vi.fn(async () => {});
  const session = {
    ...store.session,
    channels: { ...store.session.channels, list: () => list, resolve },
  };
  const snapshot = {
    status: "ready" as const,
    generation: 1,
    scope: "https://example.com:viewer",
    viewer: "viewer",
    session,
  };
  const relay: RelayData = {
    snapshot: () => snapshot,
    subscribe: () => () => {},
    retry() {},
    disconnect() {},
    async clearCache() {},
  };
  const bridge = {
    available: false,
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    touch: vi.fn(async () => {}),
    send: vi.fn(async () => {}),
  };
  const audio = vi.fn(async () => {
    throw new Error("No audio may open");
  });
  const huddles = createHuddles(relay, bridge, audio);
  const context = {
    scope: snapshot.scope,
    viewer: "viewer",
    channelId: parent,
    channelName: "Raw parent 한글",
    relayUrl: "wss://example.com",
  };
  const call = {
    phase,
    id: "fixture-call",
    destination: context,
    room,
    muted: false,
    participants: [],
  };
  vi.spyOn(huddles, "snapshot").mockReturnValue(call);
  const start = vi.spyOn(huddles, "start").mockResolvedValue();
  const join = vi.spyOn(huddles, "join").mockResolvedValue();
  const leave = vi.spyOn(huddles, "leave").mockResolvedValue();
  const showWindow = vi.fn(async () => {});
  return {
    store,
    session,
    huddles,
    context,
    bridge,
    audio,
    start,
    join,
    leave,
    resolve,
    props: { context, relay, huddles, showWindow, available: () => true },
    async dispose() {
      await huddles.dispose();
      store.dispose();
    },
  };
}

it("keeps the same Huddle confirmation and keyboard target across languages", async () => {
  const f = localizedLauncherFixture();
  const user = userEvent.setup();
  const view = render(<HuddleLauncher {...f.props} />);
  try {
    const trigger = screen.getByRole("button", {
      name: "Start or join a huddle",
    });
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog", { name: "Start a huddle?" });
    const start = screen.getByRole("button", { name: "Start huddle" });
    await waitFor(() => expect(start).toHaveFocus());
    act(() => setLanguage("ko"));
    expect(
      screen.getByRole("alertdialog", { name: "허들을 시작할까요?" }),
    ).toBe(dialog);
    expect(screen.getByRole("button", { name: "허들 시작" })).toBe(start);
    expect(start).toHaveFocus();
    expect(
      screen.getByText(
        "마이크가 켜지며 이 대화의 다른 사람들도 참여할 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(f.start).not.toHaveBeenCalled();
    expect(f.join).not.toHaveBeenCalled();
    expect(f.leave).not.toHaveBeenCalled();
    act(() => setLanguage("en"));
    expect(screen.getByRole("alertdialog", { name: "Start a huddle?" })).toBe(
      dialog,
    );
    expect(start).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(f.start).toHaveBeenCalledExactlyOnceWith(f.context);
    expect(f.audio).not.toHaveBeenCalled();
    expect(f.bridge.open).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    await f.dispose();
  }
});

it("keeps active options, raw clipboard feedback and room invitation through languages", async () => {
  const f = localizedLauncherFixture("connected");
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const view = render(<HuddleLauncher {...f.props} />);
  const link = `buzz://channel/${encodeURIComponent(f.context.channelId)}`;
  try {
    const options = screen.getByRole("button", { name: "Huddle options" });
    await user.click(options);
    const menu = await screen.findByRole("menu");
    const copy = screen.getByRole("menuitem", { name: "Copy link" });
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button", { name: "허들 옵션" })).toBe(options);
    expect(screen.getByRole("menu")).toBe(menu);
    expect(screen.getByRole("menuitem", { name: "링크 복사" })).toBe(copy);
    await user.click(copy);
    expect(write).toHaveBeenCalledExactlyOnceWith(link);
    expect(screen.getByRole("menuitem", { name: "링크 복사됨" })).toBe(copy);
    write.mockRejectedValueOnce(new Error("opaque clipboard diagnostic"));
    await user.click(copy);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      `복사하지 못했습니다. 이 링크를 직접 복사하세요: ${link}`,
    );
    act(() => setLanguage("en"));
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent(
      `Couldn’t copy. You can copy this link manually: ${link}`,
    );
    await user.click(screen.getByRole("menuitem", { name: "Add someone" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Huddle members",
    });
    act(() => setLanguage("ko"));
    expect(screen.getByRole("dialog", { name: "허들 참여자" })).toBe(dialog);
    expect(dialog).toHaveAccessibleDescription(
      "여기서 추가한 사람은 이 허들과 스레드에 참여할 수 있습니다. 기존 채팅은 비공개로 유지됩니다.",
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(options).toHaveFocus();
    expect(f.join).not.toHaveBeenCalled();
    expect(f.start).not.toHaveBeenCalled();
    expect(f.leave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "허들 나가기" }));
    expect(f.leave).toHaveBeenCalledOnce();
    expect(f.audio).not.toHaveBeenCalled();
    expect(f.bridge.open).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    await f.dispose();
  }
});

it.each([1, 2, 1000])(
  "uses a whole incoming join phrase without repeating discovery (%s)",
  async (count) => {
    const f = localizedLauncherFixture();
    const authority = "ab".repeat(32),
      creator = "cd".repeat(32);
    const start = {
      id: "fixture-start",
      pubkey: creator,
      kind: 48100,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["h", f.context.channelId]],
      content: JSON.stringify({
        ephemeral_channel_id: "00000000-0000-4000-8000-000000000002",
      }),
    };
    const events = [
      start,
      ...Array.from({ length: count }, (_, i) => ({
        ...start,
        id: `fixture-join-${i}`,
        pubkey: authority,
        kind: 48101,
        tags: [...start.tags, ["p", (i + 1).toString(16).padStart(64, "0")]],
      })),
    ];
    const observe = vi.fn(() => ({
      snapshot: () => ({ status: "ready" as const, events }),
      subscribe: () => () => {},
      refresh: async () => {},
      dispose: vi.fn(),
    }));
    Object.assign(f.session, { relayAuthor: authority, observe });
    vi.spyOn(f.huddles, "canJoin").mockReturnValue(true);
    const view = render(<HuddleLauncher {...f.props} />);
    const user = userEvent.setup();
    try {
      const button = await screen.findByRole("button", {
        name: `Join active huddle (${count.toLocaleString("en-US")} ${count === 1 ? "participant" : "participants"})`,
      });
      button.focus();
      const reads = observe.mock.calls.length;
      act(() => setLanguage("ko"));
      expect(
        screen.getByRole("button", {
          name: `진행 중인 허들 참여 (참여자 ${count.toLocaleString("ko-KR")}명)`,
        }),
      ).toBe(button);
      expect(button).toHaveFocus();
      expect(observe).toHaveBeenCalledTimes(reads);
      expect(f.join).not.toHaveBeenCalled();
      act(() => setLanguage("en"));
      await user.keyboard("{Enter}");
      expect(f.join).toHaveBeenCalledExactlyOnceWith(
        f.context,
        "00000000-0000-4000-8000-000000000002",
      );
      expect(f.start).not.toHaveBeenCalled();
      expect(f.audio).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      await f.dispose();
    }
  },
);

it("keeps the pending connection cancellable without another call on locale changes", async () => {
  const f = localizedLauncherFixture("connecting");
  const user = userEvent.setup();
  const view = render(<HuddleLauncher {...f.props} />);
  try {
    const cancel = screen.getByRole("button", {
      name: "Cancel Huddle connection",
    });
    cancel.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button", { name: "허들 연결 취소" })).toBe(cancel);
    expect(cancel).toHaveFocus();
    act(() => setLanguage("en"));
    expect(
      screen.getByRole("button", { name: "Cancel Huddle connection" }),
    ).toBe(cancel);
    expect(f.leave).not.toHaveBeenCalled();
    await user.click(cancel);
    expect(f.leave).toHaveBeenCalledOnce();
    expect(f.join).not.toHaveBeenCalled();
    expect(f.start).not.toHaveBeenCalled();
    expect(f.audio).not.toHaveBeenCalled();
    expect(f.bridge.open).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    await f.dispose();
  }
});
