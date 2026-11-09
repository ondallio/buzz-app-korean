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
import { createHuddleComposerOwner } from "../../features/huddle/composer-owner";
import type { ComposerCommand } from "../../features/huddle/composer-contract";
import { composerDOMFixture } from "../../features/messages/composer-testing";
import { readView, writeView } from "../../shared/view-state";
import { setLanguage } from "../../shared/i18n";
import { useHuddleComposer } from "./HuddleComposer";
composerDOMFixture();
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});
function Companion({ token }: { token: string }) {
  return useHuddleComposer(token);
}
it("keeps a real detached editor's draft, selection, focus and canonical send through live locale changes", async () => {
  const store = createRelaySession(null),
    viewer = "ab".repeat(32),
    room = "raw-room",
    scope = `https://example.test:${viewer}`;
  const metadata = {
    id: room,
    name: "Huddle",
    huddle: true as const,
    parentChannelId: "raw-parent",
    members: [viewer],
  };
  const send = vi.fn(() => "raw-event-id");
  const session = {
    ...store.session,
    scope,
    viewer,
    channels: { ...store.session.channels, get: () => metadata },
    messages: { ...store.session.messages, send },
  };
  const owner = createHuddleComposerOwner(
    session,
    room,
    "raw-parent",
    undefined,
    () => true,
  );
  const raw = "Raw draft 한글\nsecond line";
  writeView(scope, `draft:${room}`, { text: raw, recipients: [] });
  try {
    render(<Companion token={owner.token} />);
    const editor = await screen.findByRole("textbox", {
      name: "Message this Huddle",
    });
    await waitFor(() => expect(editor.textContent).toBe(raw));
    const form = screen.getByRole("form", { name: "Send a message to Huddle" });
    editor.focus();
    const text = editor.querySelector("p")?.firstChild;
    expect(text).not.toBeNull();
    if (!text) throw new Error("Expected editor text");
    const range = document.createRange();
    range.setStart(text, 2);
    range.setEnd(text, 7);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const draft = readView(scope, `draft:${room}`, null);
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("textbox", {
          name:
            language === "ko"
              ? "이 허들에 메시지 보내기"
              : "Message this Huddle",
        }),
      ).toBe(editor);
      expect(
        screen.getByRole("form", {
          name:
            language === "ko"
              ? "허들에 메시지 보내기"
              : "Send a message to Huddle",
        }),
      ).toBe(form);
      expect(editor).toHaveFocus();
      expect(editor.textContent).toBe(raw);
      expect(window.getSelection()?.toString()).toBe("w dra");
      expect(readView(scope, `draft:${room}`, null)).toEqual(draft);
      expect(send).not.toHaveBeenCalled();
    }
    act(() => setLanguage("ko"));
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send).toHaveBeenCalledWith(room, raw, [], [], undefined, [], {});
  } finally {
    cleanup();
    owner.dispose();
    store.dispose();
  }
});
it("keeps the same pending companion client and its raw closed diagnostic across languages", async () => {
  const token = crypto.randomUUID(),
    peer = new BroadcastChannel(`buzz.huddle.composer.${token}`),
    requests: ComposerCommand[] = [];
  peer.onmessage = ({ data }) => requests.push(data);
  try {
    render(<Companion token={token} />);
    const status = await screen.findByRole("status");
    await waitFor(() =>
      expect(requests.filter((r) => r.kind === "hello")).toHaveLength(1),
    );
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("status")).toBe(status);
      expect(status).toHaveTextContent(
        language === "ko" ? "작성기를 불러오는 중…" : "Loading composer…",
      );
    }
    expect(requests.filter((r) => r.kind === "hello")).toHaveLength(1);
    const first = requests[0];
    if (!first) throw new Error("Missing hello");
    act(() => peer.postMessage({ kind: "closed", client: first.client }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This Huddle conversation has closed.");
    act(() => setLanguage("ko"));
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("This Huddle conversation has closed.");
  } finally {
    cleanup();
    peer.close();
  }
});
