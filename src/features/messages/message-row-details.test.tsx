// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { stubAvatarBrowserApis } from "../agents/avatar-testing";
import type { ChannelMessage } from "../relay/contracts";
import type { UnreadCapability, UnreadSnapshot } from "../relay/unread";
import type { RelaySession } from "../relay/session";
import type { LocalWork } from "../agents/local-activity";
import {
  ActivityOutcome,
  activityOutcomeLabel,
  activityOutcomeReason,
} from "./ActivityOutcome";
import { ActivityDisclosure } from "./ActivityDisclosure";
import { serializeSelection } from "./selection-copy";
import { profileTarget } from "../profiles/target";
import userEvent from "@testing-library/user-event";
import { MessageRow } from "./MessageRow";

stubAvatarBrowserApis();
beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});

const row: ChannelMessage = {
  id: "raw-root",
  channelId: "raw-channel",
  authorId: "raw-author",
  content: "Raw body 한글 {name} Couldn’t finish",
  createdAt: 1,
  mentions: [],
  participants: [],
  attachments: [],
  reactions: [],
  replyCount: 23,
};
const props = {
  profile: undefined,
  media: () => undefined,
  onOpenLink: () => false,
  day: false,
  retry: undefined,
};

it("retains the exact thread, focus and unread read boundary across EN/KO/EN", () => {
  const snapshot: UnreadSnapshot = {
    target: { kind: "thread", channelId: row.channelId, rootId: row.id },
    observedCount: 2,
    attentionCount: null,
    manual: "none",
    coverage: "observed",
    freshness: "observed",
  };
  const read = vi.fn((_target: UnreadSnapshot["target"]) => snapshot);
  const subscribe = vi.fn(() => () => {});
  const unread = { snapshot: read, subscribe } as unknown as UnreadCapability;
  const open = vi.fn();
  render(
    <MessageRow {...props} row={row} unread={unread} onOpenThread={open} />,
  );
  const thread = screen.getByRole("button", {
    name: "View thread: 23 replies. Observed unread replies. Not an exact total.",
  });
  thread.focus();
  const subscriptions = subscribe.mock.calls.length;
  for (const language of ["en", "ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("button", {
        name:
          language === "ko"
            ? "스레드 보기: 답글 23개. 읽지 않은 답글이 감지되었습니다. 정확한 총개수는 아닙니다."
            : "View thread: 23 replies. Observed unread replies. Not an exact total.",
      }),
    ).toBe(thread);
    expect(thread).toHaveFocus();
    expect(screen.getByText(row.content)).toBeVisible();
    expect(subscribe).toHaveBeenCalledTimes(subscriptions);
    expect(open).not.toHaveBeenCalled();
  }
  fireEvent.click(thread);
  expect(open).toHaveBeenCalledExactlyOnceWith(row.id, row.id);
  expect(
    read.mock.calls.every(
      ([target]) =>
        JSON.stringify(target) ===
        JSON.stringify({
          kind: "thread",
          channelId: row.channelId,
          rootId: row.id,
        }),
    ),
  ).toBe(true);
});

it("retains an expanded failure and its raw explanation while translating the owning controls", () => {
  render(
    <MessageRow
      {...props}
      row={{ ...row, notice: "execution-failure" }}
      profile={{ name: "Couldn’t finish" }}
    />,
  );
  const trigger = screen.getByRole("button", {
    name: "Show activity history: Couldn’t finish: Couldn’t finish",
  });
  fireEvent.click(trigger);
  const body = screen.getByText(row.content);
  expect(body).toBeVisible();
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("button", {
      name: "활동 기록 접기: Couldn’t finish: 완료하지 못함",
    }),
  ).toBe(trigger);
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(row.content)).toBe(body);
  expect(within(trigger).getByText("접기")).toBeVisible();
  expect(screen.getAllByText("완료하지 못함").length).toBeGreaterThan(0);
  act(() => setLanguage("en"));
  expect(trigger).toHaveAccessibleName(
    "Collapse activity history: Couldn’t finish: Couldn’t finish",
  );
  expect(screen.getByText(row.content)).toBe(body);
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText(row.content)).not.toBeInTheDocument();
});

