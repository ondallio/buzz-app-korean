// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { DeliveryNotice } from "./DeliveryNotice";
import { JumpToLatestButton } from "./JumpToLatestButton";
import { FileDropOverlay } from "./FileDropOverlay";
import type { ChannelMessage } from "../relay/contracts";
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});
const row: ChannelMessage = {
  id: "raw-id-{name}",
  channelId: "channel",
  authorId: "author",
  content: "Raw content 原文",
  createdAt: 1,
  mentions: [],
  attachments: [],
  reactions: [],
  participants: [],
  replyCount: 0,
  delivery: "unknown",
  deliveryError: "Delivery not yet confirmed. 原文 {error}",
};
it("updates delivery feedback and the same retry control while preserving raw diagnostics and message ID", async () => {
  setLanguage("en");
  const retry = vi.fn();
  render(<DeliveryNotice row={row} retry={retry} />);
  const button = screen.getByRole("button", { name: "Retry" });
  const status = screen.getByRole("status");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "다시 시도" })).toBe(button);
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent(
    "아직 전송이 확인되지 않았습니다. Delivery not yet confirmed. 原文 {error}",
  );
  await userEvent.hover(button);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(
    "아직 전송이 확인되지 않았습니다. Delivery not yet confirmed. 原文 {error}",
  );
  fireEvent.click(button);
  expect(retry).toHaveBeenCalledExactlyOnceWith("raw-id-{name}");
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Retry" })).toBe(button);
  expect(row.deliveryError).toBe("Delivery not yet confirmed. 原文 {error}");
});
it("formats jump counts without replacing its action or changing visibility and raw count", () => {
  setLanguage("en");
  const click = vi.fn();
  const view = render(
    <JumpToLatestButton visible newMessageCount={1234} onClick={click} />,
  );
  const button = screen.getByRole("button", { name: "1,234 new messages" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "새 메시지 1,234개" })).toBe(
    button,
  );
  fireEvent.click(button);
  expect(click).toHaveBeenCalledOnce();
  view.rerender(
    <JumpToLatestButton visible={false} newMessageCount={0} onClick={click} />,
  );
  expect(button).toHaveTextContent("최신 메시지로 이동");
  expect(button.closest("[data-visible]")).toHaveAttribute("inert");
  act(() => setLanguage("en"));
  expect(button).toHaveTextContent("Jump to latest");
});
it("keeps the same nearest-pane drop portal while changing its label", () => {
  setLanguage("en");
  const zone = document.createElement("section");
  zone.setAttribute("data-attachment-drop-zone", "");
  const form = document.createElement("form");
  zone.append(form);
  document.body.append(zone);
  const view = render(<FileDropOverlay composer={{ current: form }} />);
  const status = screen.getByRole("status");
  expect(status.parentElement).toBe(zone);
  expect(status).toHaveTextContent("Drop files into this conversation");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("이 대화에 파일을 놓으세요");
  act(() => setLanguage("en"));
  expect(status).toHaveTextContent("Drop files into this conversation");
  view.unmount();
  zone.remove();
});
