// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import { WorkflowEditor } from "./WorkflowEditor";
import { fixtureYaml } from "./fixtures";
import { parse } from "yaml";

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
function Example({
  initial = fixtureYaml,
  onSave = () => {},
}: {
  initial?: string;
  onSave?: (yaml: string) => void;
}) {
  const [yaml, setYaml] = useState(initial);
  return (
    <WorkflowEditor
      yaml={yaml}
      initialYaml={initial}
      onChange={setYaml}
      onSave={() => onSave(yaml)}
    />
  );
}

test("names the create switch for configuration enablement", async () => {
  const change = vi.fn();
  render(
    <WorkflowEditor
      create
      yaml={fixtureYaml}
      onChange={change}
      onSave={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Close inspector" }));
  const toggle = screen.getByRole("switch", {
    name: "Enabled in configuration",
  });
  expect(toggle).not.toBeChecked();
  await user.click(toggle);
  expect(change).toHaveBeenCalledTimes(1);
  expect(parse(change.mock.calls[0]?.[0]).enabled).not.toBe(false);
});

test("titles the dialog with the name and applies header changes only on save", async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  render(<Example onSave={save} />);
  expect(screen.getByRole("dialog", { name: "Message helper" })).toBeVisible();
  const toggle = screen.getByRole("switch", {
    name: "Enabled in configuration",
  });
  expect(toggle).not.toBeChecked();
  await user.click(toggle);
  expect(toggle).toBeChecked();
  await user.click(toggle);
  expect(toggle).not.toBeChecked();
  const name = screen.getByRole("textbox", { name: "Workflow name" });
  await user.clear(name);
  await user.type(name, "Renamed draft");
  expect(screen.getByRole("dialog", { name: "Renamed draft" })).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(save).toHaveBeenCalledTimes(1);
  expect(parse(save.mock.calls[0]?.[0])).toMatchObject({
    name: "Renamed draft",
    enabled: false,
  });
});

test.each([false, true])(
  "keeps configuration controls and details in YAML (YAML-only: %s)",
  async (yamlOnly) => {
    const initial = yamlOnly
      ? fixtureYaml.replace("action: send_message", "action: future_action")
      : fixtureYaml;
    function Editor() {
      const [yaml, setYaml] = useState(initial);
      return (
        <WorkflowEditor
          yaml={yaml}
          initialYaml={initial}
          onChange={setYaml}
          onSave={vi.fn()}
          details={
            <details>
              <summary>Configuration details</summary>Owner and revision
            </details>
          }
        />
      );
    }
    render(<Editor />);
    const user = userEvent.setup();
    if (!yamlOnly) await user.click(screen.getByRole("tab", { name: "YAML" }));
    expect(screen.getByRole("textbox", { name: "Workflow YAML" })).toHaveValue(
      initial,
    );
    expect(screen.getByText("Configuration details")).toBeVisible();
    const toggle = screen.getByRole("switch", {
      name: "Enabled in configuration",
    });
    expect(toggle).toHaveAccessibleDescription(
      "Configuration changes apply on save. Turning off does not confirm runs have stopped or cancel active runs.",
    );
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(
      parse(
        (
          screen.getByRole("textbox", {
            name: "Workflow YAML",
          }) as HTMLTextAreaElement
        ).value,
      ).enabled,
    ).not.toBe(false);
  },
);

test.each([
  [{ readOnly: true }, "Only the author can change this workflow."],
  [{ busy: true }, "Review Recent activity before editing."],
  [{ locked: true }, "Review Recent activity before editing."],
  [{ chooseChannel: true }, "Choose a channel before editing."],
])("explains unavailable header controls (%j)", async (props, reason) => {
  const change = vi.fn();
  const { rerender } = render(
    <WorkflowEditor
      yaml={fixtureYaml}
      onChange={change}
      onSave={vi.fn()}
      {...props}
    />,
  );
  if ("chooseChannel" in props) {
    // Choosing a channel precedes configuration; the workflow fields wait.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  } else {
    const name = screen.getByRole("textbox", { name: "Workflow name" });
    expect(name).toBeDisabled();
    expect(name).toHaveAccessibleDescription(reason);
    const toggle = screen.getByRole("switch", {
      name: "Enabled in configuration",
    });
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).toHaveAccessibleDescription(reason);
  }
  expect(screen.queryByText("Read-only")).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
  rerender(
    <WorkflowEditor yaml={fixtureYaml} onChange={change} onSave={vi.fn()} />,
  );
  expect(
    screen.getByRole("switch", { name: "Enabled in configuration" }),
  ).not.toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("textbox", { name: "Workflow name" })).toBeEnabled();
  expect(screen.queryByText(reason)).not.toBeInTheDocument();
});