it.each([
  [
    "local-only",
    "observed",
    "Thread marked unread on this device only",
    "이 기기에서만 스레드를 읽지 않음으로 표시했습니다",
  ],
  [
    "remote",
    "observed",
    "Thread marked unread",
    "스레드를 읽지 않음으로 표시했습니다",
  ],
  [
    "none",
    "observed",
    "Observed unread replies. Not an exact total.",
    "읽지 않은 답글이 감지되었습니다. 정확한 총개수는 아닙니다.",
  ],
  [
    "none",
    "stale",
    "Observed unread replies; may be out of date. Not an exact total.",
    "읽지 않은 답글이 감지되었지만 최신 상태가 아닐 수 있습니다. 정확한 총개수는 아닙니다.",
  ],
] as const)(
  "keeps %s/%s unread evidence distinct without inventing an exact unread count",
  (manual, freshness, en, ko) => {
    const snapshot = { observedCount: 2, manual, freshness };
    const unread = {
      snapshot: () => snapshot,
      subscribe: () => () => {},
    } as unknown as UnreadCapability;
    render(
      <MessageRow
        {...props}
        row={row}
        unread={unread}
        onOpenThread={() => {}}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: `View thread: 23 replies. ${en}`,
    });
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(trigger).toHaveAccessibleName(
        language === "ko"
          ? `스레드 보기: 답글 23개. ${ko}`
          : `View thread: 23 replies. ${en}`,
      );
      expect(trigger.querySelector("[title]")).toHaveAttribute(
        "title",
        language === "ko" ? ko : en,
      );
      expect(trigger).not.toHaveAccessibleName(/2(?: unread|개)/);
    }
  },
);

it("projects real thread-work snapshots without translating their state, names or subscription identity", () => {
  const agent = "a".repeat(64),
    other = "b".repeat(64);
  const listeners = new Set<() => void>();
  const subscribe = vi.fn((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  });
  const idle = () => () => {};
  const channels = { channels: [], status: "ready" };
  const profiles = new Map();
  const library = {
    identities: [
      { pubkey: agent, name: "Working" },
      { pubkey: other, name: "대기 {count}" },
    ],
  };
  const local: LocalWork = {
    scope: "test",
    agent,
    channelId: row.channelId,
    messageId: "raw-request",
    threadRootId: row.id,
    startedAt: 1,
    state: "working",
    step: { tool: "Raw tool {state}" },
  };
  let snapshot = {
    status: "listening",
    turns: [],
    records: [],
    trimmed: 0,
    typing: [],
    local: [local],
  };
  const typing: never[] = [];
  const session = {
    channels: { list: () => channels, subscribeList: idle },
    profiles: { snapshot: () => profiles, subscribe: idle },
    messages: {},
    typing: { snapshot: () => typing, subscribe: idle },
    agentChoices: { snapshot: () => library, subscribe: idle },
    agentActivity: { snapshot: () => snapshot, subscribe },
  } as unknown as RelaySession;
  const open = vi.fn();
  const view = render(
    <MessageRow
      {...props}
      row={{ ...row, replyCount: 0 }}
      session={session}
      onOpenThread={open}
    />,
  );
  const button = screen.getByRole("button", {
    name: "View thread: Working is working",
  });
  button.focus();
  const subscriptions = subscribe.mock.calls.length;
  for (const state of ["waiting", "working"] as const) {
    act(() => {
      snapshot = { ...snapshot, local: [{ ...local, state }] };
      for (const listener of listeners) listener();
    });
    act(() => setLanguage("ko"));
    expect(button).toHaveAccessibleName(
      `스레드 보기: Working ${state === "waiting" ? "대기 중" : "작업 중"}`,
    );
    expect(button).toHaveFocus();
    expect(snapshot.local[0]?.state).toBe(state);
    expect(subscribe).toHaveBeenCalledTimes(subscriptions);
    act(() => setLanguage("en"));
    expect(button).toHaveAccessibleName(`View thread: Working is ${state}`);
  }
  act(() => {
    snapshot = { ...snapshot, local: [local, { ...local, agent: other }] };
    for (const listener of listeners) listener();
  });
  expect(button).toHaveAccessibleName("View thread: 2 agents are working");
  act(() => setLanguage("ko"));
  expect(button).toHaveAccessibleName("스레드 보기: 에이전트 2개 작업 중");
  view.rerender(
    <MessageRow {...props} row={row} session={session} onOpenThread={open} />,
  );
  expect(
    screen.getByRole("button", {
      name: "스레드 보기: 답글 23개. Working, 대기 {count} 작업 중",
    }),
  ).toBe(button);
  fireEvent.click(button);
  expect(open).toHaveBeenCalledExactlyOnceWith(row.id, row.id);
  expect(snapshot.local.map((work) => work.agent)).toEqual([agent, other]);
});

