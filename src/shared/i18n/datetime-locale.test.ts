// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  formatDayGroupLabel,
  formatItemTimestamp,
  formatFullTimestamp,
  formatTime,
} from "../datetime";
import { setLanguage } from "./language";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

it("changes the format cache immediately while retaining the device time zone", () => {
  const now = new Date(2026, 6, 30, 14, 30).getTime() / 1000;
  const yesterday = new Date(2026, 6, 29, 9, 5).getTime() / 1000;
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  setLanguage("en");
  expect(formatDayGroupLabel(now, now)).toBe("Today");
  expect(
    formatItemTimestamp(yesterday, { withTime: true, nowSeconds: now }),
  ).toContain("Yesterday at ");
  setLanguage("ko");
  expect(formatDayGroupLabel(now, now)).toBe("오늘");
  expect(
    formatItemTimestamp(yesterday, { withTime: true, nowSeconds: now }),
  ).toBe(`어제 ${formatTime(yesterday)}`);
  const expected = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "long",
  }).format(yesterday * 1000);
  expect(formatFullTimestamp(yesterday)).toBe(expected);
  expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
  setLanguage("en");
  expect(formatDayGroupLabel(now, now)).toBe("Today");
});
