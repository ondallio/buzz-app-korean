// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { setLanguage } from "../../shared/i18n";
import { stubAvatarBrowserApis } from "../agents/avatar-testing";
import type { Attachment, ChannelMessage } from "../relay/contracts";
import { MessageRow } from "./MessageRow";

stubAvatarBrowserApis();
beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});

const row: ChannelMessage = {
  id: "raw-media-row",
  channelId: "raw-channel",
  authorId: "raw-author",
  content: "Raw message 한글 {count} Open image attachment",
  createdAt: 1,
  mentions: [],
  participants: [],
  attachments: [],
  reactions: [],
  replyCount: 0,
};
function attachments(kinds: readonly ("image" | "video")[]): Attachment[] {
  return kinds.map((kind, index) => ({
    kind,
    url: `https://media.test/raw-${index}.${kind === "image" ? "png" : "mp4"}`,
    name: `Raw 파일 ${index} {count} Open image attachment`,
  }));
}
const props = {
  profile: undefined,
  media: (url: string) => url,
  onOpenLink: () => false,
  day: false,
  retry: undefined,
};

it.each(["images", "mixed"] as const)(
  "keeps collapsed %s gallery nodes, raw order and callback through EN/KO/EN",
  (kind) => {
    const items = attachments(
      kind === "images"
        ? ["image", "image", "image", "image", "image"]
        : ["image", "video", "image", "video", "image"],
    );
    const original = JSON.stringify(items),
      open = vi.fn();
    const message = { ...row, attachments: items };
    render(<MessageRow {...props} row={message} onOpenMediaReview={open} />);
    const group = screen.getByRole("group", {
      name: kind === "images" ? "5 images" : "5 photos and videos",
    });
    const links = within(group).getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const language of ["en", "ko", "en"] as const) {
      act(() => setLanguage(language));
      const korean = language === "ko";
      expect(group).toHaveAccessibleName(
        korean
          ? kind === "images"
            ? "이미지 5개"
            : "사진과 동영상 5개"
          : kind === "images"
            ? "5 images"
            : "5 photos and videos",
      );
      const current = within(group).getAllByRole("link");
      current.forEach((link, index) => {
        expect(link).toBe(links[index]);
      });
      expect(current.map((link) => link.getAttribute("href"))).toEqual(
        items.slice(0, 4).map((item) => item.url),
      );
      expect(links[3]).toHaveAccessibleName(
        korean
          ? kind === "images"
            ? "이미지 5개 모두 보기, 4번째 이미지부터"
            : "사진과 동영상 5개 모두 보기, 4번째 항목부터"
          : kind === "images"
            ? "View all 5 images, starting at image 4"
            : "View all 5 photos and videos, starting at item 4",
      );
      expect(links[3]).toHaveTextContent("+2");
      expect(open).not.toHaveBeenCalled();
      expect(JSON.stringify(items)).toBe(original);
      expect(screen.getByText(row.content)).toBeVisible();
    }
    fireEvent.click(
      within(group).getByRole("link", {
        name:
          kind === "images"
            ? "View all 5 images, starting at image 4"
            : "View all 5 photos and videos, starting at item 4",
      }),
    );
    expect(open).toHaveBeenCalledExactlyOnceWith(
      row.id,
      items[3],
      0,
      false,
      items,
    );
    expect(JSON.stringify(items)).toBe(original);
  },
);

