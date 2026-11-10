// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage, type Language } from "../../shared/i18n/language";
import { en, ko } from "../../shared/i18n/catalogs/workflow-channel-ui";
import { english, korean } from "../../shared/i18n";
import { validateCatalogs } from "../../shared/i18n/messages";
import type {
  WorkflowCapability,
  WorkflowDefinition,
} from "../../features/workflows/types";
import { WorkflowChannel } from "./WorkflowChannel";
import {
  createWorkflowFixture,
  fixtureChannel,
  fixtureDefinition,
  fixtureViewer,
  fixtureYaml,
} from "./fixtures";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.restoreAllMocks();
});
const locale = (language: Language) => act(() => setLanguage(language));
const channelName = "Reading configurations… {name} 한글";
const rawYaml = `${fixtureYaml}\n# raw {name} 한글\n`;

function mount(
  fixture = createWorkflowFixture(),
  initialSelection: WorkflowDefinition | "new" = fixtureDefinition,
  viewer = fixtureViewer,
  capability: WorkflowCapability = fixture.capability,
) {
  const onClose = vi.fn();
  const onDelete = vi.fn();
  const onSaveReadback = vi.fn();
  const onDraftRiskChange = vi.fn();
  const view = render(
    <StrictMode>
      <WorkflowChannel
        capability={capability}
        channelId={fixtureChannel}
        channel={{ name: channelName }}
        viewer={viewer}
        initialSelection={initialSelection}
        onClose={onClose}
        onDelete={onDelete}
        onSaveReadback={onSaveReadback}
        onDraftRiskChange={onDraftRiskChange}
      />
    </StrictMode>,
  );
  return {
    ...view,
    fixture,
    onClose,
    onDelete,
    onSaveReadback,
    onDraftRiskChange,
  };
}

it("retains the same raw YAML editor, caret and focus through locale changes and unknown-save readback without replay", async () => {
  const h = mount();
  const editor = await screen.findByRole("dialog", { name: "Message helper" });
  fireEvent.click(within(editor).getByRole("tab", { name: "YAML" }));
  const yaml = within(editor).getByRole<HTMLTextAreaElement>("textbox", {
    name: "Workflow YAML",
  });
  fireEvent.change(yaml, { target: { value: rawYaml } });
  fireEvent.click(within(editor).getByRole("button", { name: "Save changes" }));
  expect(h.fixture.input()).toEqual({
    channelId: fixtureChannel,
    yaml: rawYaml,
    existing: fixtureDefinition,
  });
  expect(h.fixture.calls.save).toBe(1);
  act(() => h.fixture.finish("unknown"));
  yaml.focus();
  yaml.setSelectionRange(3, 14);
  const created = h.fixture.definitions.created();
  const operation = h.fixture.capability.operations.snapshot()[0];
  expect(operation?.outcome).toBe("unknown");
  const region = h.container.querySelector("section[aria-label]");
  expect(region).toHaveAttribute("aria-label", `Workflows in ${channelName}`);
  expect(within(editor).getByText(en["workflowChannel.unsaved"])).toBeVisible();
  for (const language of ["ko", "en", "ko"] as const) {
    locale(language);
    const words = language === "ko" ? ko : en;
    const regionLabel =
      language === "ko"
        ? `${channelName}의 워크플로`
        : `Workflows in ${channelName}`;
    expect(region).toHaveAttribute("aria-label", regionLabel);
    expect(screen.getByRole("dialog", { name: "Message helper" })).toBe(editor);
    expect(
      within(editor).getByRole("textbox", {
        name: language === "ko" ? "워크플로 YAML" : "Workflow YAML",
      }),
    ).toBe(yaml);
    expect(yaml).toHaveValue(rawYaml);
    expect(yaml).toHaveFocus();
    expect([yaml.selectionStart, yaml.selectionEnd]).toEqual([3, 14]);
    expect(
      within(editor).getByText(words["workflowChannel.unsaved"]),
    ).toBeVisible();
    expect(h.fixture.definitions.created()).toBe(created);
    expect(h.fixture.capability.operations.snapshot()[0]).toBe(operation);
    expect(h.fixture.calls.save).toBe(1);
    expect(h.fixture.calls.trigger).toBe(0);
    expect(h.fixture.calls.delete).toBe(0);
  }
  h.fixture.saveOnServer();
  fireEvent.click(screen.getByRole("button", { name: "저장된 구성 확인" }));
  await act(async () => {});
  expect(h.fixture.calls.save).toBe(1);
  expect(h.onSaveReadback).toHaveBeenCalledExactlyOnceWith({
    channelId: fixtureChannel,
    revision: operation?.eventId,
  });
  expect(screen.getByRole("dialog", { name: "Message helper" })).toBe(editor);
  expect(screen.getByRole("textbox", { name: "워크플로 YAML" })).toBe(yaml);
  expect(yaml).toHaveValue(rawYaml);
  expect(h.onClose).not.toHaveBeenCalled();
  expect(h.onDelete).not.toHaveBeenCalled();
});

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

