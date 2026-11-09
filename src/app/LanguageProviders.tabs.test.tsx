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
import { Tabs } from "../shared/design-system/ui/Tabs";
import { LanguageProviders } from "./LanguageProviders";
import { setLanguage } from "../shared/i18n";
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

it("keeps the actual tab, open menu and rename draft while its accessible phrases change", async () => {
  setLanguage("en");
  const rename = vi.fn();
  const close = vi.fn();
  render(
    <LanguageProviders>
      <Tabs
        label="Fixture tabs"
        value="raw-id"
        onValueChange={() => {}}
        items={[
          {
            value: "raw-id",
            label: "User {name}",
            onClose: close,
            onRename: rename,
          },
        ]}
        tabMenu={{
          key: "raw-menu",
          closeAll: () => true,
          closeOthers: () => true,
        }}
      />
    </LanguageProviders>,
  );
  const tab = screen.getByRole("tab", { name: "User {name}" });
  const button = screen.getByRole("button", { name: "Close User {name} tab" });
  fireEvent.contextMenu(tab);
  const menu = await screen.findByRole("menu", {
    name: "Actions for User {name} tab",
  });
  act(() => setLanguage("ko"));
  expect(document.querySelector('[data-tab-value="raw-id"]')).toBe(tab);
  expect(button).toHaveAttribute("aria-label", "User {name} 탭 닫기");
  expect(screen.getByRole("menu", { name: "User {name} 탭 작업" })).toBe(menu);
  expect(screen.getByRole("menuitem", { name: "다른 탭 닫기" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "모든 탭 닫기" })).toBeVisible();
  await userEvent
    .setup()
    .click(screen.getByRole("menuitem", { name: "탭 이름 바꾸기" }));
  const input = await screen.findByRole("textbox", { name: "탭 이름" });
  fireEvent.change(input, { target: { value: "사용자 {name} 원문" } });
  input.focus();
  if (!(input instanceof HTMLInputElement))
    throw new Error("Expected a tab name input");
  input.setSelectionRange(2, 5);
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Tab name" })).toBe(input);
  expect(input).toHaveFocus();
  expect(input).toHaveValue("사용자 {name} 원문");
  expect(input.selectionStart).toBe(2);
  expect(input.selectionEnd).toBe(5);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(rename).toHaveBeenCalledExactlyOnceWith("사용자 {name} 원문");
  expect(tab).toHaveFocus();
  fireEvent.click(button);
  expect(close).toHaveBeenCalledOnce();
});

it("keeps an explicit host close label and the canonical close marker", () => {
  setLanguage("en");
  render(
    <LanguageProviders>
      <Tabs
        value="external-id"
        label="External tabs"
        onValueChange={() => {}}
        items={[
          {
            value: "external-id",
            label: "External name",
            closeLabel: "Host close",
            onClose: () => {},
          },
        ]}
      />
    </LanguageProviders>,
  );
  const close = screen.getByRole("button", { name: "Host close" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "Host close" })).toBe(close);
  expect(close).toHaveAttribute("data-tab-close", "external-id");
});
