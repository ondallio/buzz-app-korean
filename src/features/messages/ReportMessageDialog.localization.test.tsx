// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { ReportMessageDialog } from "./ReportMessageDialog";
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});
it("retains the same report note/caret/category and pending/retry payload through EN→KO→EN", async () => {
  setLanguage("en");
  let reject!: (error: Error) => void;
  const report = vi.fn<Parameters<typeof ReportMessageDialog>[0]["report"]>(
    () =>
      new Promise<void>((_, no) => {
        reject = no;
      }),
  );
  const close = vi.fn();
  render(<ReportMessageDialog report={report} close={close} />);
  const dialog = screen.getByRole("dialog", { name: "Report message" });
  const spam = screen.getByRole("radio", { name: "Spam" });
  await userEvent.setup().click(spam);
  const note = screen.getByRole("textbox", {
    name: "Additional context (optional)",
  });
  if (!(note instanceof HTMLTextAreaElement))
    throw new Error("Expected actual note textarea");
  fireEvent.change(note, { target: { value: "사용자 {name} 원문" } });
  note.focus();
  note.setSelectionRange(2, 5);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("dialog", { name: "메시지 신고" })).toBe(dialog);
  expect(screen.getByRole("radio", { name: "스팸" })).toBe(spam);
  expect(spam).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("textbox", { name: "추가 설명 (선택사항)" })).toBe(
    note,
  );
  expect(note).toHaveFocus();
  expect(note).toHaveValue("사용자 {name} 원문");
  expect(note.selectionStart).toBe(2);
  expect(note.selectionEnd).toBe(5);
  const submit = screen.getByRole("button", { name: "신고 제출" });
  fireEvent.click(submit);
  expect(report).toHaveBeenCalledExactlyOnceWith("spam", "사용자 {name} 원문");
  fireEvent.click(submit);
  expect(report).toHaveBeenCalledOnce();
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Submit report" })).toBe(submit);
  expect(submit).toHaveAttribute("aria-busy", "true");
  await act(async () => reject(new Error("raw provider diagnostic")));
  const error = await screen.findByRole("alert");
  expect(error).toHaveTextContent("Failed to submit report. Try again.");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert")).toBe(error);
  expect(error).toHaveTextContent(
    "신고를 제출하지 못했습니다. 다시 시도하세요.",
  );
  expect(note).toHaveValue("사용자 {name} 원문");
  report.mockResolvedValueOnce();
  fireEvent.click(submit);
  await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith(true));
  expect(report.mock.calls).toEqual([
    ["spam", "사용자 {name} 원문"],
    ["spam", "사용자 {name} 원문"],
  ]);
});
