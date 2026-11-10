// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Field } from "../shared/design-system/ui/Field";
import { Input } from "../shared/design-system/ui/Input";
import { Textarea } from "../shared/design-system/ui/Textarea";
import { setLanguage } from "../shared/i18n";
import { localeStorageKey } from "../shared/i18n/language";
import { LanguageProviders } from "./LanguageProviders";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", async (original) => ({
  ...(await original<typeof import("@tauri-apps/api/core")>()),
  invoke: native.invoke,
}));
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});
it.each(["input", "textarea"] as const)(
  "updates the real optional %s label without changing its draft, focus or validation contract",
  (kind) => {
    setLanguage("en");
    const changed = vi.fn(),
      raw = "Optional {name} 한글";
    function Form() {
      const [value, setValue] = useState(raw);
      const props = {
        id: "raw-target",
        name: "raw-name",
        value,
        required: false,
        onChange: (
          event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
          setValue(event.target.value);
          changed(event.target.value);
        },
      };
      return (
        <LanguageProviders>
          <Field
            label="Optional"
            optional
            controlId="raw-target"
            description="Raw description"
            error="Raw validation"
          >
            {kind === "input" ? (
              <Input {...props} />
            ) : (
              <Textarea {...props} rows={4} />
            )}
          </Field>
          <Field label="Required raw">
            <Input id="required-target" name="required-raw" required />
          </Field>
        </LanguageProviders>
      );
    }
    render(<Form />);
    const control = screen.getByRole("textbox", { name: "Optional Optional" });
    if (
      !(
        control instanceof HTMLInputElement ||
        control instanceof HTMLTextAreaElement
      )
    )
      throw new Error("Missing field control");
    const label = control.labels?.[0],
      suffix = label?.querySelector(".buzz-field-optional");
    const descriptor = control.getAttribute("aria-describedby");
    const required = screen.getByRole("textbox", { name: "Required raw" });
    control.focus();
    control.setSelectionRange(2, 8);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("textbox", {
          name: language === "ko" ? "Optional 선택 사항" : "Optional Optional",
        }),
      ).toBe(control);
      expect(control.labels?.[0]).toBe(label);
      expect(label?.querySelector(".buzz-field-optional")).toBe(suffix);
      expect(suffix?.textContent).toBe(
        language === "ko" ? "선택 사항" : "Optional",
      );
      expect(control).toHaveValue(raw);
      expect(control).toHaveFocus();
      expect(control.selectionStart).toBe(2);
      expect(control.selectionEnd).toBe(8);
      expect(control).toHaveAttribute("id", "raw-target");
      expect(control).toHaveAttribute("name", "raw-name");
      expect(control).not.toBeRequired();
      expect(control).toBeInvalid();
      expect(control).toHaveAccessibleDescription("Raw validation");
      expect(control.getAttribute("aria-describedby")).toBe(descriptor);
      expect(screen.getByRole("textbox", { name: "Required raw" })).toBe(
        required,
      );
      expect(required).toBeRequired();
      expect(changed).not.toHaveBeenCalled();
      expect(native.invoke).not.toHaveBeenCalled();
    }
    expect(writes.mock.calls.map(([key]) => key)).toEqual([
      localeStorageKey,
      localeStorageKey,
    ]);
    fireEvent.change(control, { target: { value: "Raw changed 한글" } });
    expect(changed).toHaveBeenCalledExactlyOnceWith("Raw changed 한글");
    expect(writes).toHaveBeenCalledTimes(2);
    expect(native.invoke).not.toHaveBeenCalled();
  },
);
it("keeps the generic English default and raw user label outside the product provider even when the app language is Korean", () => {
  setLanguage("ko");
  render(
    <Field label="Optional" optional>
      <Input />
    </Field>,
  );
  expect(
    screen.getByRole("textbox", { name: "Optional Optional" }),
  ).toBeVisible();
});
