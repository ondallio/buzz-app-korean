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
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { stubAvatarBrowserApis } from "../agents/avatar-testing";
import type { ChannelMessage } from "../relay/contracts";
import type { ActivityPresentation } from "./activity-presentation";
import { ActivityGroupPreview } from "./ActivityGroupPreview";
import { ActivityGroupActions } from "./ActivityGroupActions";
import { RemoteAgentHint, RemoteWorkIcon } from "./RemoteAgentHint";
import { createRelaySession } from "../relay/session";
import { createLocalAgentActivity } from "../agents/local-activity";
import { createAgentActivity } from "../agents/activity";
import { keypair } from "../relay/testing";
import type { AgentChoicesSnapshot } from "../agents/choices";
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import { toast } from "sonner";

stubAvatarBrowserApis();
beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
  toast.dismiss();
});

const fallbackEn =
  "This request ended before it could finish. Try again in a new thread, or choose a different model.";
const fallbackKo =
  "요청을 완료하기 전에 종료되었습니다. 새 스레드에서 다시 시도하거나 다른 모델을 선택하세요.";

it.each([
  { state: "error", reason: undefined, en: fallbackEn, ko: fallbackKo },
  { state: "error", reason: "", en: fallbackEn, ko: fallbackKo },
  { state: "error", reason: " ", en: " ", ko: " " },
  {
    state: "stopped",
    reason: "Raw ignored",
    en: "This request was stopped.",
    ko: "요청이 중지되었습니다.",
  },
  {
    state: "working",
    reason: "Raw ignored",
    en: "This request was stopped.",
    ko: "요청이 중지되었습니다.",
  },
] as const)(
  "preserves reason ownership for $state/$reason without relabeling unknown outcomes",
  ({ state, reason, en, ko }) => {
    const value = group({
      participants: [row.authorId],
      outcomes: [{ agent: row.authorId, state, reason }],
      working: false,
    });
    const canonical = JSON.stringify(value);
    const view = render(
      <ActivityGroupPreview
        group={value}
        profiles={profiles}
        media={() => undefined}
        expanded
        onToggle={() => {}}
      />,
    );
    const paragraph = view.container.querySelector(
      "[data-activity-details] > p",
    );
    if (!paragraph) throw new Error("Missing actual reason paragraph");
    for (const language of ["en", "ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(paragraph.textContent).toBe(language === "ko" ? ko : en);
      expect(view.container.querySelector("[data-activity-details] > p")).toBe(
        paragraph,
      );
      expect(JSON.stringify(value)).toBe(canonical);
      if (state === "working") {
        expect(screen.getByRole("button")).toHaveAccessibleName(
          language === "ko"
            ? "활동 기록 접기: Stopped: undefined"
            : "Collapse activity history: Stopped: undefined",
        );
      }
    }
  },
);

it("retains the original 280-codepoint preview and raw expanded content", () => {
  const content = "😀".repeat(281),
    preview = `${"😀".repeat(279)}…`;
  const value = group({
    latest: { ...row, content },
    history: [{ ...row, content }],
    outcomes: [],
    working: false,
    workingUpdate: undefined,
  });
  render(
    <ActivityGroupPreview
      group={value}
      profiles={profiles}
      media={() => undefined}
      expanded={false}
      onToggle={() => {}}
    />,
  );
  const trigger = screen.getByRole("button", {
    name: `Show activity history: Stopped: ${preview}`,
  });
  act(() => setLanguage("ko"));
  expect(trigger).toHaveAccessibleName(`활동 기록 보기: Stopped: ${preview}`);
  expect(value.latest.content).toBe(content);
  expect(value.history[0]?.content).toBe(content);
});

it("uses authorized runtime metadata with the same primitive subscription and live tooltip", async () => {
  const owner = createRelaySession({
    viewer: keypair().pubkey,
    relayAuthor: keypair().pubkey,
    media: () => undefined,
    query: async () => [],
  });
  const base = owner.session.agentChoices.snapshot();
  let choices: AgentChoicesSnapshot = {
    ...base,
    identities: [
      {
        pubkey: row.authorId,
        name: "Remote",
        managed: false,
        execution: "remote",
        runtime: "block.builderlab/builderlab",
      },
    ],
  };
  const listeners = new Set<() => void>();
  const subscribe = vi.fn((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  });
  const snapshot = vi.fn(() => choices);
  const session = {
    ...owner.session,
    agentChoices: { ...owner.session.agentChoices, snapshot, subscribe },
  };
  const user = userEvent.setup();
  const view = render(
    <>
      <RemoteAgentHint
        session={session}
        viewer={session.viewer}
        pubkey={row.authorId}
      />
      <RemoteWorkIcon
        session={session}
        viewer={session.viewer}
        pubkey={row.authorId}
        active
      />
    </>,
  );
  const update = (runtime: string, execution: "remote" | "local" = "remote") =>
    act(() => {
      choices = {
        ...base,
        identities: [
          {
            pubkey: row.authorId,
            name: "Remote",
            managed: false,
            execution,
            runtime,
          },
        ],
      };
      for (const listener of listeners) listener();
    });
  try {
    const hint = screen.getByText("Remote");
    await user.hover(hint);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Runs remotely on Builderlab",
    );
    await user.unhover(hint);
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
    act(() => hint.focus());
    await waitFor(() =>
      expect(hint).toHaveAccessibleDescription("Runs remotely on Builderlab"),
    );
    const tooltip = screen.getByRole("tooltip"),
      subscriptions = subscribe.mock.calls.length;
    expect(subscriptions).toBe(2);
    const icon = view.container.querySelector("svg[data-active]");
    expect(icon).not.toBeNull();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByText(language === "ko" ? "원격" : "Remote")).toBe(
        hint,
      );
      expect(hint).toHaveFocus();
      expect(screen.getByRole("tooltip")).toBe(tooltip);
      expect(tooltip).toHaveTextContent(
        language === "ko"
          ? "Builderlab에서 원격으로 실행됩니다"
          : "Runs remotely on Builderlab",
      );
      expect(subscribe).toHaveBeenCalledTimes(subscriptions);
      expect(view.container.querySelector("svg[data-active]")).toBe(icon);
    }
    act(() => setLanguage("ko"));
    update("external/provider");
    expect(screen.getByRole("tooltip")).toBe(tooltip);
    expect(tooltip).toHaveTextContent("원격 컴퓨터에서 실행됩니다");
    expect(subscribe).toHaveBeenCalledTimes(subscriptions);
    update("block.builderlab/builderlab");
    expect(tooltip).toHaveTextContent("Builderlab에서 원격으로 실행됩니다");
    update("block.builderlab/builderlab", "local");
    expect(screen.queryByText("원격")).not.toBeInTheDocument();
    expect(view.container.querySelector("svg[data-active]")).toBeNull();
    update("external/provider");
    view.rerender(
      <RemoteAgentHint
        session={session}
        viewer="foreign-owner"
        pubkey={row.authorId}
      />,
    );
    snapshot.mockClear();
    act(() => setLanguage("en"));
    expect(screen.queryByText("Remote")).not.toBeInTheDocument();
    expect(snapshot).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    owner.dispose();
  }
});

