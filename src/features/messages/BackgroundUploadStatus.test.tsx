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
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComposerSession } from "./composer-session";
import type { DraftAttachment } from "./attachment-draft";
import { sendInBackground } from "./background-upload";
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import { BackgroundUploadStatus } from "./BackgroundUploadStatus";

import { setLanguage } from "../../shared/i18n";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
/** Already uploaded, so the send goes straight to publishing. */
const ready = (name: string): DraftAttachment => ({
  id: crypto.randomUUID(),
  file: new File([], name),
  status: "ready",
  uploaded: {
    name,
    url: `https://relay.test/media/${"a".repeat(64)}.txt`,
    type: "text/plain",
    size: 5,
    sha256: "a".repeat(64),
  },
});

it("leaves cancelled sends out of the count and disables Cancel once nothing is left to stop", async () => {
  const session = { attachments: {} } as unknown as ComposerSession;
  const focusTarget = createRef<HTMLTextAreaElement>();
  render(
    <>
      <textarea ref={focusTarget} aria-label="Message" />
      <BackgroundUploadStatus
        session={session}
        focusTarget={focusTarget}
        here="buzz://channel/elsewhere"
      />
    </>,
  );
  // A publish ignores Cancel: each send stays listed until its publish settles.
  const held = [deferred(), deferred()];
  for (const [index, name] of ["#Design", "#Ideas"].entries())
    act(() =>
      sendInBackground(
        session,
        name,
        name,
        { name, link: `buzz://channel/${name}` },
        [ready(`${index}.txt`)],
        () => held[index]?.promise,
        () => true,
      ),
    );
  expect(
    screen.getByText("Finishing upload to #Ideas and 1 more"),
  ).toHaveAttribute("role", "status");

  await userEvent.click(
    screen.getByRole("button", { name: "Cancel upload to #Ideas" }),
  );
  expect(screen.getByText("Finishing upload to #Design")).toBeVisible();
  const cancel = screen.getByRole("button", {
    name: "Cancel upload to #Design",
  });
  expect(cancel).toHaveAttribute("aria-disabled", "false");

  await userEvent.click(cancel);
  // Both are cancelled and still publishing. Cancel stops nothing, but keeps
  // focus: browsers move focus off a `disabled` button.
  expect(screen.getByText("Finishing upload to #Ideas")).toBeVisible();
  expect(cancel).toHaveAccessibleName("Cancel upload to #Ideas");
  expect(cancel).toHaveAttribute("aria-disabled", "true");
  expect(cancel).not.toHaveAttribute("disabled");
  expect(cancel).toHaveFocus();

  await act(async () => {
    for (const publish of held) publish.resolve();
  });
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  expect(focusTarget.current).toHaveFocus();
});

it.each([false, true])(
  "keeps pending upload controls and raw names across EN→KO→EN (thread %s)",
  async (thread) => {
    setLanguage("en");
    const session = { attachments: {} } as unknown as ComposerSession;
    const held = deferred();
    const recover = vi.fn(() => true);
    const focusTarget = createRef<HTMLTextAreaElement>();
    render(
      <>
        <textarea ref={focusTarget} defaultValue="raw draft {name}" />
        <BackgroundUploadStatus session={session} focusTarget={focusTarget} />
      </>,
    );
    const name = "thread in 사용자 {name}";
    act(() =>
      sendInBackground(
        session,
        "raw-owner",
        "raw-channel",
        { name, ...(thread ? { thread: true as const } : {}) },
        [ready("raw.txt")],
        () => held.promise,
        recover,
      ),
    );
    const cancel = screen.getByRole("button", {
      name: `Cancel upload to ${thread ? "thread in " : ""}${name}`,
    });
    const draft = screen.getByRole("textbox");
    draft.focus();
    act(() => setLanguage("ko"));
    expect(
      screen.getByRole("button", {
        name: thread ? `${name}의 스레드 업로드 취소` : `${name} 업로드 취소`,
      }),
    ).toBe(cancel);
    expect(screen.getByRole("textbox")).toBe(draft);
    expect(draft).toHaveValue("raw draft {name}");
    expect(draft).toHaveFocus();
    expect(recover).not.toHaveBeenCalled();
    act(() => setLanguage("en"));
    expect(
      screen.getByRole("button", {
        name: `Cancel upload to ${thread ? "thread in " : ""}${name}`,
      }),
    ).toBe(cancel);
    await act(async () => held.resolve());
    expect(recover).not.toHaveBeenCalled();
  },
);

