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
import { setLanguage } from "../../shared/i18n";
import { TeamCard } from "./AgentCard";
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});
it("localizes only the empty member fallback and keeps authored names and focused actions", () => {
  setLanguage("en");
  const open = vi.fn();
  render(
    <>
      <TeamCard name="Raw {team} 한글" members={[]} onClick={open} />
      <TeamCard
        name="Named team"
        members={[{ name: "No members" }, { name: "Raw {agent} 한글" }]}
      />
    </>,
  );
  const empty = screen.getByRole("button", {
    name: "Raw {team} 한글No members",
  });
  const named = screen.getByRole("button", {
    name: "Named teamNo members, Raw {agent} 한글",
  });
  empty.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "Raw {team} 한글멤버 없음" })).toBe(
    empty,
  );
  expect(empty).toHaveFocus();
  expect(
    screen.getByRole("button", {
      name: "Named teamNo members, Raw {agent} 한글",
    }),
  ).toBe(named);
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(empty);
  expect(open).toHaveBeenCalledOnce();
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("button", { name: "Raw {team} 한글No members" }),
  ).toBe(empty);
});
