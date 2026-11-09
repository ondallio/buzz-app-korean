// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useLanguageDocument } from "./document";
import { setLanguage } from "./language";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it("updates document pronunciation while keeping the same edited input and focus", () => {
  setLanguage("en");
  function Host() {
    useLanguageDocument();
    return <input aria-label="draft" defaultValue="사용자 메시지" />;
  }
  render(<Host />);
  const input = screen.getByRole("textbox", { name: "draft" });
  input.focus();
  expect(document.documentElement.lang).toBe("en");
  act(() => setLanguage("ko"));
  expect(document.documentElement.lang).toBe("ko");
  expect(screen.getByRole("textbox", { name: "draft" })).toBe(input);
  expect(input).toHaveValue("사용자 메시지");
  expect(input).toHaveFocus();
});
