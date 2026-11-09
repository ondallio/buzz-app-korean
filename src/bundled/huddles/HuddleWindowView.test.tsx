// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { stubAvatarBrowserApis } from "../../features/agents/avatar-testing";
import type { HuddleView } from "../../features/huddle/window";
import { HuddleWindowView } from "./HuddleWindowView";
import { setLanguage } from "../../shared/i18n";

stubAvatarBrowserApis();
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);
afterEach(() => {
  cleanup();
  if (originalScrollIntoView)
    Object.defineProperty(
      Element.prototype,
      "scrollIntoView",
      originalScrollIntoView,
    );
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  vi.unstubAllGlobals();
  setLanguage("en");
  document.documentElement.removeAttribute("data-keyboard-input");
});

it.each([undefined, "", "owned-first"] as const)(
  "retains close recovery for a new error with identity %s",
  async (identity) => {
    const originalAnimations = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "getAnimations",
    );
    let finish: () => void = () => {};
    const animation = new Promise<void>((resolve) => {
      finish = resolve;
    });
    try {
      Element.prototype.scrollIntoView = vi.fn();
      Object.defineProperty(Element.prototype, "getAnimations", {
        configurable: true,
        value: () => [{ finished: animation }],
      });
      const view: HuddleView = {
        id: "raw-recovery-call",
        title: "Raw title",
        phase: "connected",
        muted: false,
        level: 0,
        dark: false,
        participants: [],
        discussion: {
          version: 0,
          historyLimited: false,
          status: "ready",
          writable: false,
          sending: false,
          sent: 0,
          hasMore: false,
          rows: [],
        },
      };
      const action = vi.fn();
      const mounted = render(
        <HuddleWindowView
          view={view}
          act={action}
          error="First raw error"
          errorIdentity={identity}
        />,
      );
      const chat = screen.getByRole("button", { name: "Huddle chat" });
      fireEvent.click(chat);
      expect(chat).toHaveAttribute("aria-expanded", "false");
      expect(action).not.toHaveBeenCalled();
      mounted.rerender(
        <HuddleWindowView
          view={view}
          act={action}
          error={identity ? "First raw error" : "Second raw error"}
          errorIdentity={identity ? "owned-next" : identity}
        />,
      );
      expect(chat).toHaveAttribute("aria-expanded", "true");
      await act(async () => finish());
      expect(action).not.toHaveBeenCalled();
    } finally {
      finish();
      if (originalAnimations)
        Object.defineProperty(
          Element.prototype,
          "getAnimations",
          originalAnimations,
        );
      else Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  },
);

it("shows and clears the connected call's voice error alongside window errors", () => {
  const view: HuddleView = {
    id: "call",
    title: "Huddle",
    phase: "connected",
    muted: false,
    level: 0,
    dark: false,
    participants: [],
    error: "Codex: Voice disconnected. Leave and rejoin the Huddle to retry.",
  };
  const act = vi.fn();
  const mounted = render(<HuddleWindowView view={view} act={act} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Codex: Voice disconnected.",
  );
  mounted.rerender(
    <HuddleWindowView
      view={view}
      act={act}
      error="Couldn’t update the call."
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Couldn’t update the call.",
  );
  mounted.rerender(<HuddleWindowView view={view} act={act} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Codex: Voice disconnected.",
  );
  mounted.rerender(
    <HuddleWindowView view={{ ...view, error: undefined }} act={act} />,
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("rests a seated agent smaller, rings it while thinking and restores it for speech", () => {
  const agent = {
    key: "agent",
    name: "Agent",
    picture: null,
    own: false,
    listening: true,
    level: 0,
  };
  const view: HuddleView = {
    id: "call",
    title: "Huddle",
    phase: "connected",
    muted: false,
    level: 0,
    dark: false,
    participants: [agent],
  };
  const mounted = render(<HuddleWindowView view={view} act={vi.fn()} />);
  const art = () =>
    mounted.container.querySelector<HTMLElement>('[class*="bubbleArtwork"]');
  const scale = () => art()?.style.getPropertyValue("--voice-scale");
  const update = (changes: Partial<typeof agent> & { thinking?: boolean }) =>
    mounted.rerender(
      <HuddleWindowView
        view={{ ...view, participants: [{ ...agent, ...changes }] }}
        act={vi.fn()}
      />,
    );
  expect(scale()).toBe("0.8");
  expect(art()?.hasAttribute("data-thinking")).toBe(false);
  update({ thinking: true });
  expect(scale()).toBe("0.8");
  expect(art()?.hasAttribute("data-thinking")).toBe(true);
  update({ thinking: true, level: 0.3 });
  expect(Number(scale())).toBeGreaterThan(1);
  expect(art()?.hasAttribute("data-thinking")).toBe(false);
  update({});
  expect(scale()).toBe("0.8");
  update({ listening: false });
  expect(scale()).toBe("1");
});

it("keeps the same call/chat controls and raw diagnostics without dispatching actions on locale", () => {
  Element.prototype.scrollIntoView = vi.fn();
  const view: HuddleView = {
    id: "raw-call",
    title: "Mute",
    phase: "connected",
    muted: false,
    level: 0,
    dark: false,
    participants: [],
    discussion: {
      version: 0,
      historyLimited: false,
      status: "ready",
      writable: false,
      sending: false,
      sent: 0,
      hasMore: false,
      rows: [],
    },
  };
  const action = vi.fn();
  render(
    <HuddleWindowView
      view={view}
      act={action}
      error="Connecting your microphone…"
    />,
  );
  const mute = screen.getByRole("button", { name: "Mute" });
  const panel = screen.getByRole("complementary", {
    name: "Huddle chat panel",
  });
  mute.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "음소거" })).toBe(mute);
  expect(screen.getByRole("complementary", { name: "허들 채팅 패널" })).toBe(
    panel,
  );
  expect(mute).toHaveFocus();
  expect(mute).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Connecting your microphone…",
  );
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(mute);
  document.documentElement.setAttribute("data-keyboard-input", "");
  fireEvent.click(screen.getByRole("button", { name: "허들 채팅" }));
  fireEvent.click(screen.getByRole("button", { name: "허들 나가기" }));
  fireEvent.click(
    screen.getByRole("button", {
      name: "허들을 간편 컨트롤로 최소화",
    }),
  );
  expect(action.mock.calls).toEqual([
    ["mute"],
    ["thread"],
    ["leave"],
    ["minimize"],
  ]);
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Mute" })).toBe(mute);
  expect(
    screen.getByRole("complementary", {
      name: "Huddle chat panel",
    }),
  ).toBe(panel);
  expect(action.mock.calls).toEqual([
    ["mute"],
    ["thread"],
    ["leave"],
    ["minimize"],
  ]);
});

it.each(["connecting", "leaving"] as const)(
  "keeps the %s call phase and disabled controls through language changes",
  (phase) => {
    const view: HuddleView = {
      id: "raw",
      title: "Raw title",
      phase,
      muted: true,
      level: 0,
      dark: false,
      participants: [],
    };
    const action = vi.fn();
    render(<HuddleWindowView view={view} act={action} />);
    const status = screen.getByRole("status");
    act(() => setLanguage("ko"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(
      phase === "connecting" ? "마이크를 연결하는 중…" : "나가는 중…",
    );
    expect(screen.getByRole("button", { name: "음소거 해제" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "허들 나가기" })).toHaveProperty(
      "disabled",
      phase === "leaving",
    );
    expect(action).not.toHaveBeenCalled();
    act(() => setLanguage("en"));
    expect(status).toHaveTextContent(
      phase === "connecting" ? "Connecting your microphone…" : "Leaving…",
    );
  },
);
