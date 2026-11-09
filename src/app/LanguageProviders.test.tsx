// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Dialog } from "../shared/design-system/ui/Dialog";
import { AlertDialog } from "../shared/design-system/ui/AlertDialog";
import { LanguageProviders } from "./LanguageProviders";
import { setLanguage } from "../shared/i18n";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it.each(["dialog", "confirmation"])(
  "updates the real %s close name without replacing its draft or focused control",
  (kind) => {
    setLanguage("en");
    const input = <input aria-label="draft" defaultValue="사용자 원문" />;
    render(
      <LanguageProviders>
        {kind === "dialog" ? (
          <Dialog open title="Fixture" onOpenChange={() => {}}>
            {input}
          </Dialog>
        ) : (
          <AlertDialog
            title="Fixture"
            description="Description"
            onClose={() => {}}
            actions={<button type="button">Continue</button>}
          >
            {input}
          </AlertDialog>
        )}
      </LanguageProviders>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    const draft = screen.getByRole("textbox");
    draft.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button", { name: "닫기" })).toBe(close);
    expect(screen.getByRole("textbox")).toBe(draft);
    expect(draft).toHaveFocus();
    expect(draft).toHaveValue("사용자 원문");
    act(() => setLanguage("en"));
    expect(screen.getByRole("button", { name: "Close" })).toBe(close);
  },
);

it("preserves an explicitly provided close name across language changes", () => {
  setLanguage("ko");
  render(
    <LanguageProviders>
      <Dialog
        open
        title="Fixture"
        closeLabel="Provided close"
        onOpenChange={() => {}}
      />
    </LanguageProviders>,
  );
  expect(screen.getByRole("button", { name: "Provided close" })).toBeVisible();
});
