// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InlineChip } from "../shared/design-system/ui/InlineChip";
import { CHIP_KINDS } from "../shared/design-system/chips/address";
import { LanguageProviders } from "./LanguageProviders";
import { setLanguage } from "../shared/i18n";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
const words = {
  person: ["Person", "사용자"],
  agent: ["Agent", "에이전트"],
  channel: ["Channel", "채널"],
  message: ["Message", "메시지"],
  link: ["Link", "링크"],
} as const;
for (const kind of CHIP_KINDS) {
  it.each(["resolved", "loading", "unresolved"] as const)(
    `localizes ${kind} %s without replacing the chip or changing its identity`,
    (state) => {
      setLanguage("en");
      const address = { kind, id: "a".repeat(64) };
      const onActivate = vi.fn();
      const label = "사용자 {name}";
      const qualifier = { text: "원문", accessibleLabel: "owner {role}" };
      render(
        <LanguageProviders>
          <InlineChip
            address={address}
            onActivate={onActivate}
            face={{
              label,
              loading: state === "loading",
              resolved: state === "resolved",
            }}
            qualifier={qualifier}
          />
        </LanguageProviders>,
      );
      const role = state === "resolved" ? "button" : "img";
      const chip = screen.getByRole(role);
      const [en, ko] = words[kind];
      const english =
        state === "resolved"
          ? `${en} ${label}, owner {role}`
          : state === "loading"
            ? `Resolving mention ${label}`
            : `Unresolved ${en.toLowerCase()}`;
      expect(chip).toHaveAccessibleName(english);
      if (state === "resolved") chip.focus();
      act(() => setLanguage("ko"));
      expect(screen.getByRole(role)).toBe(chip);
      expect(chip).toHaveAccessibleName(
        state === "resolved"
          ? `${ko} ${label}, owner {role}`
          : state === "loading"
            ? `멘션 확인 중: ${label}`
            : `확인되지 않은 ${ko}`,
      );
      expect(chip).toHaveTextContent(label);
      expect(chip).toHaveAttribute("data-kind", kind);
      expect(chip).toHaveAttribute("data-state", state);
      if (state === "resolved") {
        expect(chip).toHaveFocus();
        fireEvent.click(chip);
        expect(onActivate).toHaveBeenCalledExactlyOnceWith(address);
      } else expect(onActivate).not.toHaveBeenCalled();
      act(() => setLanguage("en"));
      expect(screen.getByRole(role)).toBe(chip);
      expect(chip).toHaveAccessibleName(english);
    },
  );
}

it.each([undefined, ""])(
  "keeps unqualified and explicitly empty qualifier phrases distinct (%s)",
  (qualifier) => {
    setLanguage("en");
    render(
      <LanguageProviders>
        <InlineChip
          address={{ kind: "person", id: "public-fixture" }}
          face={{ label: "Name {name}", loading: false, resolved: true }}
          {...(qualifier !== undefined
            ? { qualifier: { text: "", accessibleLabel: qualifier } }
            : {})}
        />
      </LanguageProviders>,
    );
    const chip = screen.getByRole("button");
    expect(chip).toHaveAttribute(
      "aria-label",
      `Person Name {name}${qualifier !== undefined ? ", " : ""}`,
    );
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button")).toBe(chip);
    expect(chip).toHaveAttribute(
      "aria-label",
      `사용자 Name {name}${qualifier !== undefined ? ", " : ""}`,
    );
  },
);
