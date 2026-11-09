// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, StrictMode, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import {
  DesktopLanguageProvider,
  useDesktopLanguageStatus,
  createDesktopLanguageSync,
  useDesktopLanguage,
  type DesktopLanguageResult,
} from "./service";
const native = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: true }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: native.invoke,
  isTauri: () => native.isTauri,
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  native.isTauri = true;
});
function deferred() {
  let resolve!: (value: DesktopLanguageResult) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<DesktopLanguageResult>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it("serializes one pending request and only the latest desired language", async () => {
  const first = deferred();
  const second = deferred();
  const send = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const sync = createDesktopLanguageSync(send);
  const initial = sync.getSnapshot();
  expect(sync.getSnapshot()).toBe(initial);
  sync.request("en");
  sync.request("ko");
  sync.request("en");
  sync.request("ko");
  expect(send.mock.calls).toEqual([["en"]]);
  first.resolve({ language: "en", missingKeys: [] });
  await waitFor(() => expect(send.mock.calls).toEqual([["en"], ["ko"]]));
  second.resolve({ language: "ko", missingKeys: ["File"] });
  await waitFor(() => expect(sync.getSnapshot().pending).toBe(false));
  expect(sync.getSnapshot()).toMatchObject({
    language: "ko",
    missingKeys: ["File"],
    error: null,
  });
  sync.request("ko");
  expect(send).toHaveBeenCalledTimes(2);
});
it("retains a failure without looping and retries the latest choice explicitly", async () => {
  const send = vi
    .fn()
    .mockRejectedValueOnce(new Error("menu unavailable"))
    .mockResolvedValue({ language: "ko", missingKeys: [] });
  const sync = createDesktopLanguageSync(send);
  sync.request("ko");
  await waitFor(() =>
    expect(sync.getSnapshot().error).toBe("menu unavailable"),
  );
  sync.request("ko");
  await Promise.resolve();
  expect(send).toHaveBeenCalledTimes(1);
  sync.retry();
  await waitFor(() => expect(sync.getSnapshot().language).toBe("ko"));
  expect(send).toHaveBeenCalledTimes(2);
  expect(sync.getSnapshot().error).toBe(null);
});
it("advances a newer choice after an older failure and rejects mismatched acknowledgements", async () => {
  const first = deferred();
  const second = deferred();
  const send = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const sync = createDesktopLanguageSync(send);
  sync.request("en");
  sync.request("ko");
  first.reject(new Error("old error"));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  second.resolve({ language: "en", missingKeys: [] });
  await waitFor(() => expect(sync.getSnapshot().error).toMatch(/language/));
  expect(sync.getSnapshot().language).toBe(null);
});
it("uses the actual language store in StrictMode without duplicate pending IPC or losing the latest choice", async () => {
  const first = deferred();
  const second = deferred();
  native.invoke
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  setLanguage("en");
  const hook = renderHook(() => useDesktopLanguage(true), {
    wrapper: StrictMode,
  });
  expect(native.invoke.mock.calls).toEqual([
    ["set_desktop_language", { language: "en" }],
  ]);
  act(() => setLanguage("ko"));
  await act(async () => first.resolve({ language: "en", missingKeys: [] }));
  expect(native.invoke.mock.calls).toEqual([
    ["set_desktop_language", { language: "en" }],
    ["set_desktop_language", { language: "ko" }],
  ]);
  await act(async () => second.resolve({ language: "ko", missingKeys: [] }));
  expect(hook.result.current.language).toBe("ko");
  expect(hook.result.current.pending).toBe(false);
});
it("does not invoke a native command on a disabled host", () => {
  renderHook(() => useDesktopLanguage(false));
  expect(native.invoke).not.toHaveBeenCalled();
});

it("collapses a return to the in-flight choice and ignores stale completion state", async () => {
  const first = deferred();
  const second = deferred();
  const send = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const sync = createDesktopLanguageSync(send);
  const listener = vi.fn();
  const unsubscribe = sync.subscribe(listener);
  sync.request("en");
  sync.request("ko");
  sync.request("en");
  first.resolve({ language: "en", missingKeys: [] });
  await waitFor(() => expect(sync.getSnapshot().pending).toBe(false));
  expect(send.mock.calls).toEqual([["en"]]);
  expect(sync.getSnapshot().language).toBe("en");
  unsubscribe();
  const calls = listener.mock.calls.length;
  sync.request("ko");
  second.resolve({ language: "ko", missingKeys: [] });
  await waitFor(() => expect(sync.getSnapshot().pending).toBe(false));
  expect(listener).toHaveBeenCalledTimes(calls);
});

it("retains failed native state across a StrictMode language change, then explicitly retries", async () => {
  native.invoke
    .mockRejectedValueOnce(new Error("dispatch failed"))
    .mockResolvedValue({ language: "ko", missingKeys: [] });
  setLanguage("ko");
  const hook = renderHook(() => useDesktopLanguage(true), {
    wrapper: StrictMode,
  });
  await waitFor(() =>
    expect(hook.result.current.error).toBe("dispatch failed"),
  );
  expect(native.invoke).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.language).toBe("ko"));
  expect(native.invoke).toHaveBeenCalledTimes(2);
  expect(hook.result.current.error).toBe(null);
  expect(localStorage.getItem("buzz-korean-beta.language.v1")).toBe("ko");
});

it("shares one controller across status consumers and retries through the provider", async () => {
  native.invoke
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValue({ language: "ko", missingKeys: [] });
  setLanguage("ko");
  const hook = renderHook(
    () => [useDesktopLanguageStatus(), useDesktopLanguageStatus()] as const,
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          StrictMode,
          null,
          createElement(DesktopLanguageProvider, { enabled: true, children }),
        ),
    },
  );
  await waitFor(() => expect(hook.result.current[0].error).toBe("unavailable"));
  expect(hook.result.current[0]).toBe(hook.result.current[1]);
  expect(native.invoke).toHaveBeenCalledTimes(1);
  act(() => hook.result.current[1].retry());
  await waitFor(() => expect(hook.result.current[0].language).toBe("ko"));
  expect(native.invoke).toHaveBeenCalledTimes(2);
});

it("defaults to the macOS Tauri host only", async () => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
  const linux = renderHook(() => useDesktopLanguage());
  expect(native.invoke).not.toHaveBeenCalled();
  linux.unmount();
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  native.isTauri = false;
  const browser = renderHook(() => useDesktopLanguage());
  expect(native.invoke).not.toHaveBeenCalled();
  browser.unmount();
  native.isTauri = true;
  setLanguage("en");
  native.invoke.mockResolvedValue({ language: "en", missingKeys: [] });
  const desktop = renderHook(() => useDesktopLanguage());
  await waitFor(() => expect(desktop.result.current.language).toBe("en"));
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith(
    "set_desktop_language",
    { language: "en" },
  );
});
