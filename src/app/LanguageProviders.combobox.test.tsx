// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Combobox } from "../shared/design-system/ui/Combobox";
import { setLanguage } from "../shared/i18n";
import { LanguageProviders } from "./LanguageProviders";

beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("updates the open host search name without resetting its raw query, selection or option", async () => {
  const choice = { id: "raw/provider", name: "Search {name} 한글" };
  const changed = vi.fn(),
    searched = vi.fn();
  const user = userEvent.setup();
  render(
    <LanguageProviders>
      <Combobox.Root
        items={[choice]}
        itemToStringLabel={(item: typeof choice) => item.name}
        itemToStringValue={(item: typeof choice) => item.id}
        autoHighlight
        onValueChange={(value) => changed(value)}
        onInputValueChange={(value) => searched(value)}
      >
        <Combobox.Trigger label="Fixture provider">
          Choose a provider
        </Combobox.Trigger>
        <Combobox.Popup search empty="No choices">
          <Combobox.List>
            {(item: typeof choice) => (
              <Combobox.Item key={item.id} value={item}>
                {item.name}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
    </LanguageProviders>,
  );
  const trigger = screen.getByRole("combobox", { name: "Fixture provider" });
  await user.click(trigger);
  const input = await screen.findByRole("combobox", {
    name: "Search",
  });
  if (!(input instanceof HTMLInputElement))
    throw new Error("Missing actual search input");
  await user.type(input, "Search {{name}");
  expect(input).toHaveValue("Search {name}");
  input.setSelectionRange(3, 8);
  const popup = screen.getByRole("listbox");
  const option = screen.getByRole("option", { name: choice.name });
  const searches = searched.mock.calls.length;
  expect(input).toHaveFocus();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("combobox", {
        name: language === "ko" ? "검색" : "Search",
      }),
    ).toBe(input);
    expect(input).toHaveAttribute(
      "placeholder",
      language === "ko" ? "검색" : "Search",
    );
    expect(input).toHaveValue("Search {name}");
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
    expect(input).toHaveFocus();
    expect(screen.getByRole("listbox")).toBe(popup);
    expect(screen.getByRole("option", { name: choice.name })).toBe(option);
    expect(screen.getByRole("combobox", { name: "Fixture provider" })).toBe(
      trigger,
    );
    expect(searched).toHaveBeenCalledTimes(searches);
    expect(changed).not.toHaveBeenCalled();
  }
  await user.keyboard("{ArrowDown}{Enter}");
  expect(changed).toHaveBeenCalledExactlyOnceWith(choice);
  await expect.poll(() => document.activeElement).toBe(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("retains English search outside the product host while the product language is Korean", async () => {
  setLanguage("ko");
  const user = userEvent.setup();
  render(
    <Combobox.Root items={["Search 한글"]}>
      <Combobox.Trigger label="Standalone provider">
        Raw choice
      </Combobox.Trigger>
      <Combobox.Popup search empty="No choices">
        <Combobox.List>
          {(item: string) => (
            <Combobox.Item key={item} value={item}>
              {item}
            </Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Root>,
  );
  await user.click(
    screen.getByRole("combobox", { name: "Standalone provider" }),
  );
  const input = await screen.findByRole("combobox", {
    name: "Search",
  });
  expect(input).toHaveAttribute("placeholder", "Search");
  expect(screen.getByRole("option", { name: "Search 한글" })).toBeVisible();
  expect(screen.queryByRole("combobox", { name: "검색" })).toBeNull();
});
