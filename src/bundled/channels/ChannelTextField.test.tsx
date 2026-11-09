// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { ChannelTextField } from "./ChannelTextField";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

it("translates its label and character description without replacing or modifying the controlled draft/caret", () => {
  const raw = `User {name} 한글${"x".repeat(100)}`;
  function Host() {
    const [value, setValue] = useState(raw);
    return (
      <ChannelTextField
        field="name"
        creation
        value={value}
        onChange={setValue}
      />
    );
  }
  render(<Host />);
  const input = screen.getByRole("textbox", { name: "Name" });
  if (!(input instanceof HTMLInputElement))
    throw new Error("Expected name input");
  input.focus();
  input.setSelectionRange(2, 6);
  expect(input).toHaveAccessibleDescription("114 of 120 characters");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "이름" })).toBe(input);
  expect(input).toHaveAccessibleDescription("120자 중 114자");
  expect(input).toHaveValue(raw);
  expect(input).toHaveFocus();
  expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Name" })).toBe(input);
  expect(input).toHaveValue(raw);
});

it("translates description help while preserving an arbitrary English error and literal authored content", () => {
  render(
    <ChannelTextField
      field="description"
      value="Raw # Goal {name} 한글"
      error="API raw {error}"
      onChange={() => {}}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Description" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "설명" })).toBe(input);
  expect(input).toHaveAttribute("placeholder", "채널의 용도를 설명하세요");
  expect(input).toHaveValue("Raw # Goal {name} 한글");
  expect(screen.getByText("API raw {error}")).toBeInTheDocument();
});
