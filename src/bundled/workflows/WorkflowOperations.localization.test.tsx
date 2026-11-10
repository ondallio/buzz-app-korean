// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import type {
  WorkflowDefinition,
  WorkflowDefinitions,
  WorkflowOperation,
  WorkflowView,
} from "../../features/workflows/types";
import { fixtureDefinition } from "./fixtures";
import { messages, WorkflowOperations } from "./WorkflowOperations";
import { deletionStatus } from "./editor-model";

type Snapshot = ReturnType<WorkflowView<WorkflowDefinitions>["snapshot"]>;
const operation: WorkflowOperation = {
  eventId: "event-{raw} 한글",
  workflow: fixtureDefinition,
  action: "save",
  createdAt: 1,
  outcome: "unknown",
  delivery: "accepted",
  runId: "run-{id}\n한글",
};
const ready: Snapshot = {
  status: "ready",
  data: { items: [fixtureDefinition], partial: false },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  setLanguage("en");
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});

it("keeps a held configuration read, operation identity, expanded details and open dismissal through live locale changes without repeating commands", async () => {
  const checking = deferred<void>(),
    dismissing = deferred<void>();
  const onCheckSaved = vi.fn(() => checking.promise);
  const onDismiss = vi.fn((_id: string) => dismissing.promise);
  const onReviewSaved = vi.fn<(_: WorkflowDefinition) => void>();
  const original = structuredClone(operation);
  try {
    render(
      <WorkflowOperations
        operations={[operation]}
        snapshot={ready}
        onCheckSaved={onCheckSaved}
        onReviewSaved={onReviewSaved}
        onDismiss={onDismiss}
      />,
    );
    const region = screen.getByRole("region", { name: "Workflow operations" });
    expect(within(region).getByRole("status")).toHaveTextContent(
      messages.save.unknown,
    );
    const summary = within(region).getByText("Delivery details", {
      selector: "summary",
    });
    fireEvent.click(summary);
    const details = summary.closest("details");
    expect(details).toHaveAttribute("open");
    const check = within(region).getByRole("button", {
      name: "Check saved configuration",
    });
    const review = within(region).getByRole("button", {
      name: "Review current configuration",
    });
    const dismiss = within(region).getByRole("button", {
      name: "Dismiss notice",
    });
    fireEvent.click(check);
    expect(onCheckSaved).toHaveBeenCalledExactlyOnceWith();
    expect(check).toBeDisabled();
    expect(review).toBeDisabled();
    expect(dismiss).toBeDisabled();
    summary.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("region", {
          name: language === "ko" ? "워크플로 작업" : "Workflow operations",
        }),
      ).toBe(region);
      expect(
        within(region).getByRole("button", {
          name:
            language === "ko"
              ? "저장된 구성 확인"
              : "Check saved configuration",
        }),
      ).toBe(check);
      expect(
        within(region).getByText(
          language === "ko" ? "전달 세부 정보" : "Delivery details",
          { selector: "summary" },
        ),
      ).toBe(summary);
      expect(summary).toHaveFocus();
      expect(details).toHaveAttribute("open");
      expect(onCheckSaved).toHaveBeenCalledTimes(1);
      expect(onReviewSaved).not.toHaveBeenCalled();
      expect(onDismiss).not.toHaveBeenCalled();
      expect(region.textContent).toContain(operation.eventId);
      expect(region.textContent).toContain(operation.runId);
      expect(operation).toEqual(original);
    }
    await act(async () => {
      checking.resolve();
      await checking.promise;
    });
    expect(check).toBeEnabled();
    fireEvent.click(review);
    expect(onReviewSaved).toHaveBeenCalledExactlyOnceWith(fixtureDefinition);
    fireEvent.click(dismiss);
    const dialog = await screen.findByRole("alertdialog", {
      name: "Dismiss this notice?",
    });
    const confirm = within(dialog).getByRole("button", {
      name: "Dismiss notice and continue",
    });
    const cancel = within(dialog).getByRole("button", { name: "Keep editing" });
    await waitFor(() => expect(confirm).toHaveFocus());
    act(() => setLanguage("ko"));
    expect(
      screen.getByRole("alertdialog", { name: "이 알림을 닫을까요?" }),
    ).toBe(dialog);
    expect(
      within(dialog).getByRole("button", { name: "알림을 닫고 계속" }),
    ).toBe(confirm);
    expect(within(dialog).getByRole("button", { name: "계속 편집" })).toBe(
      cancel,
    );
    expect(confirm).toHaveFocus();
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(confirm);
    expect(onDismiss).toHaveBeenCalledExactlyOnceWith(operation.eventId);
    expect(confirm).toBeDisabled();
    expect(cancel).toBeDisabled();
    act(() => setLanguage("en"));
    expect(
      screen.getByRole("alertdialog", { name: "Dismiss this notice?" }),
    ).toBe(dialog);
    expect(within(dialog).getByRole("button", { name: "Dismissing…" })).toBe(
      confirm,
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCheckSaved).toHaveBeenCalledTimes(1);
    expect(onReviewSaved).toHaveBeenCalledTimes(1);
    await act(async () => {
      dismissing.resolve();
      await dismissing.promise;
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Workflow operations" })).toBe(
      region,
    );
    expect(operation).toEqual(original);
    expect(details).toHaveAttribute("open");
  } finally {
    await act(async () => {
      checking.resolve();
      dismissing.resolve();
      await Promise.all([checking.promise, dismissing.promise]);
    });
  }
});