it("translates retained failure/recovery descriptors without changing diagnostics, links or recovery", async () => {
  setLanguage("en");
  const session = { attachments: {} } as unknown as ComposerSession;
  const focusTarget = createRef<HTMLTextAreaElement>();
  const recover = vi.fn<() => boolean | "conflict">(() => false);
  const open = vi.fn(() => true);
  const name = "thread in 原文 {name}";
  const link = "buzz://channel/raw?thread=abc%2Fdef#raw";
  render(
    <BackgroundUploadStatus
      session={session}
      focusTarget={focusTarget}
      onOpenLink={open}
    />,
    { wrapper: ToastProvider },
  );
  act(() =>
    sendInBackground(
      session,
      "owner",
      "raw-channel",
      { name, link, thread: true },
      [ready("raw.txt")],
      () => {
        throw new Error("Relay diagnostic {name} 原文");
      },
      recover,
    ),
  );
  await waitFor(() =>
    expect(
      screen.getByText(`Message to thread in ${name} failed to send`),
    ).toBeInTheDocument(),
  );
  const retry = screen.getByRole("button", {
    name: "Retry failed send recovery",
  });
  const failure = screen.getByText(
    `Message to thread in ${name} failed to send`,
  );
  const buttons = screen.getAllByRole("button", {
    name: `Open thread in ${name}`,
  });
  act(() => setLanguage("ko"));
  expect(
    screen.getByText(`${name}의 스레드에 메시지를 보내지 못했습니다`),
  ).toBe(failure);
  expect(
    screen.getByRole("button", { name: "실패한 전송 복구 다시 시도" }),
  ).toBe(retry);
  expect(screen.getByText("Relay diagnostic {name} 原文")).toBeInTheDocument();
  expect(
    screen.getAllByRole("button", { name: `${name}의 스레드 열기` })[0],
  ).toBe(buttons[0]);
  expect(recover).toHaveBeenCalledTimes(1);
  recover.mockReturnValueOnce("conflict");
  fireEvent.click(retry);
  expect(recover).toHaveBeenCalledTimes(2);
  expect(
    screen.getByText(
      `${name}의 스레드에 보내지 못한 메시지는 초안이 변경되어 보관했습니다. 초안을 비운 뒤 이 세션을 떠나기 전에 복구를 다시 시도하세요.`,
    ),
  ).toBeInTheDocument();
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("button", { name: "Retry failed send recovery" }),
  ).toBe(retry);
  const openButton = buttons[0];
  if (!openButton) throw new Error("Missing original open control");
  fireEvent.click(openButton);
  expect(open).toHaveBeenCalledWith(link);
  expect(
    screen.getByRole("button", { name: "Retry failed send recovery" }),
  ).toBe(retry);
  recover.mockReturnValueOnce(true);
  fireEvent.click(retry);
  expect(
    screen.queryByRole("button", { name: "Retry failed send recovery" }),
  ).toBeNull();
});

it.each([true, false])(
  "keeps Error diagnostics literal and localizes only the unknown fallback (Error %s)",
  async (external) => {
    setLanguage("en");
    const session = { attachments: {} } as unknown as ComposerSession;
    render(
      <BackgroundUploadStatus
        session={session}
        focusTarget={createRef<HTMLTextAreaElement>()}
      />,
      { wrapper: ToastProvider },
    );
    act(() =>
      sendInBackground(
        session,
        "owner",
        "channel",
        { name: "Raw {name}" },
        [ready("raw.txt")],
        () => {
          throw external ? new Error("Unknown error") : undefined;
        },
        () => true,
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("Unknown error")).toBeInTheDocument(),
    );
    act(() => setLanguage("ko"));
    expect(
      screen.getByText(external ? "Unknown error" : "알 수 없는 오류"),
    ).toBeInTheDocument();
    act(() => setLanguage("en"));
    expect(screen.getByText("Unknown error")).toBeInTheDocument();
  },
);

it("keeps byte progress and the same controls through preparing/uploading/finishing count variants", async () => {
  setLanguage("en");
  let prepared!: (file: File) => void;
  let uploaded!: (file: NonNullable<DraftAttachment["uploaded"]>) => void;
  let progress: ((sent: number, total: number) => void) | undefined;
  const source = new File(["12345"], "raw.txt");
  const upload = vi.fn(
    (
      _file: File,
      _channel: string,
      _signal: AbortSignal,
      onProgress: typeof progress,
    ) => {
      progress = onProgress;
      return new Promise<NonNullable<DraftAttachment["uploaded"]>>(
        (resolve) => {
          uploaded = resolve;
        },
      );
    },
  );
  const session = {
    attachments: {
      prepare: () =>
        new Promise<File>((resolve) => {
          prepared = resolve;
        }),
      upload,
    },
  } as unknown as ComposerSession;
  const publishing = deferred();
  const recover = vi.fn(() => true);
  render(
    <BackgroundUploadStatus
      session={session}
      focusTarget={createRef<HTMLTextAreaElement>()}
    />,
  );
  act(() => {
    sendInBackground(
      session,
      "first-owner",
      "raw-channel",
      { name: "#First" },
      [{ id: "source", file: source, status: "queued" }],
      () => publishing.promise,
      recover,
    );
    sendInBackground(
      session,
      "second-owner",
      "raw-channel",
      { name: "#Raw", thread: true },
      [ready("ready.txt")],
      () => publishing.promise,
      recover,
    );
  });
  const cancel = screen.getByRole("button", {
    name: "Cancel upload to thread in #Raw",
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Preparing upload to thread in #Raw and 1 more",
  );
  act(() => setLanguage("ko"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "#Raw의 스레드 외 1건 업로드 준비 중",
  );
  expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  await act(async () => prepared(source));
  expect(screen.getByRole("status")).toHaveTextContent(
    "#Raw의 스레드 외 1건 업로드 중",
  );
  act(() => progress?.(2, 5));
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "70",
  );
  act(() => setLanguage("en"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "Uploading to thread in #Raw and 1 more",
  );
  expect(
    screen.getByRole("button", { name: "Cancel upload to thread in #Raw" }),
  ).toBe(cancel);
  const descriptor = ready("raw.txt").uploaded;
  if (!descriptor) throw new Error("Missing ready fixture descriptor");
  await act(async () => uploaded(descriptor));
  act(() => setLanguage("ko"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "#Raw의 스레드 외 1건 업로드 마무리 중",
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  expect(upload).toHaveBeenCalledExactlyOnceWith(
    source,
    "raw-channel",
    expect.any(AbortSignal),
    expect.any(Function),
  );
  await act(async () => publishing.resolve());
  expect(recover).not.toHaveBeenCalled();
});
