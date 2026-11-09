// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { LanguageSettings } from "./LanguageSettings";
import { DesktopLanguageProvider } from "../features/native-language/service";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: native.invoke,
  isTauri: () => true,
}));
import {
  languagePreference,
  setLanguage,
  localeStorageKey,
} from "../shared/i18n/language";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent(new StorageEvent("storage", { key: localeStorageKey }));
});

it("exposes a labelled real selector, switches both ways and reads the saved choice on remount", async () => {
  setLanguage("en");
  const user = userEvent.setup();
  const view = render(<LanguageSettings />);
  await user.click(screen.getByRole("combobox", { name: "Language" }));
  await user.click(await screen.findByRole("option", { name: "한국어" }));
  expect(languagePreference()).toBe("ko");
  expect(screen.getByRole("combobox", { name: "언어" })).toHaveTextContent(
    "한국어",
  );
  view.unmount();
  render(<LanguageSettings />);
  expect(screen.getByRole("combobox", { name: "언어" })).toHaveTextContent(
    "한국어",
  );
  await user.click(screen.getByRole("combobox", { name: "언어" }));
  await user.click(await screen.findByRole("option", { name: "English" }));
  expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent(
    "English",
  );
  expect(localStorage.getItem(localeStorageKey)).toBe("en");
});

it("shows the failed save beside this setting and retries the same active choice", () => {
  setLanguage("en");
  const view = render(<LanguageSettings />);
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("quota");
    });
  act(() => setLanguage("ko"));
  expect(
    screen.getByText("선택한 언어를 적용했지만 이 기기에 저장하지 못했습니다."),
  ).toBeInTheDocument();
  view.unmount();
  render(<LanguageSettings />);
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "언어 저장 다시 시도" }));
  expect(localStorage.getItem(localeStorageKey)).toBe("ko");
  expect(
    screen.queryByText(
      "선택한 언어를 적용했지만 이 기기에 저장하지 못했습니다.",
    ),
  ).not.toBeInTheDocument();
});

it("offers a localized retry for native menu failure without showing raw errors", async () => {
  setLanguage("ko");
  native.invoke
    .mockRejectedValueOnce(new Error("native internal diagnostic"))
    .mockResolvedValue({ language: "ko", missingKeys: [] });
  render(
    <DesktopLanguageProvider enabled>
      <LanguageSettings />
    </DesktopLanguageProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "앱 메뉴에 선택한 언어를 적용하지 못했습니다.",
  );
  expect(
    screen.queryByText("native internal diagnostic"),
  ).not.toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "앱 메뉴 언어 다시 적용" }));
  await screen.findByRole("combobox", { name: "언어" });
  await vi.waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(native.invoke.mock.calls).toEqual([
    ["set_desktop_language", { language: "ko" }],
    ["set_desktop_language", { language: "ko" }],
  ]);
});

it("reports native English fallback without counting it as a completed translation", async () => {
  setLanguage("ko");
  native.invoke.mockResolvedValue({ language: "ko", missingKeys: ["File"] });
  render(
    <DesktopLanguageProvider enabled>
      <LanguageSettings />
    </DesktopLanguageProvider>,
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "일부 앱 메뉴는 아직 영어로 표시됩니다.",
  );
  expect(
    screen.queryByRole("button", { name: "앱 메뉴 언어 다시 적용" }),
  ).not.toBeInTheDocument();
});