it.each([
  {
    thrown: new Error("Couldn’t finish {reason}"),
    reason: "Couldn’t finish {reason}",
  },
  { thrown: "Raw string {reason}", reason: "Raw string {reason}" },
  { thrown: new Error(""), reason: "" },
])(
  "retains controls, exact request arguments and a live raw-reason toast after unmount: $reason",
  async ({ thrown, reason }) => {
    const owner = createRelaySession({
      viewer: keypair().pubkey,
      relayAuthor: keypair().pubkey,
      media: () => undefined,
      query: async () => [],
    });
    const local = createLocalAgentActivity();
    const activity = createAgentActivity(
      true,
      () => {},
      () => true,
      undefined,
      undefined,
      { source: local.reader, scope: "test" },
    );
    const release = activity.queries.activate();
    const retry = vi.fn(() => {
      throw thrown;
    });
    local
      .begin(
        {
          scope: "test",
          agent: row.authorId,
          channelId: row.channelId,
          messageId: "raw-request",
          threadRootId: "raw-request",
        },
        retry,
      )
      .finish({ ok: false, error: "Raw failure" });
    const retryRequest = vi.fn(activity.queries.retry),
      dismiss = vi.fn(activity.queries.dismissError);
    const session = {
      ...owner.session,
      agentActivity: {
        ...activity.queries,
        retry: retryRequest,
        dismissError: dismiss,
      },
    };
    const value = group({ liveParticipants: [row.authorId], working: false });
    const open = vi.fn(() => true),
      canOpen = vi.fn(() => true);
    const anchor = document.createElement("button");
    document.body.append(anchor);
    function Actions({ visible = true }: { visible?: boolean }) {
      return (
        <ToastProvider>
          {visible && (
            <ActivityGroupActions
              session={session}
              group={value}
              profiles={profiles}
              returnFocus={{ current: anchor }}
              active
              open={open}
              canOpen={canOpen}
            />
          )}
        </ToastProvider>
      );
    }
    const view = render(<Actions />);
    try {
      const action = screen.getByRole("button", { name: "Retry Stopped" });
      const transcript = screen.getByRole("button", {
        name: "Stopped transcript",
      });
      const dismissControl = screen.getByRole("button", {
        name: "Dismiss error from Stopped",
      });
      action.focus();
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("button", {
            name: language === "ko" ? "Stopped 다시 시도" : "Retry Stopped",
          }),
        ).toBe(action);
        expect(
          screen.getByRole("button", {
            name:
              language === "ko"
                ? "Stopped의 오류 닫기"
                : "Dismiss error from Stopped",
          }),
        ).toBe(dismissControl);
        expect(
          screen.getByRole("button", {
            name:
              language === "ko" ? "Stopped 대화 기록" : "Stopped transcript",
          }),
        ).toBe(transcript);
        expect(action).toHaveFocus();
        expect(retryRequest).not.toHaveBeenCalled();
        expect(dismiss).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
      }
      fireEvent.click(action);
      expect(retry).toHaveBeenCalledTimes(1);
      expect(retryRequest).toHaveBeenCalledExactlyOnceWith(
        row.authorId,
        row.channelId,
        "raw-request",
      );
      const notice = await screen.findByText(/^Couldn’t retry Stopped\./);
      expect(notice.textContent).toBe(`Couldn’t retry Stopped. ${reason}`);
      fireEvent.click(dismissControl);
      expect(dismiss).toHaveBeenCalledExactlyOnceWith(
        row.authorId,
        row.channelId,
        "raw-request",
      );
      expect(anchor).toHaveFocus();
      expect(
        screen.queryByRole("button", { name: "Retry Stopped" }),
      ).not.toBeInTheDocument();
      view.rerender(<Actions visible={false} />);
      act(() => setLanguage("ko"));
      expect(
        await screen.findByText(/^Stopped 다시 시도에 실패했습니다\./),
      ).toBe(notice);
      expect(notice.textContent).toBe(
        `Stopped 다시 시도에 실패했습니다. ${reason}`,
      );
      act(() => setLanguage("en"));
      expect(screen.getByText(/^Couldn’t retry Stopped\./)).toBe(notice);
      expect(notice.textContent).toBe(`Couldn’t retry Stopped. ${reason}`);
      expect(retryRequest).toHaveBeenCalledTimes(1);
      expect(dismiss).toHaveBeenCalledTimes(1);
      expect(open).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      anchor.remove();
      release();
      activity.dispose();
      owner.dispose();
    }
  },
);