it("keeps single-image and mixed sequence names with the original selected attachment", () => {
  const single = attachments(["image"]);
  const open = vi.fn();
  const view = render(
    <MessageRow
      {...props}
      row={{ ...row, attachments: single }}
      onOpenMediaReview={open}
    />,
  );
  const group = screen.getByRole("group", { name: "1 image" });
  const singleLink = within(group).getByRole("link", {
    name: "Open image attachment",
  });
  act(() => setLanguage("ko"));
  expect(group).toHaveAccessibleName("이미지 1개");
  expect(singleLink).toHaveAccessibleName("첨부 이미지 열기");
  expect(singleLink).toHaveAttribute("href", single[0]?.url);
  act(() => setLanguage("en"));
  expect(
    within(group).getByRole("link", { name: "Open image attachment" }),
  ).toBe(singleLink);
  const items = attachments(["image", "video", "image", "video"]);
  view.rerender(
    <MessageRow
      {...props}
      row={{ ...row, attachments: items }}
      onOpenMediaReview={open}
    />,
  );
  const mixed = screen.getByRole("group", { name: "4 photos and videos" });
  const links = within(mixed).getAllByRole("link");
  for (const language of ["en", "ko", "en"] as const) {
    act(() => setLanguage(language));
    within(mixed)
      .getAllByRole("link")
      .forEach((link, index) => {
        expect(link).toBe(links[index]);
      });
    for (const [index, item] of items.entries()) {
      expect(links[index]).toHaveAccessibleName(
        language === "ko"
          ? `${item.kind === "image" ? "이미지" : "동영상"} 4개 중 ${index + 1}번째 열기`
          : `Open ${item.kind} ${index + 1} of 4`,
      );
      expect(links[index]).toHaveAttribute("href", item.url);
    }
    expect(open).not.toHaveBeenCalled();
  }
  fireEvent.click(
    within(mixed).getByRole("link", { name: "Open video 2 of 4" }),
  );
  expect(open).toHaveBeenCalledExactlyOnceWith(
    row.id,
    items[1],
    0,
    false,
    items,
  );
});

it("does not collapse five images without a gallery owner when captions change", () => {
  const items = attachments(Array.from({ length: 5 }, () => "image" as const));
  render(<MessageRow {...props} row={{ ...row, attachments: items }} />);
  const group = screen.getByRole("group", { name: "5 images" });
  const links = within(group).getAllByRole("link");
  act(() => setLanguage("ko"));
  expect(group).toHaveAccessibleName("이미지 5개");
  within(group)
    .getAllByRole("link")
    .forEach((link, index) => {
      expect(link).toBe(links[index]);
    });
  expect(links).toHaveLength(5);
  expect(links[4]).toHaveAccessibleName("이미지 5개 중 5번째 열기");
  expect(group).not.toHaveTextContent("+");
  expect(links.map((link) => link.getAttribute("href"))).toEqual(
    items.map((item) => item.url),
  );
});

it.each(["en", "ko"] as const)(
  "formats the full large gallery count in %s without changing its raw items",
  (language) => {
    const items = attachments(
      Array.from({ length: 1001 }, () => "image" as const),
    );
    setLanguage(language);
    const html = renderToStaticMarkup(
      <MessageRow
        {...props}
        row={{ ...row, attachments: items }}
        onOpenMediaReview={() => {}}
      />,
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const group = document.querySelector(
      '[data-message-attachments] [role="group"][aria-label]',
    );
    expect(group).not.toBeNull();
    expect(group?.getAttribute("aria-label")).toBe(
      language === "ko" ? "이미지 1,001개" : "1,001 images",
    );
    const links = group?.querySelectorAll("a");
    expect(links).toHaveLength(4);
    expect(links?.[3]?.getAttribute("aria-label")).toBe(
      language === "ko"
        ? "이미지 1,001개 모두 보기, 4번째 이미지부터"
        : "View all 1,001 images, starting at image 4",
    );
    expect(items).toHaveLength(1001);
    expect(items[1000]?.name).toBe(
      "Raw 파일 1000 {count} Open image attachment",
    );
  },
);

it("keeps the timecode tooltip and original seek callback during a language switch", async () => {
  const seek = vi.fn();
  render(
    <MessageRow
      {...props}
      row={{ ...row, content: "⏱ 0:42 — Raw {count} 한글" }}
      onMediaTime={seek}
    />,
  );
  const trigger = screen.getByRole("button", { name: "0:42" });
  act(() => trigger.focus());
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip).toHaveTextContent("Open video");
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole("tooltip")).toBe(tooltip);
    expect(tooltip).toHaveTextContent(
      language === "ko" ? "동영상 열기" : "Open video",
    );
    expect(trigger).toHaveFocus();
    expect(seek).not.toHaveBeenCalled();
  }
  fireEvent.click(trigger);
  expect(seek).toHaveBeenCalledExactlyOnceWith(42);
  expect(screen.getByText("Raw {count} 한글")).toBeVisible();
});
