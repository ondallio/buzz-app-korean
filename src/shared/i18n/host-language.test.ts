// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { initializeHostLanguage } from "./host-language";
import {
  initializeSystemLanguage,
  languagePreference,
  localeStorageKey,
  setLanguage,
  systemLanguageProblem,
} from "./language";

const native = vi.hoisted(() => ({ isTauri: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => native);

afterEach(() => {
  initializeSystemLanguage(null);
  vi.restoreAllMocks();
  vi.clearAllMocks();
  localStorage.clear();
  document.body.replaceChildren();
  document.documentElement.lang = "en";
});

it("localizes the parser-created launch status before native lookup settles and then respects the host", async () => {
  document.body.innerHTML =
    '<div id="buzz-launch" role="status" aria-label="Opening Buzz"><img alt="Buzz"></div><div id="root" inert aria-hidden="true"></div>';
  const launch = document.getElementById("buzz-launch");
  const root = document.getElementById("root");
  vi.spyOn(navigator, "language", "get").mockReturnValue("ko-KR");
  native.isTauri.mockReturnValue(true);
  let finish: (value: string) => void = () => {
    throw new Error("Missing native gate");
  };
  native.invoke.mockReturnValue(
    new Promise<string>((resolve) => {
      finish = resolve;
    }),
  );
  const pending = initializeHostLanguage();
  try {
    expect(launch?.getAttribute("aria-label")).toBe("Buzz 여는 중");
    expect(document.documentElement.lang).toBe("ko");
    expect(root?.hasAttribute("inert")).toBe(true);
    expect(launch?.querySelector("img")?.alt).toBe("Buzz");
  } finally {
    finish("en-US");
    await pending;
  }
  expect(document.getElementById("buzz-launch")).toBe(launch);
  expect(launch?.getAttribute("aria-label")).toBe("Opening Buzz");
  expect(document.documentElement.lang).toBe("en");
  expect(root?.getAttribute("aria-hidden")).toBe("true");
});

it("uses a saved launch language despite the OS and keeps the status localized after IPC failure", async () => {
  document.body.innerHTML =
    '<div id="buzz-launch" role="status" aria-label="Opening Buzz"></div>';
  localStorage.setItem(localeStorageKey, "ko");
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  native.isTauri.mockReturnValue(true);
  native.invoke.mockRejectedValue(new Error("IPC unavailable"));
  await initializeHostLanguage();
  expect(
    document.getElementById("buzz-launch")?.getAttribute("aria-label"),
  ).toBe("Buzz 여는 중");
  expect(document.documentElement.lang).toBe("ko");
  expect(localStorage.getItem(localeStorageKey)).toBe("ko");
  expect(systemLanguageProblem()).toBe(false);
});

it("uses the native preferred language before mounting even if WKWebView reports English", async () => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  native.isTauri.mockReturnValue(true);
  native.invoke.mockResolvedValue("ko-KR");
  await initializeHostLanguage();
  expect(native.invoke).toHaveBeenCalledWith("system_language");
  expect(languagePreference()).toBe("ko");
  expect(localStorage.getItem(localeStorageKey)).toBeNull();
  setLanguage("en");
  await initializeHostLanguage();
  expect(languagePreference()).toBe("en");
});

it("preserves non-native fallback and surfaces a failed native lookup until a choice saves", async () => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("ko-KR");
  native.isTauri.mockReturnValue(false);
  await initializeHostLanguage();
  expect(native.invoke).not.toHaveBeenCalled();
  expect(languagePreference()).toBe("ko");
  native.isTauri.mockReturnValue(true);
  native.invoke.mockRejectedValue(new Error("IPC unavailable"));
  await initializeHostLanguage();
  expect(languagePreference()).toBe("ko");
  expect(systemLanguageProblem()).toBe(true);
  setLanguage("ko");
  expect(systemLanguageProblem()).toBe(false);
});
