// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { stringify } from "yaml";
import { en, ko } from "../../shared/i18n/catalogs/workflow-form";
import { setLanguage } from "../../shared/i18n/language";
import { draftIssue } from "./editor-model";
import { fixtureYaml } from "./fixtures";
import { displayWorkflowDraftIssue } from "./workflowEditorDisplay";

const base = {
  name: "raw-name",
  enabled: false,
  trigger: { on: "message_posted" },
  steps: [{ id: "raw_step", action: "send_message", text: "raw text" }],
};
const changedSteps = (steps: unknown[]) => stringify({ ...base, steps });
const cases = [
  ["tooLarge", `${fixtureYaml}#${"x".repeat(24_000)}`],
  ["yaml", "name: ["],
  ["object", "[]"],
  ["name", stringify({ ...base, name: "" })],
  ["enabled", stringify({ ...base, enabled: "true" })],
  ["trigger", stringify({ ...base, trigger: {} })],
  ["noSteps", changedSteps([])],
  [
    "maxSteps",
    changedSteps(
      Array.from({ length: 101 }, (_, index) => ({
        id: `raw_${index}`,
        action: "delay",
        duration: "5m",
      })),
    ),
  ],
  ["ids", changedSteps([{ id: "bad-id", action: "delay", duration: "5m" }])],
  ["action", changedSteps([{ id: "raw_step" }])],
  ["timeout", changedSteps([{ ...base.steps[0], timeout_secs: 0 }])],
  ["text", changedSteps([{ ...base.steps[0], text: "" }])],
  ["url", changedSteps([{ id: "raw_step", action: "call_webhook", url: "" }])],
  [
    "headers",
    changedSteps([
      {
        id: "raw_step",
        action: "call_webhook",
        url: "https://example.org/{{raw}}",
        headers: { "": "raw" },
      },
    ]),
  ],
  [
    "duration",
    changedSteps([{ id: "raw_step", action: "delay", duration: "" }]),
  ],
] as const;

afterEach(() => setLanguage("en"));

it.each(cases)(
  "projects the real finite draftIssue %s without altering its canonical result",
  (name, yaml) => {
    const issue = draftIssue(yaml);
    if (!issue) throw new Error("Expected real draft validation issue");
    const key = `workflowForm.draft.${name}` as const;
    expect(issue.message).toBe(en[key]);
    const before = JSON.stringify(issue);
    expect(displayWorkflowDraftIssue(issue)).toBe(en[key]);
    setLanguage("ko");
    expect(displayWorkflowDraftIssue(issue)).toBe(ko[key]);
    expect(JSON.stringify(issue)).toBe(before);
    setLanguage("en");
    expect(displayWorkflowDraftIssue(issue)).toBe(en[key]);
  },
);

it("preserves unknown diagnostics, wrong-field lookalikes and empty results", () => {
  setLanguage("ko");
  const unknown = {
    field: "name" as const,
    message: "Raw provider diagnostic {name}",
  };
  expect(displayWorkflowDraftIssue(unknown)).toBe(unknown.message);
  const wrongField = {
    field: "url" as const,
    stepIndex: 0,
    message: en["workflowForm.draft.text"],
  };
  expect(displayWorkflowDraftIssue(wrongField)).toBe(wrongField.message);
  expect(displayWorkflowDraftIssue(null)).toBeNull();
  expect(displayWorkflowDraftIssue(undefined)).toBeUndefined();
});
