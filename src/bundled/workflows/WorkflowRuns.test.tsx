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
import { setLanguage } from "../../shared/i18n/language";
import { WorkflowRuns } from "./WorkflowRuns";
import {
  createWorkflowFixture,
  fixtureDefinition,
  fixtureCursor,
  fixtureRun,
  fixtureView,
} from "./fixtures";

afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.restoreAllMocks();
});
it("keeps loaded runs visible without a refresh banner and retains failures", async () => {
  const fixture = createWorkflowFixture();
  const data = { runs: [fixtureRun], next: null };
  const runs = fixtureView(data);
  render(
    <WorkflowRuns
      capability={{ ...fixture.capability, runs: () => runs.view }}
      workflow={fixtureDefinition}
    />,
  );
  await screen.findByText("completed");
  act(() => runs.update({ status: "loading", data }));
  expect(screen.getByText("completed")).toBeVisible();
  expect(screen.queryByText("Reading runs…")).toBeNull();
  expect(screen.getByRole("button", { name: "Refresh runs" })).toBeDisabled();
  act(() => runs.update({ status: "error", error: "Read failed", data }));
  expect(screen.getByRole("alert")).toHaveTextContent("Read failed");
  expect(screen.getByRole("button", { name: "Refresh runs" })).toBeEnabled();
});

it("keeps the same run, trace and pending refresh across EN KO EN without reallocating host interest", async () => {
  const fixture = createWorkflowFixture();
  const data = {
    runs: [
      { ...fixtureRun, errorCode: "RAW_CODE", errorMessage: "Reading runs…" },
    ],
    next: null,
  };
  const runs = fixtureView(data);
  const allocate = vi.fn(() => runs.view);
  render(
    <WorkflowRuns
      capability={{ ...fixture.capability, runs: allocate }}
      workflow={fixtureDefinition}
    />,
  );
  const refresh = await screen.findByRole("button", { name: "Refresh runs" });
  const article = screen.getByText("completed").closest("article");
  const time = article?.querySelector("time");
  const trace = article?.querySelector("pre");
  const dateTime = time?.getAttribute("datetime");
  const calls = allocate.mock.calls.length;
  let finish = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const originalRefresh = runs.view.refresh;
  runs.view.refresh = async () => {
    runs.update({ status: "loading", data });
    await gate;
    runs.update({ status: "ready", data });
  };
  refresh.focus();
  fireEvent.click(refresh);
  try {
    expect(refresh).toBeDisabled();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button", { name: "실행 기록 새로 고침" })).toBe(
      refresh,
    );
    expect(screen.getByText("완료").closest("article")).toBe(article);
    expect(article?.querySelector("time")).toBe(time);
    expect(time).toHaveAttribute("datetime", dateTime);
    expect(article?.querySelector("pre")).toBe(trace);
    expect(trace?.textContent).toBe(JSON.stringify(fixtureRun.trace, null, 2));
    expect(article).toHaveTextContent("RAW_CODE: Reading runs…");
    expect(allocate).toHaveBeenCalledTimes(calls);
    act(() => setLanguage("en"));
    expect(screen.getByRole("button", { name: "Refresh runs" })).toBe(refresh);
    expect(refresh).toBeDisabled();
  } finally {
    await act(async () => {
      finish();
      await gate;
    });
    runs.view.refresh = originalRefresh;
  }
  expect(refresh).toBeEnabled();
  expect(screen.getByText("completed").closest("article")).toBe(article);
});

it("keeps the exact fractional cursor and raw run identity when paging in Korean", async () => {
  const fixture = createWorkflowFixture();
  render(
    <WorkflowRuns
      capability={fixture.capability}
      workflow={fixtureDefinition}
    />,
  );
  await screen.findByText("completed");
  act(() => setLanguage("ko"));
  fireEvent.click(screen.getByRole("button", { name: "이전 실행 기록" }));
  expect(
    await screen.findByText("이 페이지에 반환된 실행 기록이 없습니다."),
  ).toBeVisible();
  expect(fixture.runCursor()).toEqual(fixtureCursor);
  expect(fixture.runCursor()?.before).toBe("2026-09-12T12:00:00.123456Z");
  const newest = screen.getByRole("button", { name: "최신 실행 기록" });
  newest.focus();
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Newest runs" })).toBe(newest);
  expect(newest).toHaveFocus();
  fireEvent.click(newest);
  expect(await screen.findByText("completed")).toBeVisible();
  expect(fixture.runCursor()).toBeUndefined();
});
