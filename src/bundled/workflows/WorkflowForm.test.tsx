// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import { WorkflowForm, type WorkflowSelection } from "./WorkflowForm";
import { draftIssue } from "./editor-model";
import {
  formStateToYaml,
  type WorkflowFormState,
  DEFAULT_FORM_STATE,
} from "./workflowFormTypes";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
afterEach(() => {
  cleanup();
  setLanguage("en");
});

it("edits through shared fields and connects trigger help", async () => {
  const user = userEvent.setup();
  function Example() {
    const [state, setState] = useState(DEFAULT_FORM_STATE);
    const [selection, onSelect] = useState<WorkflowSelection>({
      type: "trigger",
    });
    return (
      <WorkflowForm
        state={state}
        onChange={setState}
        disabled={false}
        selection={selection}
        onSelect={onSelect}
      />
    );
  }
  render(<Example />);
  await user.click(screen.getByRole("combobox", { name: "Trigger" }));
  await user.click(
    await screen.findByRole("option", { name: "Reaction added" }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "Emoji (optional)" }),
    "🎉",
  );
  await user.click(screen.getByRole("tab", { name: "Advanced" }));
  expect(
    screen.getByRole("textbox", { name: "Trigger condition (optional)" }),
  ).toHaveAccessibleDescription(
    "An evalexpr expression; leave empty to match every event of this type.",
  );
  await user.click(screen.getByRole("button", { name: "Add step" }));
  await user.click(
    await screen.findByRole("menuitem", { name: "Add Send Message" }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "Message text" }),
    "Hello team",
  );
  expect(screen.getByRole("textbox", { name: "Message text" })).toHaveValue(
    "Hello team",
  );
});

it("keeps the shared choice and text inputs disabled while the form is unavailable", async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  render(
    <WorkflowForm
      state={DEFAULT_FORM_STATE}
      onChange={change}
      disabled
      selection={{ type: "trigger" }}
      onSelect={() => {}}
    />,
  );

  const trigger = screen.getByRole("combobox", { name: "Trigger" });

  expect(trigger).toBeDisabled();

  await user.click(trigger);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
});

