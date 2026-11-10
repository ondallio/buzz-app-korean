// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
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
import { useState, type ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import {
  AgentSaveButton,
  AgentSaveFooter,
  AgentSaveState,
  DiscardChanges,
} from "./AgentSaveButton";
import { AgentExecutionNote } from "./AgentExecutionNote";

const resize = vi.fn(),
  disconnect = vi.fn();
beforeEach(() => {
  setLanguage("en");
  resize.mockClear();
  disconnect.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = resize;
      unobserve() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps the actual portal, form binding, draft, report identity and focused submit across language and a held save", async () => {
  let finish!: () => void;
  const held = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const submit = vi.fn(
    async (_data: Record<string, FormDataEntryValue>) => held,
  );
  const report =
    vi.fn<NonNullable<ComponentProps<typeof AgentSaveState>["value"]>>();
  const raw = "Saved {instructions} 한글",
    draft = "Updated {instructions} 한글";
  function Host() {
    const [target, setTarget] = useState<HTMLDivElement | null>(null);
    const [value, setValue] = useState(raw),
      [saved, setSaved] = useState(raw),
      [saving, setSaving] = useState(false);
    const dirty = value !== saved;
    return (
      <AgentSaveState value={report}>
        <AgentSaveFooter
          value={{ target, notice: <p>Raw provider notice 한글</p> }}
        >
          <div data-testid="scroll-owner">
            <form
              id="fixture-agent-form"
              onSubmit={async (event) => {
                event.preventDefault();
                setSaving(true);
                try {
                  await submit(
                    Object.fromEntries(new FormData(event.currentTarget)),
                  );
                  setSaved(value);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <label htmlFor="raw-draft">Fixture draft</label>
              <textarea
                id="raw-draft"
                name="instructions"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </form>
            <AgentSaveButton
              form="fixture-agent-form"
              disabled={!dirty || saving}
              saving={saving}
              dirty={dirty}
            />
            <div ref={setTarget} data-testid="footer-target" />
          </div>
        </AgentSaveFooter>
      </AgentSaveState>
    );
  }
  const view = render(<Host />);
  try {
    const field = screen.getByRole("textbox", { name: "Fixture draft" });
    if (!(field instanceof HTMLTextAreaElement))
      throw new Error("Missing draft textarea");
    fireEvent.change(field, { target: { value: draft } });
    const button = await screen.findByRole("button", { name: "Save" });
    expect(screen.getByTestId("footer-target")).toContainElement(button);
    const frame = button.parentElement?.parentElement;
    const formId = button.getAttribute("form"),
      reportId = report.mock.lastCall?.[1];
    expect(formId).toBe("fixture-agent-form");
    expect(report.mock.lastCall?.[0]).toEqual({ dirty: true, saving: false });
    field.setSelectionRange(2, 10);
    button.focus();
    expect(resize).toHaveBeenCalledOnce();
    const count = report.mock.calls.length,
      observationCount = resize.mock.calls.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "저장" : "Save",
        }),
      ).toBe(button);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute("form", formId);
      expect(screen.getByRole("textbox", { name: "Fixture draft" })).toBe(
        field,
      );
      expect(field).toHaveValue(draft);
      expect([field.selectionStart, field.selectionEnd]).toEqual([2, 10]);
      expect(report).toHaveBeenCalledTimes(count);
      expect(resize).toHaveBeenCalledTimes(observationCount);
      expect(submit).not.toHaveBeenCalled();
      expect(frame).not.toHaveAttribute("inert");
      expect(screen.getByText("Raw provider notice 한글")).toBeInTheDocument();
    }
    fireEvent.click(button);
    await waitFor(() =>
      expect(submit).toHaveBeenCalledExactlyOnceWith({ instructions: draft }),
    );
    expect(report.mock.lastCall).toEqual([
      { dirty: true, saving: true },
      reportId,
    ]);
    const savingReports = report.mock.calls.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "저장 중…" : "Saving…",
        }),
      ).toBe(button);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(report).toHaveBeenCalledTimes(savingReports);
      expect(submit).toHaveBeenCalledOnce();
      expect(field).toHaveValue(draft);
      expect([field.selectionStart, field.selectionEnd]).toEqual([2, 10]);
    }
    await act(async () => finish());
    expect(frame).toHaveAttribute("inert");
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(report.mock.lastCall).toEqual([
      { dirty: false, saving: false },
      reportId,
    ]);
    expect(submit).toHaveBeenCalledOnce();
    expect(field).toHaveValue(draft);
  } finally {
    await act(async () => finish());
    view.unmount();
  }
});