const statuses = [
  {
    action: "save",
    outcome: "pending",
    delivery: "sending",
    text: "구성 저장 중…",
    summary: "저장: 대기 중 · 전달 상태: 전송 중",
  },
  {
    action: "save",
    outcome: "succeeded",
    delivery: "accepted",
    text: "구성을 저장했습니다.",
    summary: "저장: 성공 · 전달 상태: 수락됨",
  },
  {
    action: "save",
    outcome: "rejected",
    delivery: "failed",
    text: "구성을 저장하지 못했습니다.",
    summary: "저장: 거부됨 · 전달 상태: 실패",
  },
  {
    action: "save",
    outcome: "unknown",
    delivery: "unknown",
    text: "저장 응답을 받지 못했습니다. 다시 시도하기 전에 저장된 구성을 확인해 주세요.",
    summary: "저장: 확인되지 않음 · 전달 상태: 확인되지 않음",
  },
  {
    action: "trigger",
    outcome: "pending",
    delivery: "sending",
    text: "실행 요청 중…",
    summary: "실행 요청: 대기 중 · 전달 상태: 전송 중",
  },
  {
    action: "trigger",
    outcome: "succeeded",
    delivery: "seen",
    text: "실행을 요청했습니다. 실행 기록에서 결과를 확인해 주세요.",
    summary: "실행 요청: 성공 · 전달 상태: 이벤트 확인됨",
  },
  {
    action: "trigger",
    outcome: "rejected",
    delivery: "failed",
    text: "워크플로 실행을 요청하지 못했습니다",
    summary: "실행 요청: 거부됨 · 전달 상태: 실패",
  },
  {
    action: "trigger",
    outcome: "unknown",
    delivery: "unknown",
    text: "실행이 시작됐을 수 있지만 응답을 받지 못했습니다. 구성을 확인하거나 이 알림을 닫아도 실행 여부는 확인되지 않습니다.",
    summary: "실행 요청: 확인되지 않음 · 전달 상태: 확인되지 않음",
  },
] as const;
it.each(statuses)(
  "localizes $action/$outcome while keeping $delivery data, raw IDs and callbacks",
  ({ action, outcome, delivery, text, summary }) => {
    const op: WorkflowOperation = { ...operation, action, outcome, delivery };
    const before = structuredClone(op);
    const check = vi.fn(async () => {}),
      dismiss = vi.fn(async (_id: string) => {}),
      review = vi.fn();
    render(
      <WorkflowOperations
        operations={[op]}
        snapshot={ready}
        onCheckSaved={check}
        onReviewSaved={review}
        onDismiss={dismiss}
      />,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(messages[action][outcome]);
    const details = screen
      .getByText("Delivery details", { selector: "summary" })
      .closest("details");
    expect(details).toHaveTextContent(
      `${action}: ${outcome} · delivery ${delivery}`,
    );
    act(() => setLanguage("ko"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe(text);
    expect(details).toHaveTextContent(summary);
    expect(
      screen.getByText(`이벤트 ID: ${op.eventId}`, { selector: "p" })
        .textContent,
    ).toBe(`이벤트 ID: ${op.eventId}`);
    expect(details?.textContent).toContain(`반환된 실행 ID: ${op.runId}`);
    act(() => setLanguage("en"));
    expect(status.textContent).toBe(messages[action][outcome]);
    expect(op).toEqual(before);
    expect(check).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
    expect(review).not.toHaveBeenCalled();
  },
);

const deletions: {
  name: string;
  outcome: WorkflowOperation["outcome"];
  snapshot: Snapshot;
  text: string;
  check: boolean;
}[] = [
  {
    name: "pending",
    outcome: "pending",
    snapshot: ready,
    text: "삭제하는 중…",
    check: false,
  },
  {
    name: "rejected",
    outcome: "rejected",
    snapshot: ready,
    text: "이 워크플로를 삭제하지 못했습니다. 전달 세부 정보를 확인해 주세요.",
    check: false,
  },
  {
    name: "confirmed",
    outcome: "succeeded",
    snapshot: { status: "ready", data: { items: [], partial: false } },
    text: "저장된 워크플로가 삭제되었습니다. 이미 실행 중인 작업은 계속될 수 있습니다.",
    check: false,
  },
  {
    name: "loading",
    outcome: "succeeded",
    snapshot: { status: "loading", data: { items: [], partial: false } },
    text: "삭제를 확인하는 중…",
    check: true,
  },
  {
    name: "still saved",
    outcome: "succeeded",
    snapshot: ready,
    text: "이 워크플로가 아직 저장된 구성에 있습니다. 삭제하기 전에 다시 확인해 주세요.",
    check: true,
  },
  {
    name: "unknown receipt",
    outcome: "unknown",
    snapshot: { status: "ready", data: { items: [], partial: false } },
    text: "삭제 여부를 확인하지 못했습니다. 다시 삭제하기 전에 저장된 구성을 확인해 주세요.",
    check: true,
  },
  {
    name: "partial",
    outcome: "succeeded",
    snapshot: { status: "ready", data: { items: [], partial: true } },
    text: "삭제 여부를 확인하지 못했습니다. 다시 삭제하기 전에 저장된 구성을 확인해 주세요.",
    check: true,
  },
  {
    name: "read error",
    outcome: "succeeded",
    snapshot: { status: "error", data: { items: [], partial: false } },
    text: "삭제 여부를 확인하지 못했습니다. 다시 삭제하기 전에 저장된 구성을 확인해 주세요.",
    check: true,
  },
];
it.each(deletions)(
  "projects only canonical deletionStatus for $name without changing the read/review guard",
  ({ outcome, snapshot, text, check }) => {
    const op: WorkflowOperation = {
      ...operation,
      action: "delete",
      outcome,
      error:
        "Couldn't confirm deletion. Check saved configuration before deleting again.",
    };
    const onCheckSaved = vi.fn(async () => {}),
      onDismiss = vi.fn(async (_id: string) => {});
    render(
      <WorkflowOperations
        operations={[op]}
        snapshot={snapshot}
        onCheckSaved={onCheckSaved}
        onReviewSaved={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(deletionStatus(op, snapshot));
    const read = screen.queryByRole("button", {
      name: "Check saved configuration",
    });
    expect(!!read).toBe(check);
    act(() => setLanguage("ko"));
    expect(status.textContent).toBe(text);
    expect(screen.getByText(op.error ?? "")).toHaveTextContent(op.error ?? "");
    expect(!!screen.queryByRole("button", { name: "저장된 구성 확인" })).toBe(
      check,
    );
    if (read && snapshot.status === "loading") expect(read).toBeDisabled();
    act(() => setLanguage("en"));
    expect(status.textContent).toBe(deletionStatus(op, snapshot));
    expect(onCheckSaved).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  },
);

it.each([
  "The request could not be completed. Try again.",
  "Raw {message} 한글",
  "",
])(
  "preserves a real Error message %j and its original empty truthiness",
  async (text) => {
    const error = new Error(text);
    const check = vi.fn(async () => {
      throw error;
    });
    render(
      <WorkflowOperations
        operations={[operation]}
        snapshot={ready}
        onCheckSaved={check}
        onReviewSaved={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Check saved configuration",
    });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(check).toHaveBeenCalledExactlyOnceWith();
    const alert = screen.queryByRole("alert");
    expect(alert?.textContent ?? "").toBe(text);
    expect(!!alert).toBe(!!text);
    act(() => setLanguage("ko"));
    expect(screen.queryByRole("alert")).toBe(alert);
    expect(alert?.textContent ?? "").toBe(text);
    expect(check).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "알림 닫기" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "이 알림을 닫을까요?",
    });
    expect(within(dialog).queryByRole("alert")?.textContent ?? "").toBe(text);
    expect(!!within(dialog).queryByRole("alert")).toBe(!!text);
    fireEvent.click(within(dialog).getByRole("button", { name: "계속 편집" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")?.textContent ?? "").toBe(text);
  },
);

it.each(["untyped {reason}", ""])(
  "retains the original finite fallback for non-Error %j across locale and explicit retry",
  async (cause) => {
    const check = vi
      .fn()
      .mockRejectedValueOnce(cause)
      .mockResolvedValueOnce(undefined);
    render(
      <WorkflowOperations
        operations={[operation]}
        snapshot={ready}
        onCheckSaved={check}
        onReviewSaved={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Check saved configuration" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "The request could not be completed. Try again.",
    );
    act(() => setLanguage("ko"));
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert.textContent).toBe(
      "요청을 완료하지 못했습니다. 다시 시도해 주세요.",
    );
    expect(check).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "저장된 구성 확인" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(check.mock.calls).toEqual([[], []]);
  },
);

it.each(["", "The relay did not create a workflow run.", "Raw provider {why}"])(
  "preserves opaque trigger reason %j and only translates the original falsy fallback",
  (error) => {
    const op: WorkflowOperation = {
      ...operation,
      action: "trigger",
      outcome: "rejected",
      error,
    };
    render(
      <WorkflowOperations
        operations={[op]}
        snapshot={ready}
        onCheckSaved={vi.fn()}
        onReviewSaved={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      screen.getByText(error || "The relay did not create a workflow run."),
    ).toBeInTheDocument();
    act(() => setLanguage("ko"));
    expect(
      screen.getByText(
        error || "릴레이가 워크플로 실행을 생성하지 않았습니다.",
      ),
    ).toBeInTheDocument();
    expect(op.error).toBe(error);
  },
);

it("keeps canonical English messages and the empty-operation render contract in Korean", () => {
  const original = structuredClone(messages);
  act(() => setLanguage("ko"));
  const view = render(
    <WorkflowOperations
      operations={[]}
      snapshot={ready}
      onCheckSaved={vi.fn()}
      onReviewSaved={vi.fn()}
      onDismiss={vi.fn()}
    />,
  );
  expect(view.container).toBeEmptyDOMElement();
  expect(messages).toEqual(original);
  expect(messages.save.pending).toBe("Saving configuration…");
  expect(messages.trigger.succeeded).toBe(
    "Run requested. Inspect run history for its result.",
  );
});
