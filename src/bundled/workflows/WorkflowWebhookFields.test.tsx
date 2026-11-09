// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import type { StepFormState } from "./workflowFormTypes";
import { WorkflowWebhookFields } from "./WorkflowWebhookFields";

afterEach(() => {
  cleanup();
  setLanguage("en");
});
it("keeps raw webhook data, errors and focused inputs while translating only labels", async () => {
  const initial: StepFormState = {
    id: "raw_step",
    action: "call_webhook",
    method: "POST",
    url: "https://example.com/{{ trigger.raw }}",
    headers: [
      {
        id: "raw_header",
        name: "Header 1 name",
        value: "Bearer fixture-{raw}",
      },
    ],
    body: '{"raw":"Request body (optional)"}',
  };
  const changed = vi.fn();
  function Host() {
    const [step, setStep] = useState(initial);
    return (
      <WorkflowWebhookFields
        step={step}
        disabled={false}
        urlError="Webhook URL"
        headersError="Header names must be unique."
        update={(patch) => {
          changed(patch);
          setStep({ ...step, ...patch });
        }}
      />
    );
  }
  render(<Host />);
  const url = screen.getByRole("textbox", { name: "Webhook URL" });
  const name = screen.getByRole("textbox", { name: "Header 1 name" });
  const value = screen.getByRole("textbox", { name: "Header 1 value" });
  const body = screen.getByRole("textbox", { name: "Request body (optional)" });
  if (!(url instanceof HTMLInputElement))
    throw new Error("Expected real URL input");
  url.focus();
  url.setSelectionRange(3, 8);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "웹훅 URL" })).toBe(url);
  expect(screen.getByRole("textbox", { name: "헤더 1 이름" })).toBe(name);
  expect(screen.getByRole("textbox", { name: "헤더 1 값" })).toBe(value);
  expect(screen.getByRole("textbox", { name: "요청 본문 (선택)" })).toBe(body);
  expect(url).toHaveValue(initial.url);
  expect(url).toHaveFocus();
  expect(url.selectionStart).toBe(3);
  expect(url.selectionEnd).toBe(8);
  expect(name).toHaveValue("Header 1 name");
  expect(value).toHaveValue("Bearer fixture-{raw}");
  expect(body).toHaveValue(initial.body);
  expect(screen.getByText("Webhook URL")).toBeVisible();
  expect(screen.getByText("Header names must be unique.")).toBeVisible();
  expect(changed).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "HTTP 메서드" }));
  await user.click(
    await screen.findByRole("option", { name: "릴레이 기본값" }),
  );
  expect(changed).toHaveBeenCalledExactlyOnceWith({ method: "" });
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Webhook URL" })).toBe(url);
  expect(url.selectionStart).toBe(3);
  expect(url.selectionEnd).toBe(8);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Remove header 1" }));
  expect(changed).toHaveBeenNthCalledWith(2, { headers: [] });
  expect(changed).toHaveBeenCalledTimes(2);
});