test("form errors follow the editable field and clear when corrected", async () => {
  const user = userEvent.setup();
  render(<Example />);
  // The dialog's deferred initial focus must finish before typing into a field.
  await waitFor(() =>
    expect(
      screen.getByText("Message helper", { selector: "span" }),
    ).toHaveFocus(),
  );
  const name = screen.getByRole("textbox", { name: "Workflow name" });
  const save = screen.getByRole("button", { name: "Save changes" });
  await user.clear(name);
  expect(name).toHaveAccessibleDescription("Give this workflow a name.");
  expect(save).toBeDisabled();
  await user.type(name, "Repaired");
  expect(name).toHaveValue("Repaired");
  expect(name).not.toHaveAttribute("aria-invalid", "true");
  await user.click(
    screen.getByRole("button", { name: "Edit step 1: Send Message" }),
  );
  const text = screen.getByRole("textbox", { name: "Message text" });
  await user.clear(text);
  expect(text).toHaveAccessibleDescription(
    "Each Send Message step needs message text.",
  );
  await user.type(text, "Ready");
  await user.click(screen.getByRole("button", { name: "Add after Step 1" }));
  await user.click(await screen.findByRole("menuitem", { name: "Add Delay" }));
  const duration = screen.getByRole("textbox", { name: "Delay duration" });
  await user.clear(duration);
  expect(duration).toHaveAttribute("aria-invalid", "true");
  expect(duration).toHaveAccessibleDescription(
    "Each Delay step needs a duration.",
  );
  expect(text).not.toHaveAttribute("aria-invalid", "true");
  await user.type(duration, "5m");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(save).toBeEnabled();
});

