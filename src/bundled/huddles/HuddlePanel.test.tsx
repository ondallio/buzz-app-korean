import { setLanguage } from "../../shared/i18n";
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { File } from "node:buffer";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, assert, expect, it, vi } from "vitest";
import { composerDOMFixture } from "../../features/messages/composer-testing";
import { stubAvatarBrowserApis } from "../../features/agents/avatar-testing";
import { createRelaySession } from "../../features/relay/session";
import type { RelayData } from "../../features/relay/service";
import { readView, writeView } from "../../shared/view-state";
import { attachmentDraft } from "../../features/messages/attachment-draft";
import { HuddlePanel } from "./HuddlePanel";
import { huddleTarget } from "./HuddleCard";

composerDOMFixture();
stubAvatarBrowserApis();
afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.restoreAllMocks();
});
it("releases unsent files on close while retaining the saved panel text draft", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const parent = "00000000-0000-4000-8000-000000000001";
  const room = "00000000-0000-4000-8000-000000000002";
  const scope = "panel-attachment-cleanup";
  const store = createRelaySession(null);
  const release = vi.fn();
  const upload = vi.fn(async () => uploaded);
  const uploaded = {
    name: "notes.txt",
    url: `https://relay.test/media/${"a".repeat(64)}.txt`,
    type: "text/plain",
    size: 5,
    sha256: "a".repeat(64),
  };
  const channel = {
    id: room,
    name: "Huddle",
    huddle: true as const,
    parentChannelId: parent,
    members: [],
  };
  const list = { status: "ready" as const, channels: [channel] };
  const pending: readonly never[] = [];
  const rows: readonly never[] = [];
  const session = {
    ...store.session,
    outbox: {
      supports: () => true,
      snapshot: () => pending,
      subscribe: () => () => {},
      observeDismiss: () => () => {},
      observeSend: () => () => {},
      ready: async () => {},
      send: () => {
        throw new Error("No send expected");
      },
      recovery: async () => undefined,
      recover: async () => {},
      acknowledge: async () => {},
      retry: () => {},
      dismiss: async () => {},
    },
    attachments: {
      prepare: async (file: globalThis.File) => file,
      upload,
      release,
    },
    channels: {
      ...store.session.channels,
      resolve: async () => {},
      ensure: () => {},
      get: () => channel,
      list: () => list,
      window: () => ({
        ...store.session.channels.window(room),
        status: "ready" as const,
        rows,
        hasMore: false,
      }),
    },
  };
  const snapshot = { status: "ready" as const, generation: 1, scope, session };
  const relay: RelayData = {
    snapshot: () => snapshot,
    subscribe: () => () => {},
    retry() {},
    disconnect() {},
    async clearCache() {},
  };
  writeView(scope, `draft:${room}`, "Keep these notes");
  const panel = () => (
    <HuddlePanel
      target={huddleTarget(parent, room)}
      relay={relay}
      close={() => {}}
    />
  );
  const view = render(panel());
  await waitFor(() =>
    expect(screen.getByRole("textbox").textContent).toContain(
      "Keep these notes",
    ),
  );
  const input = view.container.querySelector('input[type="file"]');
  assert.exists(input);
  fireEvent.change(input, {
    target: {
      files: [new File(["notes"], "notes.txt", { type: "text/plain" })],
    },
  });
  await screen.findByText("notes.txt");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Send message" }),
    ).not.toBeDisabled(),
  );
  await waitFor(() =>
    expect(
      attachmentDraft(session, `${scope}:draft:${room}`, room).snapshot()[0]
        ?.status,
    ).toBe("ready"),
  );
  view.unmount();
  expect(upload).toHaveBeenCalledOnce();
  expect(release).toHaveBeenCalledWith(uploaded);
  render(panel());
  await waitFor(() =>
    expect(screen.getByRole("textbox").textContent).toContain(
      "Keep these notes",
    ),
  );
  expect(screen.queryByText("notes.txt")).toBeNull();
  cleanup();
  store.dispose();
});

