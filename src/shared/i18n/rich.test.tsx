// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { rich } from "./rich";
import {
  t,
  korean,
  missingTranslations,
  setLanguage,
  useLanguage,
} from "./index";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it("keeps inline code, a link and their original text within a whole translated sentence", () => {
  setLanguage("en");
  function Message() {
    useLanguage();
    return (
      <p>
        {rich("date.withTime", {
          day: <code>npub1&lt;user&gt;</code>,
          time: <a href="https://example.test/">사용자 링크</a>,
        })}
      </p>
    );
  }
  render(<Message />);
  const code = screen.getByText("npub1<user>");
  const link = screen.getByRole("link", { name: "사용자 링크" });
  expect(code.tagName).toBe("CODE");
  expect(code.parentElement).toHaveTextContent("npub1<user> at 사용자 링크");
  act(() => setLanguage("ko"));
  expect(screen.getByText("npub1<user>")).toBe(code);
  expect(screen.getByRole("link", { name: "사용자 링크" })).toBe(link);
  expect(code.parentElement).toHaveTextContent("npub1<user> 사용자 링크");
  expect(link).toHaveAttribute("href", "https://example.test/");
});

it("falls back through the actual production lookup and retains the missing key for follow-up", () => {
  setLanguage("ko");
  const previous = korean["date.withTime"];
  try {
    delete korean["date.withTime"];
    expect(t("date.withTime", { day: "원문", time: "09:00" })).toBe(
      "원문 at 09:00",
    );
    expect(missingTranslations()).toContain("date.withTime");
  } finally {
    if (previous !== undefined) korean["date.withTime"] = previous;
  }
});
