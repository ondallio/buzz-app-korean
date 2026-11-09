import { describe, expect, it } from "vitest";

import { workflowCardPresentation } from "./workflowCardPresentation";

describe("workflowCardPresentation", () => {
  it("describes supported triggers and actions", () => {
    expect(
      workflowCardPresentation(`
trigger:
  on: reaction_added
  emoji: "👍"
steps:
  - id: pause
    action: delay
  - id: reply
    action: send_message
`),
    ).toEqual({
      actionIcons: [
        { icon: "delay", key: "pause" },
        { icon: "message", key: "reply" },
      ],
      description: "When a reaction is added, wait and send a message.",
      triggerEmoji: "👍",
      triggerIcon: "reaction",
    });
  });

  it("keeps unsupported and malformed definitions legible", () => {
    expect(
      workflowCardPresentation(`
trigger:
  on: custom_event
steps:
  - id: custom
    action: custom_action
`),
    ).toMatchObject({
      actionIcons: [{ icon: "workflow", key: "custom" }],
      description: "When its trigger matches, run an action.",
      triggerIcon: "workflow",
    });
    expect(workflowCardPresentation("trigger: [")).toMatchObject({
      actionIcons: [],
      description: "Review this workflow configuration.",
      triggerIcon: "workflow",
    });
  });
});

it("projects only a whole semantic description while retaining icon, raw emoji and step identity", () => {
  const yaml =
    'trigger: {on: reaction_added, emoji: "custom:raw"}\nsteps: [{id: "raw-step", action: send_dm}, {action: delay}]';
  const canonical = workflowCardPresentation(yaml);
  const received: unknown[] = [];
  const projected = workflowCardPresentation(yaml, (input) => {
    received.push(input);
    return "전체 문장";
  });
  expect(projected).toEqual({ ...canonical, description: "전체 문장" });
  expect(received).toEqual([
    { trigger: "reaction", actions: ["message", "delay"], malformed: false },
  ]);
  expect(workflowCardPresentation("trigger: [", () => "잘못된 구성")).toEqual({
    ...workflowCardPresentation("trigger: ["),
    description: "잘못된 구성",
  });
});
