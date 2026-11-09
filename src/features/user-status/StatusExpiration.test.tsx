// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { setClockPreference } from "../../shared/clock-preference";
import { StatusExpiration } from "./StatusExpiration";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setLanguage("en");
  setClockPreference({ hourCycle: "system", seconds: false });
});

it.each(["Status expiration", "{label} 한글", ""])(
  "preserves the supplied label %s without interpreting it as app copy",
  (label) => {
    setLanguage("ko");
    render(
      <StatusExpiration
        label={label}
        value={new Date(2027, 2, 14, 12)}
        onChange={() => {}}
        disabled={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: `${label} 날짜`.trim() }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: `${label} 시각`.trim() }),
    ).toBeVisible();
  },
);

it("keeps all wall-clock slots on a DST transition and preserves real local selection", async () => {
  setLanguage("en");
  setClockPreference({ hourCycle: "h23" });
  const date = new Date(2027, 2, 14, 1, 30);
  const change = vi.fn();
  function Editor() {
    const [value, setValue] = useState(date);
    return (
      <StatusExpiration
        value={value}
        disabled={false}
        onChange={(next) => {
          change(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Editor />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", {
    name: "Status expiration time",
  });
  await user.click(trigger);
  const slots = await screen.findAllByRole("menuitemradio");
  expect(slots).toHaveLength(48);
  expect(slots.map((slot) => slot.textContent)).toEqual(
    Array.from(
      { length: 48 },
      (_, n) =>
        `${String(Math.floor(n / 2)).padStart(2, "0")}:${n % 2 ? "30" : "00"}`,
    ),
  );
  const selected = screen.getByRole("menuitemradio", { name: "01:30" });
  await selected.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "상태 만료 시각" })).toBe(trigger);
  expect(screen.getByRole("menuitemradio", { name: "01:30" })).toBe(selected);
  expect(selected).toHaveFocus();
  expect(screen.getAllByRole("menuitemradio")).toHaveLength(48);
  act(() => setClockPreference({ hourCycle: "h12" }));
  expect(screen.getByRole("menuitemradio", { name: "오전 2:30" })).toBe(
    slots[5],
  );
  expect(screen.getByRole("menuitemradio", { name: "오후 11:30" })).toBe(
    slots[47],
  );
  await user.click(screen.getByRole("menuitemradio", { name: "오전 2:30" }));
  const expected = new Date(date);
  expected.setHours(2, 30, 0, 0);
  expect(change).toHaveBeenCalledExactlyOnceWith(expected);
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Status expiration time" })).toBe(
    trigger,
  );
  expect(change).toHaveBeenCalledOnce();
});

it("localizes the real calendar labels and retains its selected date and keyboard focus", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2027, 2, 13, 12));
  setLanguage("en");
  const value = new Date(2027, 2, 14, 16, 25, 17);
  const change = vi.fn();
  render(<StatusExpiration value={value} onChange={change} disabled={false} />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", {
    name: "Status expiration date",
  });
  await user.click(trigger);
  const selected = screen.getByRole("button", {
    name: "Sunday, March 14th, 2027, selected",
  });
  await waitFor(() => expect(selected).toHaveFocus());
  const grid = screen.getByRole("grid");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "상태 만료 날짜" })).toBe(trigger);
  expect(screen.getByRole("grid")).toBe(grid);
  expect(
    screen.getByRole("button", { name: "2027년 3월 14일 일요일, 선택됨" }),
  ).toBe(selected);
  expect(selected).toHaveFocus();
  expect(screen.getByRole("button", { name: "다음 달로 이동" })).toBeVisible();
  expect(screen.getByRole("button", { name: "이전 달로 이동" })).toBeVisible();
  await user.keyboard("{ArrowRight}{Enter}");
  const expected = new Date(2027, 2, 15, 16, 25, 17);
  expect(change).toHaveBeenCalledExactlyOnceWith(expected);
  await waitFor(() => expect(trigger).toHaveFocus());
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Status expiration date" })).toBe(
    trigger,
  );
});
