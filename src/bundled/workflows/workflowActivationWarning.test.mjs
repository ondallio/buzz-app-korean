import assert from "node:assert/strict";
import { test } from "vitest";

import { getWorkflowActivationWarning } from "./workflowActivationWarning.ts";

function workflowYaml(trigger) {
  return `name: Test\ntrigger:\n${trigger}\nsteps:\n  - id: notify\n    action: send_message\n    text: Hi\n`;
}

test("warns when a message trigger matches every message", () => {
  assert.deepEqual(
    getWorkflowActivationWarning(workflowYaml("  on: message_posted")),
    {
      description:
        "It will run for every new message in this channel. Review the trigger before turning it on.",
      title: "This workflow may run often",
    },
  );
});

test("does not warn when a message trigger is narrowed", () => {
  assert.equal(
    getWorkflowActivationWarning(
      workflowYaml('  on: message_posted\n  filter: text == "deploy"'),
    ),
    null,
  );
});

test("warns for hourly-or-faster interval schedules with concrete copy", () => {
  assert.deepEqual(
    getWorkflowActivationWarning(
      workflowYaml("  on: schedule\n  interval: 15m"),
    ),
    {
      description:
        "It is scheduled to run every 15 minutes. Review the schedule before turning it on.",
      title: "This workflow may run often",
    },
  );
  assert.equal(
    getWorkflowActivationWarning(workflowYaml("  on: schedule\n  interval: 1h"))
      ?.description,
    "It is scheduled to run every 1 hour. Review the schedule before turning it on.",
  );
  // The relay reads a bare number as seconds.
  assert.equal(
    getWorkflowActivationWarning(
      workflowYaml("  on: schedule\n  interval: '3600'"),
    )?.description,
    "It is scheduled to run every 1 hour. Review the schedule before turning it on.",
  );
  for (const interval of ["2h", "61m", "1d", "later", "0s"]) {
    assert.equal(
      getWorkflowActivationWarning(
        workflowYaml(`  on: schedule\n  interval: ${interval}`),
      ),
      null,
      interval,
    );
  }
});

test("warns for clear hourly-or-faster cron schedules", () => {
  for (const cron of ["*/5 * * * *", "0 */5 * * * *", "0 */5 * * * * *"]) {
    assert.equal(
      getWorkflowActivationWarning(
        workflowYaml(`  on: schedule\n  cron: "${cron}"`),
      )?.description,
      "It is scheduled to run every 5 minutes. Review the schedule before turning it on.",
    );
  }
  assert.equal(
    getWorkflowActivationWarning(
      workflowYaml('  on: schedule\n  cron: "*/1 * * * *"'),
    )?.description,
    "It is scheduled to run every 1 minute. Review the schedule before turning it on.",
  );
  assert.equal(
    getWorkflowActivationWarning(
      workflowYaml('  on: schedule\n  cron: "* * * * *"'),
    )?.description,
    "It is scheduled to run every minute. Review the schedule before turning it on.",
  );
  assert.equal(
    getWorkflowActivationWarning(
      workflowYaml('  on: schedule\n  cron: "*/10 * * * * *"'),
    )?.description,
    "It is scheduled to run multiple times a minute. Review the schedule before turning it on.",
  );
  assert.equal(
    getWorkflowActivationWarning(
      workflowYaml('  on: schedule\n  cron: "0,30 * * * *"'),
    )?.description,
    "It is scheduled to run multiple times an hour. Review the schedule before turning it on.",
  );
  assert.equal(
    getWorkflowActivationWarning(
      workflowYaml('  on: schedule\n  cron: "0 9 * * *"'),
    ),
    null,
  );
});

test("warns for stepped, ranged, and listed hourly cron schedules", () => {
  for (const cron of [
    "0 0 */1 * * *",
    "0 0 * * * *",
    "0 0 0-23 * * *",
    "0 0 0-11,12-23 * * *",
    "0 0 */1 * * * *",
  ]) {
    assert.equal(
      getWorkflowActivationWarning(
        workflowYaml(`  on: schedule\n  cron: "${cron}"`),
      )?.description,
      "It is scheduled to run every hour. Review the schedule before turning it on.",
      cron,
    );
  }
  assert.equal(
    getWorkflowActivationWarning(
      workflowYaml('  on: schedule\n  cron: "*/5 0-23 * * *"'),
    )?.description,
    "It is scheduled to run every 5 minutes. Review the schedule before turning it on.",
  );
  for (const cron of ["0 */3 * * *", "0 0 0,12 * * *", "0 0 8-17 * * *"]) {
    assert.equal(
      getWorkflowActivationWarning(
        workflowYaml(`  on: schedule\n  cron: "${cron}"`),
      ),
      null,
      cron,
    );
  }
});

test("stays quiet for schedules it cannot classify", () => {
  for (const cron of [
    "0 9 * * 1-5",
    "0 MON * * *",
    "0 * * *",
    "0 0 * * * * * *",
    "0 */0 * * *",
  ]) {
    assert.equal(
      getWorkflowActivationWarning(
        workflowYaml(`  on: schedule\n  cron: "${cron}"`),
      ),
      null,
      cron,
    );
  }
  assert.equal(
    getWorkflowActivationWarning(workflowYaml("  on: schedule")),
    null,
  );
  // Interval wins when both are present; the relay refuses the pair anyway.
  assert.equal(
    getWorkflowActivationWarning(
      workflowYaml('  on: schedule\n  interval: 2h\n  cron: "* * * * *"'),
    ),
    null,
  );
});

test("returns no warning for malformed or unrelated definitions", () => {
  assert.equal(getWorkflowActivationWarning("not: [valid"), null);
  assert.equal(getWorkflowActivationWarning("- list"), null);
  assert.equal(
    getWorkflowActivationWarning(workflowYaml("  on: reaction_added")),
    null,
  );
  // Matches the reference: only unfiltered message_posted triggers warn.
  assert.equal(
    getWorkflowActivationWarning(workflowYaml("  on: diff_posted")),
    null,
  );
});

test("projects semantic frequency only after the existing warning predicate accepts it", () => {
  const seen = [];
  const display = {
    title: "자주 실행",
    description: (value) => {
      seen.push(value);
      return "전체 경고 문장";
    },
  };
  assert.deepEqual(
    getWorkflowActivationWarning(
      'trigger: {on: schedule, interval: "1m 2s"}',
      display,
    ),
    { title: "자주 실행", description: "전체 경고 문장" },
  );
  assert.deepEqual(
    getWorkflowActivationWarning(
      'trigger: {on: schedule, cron: "*/5 * * * *"}',
      display,
    ),
    { title: "자주 실행", description: "전체 경고 문장" },
  );
  assert.deepEqual(seen, [
    { kind: "interval", seconds: 62 },
    { kind: "minutes", minutes: 5 },
  ]);
  assert.equal(
    getWorkflowActivationWarning(
      'trigger: {on: schedule, interval: "2h"}',
      display,
    ),
    null,
  );
  assert.equal(
    getWorkflowActivationWarning(
      'trigger: {on: message_posted, filter: "raw-filter"}',
      display,
    ),
    null,
  );
});
