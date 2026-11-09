// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import { setLanguage } from "../../shared/i18n";
import { MediaMenuDownloadNotice } from "./MediaDownloadAction";
import { VideoPlayer } from "./VideoPlayer";
import { AudioAttachment } from "./AudioAttachment";
import { VoiceNoteCard } from "../../bundled/voice-notes/VoiceNoteCard";
import { AttachmentDownloadContext } from "./AttachmentDownloadContext";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
const url = `https://relay.test/media/${"a".repeat(64)}.mp4`;
const source = `buzz-media://localhost/${encodeURIComponent(url)}`;
const name = "recording.mp4";
type Kind = "video" | "audio" | "voice note";
function Surface({ kind, draft = false }: { kind: Kind; draft?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  if (kind === "video")
    return (
      <VideoPlayer
        source={source}
        videoRef={video}
        downloadName={draft ? undefined : name}
        onTime={() => {}}
        onError={() => {}}
      />
    );
  if (kind === "audio")
    return (
      <AudioAttachment
        source={source}
        attachment={{ url, name, kind: "audio" }}
        allowDownload={!draft}
      />
    );
  return (
    <AttachmentDownloadContext value={!draft}>
      <VoiceNoteCard
        source={source}
        downloadName={name}
        {...(draft ? { onRemove: () => {} } : {})}
      />
    </AttachmentDownloadContext>
  );
}
function held() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.mocked(invoke)
    .mockReset()
    .mockResolvedValue("http://127.0.0.1:4321/token/");
  vi.mocked(listen).mockReset();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each<Kind>(["video", "audio", "voice note"])(
  "downloads received %s from the protected source with pending feedback and retry",
  async (kind) => {
    const first = held();
    const retry = held();
    let saving = first.promise;
    vi.mocked(invoke).mockImplementation(async (command) =>
      command === "media_download" ? saving : "http://127.0.0.1:4321/token/",
    );
    render(<Surface kind={kind} />);
    const button = await screen.findByRole("button", {
      name: `Download ${kind}`,
    });
    button.focus();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Downloading…")).toBeVisible();
    if (kind === "video")
      expect(button.closest("[data-controls-revealed]")).not.toBeNull();
    expect(
      vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "media_download"),
    ).toEqual([["media_download", { source, name }]]);
    await act(async () => first.reject(new Error("offline")));
    expect(screen.getByRole("alert")).toHaveTextContent(
      kind === "voice note"
        ? "Download failed"
        : "Couldn’t download. Try again.",
    );
    saving = retry.promise;
    fireEvent.click(
      screen.getByRole("button", { name: `Retry download ${kind}` }),
    );
    await act(async () => retry.resolve());
    expect(
      screen.getByText(
        kind === "voice note" ? "Downloaded" : "Saved to Downloads",
      ),
    ).toBeVisible();
    expect(
      vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "media_download"),
    ).toHaveLength(2);
  },
);

it("keeps the voice-note confirmation visible for ten seconds after saving", async () => {
  render(<Surface kind="voice note" />);
  const button = await screen.findByRole("button", {
    name: "Download voice note",
  });
  vi.useFakeTimers();
  try {
    await act(async () => fireEvent.click(button));
    expect(screen.getByRole("status")).toHaveTextContent("Downloaded");
    act(() => vi.advanceTimersByTime(9999));
    expect(screen.getByRole("status")).toHaveTextContent("Downloaded");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  } finally {
    vi.useRealTimers();
  }
});

it.each<Kind>(["video", "audio", "voice note"])(
  "keeps the %s status region mounted before the first download",
  async (kind) => {
    render(<Surface kind={kind} />);
    await screen.findByRole("button", { name: `Download ${kind}` });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  },
);

it.each<Kind>(["video", "audio", "voice note"])(
  "clears the %s failure notice after six seconds but keeps retry",
  async (kind) => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "media_download") throw new Error("offline");
      return "http://127.0.0.1:4321/token/";
    });
    render(<Surface kind={kind} />);
    const button = await screen.findByRole("button", {
      name: `Download ${kind}`,
    });
    vi.useFakeTimers();
    try {
      await act(async () => fireEvent.click(button));
      expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();
      if (kind === "video")
        expect(button.closest("[data-controls-revealed]")).not.toBeNull();
      act(() => vi.advanceTimersByTime(5999));
      expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(button.closest("[data-controls-revealed]")).toBeNull();
      expect(button).toHaveAccessibleName(`Retry download ${kind}`);
      await act(async () => fireEvent.click(button));
      expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  },
);