it("formats a large reply count only in the display and still opens the exact source root", () => {
  const open = vi.fn();
  render(
    <MessageRow
      {...props}
      row={{ ...row, replyCount: 1001, threadRootId: "raw-original-root" }}
      onOpenThread={open}
    />,
  );
  const trigger = screen.getByRole("button", {
    name: "View thread: 1,001 replies",
  });
  act(() => setLanguage("ko"));
  expect(trigger).toHaveAccessibleName("스레드 보기: 답글 1,001개");
  fireEvent.click(trigger);
  expect(open).toHaveBeenCalledExactlyOnceWith(row.id, "raw-original-root");
});

it.each([false, true])(
  "preserves raw audience previews and open panels, edited=%s",
  (edited) => {
    const content = "Raw   \n한글 {author} (edited)";
    render(
      <MessageRow
        {...props}
        profile={{ name: "Working" }}
        row={{
          ...row,
          content,
          audience: "agents",
          ...(edited ? { edited: true } : {}),
        }}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: `Working: Raw 한글 {author} (edited)${edited ? " (edited)" : ""}`,
    });
    fireEvent.click(trigger);
    const panel = trigger.parentElement;
    act(() => setLanguage("ko"));
    expect(trigger).toHaveAccessibleName(
      `Working: Raw 한글 {author} (edited)${edited ? " (수정됨)" : ""}`,
    );
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger.parentElement).toBe(panel);
    expect(document.querySelector("[data-message-payload]")).toHaveTextContent(
      "Raw 한글 {author} (edited)",
    );
    act(() => setLanguage("en"));
    expect(trigger).toHaveAccessibleName(
      `Working: Raw 한글 {author} (edited)${edited ? " (edited)" : ""}`,
    );
  },
);

it.each([false, true])(
  "keeps signed recipient order and the original edited-mention policy, edited=%s",
  (edited) => {
    const first = "a".repeat(64),
      second = "b".repeat(64);
    const content = "@Couldn’t finish, @한글: Raw body";
    const selected = new Map([
      [first, { name: "Couldn’t finish" }],
      [second, { name: "한글" }],
    ]);
    render(
      <MessageRow
        {...props}
        profile={{ name: "Author" }}
        participantProfiles={selected}
        row={{
          ...row,
          content,
          audience: "agents",
          mentions: [first, second],
          ...(edited ? { edited: true } : {}),
        }}
      />,
    );
    const en = edited
      ? "Author: @Couldn’t finish, @한글: Raw body (edited)"
      : "Author to Couldn’t finish, 한글: Raw body";
    const ko = edited
      ? "Author: @Couldn’t finish, @한글: Raw body (수정됨)"
      : "Author → Couldn’t finish, 한글: Raw body";
    const trigger = screen.getByRole("button", { name: en });
    act(() => setLanguage("ko"));
    expect(trigger).toHaveAccessibleName(ko);
    expect(trigger).toHaveTextContent(
      edited ? content : "@Couldn’t finish, @한글 Raw body",
    );
    act(() => setLanguage("en"));
    expect(trigger).toHaveAccessibleName(en);
    expect(selected.get(first)?.name).toBe("Couldn’t finish");
  },
);