it("retains one genuinely held definition refresh and releases its recovery controls without resending a save", async () => {
  const f = createWorkflowFixture();
  f.capability.save({
    channelId: fixtureChannel,
    existing: fixtureDefinition,
    yaml: rawYaml,
  });
  f.finish("unknown");
  const read = f.capability.definitions;
  const gate = deferred();
  let hold = false;
  let heldReads = 0;
  f.capability.definitions = (channel) => {
    const owned = read(channel);
    return {
      ...owned,
      async refresh() {
        if (hold) {
          heldReads++;
          await gate.promise;
        }
        await owned.refresh();
      },
    };
  };
  // Do not let the initial subscription read resolve the restored operation.
  const h = mount(f);
  const editor = await screen.findByRole("dialog", { name: "Message helper" });
  fireEvent.click(within(editor).getByRole("tab", { name: "YAML" }));
  const yaml = within(editor).getByRole("textbox", { name: "Workflow YAML" });
  const check = screen.getByRole("button", {
    name: "Check saved configuration",
  });
  const operations = f.capability.operations.snapshot();
  f.saveOnServer();
  hold = true;
  try {
    fireEvent.click(check);
    expect(heldReads).toBe(1);
    expect(check).toBeDisabled();
    const summary = within(editor).getByText("Configuration details", {
      selector: "summary",
    });
    fireEvent.click(summary);
    summary.focus();
    for (const language of ["ko", "en"] as const) {
      locale(language);
      const words = language === "ko" ? ko : en;
      expect(screen.getByRole("dialog", { name: "Message helper" })).toBe(
        editor,
      );
      expect(
        within(editor).getByRole("textbox", {
          name: language === "ko" ? "워크플로 YAML" : "Workflow YAML",
        }),
      ).toBe(yaml);
      expect(yaml).toHaveValue(fixtureYaml);
      expect(
        within(editor).getByText(words["workflowChannel.details"], {
          selector: "summary",
        }),
      ).toBe(summary);
      expect(summary.closest("details")).toHaveAttribute("open");
      expect(summary).toHaveFocus();
      expect(
        within(editor).getByText(
          words["workflowChannel.owner"].replace(
            "{id}",
            fixtureDefinition.owner,
          ),
        ),
      ).toBeVisible();
      expect(
        within(editor).getByText(
          words["workflowChannel.revision"].replace(
            "{id}",
            fixtureDefinition.revision,
          ),
        ),
      ).toBeVisible();
      expect(f.capability.operations.snapshot()).toBe(operations);
      expect(check).toBeDisabled();
      expect(heldReads).toBe(1);
      expect(f.calls.save).toBe(1);
      expect(f.calls.trigger).toBe(0);
      expect(f.calls.delete).toBe(0);
    }
  } finally {
    hold = false;
    await act(async () => {
      gate.release();
      await gate.promise;
    });
  }
  await waitFor(() => expect(check).toBeEnabled());
  expect(h.onSaveReadback).not.toHaveBeenCalled();
  expect(f.calls.save).toBe(1);
});

