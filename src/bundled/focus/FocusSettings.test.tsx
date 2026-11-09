// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { FocusSettings } from "./FocusSettings";
import { createPreferences, FOCUS_PREFERENCES_KEY } from "./preferences";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  setLanguage("en");
});

it("keeps the open duration choice, focus and stored seconds across languages", async () => {
  setLanguage("en");
  const user = userEvent.setup();
  const preferences = createPreferences();
  const set = vi.spyOn(preferences, "set");
  const view = render(
    <FocusSettings preferences={preferences} active={() => true} />,
  );
  try {
    const trigger = screen.getByRole("combobox", { name: "Default length" });
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "2 hours" }));
    expect(preferences.snapshot()).toEqual({ length: "7200" });
    expect(
      JSON.parse(localStorage.getItem(FOCUS_PREFERENCES_KEY) ?? "null"),
    ).toEqual({ length: "7200" });
    await user.click(trigger);
    const listbox = await screen.findByRole("listbox");
    const selected = screen.getByRole("option", { name: "2 hours" });
    await waitFor(() => expect(selected).toHaveFocus());
    act(() => setLanguage("ko"));
    expect(screen.getByRole("combobox", { name: "기본 시간" })).toBe(trigger);
    expect(screen.getByRole("listbox")).toBe(listbox);
    expect(screen.getByRole("option", { name: "2시간" })).toBe(selected);
    expect(selected).toHaveFocus();
    expect(preferences.snapshot()).toEqual({ length: "7200" });
    expect(set).toHaveBeenCalledExactlyOnceWith({ length: "7200" });
    act(() => setLanguage("en"));
    expect(screen.getByRole("combobox", { name: "Default length" })).toBe(
      trigger,
    );
    expect(screen.getByRole("option", { name: "2 hours" })).toBe(selected);
    expect(selected).toHaveFocus();
    expect(set).toHaveBeenCalledOnce();
  } finally {
    view.unmount();
    preferences.dispose();
  }
});

it("retranslates retained save failure without persisting on a language change", async () => {
  setLanguage("en");
  const realSet = Storage.prototype.setItem;
  const persist = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, key, value) {
      if (key === FOCUS_PREFERENCES_KEY)
        throw new Error("fixture storage full");
      return realSet.call(this, key, value);
    });
  const preferences = createPreferences();
  const view = render(
    <FocusSettings preferences={preferences} active={() => true} />,
  );
  try {
    act(() => preferences.set({ length: "7200" }));
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent(
      "Focus settings could not be saved on this device.",
    );
    const attempts = () =>
      persist.mock.calls.filter(([key]) => key === FOCUS_PREFERENCES_KEY)
        .length;
    expect(attempts()).toBe(1);
    act(() => setLanguage("ko"));
    expect(screen.getByRole("alert")).toBe(error);
    expect(error).toHaveTextContent(
      "이 기기에 집중 모드 설정을 저장하지 못했습니다.",
    );
    expect(preferences.error()).toBe(
      "Focus settings could not be saved on this device.",
    );
    expect(preferences.snapshot()).toEqual({ length: "7200" });
    expect(attempts()).toBe(1);
    act(() => setLanguage("en"));
    expect(error).toHaveTextContent(
      "Focus settings could not be saved on this device.",
    );
    expect(attempts()).toBe(1);
  } finally {
    view.unmount();
    preferences.dispose();
  }
});
