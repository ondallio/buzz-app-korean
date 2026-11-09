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
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import { WorkflowDeletionNotices } from "./WorkflowDeletionNotices";
import { fixtureDefinition, fixtureChannel } from "./fixtures";
import type { WorkflowOperation } from "../../features/workflows/types";

afterEach(() => {
  cleanup();
  setLanguage("en");
});
it("retains the same deletion confirmation and raw name while dismissal is pending through EN KO EN", async () => {
  const definition = {
    ...fixtureDefinition,
    yaml: fixtureDefinition.yaml.replace(
      "Message helper",
      "Couldn't delete workflow {raw}",
    ),
  };
  const operation: WorkflowOperation = {
    action: "delete",
    workflow: definition,
    eventId: "raw-event",
    createdAt: 12,
    delivery: "unknown",
    outcome: "unknown",
    error: "Delivery details {raw}",
  };
  let finish = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const dismiss = vi.fn(() => gate);
  const check = vi.fn();
  render(
    <ToastProvider>
      <WorkflowDeletionNotices
        operations={[operation]}
        snapshots={{
          [fixtureChannel]: {
            status: "ready",
            data: { items: [definition], partial: false },
          },
        }}
        onDismiss={dismiss}
        onCheck={check}
      />
    </ToastProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Check saved configuration" }),
  );
  expect(check).toHaveBeenCalledExactlyOnceWith([fixtureChannel]);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notice" }));
  const dialog = screen.getByRole("alertdialog");
  const confirm = screen.getByRole("button", {
    name: "Dismiss notice and continue",
  });
  fireEvent.click(confirm);
  try {
    expect(confirm).toBeDisabled();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("alertdialog")).toBe(dialog);
    expect(screen.getByRole("button", { name: "알림을 닫는 중…" })).toBe(
      confirm,
    );
    expect(
      screen.getByText(
        "Couldn't delete workflow {raw} 삭제를 확인하지 못했습니다",
      ),
    ).toBeVisible();
    expect(screen.getByText("Delivery details {raw}")).toBeInTheDocument();
    fireEvent.click(confirm);
    expect(dismiss).toHaveBeenCalledExactlyOnceWith(operation);
    act(() => setLanguage("en"));
    expect(screen.getByRole("button", { name: "Dismissing…" })).toBe(confirm);
  } finally {
    await act(async () => {
      finish();
      await gate;
    });
  }
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("retries an owned dismissal failure in the same dialog and leaves an identical external error untranslated", async () => {
  const operation: WorkflowOperation = {
    action: "delete",
    workflow: fixtureDefinition,
    eventId: "raw",
    createdAt: 12,
    delivery: "unknown",
    outcome: "unknown",
  };
  const dismiss = vi
    .fn()
    .mockRejectedValueOnce(null)
    .mockRejectedValueOnce(
      new Error("Couldn't dismiss this notice. Try again."),
    );
  render(
    <ToastProvider>
      <WorkflowDeletionNotices
        operations={[operation]}
        snapshots={{
          [fixtureChannel]: {
            status: "ready",
            data: { items: [fixtureDefinition], partial: false },
          },
        }}
        onDismiss={dismiss}
        onCheck={() => {}}
      />
    </ToastProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Dismiss notice" }),
  );
  const dialog = screen.getByRole("alertdialog");
  fireEvent.click(
    screen.getByRole("button", { name: "Dismiss notice and continue" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn't dismiss this notice. Try again.",
  );
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alertdialog")).toBe(dialog);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "알림을 닫지 못했습니다. 다시 시도하세요.",
  );
  fireEvent.click(screen.getByRole("button", { name: "알림을 닫고 계속" }));
  expect(
    await screen.findByText("Couldn't dismiss this notice. Try again."),
  ).toBeVisible();
  expect(dismiss).toHaveBeenNthCalledWith(1, operation);
  expect(dismiss).toHaveBeenNthCalledWith(2, operation);
  act(() => setLanguage("en"));
  expect(screen.getByRole("alertdialog")).toBe(dialog);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Couldn't dismiss this notice. Try again.",
  );
});
