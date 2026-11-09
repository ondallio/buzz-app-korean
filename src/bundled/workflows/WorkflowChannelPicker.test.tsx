// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { ChannelSummary } from "../../features/relay/contracts";
import { setLanguage } from "../../shared/i18n/language";
import { WorkflowChannelPicker } from "./WorkflowChannelPicker";

afterEach(() => {
  cleanup();
  setLanguage("en");
});

it("picks the first matching channel with Enter, without an arrow key", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const channel = (id: string, name: string): ChannelSummary => ({ id, name });
  render(
    <WorkflowChannelPicker
      channels={[
        channel("1", "general"),
        channel("2", "design-reviews"),
        channel("3", "design"),
      ]}
      onSelect={onSelect}
    />,
  );
  const input = screen.getByRole("combobox", { name: "Choose a channel" });
  await user.type(input, "des");
  expect(
    await screen.findByRole("option", { name: "design-reviews" }),
  ).toHaveAttribute("data-highlighted");
  await user.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("2");
});

it("ranks an exact name before a longer one that contains it", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <WorkflowChannelPicker
      channels={[
        { id: "1", name: "dev-general" },
        { id: "2", name: "general" },
      ]}
      onSelect={onSelect}
    />,
  );
  const input = screen.getByRole("combobox", { name: "Choose a channel" });
  await user.type(input, "general");
  expect(
    (await screen.findAllByRole("option")).map((option) => option.textContent),
  ).toEqual(["general", "dev-general"]);
  await user.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("2");
});

it("does not pick a channel with Enter before anything is typed", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <WorkflowChannelPicker
      channels={[{ id: "1", name: "general" }]}
      onSelect={onSelect}
    />,
  );
  const input = screen.getByRole("combobox", { name: "Choose a channel" });
  await user.click(input);
  expect(screen.queryByRole("option", { name: "general" })).not.toHaveAttribute(
    "data-highlighted",
  );
  await user.keyboard("{Enter}");
  expect(onSelect).not.toHaveBeenCalled();
});

it("keeps the same channel input, query, caret and highlighted raw channel across EN KO EN", async () => {
  const select = vi.fn();
  const user = userEvent.setup();
  render(
    <WorkflowChannelPicker
      channels={[
        { id: "raw-first", name: "design-reviews" },
        { id: "raw-second", name: "design" },
      ]}
      onSelect={select}
    />,
  );
  const input = screen.getByRole("combobox", { name: "Choose a channel" });
  await user.type(input, "des");
  const popup = screen.getByRole("listbox");
  const option = await screen.findByRole("option", { name: "design-reviews" });
  expect(option).toHaveAttribute("data-highlighted");
  if (!(input instanceof HTMLInputElement))
    throw new Error("Expected real channel input");
  input.setSelectionRange(1, 2);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("combobox", { name: "채널 선택" })).toBe(input);
  expect(screen.getByRole("listbox")).toBe(popup);
  expect(screen.getByRole("option", { name: "design-reviews" })).toBe(option);
  expect(option).toHaveAttribute("data-highlighted");
  expect(input).toHaveValue("des");
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(1);
  expect(input.selectionEnd).toBe(2);
  expect(select).not.toHaveBeenCalled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("combobox", { name: "Choose a channel" })).toBe(
    input,
  );
  expect(input.selectionStart).toBe(1);
  expect(input.selectionEnd).toBe(2);
  await user.keyboard("{End}{Enter}");
  expect(select).toHaveBeenCalledExactlyOnceWith("raw-first");
});
