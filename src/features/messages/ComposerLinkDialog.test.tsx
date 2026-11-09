// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { ComposerLinkDialog } from "./ComposerLinkDialog";
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});
it("retains link fields, focus and validation while changing language then saves the exact user URL and text", async () => {
  setLanguage("en");
  const user = userEvent.setup();
  const save = vi.fn(() => true);
  const close = vi.fn();
  render(
    <ComposerLinkDialog
      edit={{
        text: "user link",
        href: "bad-url",
        existing: false,
        save,
        remove: vi.fn(() => true),
      }}
      input={{ current: null }}
      disabled={false}
      close={close}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "Add link" });
  const url = screen.getByRole("textbox", { name: "URL" });
  const text = screen.getByRole("textbox", { name: "Text" });
  await user.click(screen.getByRole("button", { name: "Save" }));
  const error = screen.getByText("Use an HTTP(S) URL or a valid buzz:// link.");
  url.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("dialog", { name: "링크 추가" })).toBe(dialog);
  expect(screen.getByRole("textbox", { name: "URL" })).toBe(url);
  expect(screen.getByRole("textbox", { name: "텍스트" })).toBe(text);
  expect(
    screen.getByText("HTTP(S) URL 또는 올바른 buzz:// 링크를 사용해 주세요."),
  ).toBe(error);
  expect(url).toHaveFocus();
  expect(text).toHaveValue("user link");
  await user.clear(url);
  await user.type(url, "https://example.org/원문?x=a%2Bb#user");
  act(() => setLanguage("en"));
  expect(screen.getByRole("dialog", { name: "Add link" })).toBe(dialog);
  expect(url).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledExactlyOnceWith(
    "user link",
    "https://example.org/%EC%9B%90%EB%AC%B8?x=a%2Bb#user",
  );
  expect(close).toHaveBeenCalledTimes(1);
});
