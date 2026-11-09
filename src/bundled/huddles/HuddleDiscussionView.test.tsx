// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { setLanguage } from "../../shared/i18n";
import { afterEach, beforeAll, expect, it, vi, assert } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { stubAvatarBrowserApis } from "../../features/agents/avatar-testing";
stubAvatarBrowserApis();
import { invoke } from "@tauri-apps/api/core";
vi.mock("@tauri-apps/api/core", async (original) => ({
  ...(await original<typeof import("@tauri-apps/api/core")>()),
  invoke: vi.fn(async () => {}),
}));
import { HuddleDiscussionView } from "./HuddleDiscussionView";
import type { HuddleDiscussion } from "../../features/huddle/discussion";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  setLanguage("en");
});

function discussion(delivery: "failed" | "unknown"): HuddleDiscussion {
  return {
    version: 0,
    historyLimited: false,
    status: "ready",
    writable: true,
    sending: false,
    sent: 0,
    hasMore: false,
    rows: [
      {
        id: "message",
        authorId: "ab".repeat(32),
        channelId: "room",
        attachments: [],
        author: "Alex",
        picture: null,
        text: "Hello",
        time: 1,
        delivery,
      },
    ],
  };
}

it.each(["buzz-media://localhost/authorized-avatar", null])(
  "renders a profile avatar only through its resolved media source (%s)",
  (source) => {
    const value = discussion("failed");
    const row = value.rows[0];
    assert.exists(row);
    row.pictureUrl = "https://example.test/avatar.png";
    row.picture = source;
    const { container } = render(
      <HuddleDiscussionView
        discussion={value}
        composer={null}
        older={() => {}}
        retry={() => {}}
        recover={() => {}}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("src") ?? null).toBe(
      source,
    );
  },
);

it.each(["failed", "unknown"] as const)(
  "keeps focus when recovering a %s message succeeds or fails",
  (delivery) => {
    let value = discussion(delivery);
    const recover = vi.fn((_id: string, dismiss?: boolean) => {
      value = {
        ...value,
        rows: dismiss
          ? []
          : value.rows.map((row) => ({ ...row, delivery: "sending" })),
      };
      rerender(view());
    });
    const view = () => (
      <HuddleDiscussionView
        discussion={value}
        composer={<textarea aria-label="Message this Huddle" />}
        older={() => {}}
        retry={() => {}}
        recover={recover}
      />
    );
    const { rerender } = render(view());
    if (delivery === "unknown")
      expect(screen.getByRole("status").textContent).toContain(
        "Retry sends the same message",
      );
    const editor = screen.getByRole("textbox");
    const retry = screen.getByRole("button", { name: "Retry" });
    retry.focus();
    fireEvent.click(retry);
    expect(recover).toHaveBeenCalledWith("message");
    expect(document.activeElement).toBe(editor);
    // The same row returning to failed must not steal the restored focus.
    value = discussion(delivery);
    rerender(view());
    expect(document.activeElement).toBe(editor);
    const discard = screen.getByRole("button", { name: "Discard" });
    discard.focus();
    fireEvent.click(discard);
    expect(recover).toHaveBeenLastCalledWith("message", true);
    expect(document.activeElement).toBe(editor);
    expect(screen.queryByText("Hello")).toBeNull();
  },
);

it("hands focus to the message log when discarding in a read-only room", () => {
  let value = { ...discussion("unknown"), writable: false };
  const view = () => (
    <HuddleDiscussionView
      discussion={value}
      composer={null}
      older={() => {}}
      retry={() => {}}
      recover={() => {
        value = { ...value, rows: [] };
        rerender(view());
      }}
    />
  );
  const { rerender } = render(view());
  const discard = screen.getByRole("button", { name: "Discard" });
  discard.focus();
  fireEvent.click(discard);
  expect(document.activeElement).toBe(screen.getByRole("log"));
});