it.each([
  {
    action: "save",
    reason: undefined,
    key: "workflowChannel.submitFailed",
    local: true,
  },
  {
    action: "save",
    reason: new Error(en["workflowChannel.submitFailed"]),
    key: "workflowChannel.submitFailed",
    local: false,
  },
  {
    action: "save",
    reason: new Error(""),
    key: "workflowChannel.submitFailed",
    local: false,
  },
  {
    action: "trigger",
    reason: { opaque: "raw" },
    key: "workflowChannel.runFailed",
    local: true,
  },
  {
    action: "trigger",
    reason: new Error(en["workflowChannel.runFailed"]),
    key: "workflowChannel.runFailed",
    local: false,
  },
  {
    action: "trigger",
    reason: new Error(""),
    key: "workflowChannel.runFailed",
    local: false,
  },
] as const)(
  "preserves $action diagnostic provenance with local=$local and reason=$reason",
  async ({ action, reason, key, local }) => {
    const f = createWorkflowFixture();
    const command = vi.spyOn(f.capability, action).mockImplementation(() => {
      throw reason;
    });
    const h = mount(f);
    const editor = await screen.findByRole("dialog", {
      name: "Message helper",
    });
    if (action === "save") {
      fireEvent.click(within(editor).getByRole("tab", { name: "YAML" }));
      fireEvent.change(
        within(editor).getByRole("textbox", { name: "Workflow YAML" }),
        { target: { value: rawYaml } },
      );
    }
    const button = within(editor).getByRole("button", {
      name: action === "save" ? "Save changes" : "Run now",
    });
    button.focus();
    fireEvent.click(button);
    expect(command).toHaveBeenCalledTimes(1);
    const expected = local
      ? en[key]
      : reason instanceof Error
        ? reason.message
        : "";
    if (expected)
      expect(within(editor).getByRole("alert")).toHaveTextContent(expected);
    else expect(within(editor).queryByRole("alert")).toBeNull();
    for (const language of ["ko", "en"] as const) {
      locale(language);
      const text = local ? (language === "ko" ? ko[key] : en[key]) : expected;
      if (text)
        expect(within(editor).getByRole("alert")).toHaveTextContent(text);
      else expect(within(editor).queryByRole("alert")).toBeNull();
      expect(screen.getByRole("dialog", { name: "Message helper" })).toBe(
        editor,
      );
      expect(button).toHaveFocus();
      expect(command).toHaveBeenCalledTimes(1);
      expect(h.onDelete).not.toHaveBeenCalled();
      expect(h.onClose).not.toHaveBeenCalled();
    }
    expect(f.capability.operations.snapshot()).toEqual([]);
  },
);