it("preserves inline visibility and the original default dirty report without a footer", () => {
  const report =
    vi.fn<NonNullable<ComponentProps<typeof AgentSaveState>["value"]>>();
  const tree = (disabled: boolean) => (
    <AgentSaveState value={report}>
      <AgentSaveButton form="raw-form" disabled={disabled} saving={false} />
    </AgentSaveState>
  );
  const view = render(tree(true));
  expect(screen.queryByRole("button")).toBeNull();
  expect(report.mock.lastCall?.[0]).toEqual({ dirty: false, saving: false });
  view.rerender(tree(false));
  const button = screen.getByRole("button", { name: "Save" });
  expect(button).toHaveAttribute("form", "raw-form");
  expect(report.mock.lastCall?.[0]).toEqual({ dirty: true, saving: false });
  const count = report.mock.calls.length;
  button.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "저장" })).toBe(button);
  expect(button).toHaveFocus();
  expect(report).toHaveBeenCalledTimes(count);
});

it.each(["keep", "discard", "escape"] as const)(
  "keeps the actual confirmation and raw description stable through locale before %s",
  async (action) => {
    const keep = vi.fn(),
      discard = vi.fn();
    const user = userEvent.setup();
    render(
      <DiscardChanges
        description="Discard changes?"
        onKeep={keep}
        onDiscard={discard}
      />,
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Discard changes?",
    });
    const keepButton = within(dialog).getByRole("button", {
      name: "Keep editing",
    });
    const discardButton = within(dialog).getByRole("button", {
      name: "Discard changes",
    });
    const id = dialog.getAttribute("aria-labelledby"),
      description = dialog.getAttribute("aria-describedby");
    await waitFor(() => expect(keepButton).toBeVisible());
    keepButton.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("alertdialog", {
          name:
            language === "ko" ? "변경 사항을 취소할까요?" : "Discard changes?",
        }),
      ).toBe(dialog);
      expect(dialog).toHaveAccessibleDescription("Discard changes?");
      expect(dialog.getAttribute("aria-labelledby")).toBe(id);
      expect(dialog.getAttribute("aria-describedby")).toBe(description);
      expect(
        within(dialog).getByRole("button", {
          name: language === "ko" ? "계속 편집" : "Keep editing",
        }),
      ).toBe(keepButton);
      expect(
        within(dialog).getByRole("button", {
          name: language === "ko" ? "변경 사항 취소" : "Discard changes",
        }),
      ).toBe(discardButton);
      expect(keepButton).toHaveFocus();
      expect(keep).not.toHaveBeenCalled();
      expect(discard).not.toHaveBeenCalled();
    }
    if (action === "escape") await user.keyboard("{Escape}");
    else if (action === "keep") await user.click(keepButton);
    else await user.click(discardButton);
    expect(keep).toHaveBeenCalledTimes(action === "discard" ? 0 : 1);
    expect(discard).toHaveBeenCalledTimes(action === "discard" ? 1 : 0);
  },
);

it.each([undefined, "other/runtime", "block.builderlab/builderlab"])(
  "keeps the original runtime guard while translating its note, %s",
  (runtime) => {
    render(
      <AgentExecutionNote {...(runtime === undefined ? {} : { runtime })} />,
    );
    const note = screen.getByRole("note"),
      title = within(note).getByText("Remote agent");
    const expected = runtime === "block.builderlab/builderlab";
    expect(
      within(note).queryAllByText("Runs on a Builderlab machine"),
    ).toHaveLength(expected ? 1 : 0);
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("note")).toBe(note);
      expect(
        within(note).getByText(
          language === "ko" ? "원격 에이전트" : "Remote agent",
        ),
      ).toBe(title);
      expect(
        within(note).queryAllByText(
          language === "ko"
            ? "Builderlab 컴퓨터에서 실행됩니다"
            : "Runs on a Builderlab machine",
        ),
      ).toHaveLength(expected ? 1 : 0);
    }
  },
);