it("keeps a surviving focus target across load retry success and failure", () => {
  let value: HuddleDiscussion = {
    ...discussion("failed"),
    writable: false,
    error: "Couldn’t load",
    status: "error" as HuddleDiscussion["status"],
    rows: [],
  };
  const view = () => (
    <HuddleDiscussionView
      discussion={value}
      composer={<textarea aria-label="Message this Huddle" />}
      older={() => {}}
      recover={() => {}}
      retry={() => {
        value = { ...value, error: undefined, status: "loading" };
        rerender(view());
      }}
    />
  );
  const { rerender } = render(view());
  const retry = screen.getByRole("button", { name: "Retry" });
  retry.focus();
  fireEvent.click(retry);
  const log = screen.getByRole("log");
  expect(document.activeElement).toBe(log);
  value = { ...value, error: "Still unavailable", status: "error" };
  rerender(view());
  expect(document.activeElement).toBe(log);
  value = { ...value, error: undefined, status: "ready", writable: true };
  rerender(view());
  expect(document.activeElement).toBe(log);
});

it("renders Markdown and downloads the resolved attachment, without falling back when media is unavailable", () => {
  const value = discussion("failed");
  const url = `https://relay.example/media/${"a".repeat(64)}`;
  const source = `http://buzz-media.localhost/${encodeURIComponent(url)}`;
  const row = value.rows[0];
  assert(row);
  value.rows[0] = {
    ...row,
    delivery: "seen",
    text: "**Notes**",
    attachments: [
      {
        url,
        source,
        previewSource: null,
        kind: "file",
        name: "notes.txt",
        mime: "text/plain",
        size: 23,
      },
    ],
  };
  const view = () => (
    <HuddleDiscussionView
      discussion={value}
      composer={null}
      older={() => {}}
      retry={() => {}}
      recover={() => {}}
    />
  );
  const { rerender } = render(view());
  expect(screen.getByText("Notes").tagName).toBe("STRONG");
  fireEvent.click(screen.getByRole("button", { name: "Download notes.txt" }));
  expect(invoke).toHaveBeenCalledWith("media_download", {
    source,
    name: "notes.txt",
  });
  const attachment = value.rows[0].attachments[0];
  assert(attachment);
  attachment.source = null;
  rerender(view());
  expect(
    screen.queryByRole("button", { name: "Download notes.txt" }),
  ).toBeNull();
  expect(screen.getByText("File unavailable")).toBeTruthy();
});

it("routes internal links and signed mentions while leaving unbound or edited names as prose", () => {
  const value = discussion("failed");
  const key = "cd".repeat(32);
  assert(value.rows[0]);
  value.rows[0] = {
    ...value.rows[0],
    text: "@Taylor and @Unbound [Channel](buzz://channel/test)",
    mentions: [key],
    mentionNames: { [key]: "Taylor" },
  };
  const openLink = vi.fn(() => true);
  const view = () => (
    <HuddleDiscussionView
      discussion={value}
      composer={null}
      older={() => {}}
      retry={() => {}}
      recover={() => {}}
      openLink={openLink}
    />
  );
  const mounted = render(view());
  fireEvent.click(screen.getByRole("link", { name: "Channel" }));
  expect(openLink).toHaveBeenCalledWith("buzz://channel/test");
  // A chip splits its first character from the rest of the name.
  const chip = () =>
    [...document.querySelectorAll("[data-mention-kind]")].find(
      (element) => element.textContent === "Taylor",
    );
  expect(chip()?.getAttribute("data-mention-kind")).toBe("person");
  value.rows[0] = { ...value.rows[0], edited: true };
  mounted.rerender(view());
  expect(chip()).toBeUndefined();
  expect(screen.getByText(/@Taylor/)).toBeTruthy();
});

