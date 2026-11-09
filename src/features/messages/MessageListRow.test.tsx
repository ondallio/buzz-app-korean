// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import { MessageListRow } from "./MessageListRow";

afterEach(() => {
  cleanup();
  setLanguage("en");
});

it("localizes the unread mark while preserving the same row, authored text, focus and action", () => {
  setLanguage("en");
  const open = vi.fn();
  const props = {
    avatar: null,
    sender: "Unread {raw}",
    source: "#raw-channel",
    time: "10:30",
    preview: "사용자 메시지 Unread",
    "aria-label": "raw-row",
    onClick: open,
  };
  const view = render(<MessageListRow {...props} unread />);
  const row = screen.getByRole("button", { name: "raw-row" });
  const unread = screen.getByRole("img", { name: "Unread" });
  row.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("img", { name: "읽지 않음" })).toBe(unread);
  expect(screen.getByRole("button", { name: "raw-row" })).toBe(row);
  expect(row).toHaveFocus();
  expect(screen.getByText("Unread {raw}")).toBeVisible();
  expect(screen.getByText("사용자 메시지 Unread")).toBeVisible();
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(row);
  expect(open).toHaveBeenCalledTimes(1);
  act(() => setLanguage("en"));
  expect(screen.getByRole("img", { name: "Unread" })).toBe(unread);
  view.rerender(<MessageListRow {...props} unread={false} />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByRole("button", { name: "raw-row" })).toBe(row);
  expect(row).toHaveFocus();
});
