// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { channelDurationLabel } from "./ChannelDurationField";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ChannelDurationField } from "./ChannelDurationField";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

it("retains its animated duration node and raw lifetime choices while complete descriptions switch language", async () => {
  function Host() {
    const [seconds, setSeconds] = useState<number | undefined>(86400);
    return (
      <ChannelDurationField
        temporary={seconds !== undefined}
        ttlSeconds={seconds ?? 86400}
        onChange={setSeconds}
      />
    );
  }
  const view = render(<Host />);
  const temporary = screen.getByRole("radio", { name: /Temporary/ });
  const strong = view.container.querySelector("strong");
  const animated = strong?.parentElement;
  const visual = strong?.closest('span[aria-hidden="true"]');
  if (!strong || !animated || !visual)
    throw new Error("Expected original animated duration");
  expect(visual).toHaveTextContent("Archives after 1 day without activity.");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("radio", { name: /임시/ })).toBe(temporary);
  expect(temporary).toHaveAccessibleDescription(
    "활동이 없으면 1일 후 보관됩니다.",
  );
  expect(visual).toHaveTextContent("활동이 없으면 1일 후 보관됩니다.");
  expect(strong.parentElement).toBe(animated);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "기간 늘리기" }));
  expect(temporary).toHaveAccessibleDescription(
    "활동이 없으면 7일 후 보관됩니다.",
  );
  await userEvent
    .setup()
    .click(screen.getByRole("radio", { name: /계속 유지/ }));
  expect(temporary).not.toBeChecked();
  expect(temporary).toHaveAccessibleDescription("활동이 없으면 보관됩니다.");
  expect(strong.parentElement).toBe(animated);
  act(() => setLanguage("en"));
  expect(screen.getByRole("radio", { name: /Temporary/ })).toBe(temporary);
  expect(temporary).toHaveAccessibleDescription("Archives without activity.");
});

it.each([
  [1, "1 second", "1초"],
  [90, "90 seconds", "90초"],
  [60, "1 minute", "1분"],
  [3600, "1 hour", "1시간"],
  [86400, "1 day", "1일"],
  [604800, "7 days", "7일"],
  [1209600, "2 weeks", "2주"],
  [1728000, "20 days", "20일"],
] as const)(
  "keeps canonical lifetime %s unchanged and preserves its original English formatting",
  (seconds, english, korean) => {
    setLanguage("en");
    expect(channelDurationLabel(seconds)).toBe(english);
    setLanguage("ko");
    expect(channelDurationLabel(seconds)).toBe(korean);
    setLanguage("en");
    expect(channelDurationLabel(seconds)).toBe(english);
  },
);
