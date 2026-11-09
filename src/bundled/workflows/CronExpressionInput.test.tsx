// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import { CronExpressionInput } from "./CronExpressionInput";

afterEach(() => {
  cleanup();
  setLanguage("en");
});

function Harness({
  initial,
  onChange,
  disabled,
}: {
  initial: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CronExpressionInput
        value={value}
        disabled={disabled ?? false}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <span data-testid="value">{value}</span>
      <button type="button" onClick={() => setValue("0 9 * * 1-5")}>
        Reset outside
      </button>
    </>
  );
}

const box = (name: string) => screen.getByRole("textbox", { name });

it("splits the expression into five labelled boxes and joins edits back", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness initial="*/15 * * * *" onChange={onChange} />);
  expect(box("Minute")).toHaveValue("*/15");
  for (const name of ["Hour", "Day", "Month", "Weekday"]) {
    expect(box(name)).toHaveValue("*");
  }
  expect(
    screen.getByText(/UTC · Paste all 5 fields/, { exact: false }),
  ).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();

  await user.clear(box("Hour"));
  await user.type(box("Hour"), "9");
  expect(onChange).toHaveBeenLastCalledWith("*/15 9 * * *");
  expect(screen.getByTestId("value")).toHaveTextContent("*/15 9 * * *");
});

it("hops between boxes with Space, Backspace and the arrow keys", async () => {
  const user = userEvent.setup();
  render(<Harness initial="0 9 * * 1-5" />);
  await user.click(box("Minute"));
  await user.keyboard(" ");
  expect(box("Hour")).toHaveFocus();
  // Space never lands in a box.
  expect(box("Minute")).toHaveValue("0");
  expect(box("Hour")).toHaveValue("9");

  // Hopping selects the box's text; the first ArrowRight collapses that
  // selection to the end and only the next one hops.
  await user.keyboard("{ArrowRight}");
  expect(box("Hour")).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(box("Day")).toHaveFocus();
  // A selected box already has its caret at the start, so ArrowLeft hops.
  await user.keyboard("{ArrowLeft}");
  expect(box("Hour")).toHaveFocus();

  await user.clear(box("Hour"));
  expect(screen.getByRole("alert")).toHaveTextContent("Hour is required.");
  await user.keyboard("{Backspace}");
  expect(box("Minute")).toHaveFocus();
  expect(box("Minute")).toHaveValue("0");
  // The emptied box stays empty instead of collapsing the expression.
  expect(box("Hour")).toHaveValue("");
  expect(screen.getByTestId("value")).toHaveTextContent("0  * * 1-5", {
    normalizeWhitespace: false,
  });

  await user.click(box("Weekday"));
  await user.keyboard(" ");
  expect(box("Weekday")).toHaveFocus();
});

it("fills all five boxes from a pasted expression and reports bad pastes", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness initial="0 9 * * *" onChange={onChange} />);
  await user.click(box("Day"));
  await user.paste("30 14 1,15 JAN,JUL MON-FRI");
  expect(box("Minute")).toHaveValue("30");
  expect(box("Hour")).toHaveValue("14");
  expect(box("Day")).toHaveValue("1,15");
  expect(box("Month")).toHaveValue("JAN,JUL");
  expect(box("Weekday")).toHaveValue("MON-FRI");
  expect(onChange).toHaveBeenLastCalledWith("30 14 1,15 JAN,JUL MON-FRI");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();

  await user.paste("0 9 * *");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Paste a 5-field cron expression. Found 4 fields.",
  );
  expect(box("Day")).toHaveValue("1,15");
  expect(onChange).toHaveBeenCalledTimes(1);

  // A single token pastes into the focused box like ordinary text.
  await user.clear(box("Day"));
  await user.paste("20");
  expect(box("Day")).toHaveValue("20");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("flags the first invalid box and follows outside value changes", async () => {
  const user = userEvent.setup();
  render(<Harness initial="0 9 * * *" />);
  await user.clear(box("Minute"));
  await user.type(box("Minute"), "60");
  expect(box("Minute")).toHaveAttribute("aria-invalid", "true");
  expect(box("Hour")).toHaveAttribute("aria-invalid", "false");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Minute must be between 0 and 59.",
  );
  await user.clear(box("Weekday"));
  await user.type(box("Weekday"), "8");
  // Only the first error is announced.
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Minute must be between 0 and 59.",
  );

  await user.click(screen.getByRole("button", { name: "Reset outside" }));
  expect(box("Minute")).toHaveValue("0");
  expect(box("Weekday")).toHaveValue("1-5");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("disables every box", () => {
  render(<Harness initial="0 9 * * *" disabled />);
  for (const name of ["Minute", "Hour", "Day", "Month", "Weekday"]) {
    expect(box(name)).toBeDisabled();
  }
});

it("keeps all cron boxes, aliases, ids and keyboard gestures when display language changes", async () => {
  const change = vi.fn();
  render(<Harness initial="30 14 1,15 JAN,JUL MON-FRI" onChange={change} />);
  const minute = box("Minute"),
    hour = box("Hour"),
    month = box("Month");
  const id = month.id;
  if (!(month instanceof HTMLInputElement))
    throw new Error("Expected real cron input");
  month.focus();
  month.setSelectionRange(1, 4);
  act(() => setLanguage("ko"));
  expect(box("월")).toBe(month);
  expect(month.id).toBe(id);
  expect(month).toHaveValue("JAN,JUL");
  expect(month).toHaveFocus();
  expect([month.selectionStart, month.selectionEnd]).toEqual([1, 4]);
  expect(box("분")).toBe(minute);
  expect(box("시")).toBe(hour);
  expect(change).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(minute);
  await user.keyboard(" ");
  expect(hour).toHaveFocus();
  act(() => setLanguage("en"));
  expect(box("Hour")).toBe(hour);
  expect(hour).toHaveFocus();
  expect(screen.getByTestId("value")).toHaveTextContent(
    "30 14 1,15 JAN,JUL MON-FRI",
  );
  expect(change).not.toHaveBeenCalled();
});

it("retains the mixed canonical cron diagnostic and authored atom as literal text", async () => {
  const change = vi.fn();
  render(<Harness initial="60 9 * * *" onChange={change} />);
  const minute = box("Minute"),
    alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent("Minute must be between 0 and 59.");
  minute.focus();
  act(() => setLanguage("ko"));
  expect(box("분")).toBe(minute);
  expect(minute).toHaveFocus();
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent("Minute must be between 0 and 59.");
  expect(change).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.clear(minute);
  await user.type(minute, "raw_atom");
  expect(change).toHaveBeenLastCalledWith("raw_atom 9 * * *");
  expect(alert).toHaveTextContent(
    "Minute contains “raw_atom”, which is not a supported value.",
  );
  act(() => setLanguage("en"));
  expect(box("Minute")).toBe(minute);
  expect(minute).toHaveValue("raw_atom");
  expect(minute).toHaveFocus();
  expect(alert).toHaveTextContent(
    "Minute contains “raw_atom”, which is not a supported value.",
  );
});
