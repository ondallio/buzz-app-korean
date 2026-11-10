// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { StrictMode, useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import { PanelCard } from "./PanelCard";
import { PanelSubview } from "./PanelSubview";
import type { RegisteredPanel } from "./service";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
});

function Content() {
  const [detail, setDetail] = useState(false);
  return (
    <>
      <input aria-label="Raw draft" defaultValue="Keep {name} 한글" />
      <button type="button" onClick={() => setDetail(true)}>
        Raw detail
      </button>
      {detail && (
        <PanelSubview
          title="Raw HARNESS {Name} 한글"
          backLabel="Raw back"
          onBack={() => setDetail(false)}
        >
          <input aria-label="Raw filter" defaultValue="Filter {name} 한글" />
        </PanelSubview>
      )}
    </>
  );
}

function panel(title: string): RegisteredPanel {
  return {
    id: "raw",
    key: "fixture:raw",
    pluginId: "fixture",
    revision: "revision",
    title,
    matches: () => true,
    component: Content,
  };
}

it.each([
  ["GitHub", "Close GitHub panel", "GitHub 패널 닫기"],
  [
    "Raw TITLE {name} 한글",
    "Close Raw TITLE {name} 한글 panel",
    "Raw TITLE {name} 한글 패널 닫기",
  ],
  ["", "Close panel", "패널 닫기"],
])(
  "updates the card close name without replacing %s content or focus",
  async (title, english, korean) => {
    const user = userEvent.setup();
    const close = vi.fn();
    const { container } = render(
      <StrictMode>
        <PanelCard
          panel={panel(title)}
          target="fixture:raw/{name}"
          close={close}
        />
      </StrictMode>,
    );
    const card = container.querySelector("aside");
    const draft = screen.getByRole("textbox", { name: "Raw draft" });
    await user.type(draft, " edited");
    const button = screen.getByRole("button", { name: english });
    button.focus();
    for (const [language, expected] of [
      ["ko", korean],
      ["en", english],
      ["ko", korean],
    ] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("button", { name: expected.trim() })).toBe(
        button,
      );
      expect(button).toHaveFocus();
      expect(container.querySelector("aside")).toBe(card);
      expect(card).toHaveAttribute("aria-label", title);
      expect(screen.getByRole("textbox", { name: "Raw draft" })).toBe(draft);
      expect(draft).toHaveValue("Keep {name} 한글 edited");
      expect(close).not.toHaveBeenCalled();
    }
    await user.keyboard("{Shift>}{Escape}{/Shift}");
    expect(close).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(close).toHaveBeenCalledOnce();
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledTimes(2);
  },
);

it("keeps inline detail cover, draft, back focus and distinct whole-panel close", async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  render(
    <StrictMode>
      <PanelCard
        panel={panel("Raw owner")}
        target="fixture:raw/{name}"
        close={close}
      />
    </StrictMode>,
  );
  const draft = screen.getByRole("textbox", { name: "Raw draft" });
  const trigger = screen.getByRole("button", { name: "Raw detail" });
  await user.type(draft, " edited");
  await user.click(trigger);
  const region = screen.getByRole("region", {
    name: "Raw HARNESS {Name} 한글",
  });
  const back = screen.getByRole("button", { name: "Raw back" });
  expect(back).toHaveFocus();
  const filter = screen.getByRole("textbox", { name: "Raw filter" });
  await user.type(filter, " edited");
  const button = screen.getByRole("button", {
    name: "Close raw harness {name} 한글 panel",
  });
  button.focus();
  for (const [language, expected] of [
    ["ko", "raw harness {name} 한글 패널 닫기"],
    ["en", "Close raw harness {name} 한글 panel"],
    ["ko", "raw harness {name} 한글 패널 닫기"],
  ] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole("button", { name: expected })).toBe(button);
    expect(button).toHaveFocus();
    expect(
      screen.getByRole("region", {
        name: "Raw HARNESS {Name} 한글",
      }),
    ).toBe(region);
    expect(screen.getByRole("textbox", { name: "Raw filter" })).toBe(filter);
    expect(filter).toHaveValue("Filter {name} 한글 edited");
    expect(screen.queryByRole("textbox", { name: "Raw draft" })).toBeNull();
    expect(draft).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  }
  await user.keyboard("{Shift>}{Escape}{/Shift}");
  expect(region).toBeInTheDocument();
  await user.click(button);
  expect(close).toHaveBeenCalledOnce();
  await user.keyboard("{Escape}");
  expect(region).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(close).toHaveBeenCalledOnce();
  expect(screen.getByRole("textbox", { name: "Raw draft" })).toBe(draft);
  expect(draft).toHaveValue("Keep {name} 한글 edited");
});