it.each<Kind>(["video", "audio", "voice note"])(
  "does not add a download action to an unsent %s preview",
  async (kind) => {
    render(<Surface kind={kind} draft />);
    await act(async () => {});
    expect(
      screen.queryByRole("button", { name: `Download ${kind}` }),
    ).not.toBeInTheDocument();
  },
);

it("shows native media menu download results until unmounted", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  let publish!: (event: { payload: string | null }) => void;
  const registered = held();
  const unlisten = vi.fn();
  vi.mocked(listen).mockImplementation(async (event, handler) => {
    expect(event).toBe("media-menu-download");
    publish = handler as typeof publish;
    registered.resolve();
    return unlisten;
  });
  const view = render(
    <ToastProvider>
      <MediaMenuDownloadNotice />
    </ToastProvider>,
  );
  await act(() => registered.promise);
  act(() => publish({ payload: `${"a".repeat(64)}.mp4` }));
  expect(
    await screen.findByRole("dialog", { name: "Saved to Downloads" }),
  ).toBeVisible();
  act(() => publish({ payload: null }));
  expect(
    await screen.findByRole("dialog", {
      name: "Couldn’t download. Try again.",
    }),
  ).toBeVisible();
  view.unmount();
  expect(unlisten).toHaveBeenCalledOnce();
});

it("stops a menu download listener that registers after unmount", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  let register!: (unlisten: () => void) => void;
  vi.mocked(listen).mockImplementation(
    () =>
      new Promise((resolve) => {
        register = resolve;
      }),
  );
  const view = render(
    <ToastProvider>
      <MediaMenuDownloadNotice />
    </ToastProvider>,
  );
  view.unmount();
  const unlisten = vi.fn();
  await act(async () => register(unlisten));
  expect(unlisten).toHaveBeenCalledOnce();
});

it("does not listen for menu downloads outside the desktop host", () => {
  vi.mocked(isTauri).mockReturnValue(false);
  render(
    <ToastProvider>
      <MediaMenuDownloadNotice />
    </ToastProvider>,
  );
  expect(listen).not.toHaveBeenCalled();
});

it("keeps the same pending/retry download control and raw native request across locale changes", async () => {
  setLanguage("en");
  const first = held(),
    second = held();
  let saving = first.promise;
  vi.mocked(invoke).mockImplementation(async (command) =>
    command === "media_download" ? saving : "http://127.0.0.1:4321/token/",
  );
  render(<Surface kind="voice note" />);
  const button = await screen.findByRole("button", {
    name: "Download voice note",
  });
  button.focus();
  fireEvent.click(button);
  const status = screen.getByRole("status");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "음성 메모 다운로드" })).toBe(
    button,
  );
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(status).toHaveTextContent("다운로드 중…");
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(([command]) => command === "media_download"),
  ).toEqual([["media_download", { source, name }]]);
  await act(async () => first.reject(new Error("raw native error")));
  expect(
    screen.getByRole("button", { name: "음성 메모 다운로드 다시 시도" }),
  ).toBe(button);
  expect(screen.getByRole("alert")).toHaveTextContent("다운로드 실패");
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("button", { name: "Retry download voice note" }),
  ).toBe(button);
  saving = second.promise;
  fireEvent.click(button);
  await act(async () => second.resolve());
  act(() => setLanguage("ko"));
  expect(screen.getByText("다운로드 완료")).toBeVisible();
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(([command]) => command === "media_download"),
  ).toEqual([
    ["media_download", { source, name }],
    ["media_download", { source, name }],
  ]);
});

it("keeps completed native-menu feedback live after its listener unmounts", async () => {
  setLanguage("en");
  vi.mocked(isTauri).mockReturnValue(true);
  let publish!: (event: { payload: string | null }) => void;
  const unlisten = vi.fn();
  vi.mocked(listen).mockImplementation(async (_event, handler) => {
    publish = handler as typeof publish;
    return unlisten;
  });
  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <ToastProvider>
        {open && <MediaMenuDownloadNotice />}
        <button type="button" onClick={() => setOpen(false)}>
          Retire listener
        </button>
      </ToastProvider>
    );
  }
  render(<Host />);
  await act(async () => {});
  act(() => publish({ payload: "原文 {name}.mp4" }));
  const toast = await screen.findByRole("dialog", {
    name: "Saved to Downloads",
  });
  fireEvent.click(screen.getByRole("button", { name: "Retire listener" }));
  expect(unlisten).toHaveBeenCalledOnce();
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("dialog", { name: "다운로드 폴더에 저장했습니다" }),
  ).toBe(toast);
  act(() => setLanguage("en"));
  expect(screen.getByRole("dialog", { name: "Saved to Downloads" })).toBe(
    toast,
  );
});
