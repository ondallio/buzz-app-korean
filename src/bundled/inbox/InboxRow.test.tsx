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
import type { InboxItem } from "../../features/relay/inbox";
import { createRelaySession } from "../../features/relay/session";
import { keypair, signed } from "../../features/relay/testing";
import { foldMessages } from "../../features/relay/fold";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import { setLanguage } from "../../shared/i18n/language";
import { en, ko } from "../../shared/i18n/catalogs/inbox";
import { InboxRowButton, ReactionRowButton, inboxTimestamp } from "./InboxRow";

afterEach(() => {
  cleanup();
  setLanguage("en");
});

const item: InboxItem = {
  id: "raw-row",
  channelId: "raw-channel",
  target: {
    kind: "message",
    channelId: "raw-channel",
    messageId: "a".repeat(64),
  },
  messageId: "a".repeat(64),
  latestMessageId: "a".repeat(64),
  messageIds: ["a".repeat(64)],
  authorId: "b".repeat(64),
  preview: "Raw user body {raw}",
  createdAt: 1700000000,
  mentioned: true,
  messages: [],
  thread: false,
  unreadCount: 1,
  manual: false,
  readThrough: [],
};

it("updates only an owned incomplete preview and accessible phrase while preserving raw identity, focus and data", () => {
  const clicked = vi.fn();
  const before = JSON.stringify(item);
  render(
    <InboxRowButton
      item={item}
      identity={{
        sender: "Activity {raw}",
        context: "#Mark as read",
        profile: undefined,
      }}
      media={(url) => url}
      feed={{ status: "loading", incomplete: [item.messageId] }}
      time="raw-time"
      onClick={clicked}
    />,
  );
  const button = screen.getByRole("button", {
    name: "Open Activity {raw} in #Mark as read",
  });
  const time = button.querySelector("time");
  button.focus();
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("button", {
      name: "#Mark as read에서 Activity {raw} 열기",
    }),
  ).toBe(button);
  expect(button).toHaveFocus();
  expect(button).toHaveTextContent("미리보기를 갱신하는 중…");
  expect(screen.getByText("Activity {raw}")).toBeVisible();
  expect(screen.getByText("#Mark as read")).toBeVisible();
  expect(button.querySelector("time")).toBe(time);
  expect(time).toHaveAttribute("dateTime", "2023-11-14T22:13:20.000Z");
  expect(time).toHaveTextContent("raw-time");
  expect(JSON.stringify(item)).toBe(before);
  fireEvent.click(button);
  expect(clicked).toHaveBeenCalledOnce();
  act(() => setLanguage("en"));
  expect(button).toHaveTextContent("Preview updating…");
});

it("uses the whole reaction caption in the original strong and nonshrinking tail without changing raw glyphs or focus", () => {
  const author = keypair();
  const owner = createRelaySession(null);
  const event = signed(author, {
    kind: 9,
    content: "User body {raw} 한국어",
    created_at: 1700000000,
    tags: [["h", "raw-channel"]],
  });
  const [message] = foldMessages("raw-channel", "relay", [event]);
  if (!message) throw new Error("Missing message");
  const reaction = signed(author, {
    kind: 7,
    content: ":raw_code:",
    created_at: 1700000001,
    tags: [
      ["e", event.id],
      ["emoji", "raw_code", "https://example.org/raw.png"],
    ],
  });
  const clicked = vi.fn();
  const data = {
    id: "raw-reaction",
    channelId: "raw-channel",
    message,
    events: [reaction],
    createdAt: 1700000001,
  };
  const raw = JSON.stringify(data);
  try {
    render(
      <ReactionRowButton
        item={data}
        session={{ ...owner.session, media: (url) => url }}
        profiles={new Map([[author.pubkey, { name: "Activity {raw}" }]])}
        name={(_key, fallback) => fallback}
        channel={undefined}
        onClick={clicked}
      />,
    );
    const button = screen.getByRole("button", {
      name: /Activity \{raw\} reacted with :raw_code:/,
    });
    const sender = screen.getByText("Activity {raw}", { selector: "strong" });
    const tail = sender.nextElementSibling;
    const glyph = tail?.querySelector("img");
    expect(tail?.tagName).toBe("SPAN");
    expect(tail).toHaveTextContent("reacted");
    expect(glyph).toHaveAttribute("src", "https://example.org/raw.png");
    button.focus();
    act(() => setLanguage("ko"));
    expect(
      screen.getByRole("button", {
        name: "Activity {raw}님이 내 메시지에 :raw_code: 반응을 남겼습니다: User body {raw} 한국어",
      }),
    ).toBe(button);
    expect(button).toHaveFocus();
    expect(sender.nextElementSibling).toBe(tail);
    expect(tail).toHaveTextContent("님의 반응");
    expect(tail?.querySelector("img")).toBe(glyph);
    expect(screen.getByText("User body {raw} 한국어")).toBeVisible();
    expect(JSON.stringify(data)).toBe(raw);
    act(() => setLanguage("en"));
    expect(sender.nextElementSibling).toBe(tail);
    expect(tail).toHaveTextContent("reacted");
    fireEvent.click(button);
    expect(clicked).toHaveBeenCalledOnce();
  } finally {
    owner.dispose();
  }
});

it.each([en, ko])(
  "binds the two whole-caption slots and sender-first layout contract to the actual catalog",
  (catalog) => {
    const template = catalog["inbox.reactionCaption"];
    expect(
      [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
    ).toEqual(["sender", "reactions"]);
    expect(template.startsWith("{sender}")).toBe(true);
  },
);

it.each([0, 59, 60, 119, 120, 3599, 3600, 86399, 86400, 604799, 604800])(
  "keeps the canonical English timestamp ladder at age %s without changing the shared helper",
  (age) => {
    const now = 1800000000;
    expect(inboxTimestamp(now - age, now)).toBe(
      relativeTimestamp(now - age, now),
    );
    setLanguage("ko");
    if (age < 60) expect(inboxTimestamp(now - age, now)).toBe("방금");
    else if (age === 60) expect(inboxTimestamp(now - age, now)).toBe("1분 전");
    else if (age === 3600)
      expect(inboxTimestamp(now - age, now)).toBe("1시간 전");
    else if (age === 86400)
      expect(inboxTimestamp(now - age, now)).toBe("1일 전");
    else if (age === 604800)
      expect(inboxTimestamp(now - age, now)).toBe(
        new Date((now - age) * 1000).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        }),
      );
  },
);