it.each(["permission", "connection"] as const)(
  "rechecks deletion %s at confirmation and retains the editor without issuing a delete",
  async (cause) => {
    const f = createWorkflowFixture();
    let permitted = true;
    let available = true;
    vi.spyOn(f.capability.permissions, "canDelete").mockImplementation(
      () => permitted,
    );
    const capability = {
      ...f.capability,
      availability: {
        ...f.capability.availability,
        get delete() {
          return available;
        },
      },
    };
    const h = mount(f, fixtureDefinition, fixtureViewer, capability);
    const editor = await screen.findByRole("dialog", {
      name: "Message helper",
    });
    const user = userEvent.setup();
    await user.click(
      within(editor).getByRole("button", { name: "Workflow actions" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete workflow" }),
    );
    const confirm = screen.getByRole("alertdialog", {
      name: "Delete this workflow?",
    });
    const cancel = within(confirm).getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());
    locale("ko");
    expect(
      screen.getByRole("alertdialog", {
        name: ko["workflowChannel.deleteTitle"],
      }),
    ).toBe(confirm);
    expect(confirm).toHaveAccessibleDescription(
      ko["workflowChannel.deleteDescription"],
    );
    expect(within(confirm).getByRole("button", { name: "취소" })).toBe(cancel);
    expect(cancel).toHaveFocus();
    if (cause === "permission") permitted = false;
    else available = false;
    fireEvent.click(
      within(confirm).getByRole("button", { name: "워크플로 삭제" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const key =
      cause === "permission"
        ? "workflowChannel.deletePermissionLost"
        : "workflowChannel.deleteUnavailable";
    expect(within(editor).getByRole("alert")).toHaveTextContent(ko[key]);
    locale("en");
    expect(within(editor).getByRole("alert")).toHaveTextContent(en[key]);
    expect(screen.getByRole("dialog", { name: "Message helper" })).toBe(editor);
    expect(h.onDelete).not.toHaveBeenCalled();
    expect(f.calls.delete).toBe(0);
    expect(f.calls.save).toBe(0);
  },
);

it("retains a dirty YAML draft and distinct Keep editing/Cancel semantics across an open leave confirmation", async () => {
  const h = mount();
  const editor = await screen.findByRole("dialog", { name: "Message helper" });
  fireEvent.click(within(editor).getByRole("tab", { name: "YAML" }));
  const yaml = within(editor).getByRole("textbox", { name: "Workflow YAML" });
  fireEvent.change(yaml, { target: { value: rawYaml } });
  fireEvent.click(within(editor).getByRole("button", { name: "Cancel" }));
  const confirm = screen.getByRole("alertdialog", {
    name: en["workflowChannel.leaveTitle"],
  });
  const keep = within(confirm).getByRole("button", { name: "Keep editing" });
  await waitFor(() => expect(keep).toHaveFocus());
  for (const language of ["ko", "en"] as const) {
    locale(language);
    const words = language === "ko" ? ko : en;
    expect(
      screen.getByRole("alertdialog", {
        name: words["workflowChannel.leaveTitle"],
      }),
    ).toBe(confirm);
    expect(confirm).toHaveAccessibleDescription(
      words["workflowChannel.leaveDescription"],
    );
    expect(
      within(confirm).getByRole("button", {
        name: words["workflowChannel.keepEditing"],
      }),
    ).toBe(keep);
    expect(keep).toHaveFocus();
    expect(yaml).toHaveValue(rawYaml);
    expect(h.onClose).not.toHaveBeenCalled();
    expect(h.fixture.calls.save).toBe(0);
  }
  fireEvent.click(keep);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(screen.getByRole("dialog", { name: "Message helper" })).toBe(editor);
  fireEvent.click(within(editor).getByRole("button", { name: "Cancel" }));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Leave draft",
    }),
  );
  expect(h.onClose).toHaveBeenCalledExactlyOnceWith();
  expect(h.fixture.calls.save).toBe(0);
  expect(h.fixture.calls.delete).toBe(0);
  expect(h.fixture.calls.trigger).toBe(0);
});

it.each([undefined, en["workflowChannel.readFailedShort"], ""])(
  "translates only absent snapshot diagnostics and preserves the raw value %s",
  async (diagnostic) => {
    const h = mount();
    const editor = await screen.findByRole("dialog", {
      name: "Message helper",
    });
    act(() =>
      h.fixture.definitions.update({
        status: "error",
        ...(diagnostic === undefined ? {} : { error: diagnostic }),
        data: { items: [fixtureDefinition], partial: true },
      }),
    );
    const refresh = within(editor).getByRole("button", {
      name: "Refresh configurations",
    });
    refresh.focus();
    for (const language of ["en", "ko", "en"] as const) {
      locale(language);
      const words = language === "ko" ? ko : en;
      expect(within(editor).getByRole("alert").textContent).toBe(
        diagnostic ?? words["workflowChannel.readFailedShort"],
      );
      const parentAlert = h.container.querySelector('[role="alert"]');
      expect(parentAlert?.textContent).toBe(
        diagnostic ?? words["workflowChannel.readFailed"],
      );
      expect(h.container.textContent).toContain(
        words["workflowChannel.partial"],
      );
      expect(
        within(editor).getByRole("button", {
          name: words["workflowChannel.refresh"],
        }),
      ).toBe(refresh);
      expect(refresh).toHaveFocus();
      expect(refresh).toBeEnabled();
      expect(h.fixture.calls.save).toBe(0);
    }
    act(() =>
      h.fixture.definitions.update({
        status: "loading",
        data: { items: [fixtureDefinition], partial: false },
      }),
    );
    expect(
      within(editor).getByText(en["workflowChannel.reading"]),
    ).toBeVisible();
    expect(refresh).toBeDisabled();
    locale("ko");
    expect(
      within(editor).getByText(ko["workflowChannel.reading"]),
    ).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Message helper" })).toBe(editor);
    expect(h.fixture.calls.save).toBe(0);
  },
);

it.each(["idle", "unavailable"] as const)(
  "keeps the canonical %s withdrawal policy while changing its display",
  async (status) => {
    const h = mount();
    await screen.findByRole("dialog", { name: "Message helper" });
    act(() =>
      h.fixture.definitions.update({
        status,
        data: { items: [], partial: false },
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const key =
      status === "idle"
        ? "workflowChannel.cleared"
        : "workflowChannel.definitionsUnavailable";
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(en[key]);
    for (const language of ["ko", "en"] as const) {
      locale(language);
      expect(screen.getByRole("status")).toBe(notice);
      expect(notice).toHaveTextContent((language === "ko" ? ko : en)[key]);
      expect(h.fixture.calls.save).toBe(0);
      expect(h.fixture.calls.delete).toBe(0);
      expect(h.fixture.calls.trigger).toBe(0);
    }
  },
);

it("projects unavailable-host and verified-author guidance without changing disabled controls or raw owner IDs", async () => {
  const f = createWorkflowFixture();
  vi.spyOn(f.capability.permissions, "canDelete").mockReturnValue(false);
  const capability = {
    ...f.capability,
    availability: { ...f.capability.availability, save: false, delete: false },
  };
  const h = mount(f, fixtureDefinition, fixtureViewer, capability);
  const editor = await screen.findByRole("dialog", { name: "Message helper" });
  fireEvent.click(within(editor).getByRole("tab", { name: "YAML" }));
  const yaml = within(editor).getByRole("textbox", { name: "Workflow YAML" });
  const user = userEvent.setup();
  await user.click(
    within(editor).getByRole("button", { name: "Workflow actions" }),
  );
  const remove = await screen.findByRole("menuitem", {
    name: "Delete workflow",
  });
  remove.focus();
  const describedBy = remove.getAttribute("aria-describedby");
  expect(remove).toHaveAttribute("aria-disabled", "true");
  for (const language of ["ko", "en"] as const) {
    locale(language);
    const words = language === "ko" ? ko : en;
    expect(
      screen.getByRole("menuitem", { name: words["workflowChannel.delete"] }),
    ).toBe(remove);
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAttribute("aria-describedby", describedBy);
    expect(remove).toHaveAccessibleDescription(
      words["workflowChannel.authorOnly"],
    );
    expect(remove).toHaveFocus();
    expect(h.container.textContent).toContain(
      words["workflowChannel.readOnlyHost"],
    );
    expect(editor.textContent).toContain(
      words["workflowChannel.saveUnavailable"],
    );
    expect(editor.textContent).toContain(words["workflowChannel.noDelete"]);
    expect(yaml).toHaveValue(fixtureYaml);
    expect(f.calls.delete).toBe(0);
  }
});

it.each(["succeeded", "rejected"] as const)(
  "retains the %s save editor lock and translates its exact recovery reason",
  async (outcome) => {
    const h = mount();
    const editor = await screen.findByRole("dialog", {
      name: "Message helper",
    });
    fireEvent.click(within(editor).getByRole("tab", { name: "YAML" }));
    const yaml = within(editor).getByRole("textbox", { name: "Workflow YAML" });
    fireEvent.change(yaml, { target: { value: rawYaml } });
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save changes" }),
    );
    act(() => h.fixture.finish(outcome, false));
    const key =
      outcome === "succeeded"
        ? "workflowChannel.awaitingReadback"
        : "workflowChannel.rejectedDraft";
    yaml.focus();
    for (const language of ["en", "ko", "en"] as const) {
      locale(language);
      const words = language === "ko" ? ko : en;
      expect(editor.textContent).toContain(words[key]);
      expect(screen.getByRole("dialog", { name: "Message helper" })).toBe(
        editor,
      );
      expect(yaml).toHaveFocus();
      expect(yaml).toHaveValue(rawYaml);
      expect(yaml).toHaveAttribute("readonly");
      expect(h.fixture.calls.save).toBe(1);
    }
    if (outcome === "rejected") {
      fireEvent.click(
        within(editor).getByRole("button", {
          name: "Continue editing retained draft",
        }),
      );
      expect(yaml).not.toHaveAttribute("readonly");
      expect(yaml).toHaveValue(rawYaml);
    }
    expect(h.fixture.calls.save).toBe(1);
  },
);

it("keeps canonical run outcome transitions without repeating commands while translating the parent pending and successful display", async () => {
  const h = mount();
  const editor = await screen.findByRole("dialog", { name: "Message helper" });
  const run = within(editor).getByRole("button", { name: "Run now" });
  fireEvent.click(run);
  expect(h.fixture.calls.trigger).toBe(1);
  expect(run).toBeDisabled();
  locale("ko");
  expect(within(editor).getByRole("button", { name: "지금 실행" })).toBe(run);
  expect(run).toHaveAccessibleName("지금 실행");
  expect(editor.textContent).toContain("실행 요청 중…");
  fireEvent.click(run);
  expect(h.fixture.calls.trigger).toBe(1);
  act(() => h.fixture.finish("succeeded"));
  const notice = within(editor).getByText(
    "실행을 요청했습니다. 실행 기록에서 결과를 확인해 주세요.",
  );
  locale("en");
  expect(
    within(editor).getByText(
      "Run requested. Inspect run history for its result.",
    ),
  ).toBe(notice);
  expect(h.fixture.calls.trigger).toBe(1);
  expect(run).toBeEnabled();
  expect(h.fixture.calls.save).toBe(0);
});

it("keeps the serialized new-workflow name canonical rather than translating the generated YAML", async () => {
  const h = mount(createWorkflowFixture(), "new");
  const editor = await screen.findByRole("dialog", { name: "Create workflow" });
  fireEvent.click(within(editor).getByRole("tab", { name: "YAML" }));
  const yaml = within(editor).getByRole<HTMLTextAreaElement>("textbox", {
    name: "Workflow YAML",
  });
  const original = yaml.value;
  expect(original).toContain("name: Untitled workflow");
  locale("ko");
  expect(within(editor).getByRole("textbox", { name: "워크플로 YAML" })).toBe(
    yaml,
  );
  expect(yaml).toHaveValue(original);
  expect(h.fixture.calls.save).toBe(0);
});

it("registers all 33 complete channel templates with matching variables and no changed canonical operation messages", () => {
  expect(Object.keys(en)).toHaveLength(33);
  expect(validateCatalogs(en, ko)).toEqual({
    missing: [],
    unexpected: [],
    variables: [],
  });
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    expect(english[key]).toBe(en[key]);
    expect(korean[key]).toBe(ko[key]);
  }
});
