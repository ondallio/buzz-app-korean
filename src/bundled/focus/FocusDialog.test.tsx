// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { FocusDialog } from "./FocusDialog";
import { createPreferences } from "./preferences";
import { createFocus, FOCUS_KEY } from "./state";
import { setLanguage } from "../../shared/i18n";
import { setClockPreference } from "../../shared/clock-preference";
import { FocusBanner, focusUntilLabel } from "./FocusDialog";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  setLanguage("en");
  setClockPreference({ hourCycle: "system", seconds: false });
});

it("keeps start validation canonical while translating only the owned error", async () => {
  setLanguage("en");
  const user = userEvent.setup();
  const focus = createFocus();
  const start = vi.spyOn(focus, "start");
  const close = vi.fn();
  const preferences = createPreferences();
  const view = render(
    <FocusDialog
      open
      onOpenChange={close}
      focus={focus}
      preferences={preferences}
    />,
  );
  try {
    await user.click(screen.getByRole("button", { name: "Duration: 1 hour" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Custom" }),
    );
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 86_400_000);
    await user.click(screen.getByRole("button", { name: "Start focus" }));
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Choose a time in the future.");
    expect(start).toHaveBeenCalledOnce();
    expect(focus.snapshot().until).toBeUndefined();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("alert")).toBe(error);
    expect(error).toHaveTextContent("미래 시각을 선택하세요.");
    expect(start).toHaveBeenCalledOnce();
    start.mockImplementationOnce(() => {
      throw new Error("Choose a time in the future.");
    });
    await user.click(screen.getByRole("button", { name: "집중 모드 시작" }));
    expect(error).toHaveTextContent("Choose a time in the future.");
    expect(start).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    focus.dispose();
    preferences.dispose();
  }
});

it("formats Focus's local until boundary with the chosen clock and no new start", () => {
  setLanguage("en");
  setClockPreference({ hourCycle: "h23" });
  const now = new Date(2027, 2, 13, 12);
  vi.spyOn(Date, "now").mockReturnValue(now.getTime());
  const until = new Date(2027, 2, 14, 16, 30).getTime() / 1000;
  expect(focusUntilLabel(until, now)).toBe("Sun 16:30");
  const focus = createFocus();
  focus.start(until);
  const start = vi.spyOn(focus, "start");
  const view = render(<FocusBanner focus={focus} />);
  try {
    act(() => setLanguage("ko"));
    expect(focusUntilLabel(until, now)).toBe("일 16:30");
    expect(screen.getByText(/까지 집중 모드$/)).toBeVisible();
    expect(start).not.toHaveBeenCalled();
    expect(focus.snapshot().until).toBe(until);
    act(() => setClockPreference({ hourCycle: "h12" }));
    expect(focusUntilLabel(until, now)).toBe("일 오후 4:30");
  } finally {
    view.unmount();
    focus.dispose();
  }
});

it("translates the owned device save failure without restarting Focus", async () => {
  setLanguage("en");
  const realSet = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    if (key === FOCUS_KEY) throw new Error("fixture storage full");
    return realSet.call(this, key, value);
  });
  const focus = createFocus();
  const start = vi.spyOn(focus, "start");
  const preferences = createPreferences();
  const close = vi.fn();
  const view = render(
    <FocusDialog
      open
      onOpenChange={close}
      focus={focus}
      preferences={preferences}
    />,
  );
  try {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start focus" }));
    const error = screen.getByRole("alert");
    const until = focus.snapshot().until;
    expect(until).toBeGreaterThan(Date.now() / 1000);
    expect(error).toHaveTextContent("Focus could not be saved on this device.");
    act(() => setLanguage("ko"));
    expect(screen.getByRole("alert")).toBe(error);
    expect(error).toHaveTextContent(
      "이 기기에 집중 모드를 저장하지 못했습니다.",
    );
    expect(focus.snapshot().error).toBe(
      "Focus could not be saved on this device.",
    );
    expect(focus.snapshot().until).toBe(until);
    expect(start).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  } finally {
    view.unmount();
    focus.dispose();
    preferences.dispose();
  }
});

it("starts Focus for the chosen duration and offers End while it is on", async () => {
  const user = userEvent.setup();
  const focus = createFocus();
  const onOpenChange = vi.fn();
  const dialog = (
    <FocusDialog
      open
      onOpenChange={onOpenChange}
      focus={focus}
      preferences={createPreferences()}
    />
  );
  const view = render(dialog);
  await user.click(screen.getByRole("button", { name: "Duration: 1 hour" }));
  await user.click(
    await screen.findByRole("menuitemradio", { name: "30 minutes" }),
  );
  // Hold the clock so the deadline is exact.
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now);
  await user.click(screen.getByRole("button", { name: "Start focus" }));
  expect(focus.snapshot().until).toBe(Math.floor(now / 1000) + 1800);
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  view.rerender(dialog);
  expect(screen.getByText(/^Focusing until/)).toHaveTextContent(
    /^Focusing until \S+/,
  );
  expect(screen.queryByText(/Only Solo chats show/)).toBeNull();
  await user.click(screen.getByRole("button", { name: "End focus" }));
  expect(focus.snapshot().until).toBeUndefined();
  focus.dispose();
});

it("rejects a custom end time that has already passed", async () => {
  const user = userEvent.setup();
  const focus = createFocus();
  render(
    <FocusDialog
      open
      onOpenChange={() => {}}
      focus={focus}
      preferences={createPreferences()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Duration: 1 hour" }));
  await user.click(
    await screen.findByRole("menuitemradio", { name: "Custom" }),
  );
  expect(screen.getByRole("button", { name: "Focus end time" })).toBeVisible();
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 86_400_000);
  await user.click(screen.getByRole("button", { name: "Start focus" }));
  expect(screen.getByRole("alert")).toHaveTextContent("future");
  expect(focus.snapshot().until).toBeUndefined();
  focus.dispose();
});

it("starts from the length in Settings without changing it", async () => {
  const user = userEvent.setup();
  const preferences = createPreferences();
  preferences.set({ length: "7200" });
  const focus = createFocus();
  render(
    <FocusDialog
      open
      onOpenChange={() => {}}
      focus={focus}
      preferences={preferences}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Duration: 2 hours" }));
  await user.click(
    await screen.findByRole("menuitemradio", { name: "30 minutes" }),
  );
  await user.click(screen.getByRole("button", { name: "Start focus" }));
  expect(preferences.snapshot().length).toBe("7200");
  focus.dispose();
});
