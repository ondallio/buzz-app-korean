// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SearchField } from "./SearchField";

afterEach(cleanup);

it("accepts a whole localized clear name without changing focus or payload", () => {
  const change = vi.fn();
  render(
    <SearchField
      label="검색"
      clearLabel="검색어 지우기"
      value="사용자 query"
      onValueChange={change}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("");
  expect(screen.getByRole("searchbox", { name: "검색" })).toHaveFocus();
});

it("preserves the existing default English name for existing consumers", () => {
  render(
    <SearchField
      label="Search Projects"
      value="query"
      onValueChange={() => {}}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Clear search projects" }),
  ).toBeVisible();
});
