// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import type { AudioSettingsState } from "../../features/huddle/audio-settings";
import { HuddleAudioSettings } from "./HuddleAudioSettings";

afterEach(() => {
  cleanup();
  setLanguage("en");
});
const state: AudioSettingsState = {
  inputs: [{ id: "mic/raw-한글", label: "Microphone" }],
  outputs: [{ id: "speaker/raw-한글", label: "Speakers" }],
  input: "mic/raw-한글",
  output: "speaker/raw-한글",
  outputSupported: true,
  loading: false,
  busy: false,
};
it("retains the real device choice popup, focus and raw device values through language changes", async () => {
  const user = userEvent.setup(),
    refresh = vi.fn(),
    select = vi.fn();
  const mounted = render(
    <HuddleAudioSettings state={state} refresh={refresh} select={select} />,
  );
  await user.click(screen.getByRole("button", { name: "Audio settings" }));
  const popup = screen.getByRole("dialog", { name: "Audio settings" });
  const microphone = screen.getByRole("combobox", { name: "Microphone" });
  await waitFor(() => expect(microphone).toHaveFocus());
  await user.keyboard("{ArrowDown}");
  const list = await screen.findByRole("listbox");
  const focused = document.activeElement;
  expect(screen.getByRole("option", { name: "Microphone" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  act(() => setLanguage("ko"));
  expect(screen.getByRole("dialog", { name: "오디오 설정" })).toBe(popup);
  expect(screen.getByRole("combobox", { name: "마이크" })).toBe(microphone);
  expect(microphone).toHaveTextContent("Microphone");
  expect(screen.getByRole("listbox")).toBe(list);
  expect(document.activeElement).toBe(focused);
  expect(screen.getByRole("option", { name: "Microphone" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("option", { name: "시스템 기본값" })).toBeVisible();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(select).not.toHaveBeenCalled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("combobox", { name: "Microphone" })).toBe(microphone);
  expect(screen.getByRole("listbox")).toBe(list);
  await user.click(screen.getByRole("option", { name: "System default" }));
  expect(select).toHaveBeenLastCalledWith("input", "");
  mounted.rerender(
    <HuddleAudioSettings
      state={{ ...state, input: "" }}
      refresh={refresh}
      select={select}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Microphone" })).toBe(microphone);
  await waitFor(() => expect(microphone).toHaveFocus());
  await user.keyboard("{ArrowDown}");
  await user.click(await screen.findByRole("option", { name: "Microphone" }));
  expect(select.mock.calls).toEqual([
    ["input", ""],
    ["input", "mic/raw-한글"],
  ]);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("keeps unavailable selection and opaque diagnostics literal while local busy/help text changes", async () => {
  const user = userEvent.setup(),
    refresh = vi.fn(),
    select = vi.fn();
  const current = {
    ...state,
    input: "missing/raw",
    outputSupported: false,
    busy: true,
    error: "Audio settings aren’t available for this call.",
  };
  const mounted = render(
    <HuddleAudioSettings state={current} refresh={refresh} select={select} />,
  );
  await user.click(screen.getByRole("button", { name: "Audio settings" }));
  const microphone = screen.getByRole("combobox", { name: "Microphone" });
  const alert = screen.getByRole("alert");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("combobox", { name: "마이크" })).toBe(microphone);
  expect(microphone).toHaveTextContent("사용할 수 없는 장치");
  expect(screen.getByRole("combobox", { name: "스피커" })).toBeDisabled();
  expect(
    screen.getByText("시스템에서 선택한 스피커를 사용합니다."),
  ).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("장치를 전환하는 중…");
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent(current.error);
  mounted.rerender(
    <HuddleAudioSettings
      state={{ ...current, busy: false }}
      refresh={refresh}
      select={select}
    />,
  );
  microphone.focus();
  await user.keyboard("{ArrowDown}");
  expect(
    await screen.findByRole("option", { name: "사용할 수 없는 장치" }),
  ).toHaveAttribute("aria-disabled", "true");
  expect(select).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("translates only the locally owned unavailable-call message", async () => {
  const user = userEvent.setup(),
    refresh = vi.fn(),
    select = vi.fn();
  render(
    <HuddleAudioSettings state={undefined} refresh={refresh} select={select} />,
  );
  await user.click(screen.getByRole("button", { name: "Audio settings" }));
  const status = screen.getByRole("status");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent(
    "이 통화에서는 오디오 설정을 사용할 수 없습니다.",
  );
  act(() => setLanguage("en"));
  expect(status).toHaveTextContent(
    "Audio settings aren’t available for this call.",
  );
  expect(select).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledTimes(1);
});
