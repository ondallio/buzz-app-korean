// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
  localError,
  errorMessage,
} from "./deferred-message";
import { setLanguage, useLanguage } from "./language";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it("retranslates a retained local error without changing raw diagnostics or retry state", () => {
  setLanguage("en");
  function Editor() {
    useLanguage();
    const [error, setError] = useState<DisplayMessage>();
    return (
      <>
        <input aria-label="draft" defaultValue="사용자 원문" />
        <button
          type="button"
          onClick={() => setError(localMessage("language.unsaved"))}
        >
          fail
        </button>
        <p role="alert">{resolveMessage(error)}</p>
      </>
    );
  }
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "fail" }));
  const alert = screen.getByRole("alert");
  const input = screen.getByRole("textbox");
  input.focus();
  expect(alert).toHaveTextContent("This language is active");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent("선택한 언어를 적용했지만");
  expect(input).toHaveFocus();
  expect(input).toHaveValue("사용자 원문");
  expect(resolveMessage("This language is active")).toBe(
    "This language is active",
  );
  expect(resolveMessage(undefined)).toBeUndefined();
  expect(resolveMessage(null)).toBeNull();
});

it("captures exact immutable parameters and renders literal user values only once", () => {
  setLanguage("en");
  const values = { day: "{time}", time: "사용자" };
  const message = localMessage("date.withTime", values);
  values.time = "changed";
  expect(resolveMessage(message)).toBe("{time} at 사용자");
  setLanguage("ko");
  expect(resolveMessage(message)).toBe("{time} 사용자");
  expect(Object.isFrozen(message)).toBe(true);
});

it("keeps thrown diagnostics in English and only retranslates errors created by this owner", () => {
  setLanguage("ko");
  const failure = localError("date.withTime", { day: "{time}", time: 1234 });
  expect(failure).toBeInstanceOf(Error);
  expect(JSON.stringify(failure)).toBe("{}");
  expect(Object.keys(failure)).toEqual([]);
  expect(failure.message).toBe("{time} at 1234");
  const display = errorMessage(failure);
  expect(resolveMessage(display)).toBe("{time} 1,234");
  setLanguage("en");
  expect(resolveMessage(display)).toBe("{time} at 1,234");
  expect(errorMessage(new Error(failure.message))).toBe(failure.message);
  expect(errorMessage("원문 진단")).toBe("원문 진단");
  expect(errorMessage({ message: "date.withTime" })).toBe("[object Object]");
});