it.each(["schedule", "webhook"] as const)(
  "preserves %s when switching directly from a step inspector",
  async (trigger) => {
    const user = userEvent.setup();
    const initial: WorkflowFormState = {
      ...DEFAULT_FORM_STATE,
      trigger:
        trigger === "schedule"
          ? { on: "schedule", cron: "0 9 * * *" }
          : { on: "webhook" },
      steps: [{ id: "step_1", action: "send_message", text: "Hello" }],
    };
    function Example() {
      const [state, setState] = useState(initial);
      const [selection, onSelect] = useState<WorkflowSelection>({
        type: "step",
        id: "step_1",
      });
      return (
        <>
          <WorkflowForm
            state={state}
            onChange={setState}
            disabled={false}
            selection={selection}
            onSelect={onSelect}
          />
          <output>{JSON.stringify(state)}</output>
        </>
      );
    }
    render(<Example />);
    await user.click(
      screen.getByRole("button", {
        name: `Edit trigger: ${trigger === "schedule" ? "Schedule" : "Webhook"}`,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      JSON.stringify(initial),
    );
    await user.click(
      screen.getByRole("button", { name: "Edit step 1: Send Message" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      JSON.stringify(initial),
    );
  },
);

it("keeps Run controls open and timeout focused after correcting an invalid value", async () => {
  const user = userEvent.setup();
  function Example() {
    const [state, setState] = useState<WorkflowFormState>({
      ...DEFAULT_FORM_STATE,
      name: "Timeout regression",
      steps: [
        {
          id: "step_1",
          action: "send_message",
          text: "Hello",
          timeoutSecs: "bad",
        },
      ],
    });
    const [selection, onSelect] = useState<WorkflowSelection>({
      type: "step",
      id: "step_1",
    });
    return (
      <WorkflowForm
        state={state}
        onChange={setState}
        disabled={false}
        issue={draftIssue(formStateToYaml(state))}
        selection={selection}
        onSelect={onSelect}
      />
    );
  }
  render(<Example />);
  const timeout = screen.getByRole("textbox", {
    name: "Step timeout (optional)",
  });
  await user.clear(timeout);
  await user.type(timeout, "30s");
  expect(timeout).toBeVisible();
  expect(timeout).toHaveFocus();
  expect(timeout).toHaveValue("30s");
  expect(screen.getByRole("button", { name: /Run controls/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

it("returns focus to the selected node after closing the inline inspector", async () => {
  const user = userEvent.setup();
  function Example() {
    const [selection, onSelect] = useState<WorkflowSelection>(null);
    return (
      <WorkflowForm
        state={DEFAULT_FORM_STATE}
        onChange={() => {}}
        disabled={false}
        selection={selection}
        onSelect={onSelect}
      />
    );
  }
  render(<Example />);
  const trigger = screen.getByRole("button", {
    name: "Edit trigger: Message posted",
  });
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Close inspector" }));
  expect(trigger).toHaveFocus();
});

it("keeps raw step data and closed run controls stable while its own issue labels switch locale", async () => {
  const raw = "Each Send Message step needs message text.";
  const initial: WorkflowFormState = {
    ...DEFAULT_FORM_STATE,
    name: "raw-name",
    steps: [
      {
        id: "raw_step",
        action: "send_message",
        text: raw,
        timeoutSecs: "bad",
        condition: "true",
        replyInThread: true,
      },
    ],
  };
  const changed = vi.fn();
  function Host() {
    const [state, setState] = useState(initial);
    const [selection, onSelect] = useState<WorkflowSelection>({
      type: "step",
      id: "raw_step",
    });
    return (
      <WorkflowForm
        state={state}
        onChange={(next) => {
          changed(next);
          setState(next);
        }}
        disabled={false}
        issue={draftIssue(formStateToYaml(state))}
        selection={selection}
        onSelect={onSelect}
      />
    );
  }
  render(<Host />);
  const text = screen.getByRole("textbox", { name: "Message text" });
  const timeout = screen.getByRole("textbox", {
    name: "Step timeout (optional)",
  });
  const disclosure = screen.getByRole("button", { name: /Run controls/ });
  const user = userEvent.setup();
  await user.click(disclosure);
  expect(disclosure).toHaveAttribute("aria-expanded", "false");
  if (!(text instanceof HTMLTextAreaElement))
    throw new Error("Expected real text input");
  text.focus();
  text.setSelectionRange(3, 8);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "메시지 텍스트" })).toBe(text);
  expect(text).toHaveValue(raw);
  expect(text).toHaveFocus();
  expect([text.selectionStart, text.selectionEnd]).toEqual([3, 8]);
  expect(screen.getByRole("button", { name: /실행 제어/ })).toBe(disclosure);
  expect(disclosure).toHaveAttribute("aria-expanded", "false");
  expect(changed).not.toHaveBeenCalled();
  await user.click(disclosure);
  expect(screen.getByRole("textbox", { name: "단계 제한 시간 (선택)" })).toBe(
    timeout,
  );
  expect(timeout).toHaveValue("bad");
  expect(timeout).toHaveAccessibleDescription(
    "단계 제한 시간은 양의 정수 초여야 합니다(예: 폼 모드에서 30s). 비워 둘 수도 있습니다.",
  );
  await user.clear(timeout);
  await user.type(timeout, "30s");
  expect(timeout).toHaveFocus();
  expect(disclosure).toHaveAttribute("aria-expanded", "true");
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Step timeout (optional)" })).toBe(
    timeout,
  );
  expect(timeout).toHaveValue("30s");
  expect(timeout).toHaveFocus();
  expect(changed.mock.calls.at(-1)?.[0]).toEqual({
    ...initial,
    steps: [{ ...initial.steps[0], timeoutSecs: "30s" }],
  });
});

it.each([
  [false, false, "", "Default", "기본값"],
  [true, false, "", "Conditional", "조건부"],
  [false, true, "", "Thread reply", "스레드 답글"],
  [true, true, "", "Conditional · Thread reply", "조건부 · 스레드 답글"],
  [false, false, "30s", "30s", "30s"],
  [true, false, "30s", "Conditional · 30s", "조건부 · 30s"],
  [false, true, "30s", "Thread reply · 30s", "스레드 답글 · 30s"],
  [
    true,
    true,
    "30s",
    "Conditional · Thread reply · 30s",
    "조건부 · 스레드 답글 · 30s",
  ],
] as const)(
  "keeps the complete run-control summary live (%s/%s/%s)",
  (conditional, thread, timeout, english, korean) => {
    const changed = vi.fn();
    const state: WorkflowFormState = {
      ...DEFAULT_FORM_STATE,
      steps: [
        {
          id: "raw_step",
          action: "send_message",
          text: "Default",
          condition: conditional ? "raw_condition" : "",
          replyInThread: thread,
          timeoutSecs: timeout,
        },
      ],
    };
    render(
      <WorkflowForm
        state={state}
        disabled={false}
        onChange={changed}
        selection={{ type: "step", id: "raw_step" }}
        onSelect={vi.fn()}
      />,
    );
    const disclosure = screen.getByRole("button", { name: /Run controls/ });
    const summary = within(disclosure).getByText(english, { exact: true });
    disclosure.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button", { name: /실행 제어/ })).toBe(disclosure);
    expect(within(disclosure).getByText(korean, { exact: true })).toBe(summary);
    expect(disclosure).toHaveFocus();
    expect(changed).not.toHaveBeenCalled();
    act(() => setLanguage("en"));
    expect(within(disclosure).getByText(english, { exact: true })).toBe(
      summary,
    );
    expect(disclosure).toHaveFocus();
  },
);