test("errors stay visible beside hidden fields and Runs clears view-switch errors", async () => {
  const user = userEvent.setup();
  function WithRuns() {
    const [yaml, setYaml] = useState(fixtureYaml);
    return (
      <WorkflowEditor
        yaml={yaml}
        onChange={setYaml}
        onSave={vi.fn()}
        runs={<p>Run history</p>}
      />
    );
  }
  render(<WithRuns />);
  await user.clear(screen.getByRole("textbox", { name: "Workflow name" }));
  await user.click(
    screen.getByRole("button", { name: "Edit step 1: Send Message" }),
  );
  expect(screen.getByText("Give this workflow a name.")).toBeVisible();
  await user.click(screen.getByRole("tab", { name: "Runs" }));
  expect(screen.getByText("Run history")).toBeVisible();
  expect(screen.getByText("Give this workflow a name.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await user.click(screen.getByRole("tab", { name: "YAML" }));
  const yaml = screen.getByRole("textbox", { name: "Workflow YAML" });
  await user.clear(yaml);
  await user.click(yaml);
  await user.paste("name: [");
  await user.click(screen.getByRole("tab", { name: "Form" }));
  expect(screen.getByText(/^Cannot switch editor view/)).toBeVisible();
  await user.click(screen.getByRole("tab", { name: "Runs" }));
  expect(screen.getByText("Run history")).toBeVisible();
  expect(
    screen.queryByText(/^Cannot switch editor view/),
  ).not.toBeInTheDocument();
});

test("YAML errors replace help, retain the draft and restore help after recovery", async () => {
  const user = userEvent.setup();
  render(<Example initial="name: [" />);
  // The dialog's deferred initial focus must finish before typing into a field.
  await waitFor(() =>
    expect(
      screen.getByText("Untitled workflow", { selector: "span" }),
    ).toHaveFocus(),
  );
  // Unreadable YAML has no enabled state to show or change.
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  expect(
    screen.getByRole("dialog", { name: "Untitled workflow" }),
  ).toBeVisible();
  const yaml = screen.getByRole("textbox", { name: "Workflow YAML" });
  expect(yaml).toHaveAttribute("aria-invalid", "true");
  expect(yaml).toHaveAccessibleDescription(
    "The YAML cannot be parsed. Correct it before saving.",
  );
  expect(yaml).toHaveValue("name: [");
  expect(screen.queryByText(/Original text is kept/)).not.toBeInTheDocument();
  await user.clear(yaml);
  await user.click(yaml);
  await user.paste(fixtureYaml);
  expect(yaml).not.toHaveAttribute("aria-invalid", "true");
  expect(yaml).toHaveAccessibleDescription(/Original text is kept/);
  expect(screen.getByRole("dialog", { name: "Message helper" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
});

test("a readable definition without enabled retains its default on state", () => {
  render(<Example initial={fixtureYaml.replace("enabled: false\n", "")} />);
  expect(
    screen.getByRole("switch", { name: "Enabled in configuration" }),
  ).toBeChecked();
});

test("valid advanced YAML stays valid when Form mode cannot represent it", async () => {
  const user = userEvent.setup();
  render(<Example initial={`${fixtureYaml}future: preserve-me\n`} />);
  const yaml = screen.getByRole("textbox", { name: "Workflow YAML" });
  await user.click(screen.getByRole("tab", { name: "Form" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(yaml).not.toHaveAttribute("aria-invalid", "true");
  expect(yaml).toHaveAccessibleDescription(/Original text is kept/);
  expect(
    screen.getByRole("switch", { name: "Enabled in configuration" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
});

test("timeout correction keeps Step options open and the input focused", async () => {
  const user = userEvent.setup();
  render(<Example />);
  await user.click(
    screen.getByRole("button", { name: "Edit step 1: Send Message" }),
  );
  await user.click(screen.getByRole("button", { name: /Run controls/ }));
  const timeout = screen.getByRole("textbox", {
    name: "Step timeout (optional)",
  });
  const options = screen.getByRole("button", { name: /Run controls/ });
  const save = screen.getByRole("button", { name: "Save changes" });
  await user.type(timeout, "0s");
  expect(timeout).toHaveAttribute("aria-invalid", "true");
  expect(save).toBeDisabled();
  await user.clear(timeout);
  expect(options).toHaveAttribute("aria-expanded", "true");
  expect(timeout).toBeVisible();
  expect(timeout).toHaveFocus();
  expect(save).toBeEnabled();
  for (const character of "30s") {
    await user.keyboard(character);
    expect(options).toHaveAttribute("aria-expanded", "true");
    expect(timeout).toBeVisible();
    expect(timeout).toHaveFocus();
  }
  expect(timeout).toHaveValue("30s");
  expect(save).toBeEnabled();
  await user.click(options);
  expect(options).toHaveAttribute("aria-expanded", "false");
});

test.each([
  fixtureYaml.replace(
    "on: message_posted",
    'on: message_posted\n  filter: \'trigger_text == "a" || trigger_text == "b"\'',
  ),
  `# preserve this comment\nname: Request\nenabled: false\ntrigger:\n  on: webhook\nsteps:\n  - id: request\n    action: call_webhook\n    url: https://example.com/hook\n    future: keep\n`,
])(
  "opening and saving unfamiliar definitions leaves source byte-identical",
  async (yaml) => {
    const user = userEvent.setup();
    const change = vi.fn();
    const save = vi.fn();
    render(
      <WorkflowEditor
        yaml={yaml}
        initialYaml={yaml}
        onChange={change}
        onSave={save}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(change).not.toHaveBeenCalled();
  },
);

test("invalid Basic identity cannot silently turn into an unfiltered saved workflow", async () => {
  const user = userEvent.setup();
  render(<Example />);
  await user.click(
    screen.getByRole("button", { name: "Edit trigger: Message posted" }),
  );
  await user.click(screen.getByRole("combobox", { name: "Add condition" }));
  await user.click(await screen.findByRole("option", { name: "Author" }));
  await user.type(
    screen.getByRole("textbox", { name: "Value" }),
    "not-a-pubkey",
  );
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await user.click(screen.getByRole("tab", { name: "YAML" }));
  expect(
    screen.queryByRole("textbox", { name: "Workflow YAML" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close inspector" }));
  await user.click(
    screen.getByRole("button", { name: "Edit trigger: Message posted" }),
  );
  expect(screen.getByRole("textbox", { name: "Value" })).toHaveValue(
    "not-a-pubkey",
  );
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
});

test("clearing an enabled Basic condition blocks save and lossy view switches until removed", async () => {
  const user = userEvent.setup();
  const initial = fixtureYaml
    .replace("enabled: false", "enabled: true")
    .replace(
      "on: message_posted",
      "on: message_posted\n  filter: 'str_contains(trigger_text, \"P1\")'",
    );
  render(<Example initial={initial} />);
  await user.click(
    screen.getByRole("button", { name: "Edit trigger: Message posted" }),
  );
  const value = screen.getByRole("textbox", { name: "Value" });
  await user.clear(value);
  expect(value).toHaveAccessibleDescription(
    "Enter a value or remove this condition.",
  );
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await user.click(screen.getByRole("tab", { name: "Advanced" }));
  expect(screen.getByRole("tab", { name: "Basic" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await user.click(screen.getByRole("tab", { name: "YAML" }));
  expect(
    screen.queryByRole("textbox", { name: "Workflow YAML" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close inspector" }));
  await user.click(
    screen.getByRole("button", { name: "Edit trigger: Message posted" }),
  );
  expect(screen.getByRole("textbox", { name: "Value" })).toHaveValue("");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Remove Message text condition" }),
  );
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  await user.click(screen.getByRole("tab", { name: "YAML" }));
  expect(
    screen.getByRole("textbox", { name: "Workflow YAML" }),
  ).not.toHaveValue(expect.stringContaining("filter:"));
});

test("templated webhook URLs remain saveable in Form and YAML", async () => {
  const user = userEvent.setup();
  const initial =
    'name: Template\nenabled: false\ntrigger: {on: webhook}\nsteps:\n  - id: request\n    action: call_webhook\n    url: "{{trigger_text}}"\n';
  render(<Example initial={initial} />);
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  await user.click(screen.getByRole("tab", { name: "YAML" }));
  expect(screen.getByRole("textbox", { name: "Workflow YAML" })).toHaveValue(
    initial,
  );
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
});

test.each(["", "   "])(
  "clearing a step condition removes its expression (%j)",
  async (empty) => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(
      screen.getByRole("button", { name: "Edit step 1: Send Message" }),
    );
    await user.click(screen.getByRole("button", { name: /Run controls/ }));
    const condition = screen.getByRole("textbox", {
      name: "Step condition (optional)",
    });
    await user.type(condition, "true");
    await user.clear(condition);
    if (empty) await user.type(condition, empty);
    await user.click(screen.getByRole("tab", { name: "YAML" }));
    expect(
      screen.getByRole("textbox", { name: "Workflow YAML" }),
    ).not.toHaveValue(expect.stringContaining("if:"));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  },
);

test("editing another Basic condition preserves the untouched literal", async () => {
  const user = userEvent.setup();
  const initial = fixtureYaml.replace(
    "on: message_posted",
    `on: message_posted\n  filter: 'str_starts_with(trigger_text, "deploy ")'`,
  );
  render(<Example initial={initial} />);
  await user.click(
    screen.getByRole("button", { name: "Edit trigger: Message posted" }),
  );
  await user.click(screen.getByRole("combobox", { name: "Add condition" }));
  await user.click(await screen.findByRole("option", { name: "Author" }));
  const authorValue = screen.getAllByRole("textbox", { name: "Value" })[1];
  if (!authorValue) throw new Error("Author condition input is missing");
  await user.type(authorValue, "a".repeat(64));
  expect(screen.getAllByRole("textbox", { name: "Value" })[0]).toHaveValue(
    "deploy ",
  );
  await user.click(screen.getByRole("tab", { name: "YAML" }));
  const yaml = screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: "Workflow YAML",
  }).value;
  expect(parse(yaml).trigger.filter).toBe(
    `str_starts_with(trigger_text, "deploy ") && trigger_author == "${"a".repeat(64)}"`,
  );
});

test("opening an existing workflow focuses its heading without running or saving", async () => {
  const run = vi.fn();
  const save = vi.fn();
  render(
    <WorkflowEditor
      yaml={fixtureYaml}
      onChange={vi.fn()}
      onSave={save}
      run={
        <button type="button" onClick={run}>
          Run now
        </button>
      }
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByText("Message helper", { selector: "span" }),
    ).toHaveFocus(),
  );
  await userEvent.setup().keyboard("{Enter}");
  expect(run).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

test("keeps the same raw name, draft and focused controls while a save is pending across locales", async () => {
  const saved = vi.fn();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const rawName = "Give this workflow a name.";
  const initial = fixtureYaml.replace("Message helper", rawName);
  function Host() {
    const [yaml, setYaml] = useState(initial);
    const [busy, setBusy] = useState(false);
    return (
      <WorkflowEditor
        yaml={yaml}
        initialYaml={initial}
        onChange={setYaml}
        busy={busy}
        onSave={() => {
          saved(yaml);
          setBusy(true);
          void gate.then(() => setBusy(false));
        }}
      />
    );
  }
  render(<Host />);
  const user = userEvent.setup();
  const title = screen.getByText(rawName, { selector: "span" });
  await waitFor(() => expect(title).toHaveFocus());
  const dialog = screen.getByRole("dialog", { name: rawName });
  const name = screen.getByRole("textbox", { name: "Workflow name" });
  if (!(name instanceof HTMLInputElement))
    throw new Error("Expected name input");
  name.focus();
  name.setSelectionRange(2, 7);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("dialog", { name: rawName })).toBe(dialog);
  expect(screen.getByRole("textbox", { name: "워크플로 이름" })).toBe(name);
  expect(name).toHaveValue(rawName);
  expect(name).toHaveFocus();
  expect([name.selectionStart, name.selectionEnd]).toEqual([2, 7]);
  const save = screen.getByRole("button", { name: "변경 사항 저장" });
  try {
    await user.click(save);
    expect(saved).toHaveBeenCalledExactlyOnceWith(initial);
    expect(screen.getByRole("button", { name: "저장 중…" })).toBe(save);
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(name).toBeDisabled();
    act(() => setLanguage("en"));
    expect(screen.getByRole("button", { name: "Saving…" })).toBe(save);
    expect(screen.getByRole("textbox", { name: "Workflow name" })).toBe(name);
    expect(name).toHaveValue(rawName);
    await user.click(save);
    expect(saved).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      release();
      await gate;
    });
  }
  expect(screen.getByRole("button", { name: "Save changes" })).toBe(save);
  expect(save).toBeEnabled();
});

test("retains the activation confirmation and saved YAML while its whole warning changes locale", async () => {
  const save = vi.fn();
  render(<Example onSave={save} />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("switch", { name: "Enabled in configuration" }),
  );
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  const confirmation = screen.getByRole("alertdialog", {
    name: "This workflow may run often",
  });
  const confirm = screen.getByRole("button", { name: "Save enabled workflow" });
  confirm.focus();
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("alertdialog", {
      name: "이 워크플로가 자주 실행될 수 있습니다",
    }),
  ).toBe(confirmation);
  expect(screen.getByRole("button", { name: "활성화된 워크플로 저장" })).toBe(
    confirm,
  );
  expect(confirm).toHaveFocus();
  expect(save).not.toHaveBeenCalled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Save enabled workflow" })).toBe(
    confirm,
  );
  await user.click(confirm);
  expect(save).toHaveBeenCalledExactlyOnceWith(
    fixtureYaml.replace("enabled: false\n", ""),
  );
  expect(parse(save.mock.calls[0]?.[0]).enabled).not.toBe(false);
  expect(parse(save.mock.calls[0]?.[0])).toMatchObject({
    name: "Message helper",
    steps: [
      { id: "notify", action: "send_message", text: "Hello from a fixture" },
    ],
  });
});

test("keeps parser diagnostics and opaque blocked copy literal while translating the view-switch frame", async () => {
  const initial = `${fixtureYaml}future: preserve-me\n`;
  const blocked = "Review Recent activity before editing.";
  const { yamlToFormState } = await import("./workflowFormTypes");
  const parsed = yamlToFormState(initial);
  if (parsed.ok) throw new Error("Expected real unsupported-field diagnostic");
  render(
    <WorkflowEditor
      yaml={initial}
      onChange={vi.fn()}
      onSave={vi.fn()}
      blocked={blocked}
    />,
  );
  const user = userEvent.setup();
  const yaml = screen.getByRole("textbox", { name: "Workflow YAML" });
  await user.click(screen.getByRole("tab", { name: "Form" }));
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(`Cannot switch editor view: ${parsed.error}`);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent(
    `편집기 보기를 전환할 수 없습니다: ${parsed.error}`,
  );
  expect(screen.getByText(blocked)).toBeVisible();
  expect(screen.getByRole("textbox", { name: "워크플로 YAML" })).toBe(yaml);
  expect(yaml).toHaveValue(initial);
  act(() => setLanguage("en"));
  expect(alert).toHaveTextContent(`Cannot switch editor view: ${parsed.error}`);
});

test("projects real URL and header draft issues at the parent boundary without translating raw values", async () => {
  const rawBody = "Give every header a name or remove its row.";
  const initial = `name: raw-request\nenabled: false\ntrigger:\n  on: webhook\nsteps:\n  - id: raw_request\n    action: call_webhook\n    url: https://example.org/{{ trigger.raw }}\n    body: '${rawBody}'\n`;
  render(<Example initial={initial} />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Edit step 1: Call Webhook" }),
  );
  const url = screen.getByRole("textbox", { name: "Webhook URL" });
  const body = screen.getByRole("textbox", { name: "Request body (optional)" });
  await user.clear(url);
  const originalError =
    "Enter a webhook URL or template. The relay checks destination safety and permission.";
  expect(url).toHaveAccessibleDescription(originalError);
  const save = screen.getByRole("button", { name: "Save changes" });
  expect(save).toBeDisabled();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "웹훅 URL" })).toBe(url);
  expect(url).toHaveFocus();
  expect(url).toHaveValue("");
  expect(url).toHaveAccessibleDescription(
    "웹훅 URL 또는 템플릿을 입력해 주세요. 릴레이가 대상의 안전성과 권한을 확인합니다.",
  );
  expect(screen.getByRole("textbox", { name: "요청 본문 (선택)" })).toBe(body);
  expect(body).toHaveValue(rawBody);
  await user.type(url, "https://example.org/{{ trigger.raw }}");
  await user.click(screen.getByRole("button", { name: "헤더 추가" }));
  const header = screen.getByRole("textbox", { name: "헤더 1 이름" });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "각 헤더에 이름을 입력하거나 해당 행을 삭제해 주세요.",
  );
  expect(save).toBeDisabled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Header 1 name" })).toBe(header);
  expect(screen.getByRole("alert")).toHaveTextContent(rawBody);
  expect(body).toHaveValue(rawBody);
  await user.type(header, "Header names must be unique.");
  expect(header).toHaveValue("Header names must be unique.");
  expect(save).toBeEnabled();
});

test("retains a blocked lossy view switch and its local message across language changes", async () => {
  const initial = fixtureYaml.replace(
    "on: message_posted",
    `on: message_posted\n  filter: 'str_contains(trigger_text, "P1")'`,
  );
  render(<Example initial={initial} />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Edit trigger: Message posted" }),
  );
  const value = screen.getByRole("textbox", { name: "Value" });
  await user.clear(value);
  await user.click(screen.getByRole("tab", { name: "YAML" }));
  const alert = screen.getByText(/^Cannot switch editor view:/);
  expect(alert).toHaveTextContent(
    "Correct the invalid condition or duplicate header before switching views.",
  );
  act(() => setLanguage("ko"));
  expect(screen.getByText(/^편집기 보기를 전환할 수 없습니다:/)).toBe(alert);
  expect(alert).toHaveTextContent(
    "보기를 전환하기 전에 잘못된 조건이나 중복된 헤더를 수정해 주세요.",
  );
  expect(screen.getByRole("textbox", { name: "값" })).toBe(value);
  expect(value).toHaveValue("");
  expect(screen.queryByRole("textbox", { name: "워크플로 YAML" })).toBeNull();
  act(() => setLanguage("en"));
  expect(alert).toHaveTextContent(
    "Correct the invalid condition or duplicate header before switching views.",
  );
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
});