it("keeps one known-presence accessible owner and leaves an unknown avatar decorative", () => {
  const idle = () => () => {};
  const channels = { channels: [], status: "ready" };
  let status: "online" | "away" | "offline" | "unknown" = "online";
  const listeners = new Set<() => void>();
  const session = {
    channels: { list: () => channels, subscribeList: idle },
    messages: {},
    presence: {
      status: () => status,
      limited: () => false,
      subscribe: (_: string, listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  } as unknown as RelaySession;
  const message = {
    ...row,
    authorId: "ab".repeat(32),
    agentEnvelope: true as const,
  };
  const view = render(
    <MessageRow
      {...props}
      row={message}
      profile={{ name: "Raw Agent" }}
      session={session}
    />,
  );
  for (const [raw, ko] of [
    ["online", "온라인"],
    ["away", "자리 비움"],
    ["offline", "오프라인"],
  ] as const) {
    act(() => {
      status = raw;
      for (const listener of listeners) listener();
      setLanguage("en");
    });
    const avatar = screen.getByRole("img", { name: `Agent, ${raw}` });
    act(() => setLanguage("ko"));
    expect(screen.getAllByRole("img")).toEqual([avatar]);
    expect(avatar).toHaveAccessibleName(`에이전트, ${ko}`);
    expect(avatar.querySelector("[data-status]")).toHaveAttribute(
      "data-status",
      raw,
    );
  }
  act(() => {
    status = "unknown";
    for (const listener of listeners) listener();
  });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(document.querySelector(".buzz-avatar-status")).not.toHaveAttribute(
    "data-status",
  );
  act(() => {
    status = "online";
    for (const listener of listeners) listener();
  });
  view.rerender(
    <MessageRow
      {...props}
      row={message}
      profile={{ name: "Raw Agent" }}
      session={session}
      canOpenLink={() => true}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Raw Agent 프로필 보기" });
  expect(trigger).toHaveAccessibleDescription("접속 상태: 온라인");
  expect(within(trigger).queryByRole("img")).toBeNull();
});

it("translates only absent diff content and preserves identically named authored data", () => {
  const diff = { filePath: "", description: "Raw diff", truncated: true };
  const view = render(
    <MessageRow {...props} row={{ ...row, content: "", diff }} />,
  );
  const region = screen.getByRole("region", { name: "Raw diff" });
  region.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("region", { name: "원본 변경 사항" })).toBe(region);
  expect(region).toHaveFocus();
  expect(region).toHaveTextContent("변경 내용이 없습니다");
  expect(screen.getByText("변경 사항")).toBeVisible();
  expect(screen.getByText("Raw diff")).toBeVisible();
  expect(
    screen.getByText(
      "변경 내용의 일부만 표시했습니다. 원본 저장소에서 전체 변경 내용을 확인하세요.",
    ),
  ).toBeVisible();
  view.rerender(
    <MessageRow
      {...props}
      row={{
        ...row,
        content: "No diff content",
        diff: { ...diff, filePath: "Diff" },
      }}
    />,
  );
  expect(screen.getByText("Diff")).toBeVisible();
  expect(region).toHaveTextContent("No diff content");
  expect(screen.queryByText("변경 내용이 없습니다")).not.toBeInTheDocument();
});

it.each([undefined, "Raw 한글 {thread} Thread"])(
  "keeps a rich sent-from link, selection copy and raw target: %s",
  (excerpt) => {
    const open = vi.fn(() => true),
      rootId = "a".repeat(64);
    const url = `buzz://message?channel=raw-channel&id=${rootId}&thread=${rootId}`;
    render(
      <MessageRow
        {...props}
        row={{ ...row, sentFromThread: { rootId, excerpt } }}
        onOpenLink={open}
      />,
    );
    const link = screen.getByRole("link", {
      name: excerpt ? `Thread — ${excerpt}` : "Thread",
    });
    link.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      const label = `${language === "ko" ? "스레드" : "Thread"}${excerpt ? ` — ${excerpt}` : ""}`;
      expect(screen.getByRole("link", { name: label })).toBe(link);
      expect(link).toHaveFocus();
      expect(link).toHaveAttribute("href", url);
      expect(link.parentElement).toHaveTextContent(
        language === "ko" ? `${label}에서 보냄` : `Sent from ${label}`,
      );
      const selection = window.getSelection();
      if (!selection) throw new Error("The fixture requires DOM selection");
      const range = document.createRange();
      range.selectNodeContents(link);
      selection.removeAllRanges();
      selection.addRange(range);
      expect(serializeSelection(selection, "text")).toBe(`${label} (${url})`);
      expect(serializeSelection(selection, "markdown")).toBe(
        `[${label}](${url})`,
      );
      selection.removeAllRanges();
    }
    fireEvent.click(link);
    expect(open).toHaveBeenCalledExactlyOnceWith(url, { rootId: row.id });
  },
);

it("retains workflow ownership, popup and owner button through rich phrase reordering", async () => {
  const user = userEvent.setup();
  const ownerId = "ab".repeat(32),
    open = vi.fn(() => true);
  render(
    <MessageRow
      {...props}
      row={{ ...row, authorId: ownerId, workflowOwnerId: ownerId }}
      participantProfiles={new Map([[ownerId, { name: "Workflow" }]])}
      onOpenLink={open}
      canOpenLink={() => true}
    />,
  );
  const owner = screen.getByRole("button", {
    name: "View workflow owner Workflow profile",
  });
  const trigger = screen.getByRole("button", {
    name: "Workflow message details",
  });
  trigger.focus();
  await user.keyboard("{Enter}");
  const dialog = await screen.findByRole("dialog", {
    name: "Workflow message",
  });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("dialog", { name: "워크플로 메시지" })).toBe(dialog);
  expect(dialog).toHaveAccessibleDescription(
    "워크플로가 자동으로 보낸 메시지입니다. 소유자가 워크플로를 설정했지만 이 메시지를 직접 보내지는 않았습니다.",
  );
  expect(screen.getByRole("img", { name: "워크플로" })).toBeVisible();
  expect(
    screen.getByRole("button", {
      name: "워크플로 소유자 Workflow 프로필 보기",
    }),
  ).toBe(owner);
  expect(owner).toHaveTextContent("Workflow");
  expect(owner.parentElement).toHaveTextContent("Workflow 님 소유");
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  fireEvent.click(owner);
  expect(open).toHaveBeenCalledExactlyOnceWith(profileTarget(ownerId), {
    rootId: row.id,
  });
});

