// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { ComposerFormattingTools } from "./ComposerFormattingTools";
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});
it("updates formatting labels live while retaining focused active controls and canonical editor mark values", async () => {
  setLanguage("en");
  const toggleFormat = vi.fn();
  const editLink = vi.fn();
  render(
    <ComposerFormattingTools
      disabled={false}
      activeFormats={["bold"]}
      toggleFormat={toggleFormat}
      editLink={editLink}
    >
      {null}
    </ComposerFormattingTools>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Toggle formatting" }));
  const bold = await screen.findByRole("button", { name: "Bold" });
  bold.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "굵게" })).toBe(bold);
  expect(bold).toHaveFocus();
  expect(bold).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("group", { name: "서식 옵션" })).toContainElement(
    bold,
  );
  await user.keyboard("{Enter}");
  expect(toggleFormat.mock.calls).toEqual([["bold"]]);
  await user.click(screen.getByRole("button", { name: "링크" }));
  expect(editLink).toHaveBeenCalledTimes(1);
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Bold" })).toBe(bold);
});
