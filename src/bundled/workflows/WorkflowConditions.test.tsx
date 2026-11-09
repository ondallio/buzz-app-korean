// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import type { TriggerConfig } from "./workflowFormTypes";
import { conditionRowError } from "./workflowConditionExpression";
import { WorkflowConditions } from "./WorkflowConditions";

afterEach(() => {
  cleanup();
  setLanguage("en");
});
function mount(initial: TriggerConfig) {
  const change = vi.fn();
  function Host() {
    const [trigger, setTrigger] = useState(initial);
    return (
      <WorkflowConditions
        trigger={trigger}
        disabled={false}
        onChange={(patch) => {
          change(patch);
          setTrigger({ ...trigger, ...patch });
        }}
      />
    );
  }
  render(<Host />);
  return change;
}
it("keeps an advanced expression, caret and replacement dialog through EN KO EN until explicit replacement", async () => {
  const expression = 'custom_function("Raw 조건")';
  const change = mount({ on: "message_posted", filter: expression });
  const user = userEvent.setup();
  const input = screen.getByRole("textbox", {
    name: "Trigger condition (optional)",
  });
  if (!(input instanceof HTMLTextAreaElement))
    throw new Error("Expected real expression editor");
  input.focus();
  input.setSelectionRange(2, 8);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "트리거 조건 (선택)" })).toBe(
    input,
  );
  expect(input).toHaveValue(expression);
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(2);
  expect(input.selectionEnd).toBe(8);
  await user.click(screen.getByRole("tab", { name: "기본" }));
  const dialog = screen.getByRole("alertdialog", {
    name: "기본 조건으로 바꿀까요?",
  });
  const cancel = screen.getByRole("button", { name: "계속 편집" });
  cancel.focus();
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("alertdialog", { name: "Replace with basic filters?" }),
  ).toBe(dialog);
  expect(screen.getByRole("button", { name: "Keep editing" })).toBe(cancel);
  expect(cancel).toHaveFocus();
  expect(change).not.toHaveBeenCalled();
  await user.click(cancel);
  expect(
    screen.getByRole("textbox", { name: "Trigger condition (optional)" }),
  ).toBe(input);
  expect(input).toHaveValue(expression);
  await user.click(screen.getByRole("tab", { name: "Basic" }));
  await user.click(
    screen.getByRole("button", { name: "Replace with basic filters" }),
  );
  expect(change).toHaveBeenCalledExactlyOnceWith({
    filter: "",
    conditionRows: [],
  });
});
it.each([
  [
    "message_posted",
    "trigger_text",
    "",
    "Enter a value or remove this condition.",
    "값을 입력하거나 이 조건을 삭제해 주세요.",
  ],
  [
    "message_posted",
    "trigger_author",
    "not-hex",
    "Enter a 64-character hex pubkey.",
    "64자리 16진수 공개 키를 입력해 주세요.",
  ],
  [
    "reaction_added",
    "trigger_message_id",
    "not-event",
    "Enter a 64-character hex event ID.",
    "64자리 16진수 이벤트 ID를 입력해 주세요.",
  ],
] as const)(
  "translates only the finite validator result for %s/%s",
  (on, field, value, english, korean) => {
    const row = { field, operator: "equals" as const, value, webhookField: "" };
    const change = mount({ on, conditionRows: [row] });
    const input = screen.getByRole("textbox", { name: "Value" });
    input.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("textbox", { name: "값" })).toBe(input);
    expect(input).toHaveValue(value);
    expect(input).toHaveFocus();
    expect(screen.getByText(korean)).toBeVisible();
    expect(conditionRowError(row)).toBe(english);
    expect(change).not.toHaveBeenCalled();
    act(() => setLanguage("en"));
    expect(screen.getByText(english)).toBeVisible();
  },
);
it("keeps authored values identical to validator copy as raw content", async () => {
  const value = "Enter a value or remove this condition.";
  const change = mount({
    on: "message_posted",
    conditionRows: [
      { field: "trigger_text", operator: "contains", value, webhookField: "" },
    ],
  });
  const input = screen.getByRole("textbox", { name: "Value" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "값" })).toBe(input);
  expect(input).toHaveValue(value);
  expect(
    screen.queryByText("값을 입력하거나 이 조건을 삭제해 주세요."),
  ).toBeNull();
  expect(change).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("combobox", { name: "메시지 텍스트 비교" }),
  );
  await user.click(await screen.findByRole("option", { name: "같음" }));
  expect(change).toHaveBeenCalledExactlyOnceWith({
    filter: 'trigger_text == "Enter a value or remove this condition."',
    conditionRows: [
      { field: "trigger_text", operator: "equals", value, webhookField: "" },
    ],
  });
});
