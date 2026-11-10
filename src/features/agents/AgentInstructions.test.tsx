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
import { setLanguage } from "../../shared/i18n";
import { AgentInstructions } from "./AgentInstructions";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});
it.each(["", "Help me plan my week and prioritize tasks."])(
  "keeps the same raw controlled instructions, selection and caller description %s while its label and placeholder translate",
  (description) => {
    const changed = vi.fn(),
      raw = "Help me plan my week and prioritize tasks.";
    function Controlled() {
      const [value, setValue] = useState(raw);
      return (
        <AgentInstructions
          value={value}
          disabled={false}
          description={description}
          onChange={(next) => {
            setValue(next);
            changed(next);
          }}
        />
      );
    }
    render(<Controlled />);
    const input = screen.getByRole("textbox", { name: "Instructions" });
    if (!(input instanceof HTMLTextAreaElement))
      throw new Error("Missing textarea");
    input.focus();
    input.setSelectionRange(2, 9);
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("textbox", {
          name: language === "ko" ? "지침" : "Instructions",
        }),
      ).toBe(input);
      expect(input).toHaveAttribute(
        "placeholder",
        language === "ko"
          ? "이번 주 일정을 계획하고 작업의 우선순위를 정하도록 도와주세요."
          : raw,
      );
      expect(input).toHaveValue(raw);
      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(9);
      expect(input).toHaveAccessibleDescription(description);
      expect(input).toHaveAttribute("rows", "8");
      expect(changed).not.toHaveBeenCalled();
    }
    const next = "Instructions {name} 한글\nraw second line";
    fireEvent.change(input, { target: { value: next } });
    expect(changed).toHaveBeenCalledExactlyOnceWith(next);
    expect(input).toHaveValue(next);
  },
);