it("keeps a Huddle panel's composer, selection and canonical saved draft across languages", async () => {
  const store = createRelaySession(null);
  const room = "00000000-0000-4000-8000-000000000002",
    parent = "00000000-0000-4000-8000-000000000001";
  const scope = "huddle-language-fixture";
  const metadata = {
    id: room,
    name: "Raw room 한글",
    huddle: true as const,
    parentChannelId: parent,
  };
  const list = { status: "ready" as const, channels: [metadata] };
  const window = {
    ...store.session.channels.window(room),
    status: "ready" as const,
    rows: [],
    hasMore: false,
  };
  const resolve = vi.fn(async () => {}),
    ensure = vi.fn();
  const pending: readonly never[] = [];
  const session = {
    ...store.session,
    outbox: {
      supports: () => true,
      snapshot: () => pending,
      subscribe: () => () => {},
      observeDismiss: () => () => {},
      observeSend: () => () => {},
      ready: async () => {},
      send: () => {
        throw new Error("No send expected");
      },
      recovery: async () => undefined,
      recover: async () => {},
      acknowledge: async () => {},
      retry: () => {},
      dismiss: async () => {},
    },
    channels: {
      ...store.session.channels,
      resolve,
      ensure,
      get: () => metadata,
      list: () => list,
      window: () => window,
    },
  };
  const snapshot = { status: "ready" as const, generation: 1, scope, session };
  const relay: RelayData = {
    snapshot: () => snapshot,
    subscribe: () => () => {},
    retry() {},
    disconnect() {},
    async clearCache() {},
  };
  const key = `draft:${room}`;
  writeView(scope, key, "Huddle raw draft 한글");
  const view = render(
    <HuddlePanel
      target={huddleTarget(parent, room)}
      relay={relay}
      close={() => {}}
    />,
  );
  try {
    const editor = await screen.findByRole("textbox", {
      name: "Message this Huddle",
    });
    await waitFor(() =>
      expect(editor).toHaveTextContent("Huddle raw draft 한글"),
    );
    const form = screen.getByRole("form", { name: "Send a message to Huddle" });
    editor.focus();
    const text = document
      .createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      .nextNode();
    assert(text instanceof Text);
    const range = document.createRange();
    range.setStart(text, 3);
    range.setEnd(text, 7);
    const selection = document.getSelection();
    assert(selection);
    selection.removeAllRanges();
    selection.addRange(range);
    const saved = readView(scope, key, null);
    const calls = resolve.mock.calls.length;
    act(() => setLanguage("ko"));
    expect(
      screen.getByRole("textbox", { name: "이 허들에 메시지 보내기" }),
    ).toBe(editor);
    expect(screen.getByRole("form", { name: "허들에 메시지 보내기" })).toBe(
      form,
    );
    expect(editor).toHaveFocus();
    expect(editor).toHaveTextContent("Huddle raw draft 한글");
    expect([
      selection.anchorNode,
      selection.anchorOffset,
      selection.focusNode,
      selection.focusOffset,
    ]).toEqual([text, 3, text, 7]);
    expect(readView(scope, key, null)).toEqual(saved);
    expect(resolve).toHaveBeenCalledTimes(calls);
    act(() => setLanguage("en"));
    expect(screen.getByRole("textbox", { name: "Message this Huddle" })).toBe(
      editor,
    );
    expect(screen.getByRole("form", { name: "Send a message to Huddle" })).toBe(
      form,
    );
    expect(editor).toHaveFocus();
    expect(readView(scope, key, null)).toEqual(saved);
  } finally {
    view.unmount();
    store.dispose();
  }
});

it("keeps the unavailable Huddle panel message live without opening a discussion", () => {
  const store = createRelaySession(null);
  const observe = vi.fn(store.session.observe);
  const snapshot = {
    status: "ready" as const,
    generation: 1,
    scope: "unavailable-fixture",
    session: { ...store.session, observe },
  };
  const relay: RelayData = {
    snapshot: () => snapshot,
    subscribe: () => () => {},
    retry() {},
    disconnect() {},
    async clearCache() {},
  };
  const view = render(
    <HuddlePanel
      target="buzz://huddle/invalid?parent=invalid"
      relay={relay}
      close={() => {}}
    />,
  );
  try {
    const message = screen.getByText(
      "This Huddle conversation is unavailable.",
    );
    act(() => setLanguage("ko"));
    expect(screen.getByText("이 허들 대화를 사용할 수 없습니다.")).toBe(
      message,
    );
    act(() => setLanguage("en"));
    expect(screen.getByText("This Huddle conversation is unavailable.")).toBe(
      message,
    );
    expect(observe).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    store.dispose();
  }
});
