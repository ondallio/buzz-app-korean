// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createRelaySession } from "../../features/relay/session";
import type { RelayData } from "../../features/relay/service";
import {
  createHuddles,
  type HuddleSnapshot,
} from "../../features/huddle/service";
import { setLanguage } from "../../shared/i18n";
import { stubAvatarBrowserApis } from "../../features/agents/avatar-testing";
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import { HuddleCapsule } from "./HuddleCapsule";

stubAvatarBrowserApis();
afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.restoreAllMocks();
});
const destination = {
  scope: "https://example.test:viewer",
  viewer: "viewer",
  channelId: "raw-chat",
  channelName: "Raw conversation 한글",
  relayUrl: "wss://example.test",
};
function harness(initial: HuddleSnapshot, name?: string) {
  const store = createRelaySession(null);
  const profiles = new Map(name ? [["caller", { name }]] : []);
  const session = {
    ...store.session,
    profiles: { ...store.session.profiles, snapshot: () => profiles },
  };
  const snapshot = {
    status: "ready" as const,
    generation: 1,
    scope: destination.scope,
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
      throw new Error("No audio permitted");
    },
  );
  const listeners = new Set<() => void>();
  let call = initial;
  vi.spyOn(huddles, "snapshot").mockImplementation(() => call);
  vi.spyOn(huddles, "subscribe").mockImplementation((fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  });
  const join = vi.spyOn(huddles, "join").mockResolvedValue(),
    leave = vi.spyOn(huddles, "leave").mockResolvedValue(),
    mute = vi.spyOn(huddles, "mute").mockImplementation(() => {});
  const refresh = vi
    .spyOn(huddles, "refreshAudioSettings")
    .mockImplementation(() => {});
  const open = vi.fn(async () => {}),
    dismissError = vi.fn();
  const presentation: { visible: boolean; failed: boolean; error?: string } = {
    visible: false,
    failed: false,
  };
  const companion = {
    snapshot: () => presentation,
    subscribe: () => () => {},
    open,
    dispose: async () => {},
    dismissError,
  };
  const props = { huddles, relay, companion };
  return {
    props,
    join,
    leave,
    mute,
    open,
    refresh,
    presentation,
    set: (next: HuddleSnapshot) =>
      act(() => {
        call = next;
        for (const listener of listeners) listener();
      }),
    dispose: async () => {
      cleanup();
      await huddles.dispose();
      store.dispose();
    },
  };
}
it.each(["Someone", "Raw 이름 한글"])(
  "translates an incoming request without interpreting caller %s or changing canonical actions",
  async (name) => {
    const state: HuddleSnapshot = {
      phase: "incoming",
      requester: "caller",
      room: "raw-room",
      destination,
      muted: false,
      participants: [],
      error: "Raw relay 이유",
    };
    const h = harness(state, name);
    try {
      render(
        <ToastProvider>
          <HuddleCapsule {...h.props} />
        </ToastProvider>,
      );
      const join = screen.getByRole("button", { name: "Join" });
      join.focus();
      const group = screen.getByRole("group", { name: "Huddle request" });
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("group", {
            name: language === "ko" ? "허들 요청" : "Huddle request",
          }),
        ).toBe(group);
        expect(
          screen.getByRole("button", {
            name: language === "ko" ? "참여" : "Join",
          }),
        ).toBe(join);
        expect(join).toHaveFocus();
        expect(
          screen.getByText(
            language === "ko"
              ? `${name}님이 통화를 요청했습니다`
              : `${name} calling`,
          ),
        ).toBeVisible();
        expect(screen.getByRole("alert")).toHaveTextContent("Raw relay 이유");
        expect(h.join).not.toHaveBeenCalled();
        expect(h.leave).not.toHaveBeenCalled();
        expect(h.open).not.toHaveBeenCalled();
      }
      act(() => setLanguage("ko"));
      fireEvent.click(join);
      expect(h.join).toHaveBeenCalledExactlyOnceWith(destination, "raw-room");
      h.set({ ...state, phase: "connecting" });
      expect(join).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "취소" }));
      expect(h.leave).toHaveBeenCalledExactlyOnceWith();
    } finally {
      await h.dispose();
    }
  },
);
it("uses a complete unnamed request sentence while retaining the fallback branch and window action", async () => {
  const h = harness({
    phase: "incoming",
    room: "raw-room",
    destination,
    muted: false,
    participants: [],
  });
  try {
    render(
      <ToastProvider>
        <HuddleCapsule {...h.props} />
      </ToastProvider>,
    );
    act(() => setLanguage("ko"));
    expect(screen.getByText("누군가 통화를 요청했습니다")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "허들 요청 열기" }));
    expect(h.open).toHaveBeenCalledExactlyOnceWith();
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    expect(h.leave).toHaveBeenCalledExactlyOnceWith();
  } finally {
    await h.dispose();
  }
});
it("retains active controls and a pending window failure across live languages without issuing audio actions", async () => {
  const state: HuddleSnapshot = {
    phase: "connected",
    id: "raw-call",
    destination,
    muted: false,
    participants: [],
  };
  const h = harness(state);
  let reject: (error: Error) => void = (_error) => {
    throw new Error("Missing gate");
  };
  const pending = new Promise<void>((_resolve, decline) => {
    reject = decline;
  });
  h.open.mockImplementation(() => pending);
  try {
    render(
      <ToastProvider>
        <HuddleCapsule {...h.props} />
      </ToastProvider>,
    );
    const group = screen.getByRole("group", { name: "Active Huddle" });
    const open = screen.getByRole("button", {
      name: `Open Huddle window for ${destination.channelName}`,
    });
    fireEvent.click(open);
    open.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("group", {
          name: language === "ko" ? "진행 중인 허들" : "Active Huddle",
        }),
      ).toBe(group);
      expect(
        screen.getByRole("button", {
          name:
            language === "ko"
              ? `${destination.channelName}의 허들 창 열기`
              : `Open Huddle window for ${destination.channelName}`,
        }),
      ).toBe(open);
      expect(open).toHaveFocus();
      expect(h.open).toHaveBeenCalledOnce();
      expect(h.mute).not.toHaveBeenCalled();
      expect(h.leave).not.toHaveBeenCalled();
      expect(h.refresh).not.toHaveBeenCalled();
    }
    act(() => setLanguage("ko"));
    await act(async () => reject(new Error("Raw window diagnostic")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "허들 창을 열지 못했습니다. 다시 시도해 주세요.",
    );
    const alert = screen.getByRole("alert");
    act(() => setLanguage("en"));
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("Couldn’t open Huddle window. Try again.");
    act(() => setLanguage("ko"));
    fireEvent.click(screen.getByRole("button", { name: "음소거" }));
    expect(h.mute).toHaveBeenCalledExactlyOnceWith();
    h.set({ ...state, muted: true });
    expect(screen.getByRole("button", { name: "음소거 해제" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "허들 나가기" }));
    expect(h.leave).toHaveBeenCalledExactlyOnceWith();
  } finally {
    reject(new Error("Fixture teardown"));
    await h.dispose();
  }
});
it.each([
  undefined,
  "The connection failed.",
  "Huddle audio unavailable in this deployment",
])(
  "translates only owned connection captions while preserving supplied reason %s",
  async (error) => {
    const h = harness({
      phase: "error",
      muted: false,
      participants: [],
      ...(error === undefined ? {} : { error }),
    });
    try {
      render(
        <ToastProvider>
          <HuddleCapsule {...h.props} />
        </ToastProvider>,
      );
      act(() => setLanguage("ko"));
      if (error?.startsWith("Huddle audio unavailable"))
        expect(
          await screen.findByText(
            "이 서버에서는 허들 오디오를 사용할 수 없습니다. 릴레이 운영자가 설정을 확인해야 합니다.",
          ),
        ).toBeVisible();
      else
        expect(
          await screen.findByText(
            error
              ? `${error} 헤드폰 버튼을 다시 눌러 주세요.`
              : "연결하지 못했습니다. 헤드폰 버튼을 다시 눌러 주세요.",
          ),
        ).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "허들 오류 닫기" }));
      await waitFor(() => expect(h.leave).toHaveBeenCalledExactlyOnceWith());
    } finally {
      await h.dispose();
    }
  },
);
it("keeps the same connecting cancel control and focus through language changes", async () => {
  const h = harness({ phase: "connecting", muted: false, participants: [] });
  try {
    render(<HuddleCapsule {...h.props} />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "취소" : "Cancel",
        }),
      ).toBe(cancel);
      expect(cancel).toHaveFocus();
      expect(
        screen.getByText(
          language === "ko" ? "허들에 연결하는 중…" : "Connecting to Huddle…",
        ),
      ).toBeVisible();
      expect(h.leave).not.toHaveBeenCalled();
    }
    act(() => setLanguage("ko"));
    fireEvent.click(cancel);
    expect(h.leave).toHaveBeenCalledExactlyOnceWith();
  } finally {
    await h.dispose();
  }
});

