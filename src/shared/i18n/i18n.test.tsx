// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  languagePreference,
  localeStorageKey,
  setLanguage,
  useLanguage,
  languageSaveProblem,
} from "./language";
import { formatMessage, validateCatalogs } from "./messages";
import { t } from "./index";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.dispatchEvent(new StorageEvent("storage", { key: localeStorageKey }));
});

it("follows the first OS language only until a supported saved choice exists", () => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("ko-KR");
  expect(languagePreference()).toBe("ko");
  setLanguage("en");
  expect(localStorage.getItem(localeStorageKey)).toBe("en");
  expect(languagePreference()).toBe("en");
  localStorage.setItem(localeStorageKey, "invalid");
  expect(languagePreference()).toBe("ko");
});

it("uses English for non-Korean OS languages and rejects unsupported stored values", () => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("ja-JP");
  expect(languagePreference()).toBe("en");
  expect(() => setLanguage("ja" as "en")).toThrow();
  expect(localStorage.getItem(localeStorageKey)).toBeNull();
});

it("updates mounted consumers without replacing inputs or losing their values", () => {
  setLanguage("en");
  function Consumer() {
    useLanguage();
    return (
      <label>
        {t("language.label")}
        <input defaultValue="사용자가 쓴 내용" />
      </label>
    );
  }
  render(<Consumer />);
  const input = screen.getByRole("textbox", { name: "Language" });
  input.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "언어" })).toBe(input);
  expect(input).toHaveValue("사용자가 쓴 내용");
  expect(input).toHaveFocus();
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Language" })).toBe(input);
});

it("retains a failed choice with explicit retry state rather than claiming it saved", () => {
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("denied");
    });
  setLanguage("ko");
  expect(languagePreference()).toBe("ko");
  expect(languageSaveProblem()).toBe(true);
  write.mockRestore();
  setLanguage("ko");
  expect(languageSaveProblem()).toBe(false);
  expect(localStorage.getItem(localeStorageKey)).toBe("ko");
});

it("uses a real cross-window storage event to notify mounted consumers", () => {
  setLanguage("en");
  function Consumer() {
    return <p>{useLanguage()}</p>;
  }
  render(<Consumer />);
  act(() => {
    localStorage.setItem(localeStorageKey, "ko");
    window.dispatchEvent(
      new StorageEvent("storage", { key: localeStorageKey }),
    );
  });
  expect(screen.getByText("ko")).toBeInTheDocument();
});

it("replaces whole-message parameters once and rejects missing or extra values", () => {
  expect(
    formatMessage(
      "{name}: {count} results",
      { name: "{count}", count: 1234 },
      "ko",
    ),
  ).toBe("{count}: 1,234 results");
  expect(() => formatMessage("{name}", {}, "en")).toThrow(/name/);
  expect(() => formatMessage("Done", { count: 1 }, "en")).toThrow(/count/);
});

it("reports untranslated entries separately from invalid substitutions and unknown keys", () => {
  expect(
    validateCatalogs(
      { one: "Hello {name}", two: "Done" },
      { one: "안녕하세요 {user}", extra: "추가" },
    ),
  ).toEqual({ missing: ["two"], unexpected: ["extra"], variables: ["one"] });
});