it("translates only component-owned outcomes and collapse, preserving the canonical exported helpers", () => {
  const toggle = vi.fn();
  render(
    <ActivityDisclosure
      expanded
      onToggle={toggle}
      label="Raw Collapse"
      summary="Raw Stopped"
    >
      <ActivityOutcome state="error" name="Couldn’t finish" />
      <ActivityOutcome state="stopped" />
      <ActivityOutcome state="unknown" />
    </ActivityDisclosure>,
  );
  const trigger = screen.getByRole("button", { name: "Raw Collapse" });
  act(() => setLanguage("ko"));
  expect(trigger).toHaveAccessibleName("Raw Collapse");
  expect(trigger).toHaveTextContent("접기");
  expect(screen.getByText("완료하지 못함")).toBeVisible();
  expect(screen.getByText("Couldn’t finish ·")).toBeVisible();
  expect(screen.getByText("중지됨")).toBeVisible();
  expect(activityOutcomeLabel("error")).toBe("Couldn’t finish");
  expect(activityOutcomeLabel("stopped")).toBe("Stopped");
  expect(activityOutcomeLabel("unknown")).toBeUndefined();
  expect(activityOutcomeReason("error", "This request was stopped.")).toBe(
    "This request was stopped.",
  );
  expect(activityOutcomeReason("stopped")).toBe("This request was stopped.");
  fireEvent.click(trigger);
  expect(toggle).toHaveBeenCalledOnce();
});