it("keeps the same discussion, raw message and retained draft while translating live controls", () => {
  const value = {
    ...discussion("unknown"),
    historyLimited: true,
    hasMore: true,
  };
  const older = vi.fn(),
    recover = vi.fn(),
    retry = vi.fn();
  const { container } = render(
    <HuddleDiscussionView
      discussion={value}
      composer={
        <textarea aria-label="Raw draft editor" defaultValue="Raw draft 한글" />
      }
      older={older}
      recover={recover}
      retry={retry}
    />,
  );
  const log = screen.getByRole("log", { name: "Huddle messages" });
  const thread = screen.getByRole("tab", { name: "Thread" });
  const editor = screen.getByRole("textbox", { name: "Raw draft editor" });
  assert(editor instanceof HTMLTextAreaElement);
  editor.focus();
  editor.setSelectionRange(4, 9);
  const text =
    container.querySelector(".message-body") ?? screen.getByText("Hello");
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("log", {
        name: language === "ko" ? "허들 메시지" : "Huddle messages",
      }),
    ).toBe(log);
    expect(
      screen.getByRole("tab", {
        name: language === "ko" ? "스레드" : "Thread",
      }),
    ).toBe(thread);
    expect(screen.getByRole("textbox", { name: "Raw draft editor" })).toBe(
      editor,
    );
    expect(editor.value).toBe("Raw draft 한글");
    expect(editor.selectionStart).toBe(4);
    expect(editor.selectionEnd).toBe(9);
    expect(editor).toHaveFocus();
    expect(
      screen.getByText(
        language === "ko"
          ? "최근 메시지 200개를 표시합니다."
          : "Showing the latest 200 messages.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      language === "ko"
        ? "전송 여부가 확인되지 않았습니다. 다시 시도하면 같은 메시지를 보냅니다."
        : "Delivery hasn’t been confirmed. Retry sends the same message.",
    );
    expect(text).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeVisible();
    expect(screen.getByText("Alex")).toBeVisible();
    expect(older).not.toHaveBeenCalled();
    expect(recover).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  }
  act(() => setLanguage("ko"));
  fireEvent.click(screen.getByRole("button", { name: "이전 메시지 불러오기" }));
  expect(older).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(recover).toHaveBeenCalledExactlyOnceWith("message");
  expect(editor).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "버리기" }));
  expect(recover).toHaveBeenLastCalledWith("message", true);
  fireEvent.click(screen.getByRole("tab", { name: "실시간 대화록" }));
  expect(screen.getByText("실시간 대화록이 없습니다")).toBeVisible();
});

it.each(["loading", "ready"] as const)(
  "translates the %s empty room while keeping the same read-only log",
  (status) => {
    const value = {
      ...discussion("failed"),
      rows: [],
      status,
      writable: false,
    };
    render(
      <HuddleDiscussionView
        discussion={value}
        composer={null}
        older={() => {}}
        retry={() => {}}
        recover={() => {}}
      />,
    );
    const log = screen.getByRole("log");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("log")).toBe(log);
      expect(
        screen.getByText(
          status === "loading"
            ? language === "ko"
              ? "대화를 불러오는 중…"
              : "Loading conversation…"
            : language === "ko"
              ? "아직 메시지가 없습니다"
              : "No messages yet",
        ),
      ).toBeVisible();
      if (status === "ready")
        expect(
          screen.getByText(
            language === "ko"
              ? "이 허들 대화는 읽기 전용입니다."
              : "This Huddle conversation is read-only.",
          ),
        ).toBeVisible();
    }
  },
);
it("preserves a retained raw read error even when it matches an owned delivery caption", () => {
  const value = { ...discussion("failed"), error: "Message wasn’t delivered." };
  const retry = vi.fn();
  render(
    <HuddleDiscussionView
      discussion={value}
      composer={null}
      older={() => {}}
      retry={retry}
      recover={() => {}}
    />,
  );
  const alert = screen.getByRole("alert");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent("Message wasn’t delivered. 다시 시도");
  const action = alert.querySelector("button");
  assert(action instanceof HTMLButtonElement);
  fireEvent.click(action);
  expect(retry).toHaveBeenCalledExactlyOnceWith();
  expect(screen.getByRole("log")).toHaveFocus();
});