it("keeps a pending Stop scoped to its original request while language changes", async () => {
  const owner = createRelaySession({
    viewer: keypair().pubkey,
    relayAuthor: keypair().pubkey,
    media: () => undefined,
    query: async () => [],
  });
  const local = createLocalAgentActivity();
  const activity = createAgentActivity(
    true,
    () => {},
    () => true,
    undefined,
    undefined,
    { source: local.reader, scope: "test" },
  );
  const release = activity.queries.activate();
  let finish = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const stopped = vi.fn(() => gate);
  const work = local.begin({
    scope: "test",
    agent: row.authorId,
    channelId: row.channelId,
    messageId: "raw-request",
    threadRootId: "raw-request",
  });
  work.started();
  work.interruptible(stopped);
  const interrupt = vi.fn(activity.queries.interrupt);
  const subscribe = vi.fn(activity.queries.subscribe);
  const session = {
    ...owner.session,
    agentActivity: { ...activity.queries, interrupt, subscribe },
  };
  const anchor = document.createElement("button");
  document.body.append(anchor);
  const value = group({ liveParticipants: [row.authorId], working: true });
  const view = render(
    <ActivityGroupActions
      session={session}
      group={value}
      profiles={profiles}
      returnFocus={{ current: anchor }}
      active
    />,
  );
  try {
    const stop = screen.getByRole("button", { name: "Stop Stopped" });
    stop.focus();
    fireEvent.click(stop);
    expect(interrupt).toHaveBeenCalledExactlyOnceWith(
      row.authorId,
      row.channelId,
      "raw-request",
    );
    expect(stopped).toHaveBeenCalledTimes(1);
    const subscriptions = subscribe.mock.calls.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "Stopped 중지" : "Stop Stopped",
        }),
      ).toBe(stop);
      expect(stop).toHaveAttribute("aria-busy", "true");
      expect(interrupt).toHaveBeenCalledTimes(1);
      expect(subscribe).toHaveBeenCalledTimes(subscriptions);
    }
    await act(async () => {
      finish();
      await gate;
    });
    expect(
      screen.queryByRole("button", { name: "Stop Stopped" }),
    ).not.toBeInTheDocument();
    expect(anchor).toHaveFocus();
  } finally {
    finish();
    view.unmount();
    anchor.remove();
    release();
    activity.dispose();
    owner.dispose();
  }
});