it("updates retained voice and window toast captions while keeping identical backend reasons and dismiss targets", async () => {
  const h = harness({
    phase: "connected",
    id: "raw-call",
    muted: false,
    participants: [],
    error: "Agent voice stopped",
  });
  h.presentation.error = "Couldn’t update Huddle";
  const voice = vi
    .spyOn(h.props.huddles, "voiceError")
    .mockImplementation(() => {});
  try {
    render(
      <ToastProvider>
        <HuddleCapsule {...h.props} />
      </ToastProvider>,
    );
    const voiceClose = await screen.findByRole("button", {
      name: "Dismiss agent voice error",
    });
    const windowClose = screen.getByRole("button", {
      name: "Dismiss Huddle window error",
    });
    screen.getByRole("button", { name: "Mute" }).focus();
    voiceClose.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      await waitFor(() =>
        expect(
          screen.getByRole("button", {
            name:
              language === "ko"
                ? "에이전트 음성 오류 닫기"
                : "Dismiss agent voice error",
          }),
        ).toBe(voiceClose),
      );
      expect(voiceClose).toHaveFocus();
      expect(
        screen.getByRole("button", {
          name:
            language === "ko"
              ? "허들 창 오류 닫기"
              : "Dismiss Huddle window error",
        }),
      ).toBe(windowClose);
      expect(screen.getAllByText("Agent voice stopped").length).toBe(
        language === "ko" ? 1 : 2,
      );
      expect(screen.getAllByText("Couldn’t update Huddle").length).toBe(
        language === "ko" ? 1 : 2,
      );
      expect(voice).not.toHaveBeenCalled();
      expect(h.props.companion.dismissError).not.toHaveBeenCalled();
    }
    act(() => setLanguage("ko"));
    fireEvent.click(voiceClose);
    await waitFor(() =>
      expect(voice).toHaveBeenCalledExactlyOnceWith("raw-call"),
    );
    fireEvent.click(windowClose);
    await waitFor(() =>
      expect(h.props.companion.dismissError).toHaveBeenCalledExactlyOnceWith(),
    );
  } finally {
    await h.dispose();
  }
});