const row: ChannelMessage = {
  id: "raw-step",
  channelId: "raw-channel",
  threadRootId: "raw-request",
  authorId: "a".repeat(64),
  content: "Raw preview {name}  한글",
  createdAt: 1,
  mentions: [],
  participants: [],
  attachments: [],
  reactions: [],
  replyCount: 0,
};

function group(
  patch: Partial<ActivityPresentation> = {},
): ActivityPresentation {
  return {
    ids: [row.id],
    history: [row],
    latest: row,
    participants: [row.authorId, "raw-helper"],
    requestId: "raw-request",
    followingMessage: undefined,
    retired: true,
    outcomes: [
      { agent: row.authorId, state: "error", reason: "Couldn’t finish" },
      { agent: "raw-helper", state: "stopped", reason: "Ignored raw reason" },
    ],
    liveParticipants: [],
    presentedParticipants: [],
    working: true,
    workingUpdate: { ...row, authorId: "raw-helper" },
    standalone: true,
    ...patch,
  };
}

const profiles = new Map([
  [row.authorId, { name: "Stopped" }],
  ["raw-helper", { name: "Couldn’t finish" }],
]);

it.each([false, true])(
  "opens the original transcript target after locale changes, multiple=%s",
  (multiple) => {
    const owner = createRelaySession({
      viewer: keypair().pubkey,
      relayAuthor: keypair().pubkey,
      media: () => undefined,
      query: async () => [],
    });
    const open = vi.fn(() => true),
      canOpen = vi.fn(() => true);
    const value = group({
      participants: multiple ? [row.authorId, "raw-helper"] : [row.authorId],
    });
    const view = render(
      <ActivityGroupActions
        session={owner.session}
        group={value}
        profiles={profiles}
        returnFocus={{ current: null }}
        active
        open={open}
        canOpen={canOpen}
      />,
    );
    try {
      const button = screen.getByRole("button", {
        name: multiple ? "Stopped transcript" : "View transcript",
      });
      button.focus();
      act(() => setLanguage("ko"));
      expect(
        screen.getByRole("button", {
          name: multiple ? "Stopped 대화 기록" : "대화 기록 보기",
        }),
      ).toBe(button);
      expect(button).toHaveFocus();
      expect(open).not.toHaveBeenCalled();
      fireEvent.click(button);
      expect(open).toHaveBeenCalledExactlyOnceWith(
        `buzz:profile?agent=${row.authorId}&tab=activity`,
        { rootId: row.threadRootId },
      );
    } finally {
      view.unmount();
      owner.dispose();
    }
  },
);

it("retains a real expanded history and focus while translating complete group summaries", () => {
  const toggle = vi.fn();
  const history = vi.fn((entry: ChannelMessage) => (
    <p data-message-id={entry.id} data-testid={entry.id}>
      {entry.content}
    </p>
  ));
  const value = group();
  function Preview() {
    const [expanded, setExpanded] = useState(false);
    return (
      <ActivityGroupPreview
        group={value}
        profiles={profiles}
        media={() => undefined}
        expanded={expanded}
        onToggle={() => {
          toggle();
          setExpanded((current) => !current);
        }}
        renderHistory={history}
      />
    );
  }
  render(<Preview />);
  const english =
    "Stopped: Couldn’t finish; Couldn’t finish: Stopped; Couldn’t finish: still working — Raw preview {name} 한글";
  const korean =
    "Stopped: 완료하지 못함; Couldn’t finish: 중지됨; Couldn’t finish: 아직 작업 중 — Raw preview {name} 한글";
  const trigger = screen.getByRole("button", {
    name: `Show activity history: ${english}`,
  });
  fireEvent.click(trigger);
  expect(toggle).toHaveBeenCalledTimes(1);
  const raw = screen.getByTestId(row.id);
  expect(raw.textContent).toBe(row.content);
  expect(raw).toHaveAttribute("data-message-id", row.id);
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("button", {
        name:
          language === "ko"
            ? `활동 기록 접기: ${korean}`
            : `Collapse activity history: ${english}`,
      }),
    ).toBe(trigger);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId(row.id)).toBe(raw);
    expect(raw.textContent).toBe(row.content);
    expect(screen.getByText("Stopped: Couldn’t finish")).toBeVisible();
    expect(
      screen.getByText(
        language === "ko"
          ? "Couldn’t finish: 요청이 중지되었습니다."
          : "Couldn’t finish: This request was stopped.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/Ignored raw reason/)).not.toBeInTheDocument();
    expect(toggle).toHaveBeenCalledTimes(1);
  }
  fireEvent.click(trigger);
  expect(trigger).toHaveAccessibleName(`Show activity history: ${english}`);
  expect(toggle).toHaveBeenCalledTimes(2);
  expect(raw).not.toBeInTheDocument();
});
