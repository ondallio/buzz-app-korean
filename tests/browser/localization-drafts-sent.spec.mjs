import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { verifyEvent } from "nostr-tools";
import { test, expect } from "./fixture.mjs";
import { stopRoutes } from "./playwright-test.mjs";
import {
  openPage,
  openSettings,
  selectSettingsSection,
  pageChoice,
} from "./navigation.mjs";
import { fixtureRelayUrl } from "../relay-config.ts";

const channel = "Notes to self 한글 {channel}";
const lead = "Draft raw 초안 {name}";
const code = 'const value = "Agent";';
const tail = "마지막 줄";
const raw = `${lead}\n\`${code}\`\n${tail}`;
const plain = `${lead}\n${code}\n${tail}`;
const expectedDraft = {
  text: plain,
  recipients: [],
  document: {
    version: 1,
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: `${lead}\n` },
            { type: "text", marks: [{ type: "code" }], text: code },
            { type: "text", text: `\n${tail}` },
          ],
        },
      ],
    },
  },
};
const summary = `${lead} ${code} ${tail}`;
const languageKey = "buzz-korean-beta.language.v1";

test.use({
  productionBroker: true,
  draftsSent: true,
  enabledPlugins: ["buzz.drafts-and-sent"],
  historyCounts: { alpha: 1, beta: 0 },
  channelNames: { alpha: channel },
});

function observeApiRequests(context) {
  // Actual broker reads/control routes from transport.ts and broker-live.ts.
  const routes = new Set([
    "query",
    "presence-snapshot",
    "sidebar-preferences",
    "profile-search",
    "channel-activity",
    "sign",
    "publish",
    "read-state-decode",
    "read-state-sign",
    "read-state-publish",
    "stream",
    "stream-interests",
    "stream-priority",
    "stream-observer",
    "stream-presence",
    "stream-presence-authors",
    "stream-retry",
    "stream-artifact-sync",
    "stream-artifact-sync-close",
  ]);
  const communities = new Set(["primary", encodeURIComponent(fixtureRelayUrl)]);
  const events = [];
  let overflow = 0;
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "GET" || !url.pathname.startsWith("/api/")) return;
    if (events.length >= 256) {
      overflow++;
      return;
    }
    const rawBody = request.postData() ?? "";
    const bytes = Buffer.byteLength(rawBody);
    const entry = { method: request.method(), path: url.pathname, bytes };
    const match = /^\/api\/relay\/([^/]+)\/([^/]+)$/.exec(entry.path);
    entry.allowed =
      entry.method === "POST" &&
      (entry.path === "/api/relay/register" ||
        (match !== null && communities.has(match[1]) && routes.has(match[2])));
    if (bytes > 65536) entry.parseError = "API body exceeds 64 KiB";
    else {
      entry.rawBody = rawBody;
      try {
        entry.body = JSON.parse(rawBody);
      } catch (error) {
        entry.parseError = String(error);
      }
    }
    events.push(entry);
  });
  return { events, overflow: () => overflow };
}

async function stored(page, viewer) {
  return page.evaluate(
    ({ scope, languageKey }) => {
      const key = (name) => `buzz-view.v1:${JSON.stringify([scope, name])}`;
      return {
        draft: localStorage.getItem(key("draft:alpha")),
        tab: localStorage.getItem(key("drafts-sent-tab")),
        language: localStorage.getItem(languageKey),
      };
    },
    { scope: `${fixtureRelayUrl}:${viewer}`, languageKey },
  );
}

async function openDrafts(page, language) {
  if (language === "en") return openPage(page, "Drafts & sent");
  await page.locator("[data-global-search-trigger]").click();
  const dialog = page.getByRole("dialog", { name: "Buzz 검색", exact: true });
  await expect(
    dialog.getByText("커뮤니티에 연결하고 있습니다…", { exact: true }),
  ).toHaveCount(0);
  const input = dialog.getByRole("combobox", {
    name: "Buzz 검색",
    exact: true,
  });
  await input.fill("초안 및 보낸 메시지");
  await expect(input).toHaveValue("초안 및 보낸 메시지");
  const group = dialog.locator(
    '[role="group"][aria-label="페이지"], [role="rowgroup"][aria-label="페이지"]',
  );
  const choice = pageChoice(group, "초안 및 보낸 메시지");
  await expect(choice).toBeVisible();
  const id = await choice.getAttribute("id");
  const limit = await dialog.locator('[role="option"], [role="row"]').count();
  await input.press("ArrowUp");
  for (
    let step = 0;
    (await input.getAttribute("aria-activedescendant")) !== id;
    step++
  ) {
    expect(step, "keyboard reaches the exact registered page").toBeLessThan(
      limit + 16,
    );
    await input.press("ArrowDown");
  }
  await input.press("Enter");
  await expect(dialog).toBeHidden();
}

async function compose(page) {
  const input = page.getByRole("textbox", {
    name: `Message #${channel}`,
    exact: true,
  });
  await expect(input).toBeVisible();
  await input.fill(lead);
  await input.evaluate(
    (node, offset) => node.setSelectionRange(offset, offset),
    lead.length,
  );
  await input.press("Shift+Enter");
  await page
    .getByRole("button", { name: "Toggle formatting", exact: true })
    .click();
  const toggle = page.getByRole("button", { name: "Code", exact: true });
  await toggle.click();
  await page.keyboard.type(code);
  await expect(input.locator("code")).toHaveText(code);
  await toggle.click();
  await input.press("Shift+Enter");
  await page.keyboard.insertText(tail);
  await expect(input).toHaveJSProperty("value", plain);
  await expect(input.locator("code")).toHaveText(code);
  return input;
}

async function sameNode(locator, original) {
  expect(await locator.evaluate((node, old) => node === old, original)).toBe(
    true,
  );
}

function surface(page) {
  return page
    .getByRole("region", { name: "Drafts & sent", exact: true })
    .or(page.getByRole("region", { name: "초안 및 보낸 메시지", exact: true }));
}

function previewOf(region) {
  return region
    .getByRole("region", { name: `Draft for #${channel}`, exact: true })
    .or(region.getByRole("region", { name: `#${channel} 초안`, exact: true }));
}

function draftRow(region, language) {
  return region.getByRole("button", {
    name:
      language === "en"
        ? `Continue draft in #${channel}: ${summary}`
        : `#${channel}의 초안 이어 쓰기: ${summary}`,
    exact: true,
  });
}

async function driver(context, app, consoleErrors) {
  const sibling = await context.newPage();
  app.watchPageErrors(sibling);
  sibling.on("console", (message) => {
    if (message.type() === "error" && consoleErrors.length < 64)
      consoleErrors.push(message.text().slice(0, 8192));
  });
  try {
    await sibling.goto(app.origin);
    await openSettings(sibling);
    await selectSettingsSection(sibling, "Appearance");
  } catch (error) {
    await stopRoutes(context);
    await sibling.close();
    throw error;
  }
  const settings = sibling.getByRole("dialog", { name: /^(Settings|설정)$/ });
  return {
    async language(page, language) {
      await sibling.evaluate(
        ({ key, language }) => localStorage.setItem(key, language),
        { key: languageKey, language },
      );
      await expect(page.locator("html")).toHaveAttribute("lang", language);
    },
    async sample(page, { width, mode, scale }) {
      await settings.getByRole("combobox", { name: /^(Mode|모드)$/ }).click();
      await sibling
        .getByRole("option", {
          name: mode === "Light" ? /^(Light|밝게)$/ : /^(Dark|어둡게)$/,
        })
        .click();
      const output = settings.locator(
        'output[aria-label="Interface size"],output[aria-label="인터페이스 크기"]',
      );
      const current = Number.parseInt(await output.textContent(), 10);
      const delta = Math.abs(current - scale) / 10;
      expect(Number.isInteger(delta) && delta <= 10).toBe(true);
      const name =
        current > scale
          ? /^(Decrease interface size|인터페이스 축소)$/
          : /^(Increase interface size|인터페이스 확대)$/;
      for (let step = 0; step < delta; step++)
        await settings.getByRole("button", { name }).click();
      await expect(output).toHaveText(`${scale}%`);
      await page.setViewportSize({ width, height: 950 });
      await expect(page.locator("html")).toHaveAttribute(
        "data-color-mode",
        mode.toLowerCase(),
      );
      await expect
        .poll(() =>
          page
            .locator("html")
            .evaluate((node) =>
              Number.parseFloat(getComputedStyle(node).fontSize),
            ),
        )
        .toBe((16 * scale) / 100);
    },
    async close() {
      await stopRoutes(context);
      await sibling.close();
    },
  };
}

async function selection(editor) {
  return editor.evaluate((node) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
    selected: window.getSelection()?.toString(),
    focused: document.activeElement === node,
  }));
}

async function capture(page, info, region, preview, language, name, images) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().endTime !== Infinity,
        )
        .map((animation) => animation.finished),
    );
  });
  const layout = await preview.evaluate((node) => {
    let owner = node;
    for (
      let step = 0;
      step < 24 && owner;
      step++, owner = owner.parentElement
    ) {
      if (getComputedStyle(owner).containerName === "drafts-sent") {
        const box = owner.getBoundingClientRect();
        return {
          width: owner.clientWidth,
          left: box.left,
          right: box.right,
          rem: Number.parseFloat(
            getComputedStyle(document.documentElement).fontSize,
          ),
          overflow:
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth + 1,
        };
      }
    }
    throw new Error("Drafts container not found within 24 ancestors");
  });
  const narrow = layout.width <= 48 * layout.rem;
  const back = preview.getByRole("button", {
    name: language === "en" ? "Back to drafts" : "초안 목록으로 돌아가기",
    exact: true,
  });
  const close = preview.getByRole("button", {
    name: language === "en" ? "Close draft preview" : "초안 미리보기 닫기",
    exact: true,
  });
  await expect(back).toHaveCount(narrow ? 1 : 0);
  await expect(close).toHaveCount(narrow ? 0 : 1);
  await expect(
    region.getByRole("searchbox", {
      name:
        language === "en"
          ? "Search drafts and sent messages"
          : "초안 및 보낸 메시지 검색",
      exact: true,
    }),
  ).toHaveCount(narrow ? 0 : 1);
  expect(layout.overflow).toBe(false);
  expect(layout.left).toBeGreaterThanOrEqual(-1);
  expect(layout.right).toBeLessThanOrEqual(page.viewportSize().width + 1);
  const frame = await preview.boundingBox();
  const controls = [];
  for (const control of [
    narrow ? back : close,
    preview.getByRole("button", {
      name: language === "en" ? "Open conversation" : "대화 열기",
      exact: true,
    }),
    preview.getByRole("button", {
      name: language === "en" ? "Send message" : "메시지 보내기",
      exact: true,
    }),
  ]) {
    await expect(control).toBeVisible();
    await expect(control).toBeEnabled();
    await expect(control).toBeInViewport();
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(frame.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(frame.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
    expect(
      await control.evaluate((node) => {
        const box = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          ),
        );
      }),
    ).toBe(true);
    controls.push({ name: await control.getAttribute("aria-label"), box });
  }
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  const sha256 = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  expect(images.map((image) => image.sha256)).not.toContain(sha256);
  images.push({
    name,
    sha256,
    layout,
    narrow,
    controls,
    viewport: page.viewportSize(),
  });
  await info.attach(name, { path, contentType: "image/png" });
}

test("Drafts and sent retains a real code draft through Korean layout, reload and one modeled send", async ({
  page,
  context,
  app,
}, info) => {
  const requests = observeApiRequests(context);
  const publications = () =>
    requests.events.filter((entry) =>
      /\/api\/relay\/[^/]+\/(?:publish|read-state-publish)$/.test(entry.path),
    );
  const messages = () =>
    publications().filter((entry) => entry.body?.kind === 9);
  const images = [];
  const siblingConsole = [];
  let settings;
  let sentEvent;
  let beforeReload;
  await page.addInitScript((key) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, "en");
  }, languageKey);
  try {
    await page.goto(app.origin);
    await openPage(page, "Messages");
    await page
      .getByRole("navigation", { name: "Subscribed channels", exact: true })
      .getByRole("button", { name: channel, exact: true })
      .click();
    await compose(page);
    await expect
      .poll(
        async () => JSON.parse((await stored(page, app.viewer)).draft)?.text,
      )
      .toBe(plain);
    expect(JSON.parse((await stored(page, app.viewer)).draft)).toEqual(
      expectedDraft,
    );
    expect(messages()).toHaveLength(0);
    await openDrafts(page, "en");
    await expect(
      page.getByRole("img", { name: "1 draft", exact: true }),
    ).toBeVisible();
    const region = surface(page);
    const search = region.getByRole("searchbox", {
      name: "Search drafts and sent messages",
      exact: true,
    });
    await search.fill("{name}");
    const searchNode = await search.elementHandle();
    const row = draftRow(region, "en");
    await expect(row).toBeVisible();
    const rowNode = await row.elementHandle();
    settings = await driver(context, app, siblingConsole);
    await settings.language(page, "ko");
    const koSearch = region.getByRole("searchbox", {
      name: "초안 및 보낸 메시지 검색",
      exact: true,
    });
    await sameNode(koSearch, searchNode);
    await expect(koSearch).toHaveValue("{name}");
    await sameNode(draftRow(region, "ko"), rowNode);
    await region
      .getByRole("button", {
        name: "초안 및 보낸 메시지 검색 지우기",
        exact: true,
      })
      .click();
    await expect(koSearch).toHaveValue("");
    await expect(koSearch).toBeFocused();
    await settings.language(page, "en");
    await row.focus();
    await row.press("Enter");
    const preview = previewOf(region);
    const editor = preview.getByRole("textbox");
    await expect(editor).toHaveAccessibleName(`Message #${channel}`);
    await expect(editor).toHaveJSProperty("value", plain);
    await expect(editor.locator("code")).toHaveText(code);
    const nodes = {
      region: await region.elementHandle(),
      preview: await preview.elementHandle(),
      editor: await editor.elementHandle(),
    };
    await editor.focus();
    await editor.evaluate((node) => node.setSelectionRange(1, 6));
    await editor.press("Shift+ArrowRight");
    const selected = {
      start: 1,
      end: 7,
      selected: plain.slice(1, 7),
      focused: true,
    };
    await expect.poll(() => selection(editor)).toEqual(selected);
    const retained = (await stored(page, app.viewer)).draft;
    const preserve = async (language) => {
      await sameNode(region, nodes.region);
      await sameNode(preview, nodes.preview);
      await sameNode(editor, nodes.editor);
      expect(await rowNode.evaluate((node) => node.isConnected)).toBe(true);
      await expect(editor).toHaveJSProperty("value", plain);
      await expect(editor.locator("code")).toHaveText(code);
      await expect(editor).toHaveAccessibleName(
        language === "en"
          ? `Message #${channel}`
          : `#${channel}에 메시지 보내기`,
      );
      expect(await selection(editor)).toEqual(selected);
      expect((await stored(page, app.viewer)).draft).toBe(retained);
      expect(messages()).toHaveLength(0);
    };
    await settings.sample(page, { width: 1280, mode: "Light", scale: 100 });
    await preserve("en");
    await capture(page, info, region, preview, "en", "wide-light-en", images);
    await settings.language(page, "ko");
    await preserve("ko");
    await expect(
      page.getByRole("img", { name: "초안 1개", exact: true }),
    ).toBeVisible();
    await capture(page, info, region, preview, "ko", "wide-light-ko", images);
    for (const sample of [
      { width: 800, mode: "Dark", scale: 100 },
      { width: 480, mode: "Dark", scale: 150 },
    ]) {
      await settings.sample(page, sample);
      await preserve("ko");
      await capture(
        page,
        info,
        region,
        preview,
        "ko",
        `dark-ko-${sample.width}-${sample.scale}`,
        images,
      );
    }
    expect(images[0].narrow).toBe(false);
    expect(images[3].narrow).toBe(true);
    await settings.language(page, "en");
    await preserve("en");
    await settings.language(page, "ko");
    await preserve("ko");
    const trigger = page.locator("[data-global-search-trigger]");
    await trigger.click();
    const palette = page.getByRole("dialog", {
      name: "Buzz 검색",
      exact: true,
    });
    await expect(palette).toBeVisible();
    await expect(
      palette.getByRole("combobox", { name: "Buzz 검색", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
    await expect(trigger).toBeFocused();
    await editor.focus();
    expect(await selection(editor)).toEqual(selected);
    await preserve("ko");
    await preview
      .getByRole("button", { name: "초안 목록으로 돌아가기", exact: true })
      .click();
    await expect(preview).toHaveCount(0);
    await sameNode(draftRow(region, "ko"), rowNode);
    await expect(draftRow(region, "ko")).toBeFocused();
    await draftRow(region, "ko").press("Enter");
    await preview
      .getByRole("button", { name: "대화 열기", exact: true })
      .click();
    const channelEditor = page.getByRole("textbox", {
      name: `#${channel}에 메시지 보내기`,
      exact: true,
    });
    await expect(channelEditor).toHaveJSProperty("value", plain);
    await expect(channelEditor.locator("code")).toHaveText(code);
    expect((await stored(page, app.viewer)).draft).toBe(retained);
    expect(messages()).toHaveLength(0);
    await openDrafts(page, "ko");
    await region.getByRole("tab", { name: "보낸 메시지", exact: true }).click();
    await expect
      .poll(async () => JSON.parse((await stored(page, app.viewer)).tab))
      .toBe("sent");
    beforeReload = await stored(page, app.viewer);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-mode",
      "dark",
    );
    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate((node) => getComputedStyle(node).fontSize),
      )
      .toBe("24px");
    expect(await stored(page, app.viewer)).toEqual(beforeReload);
    // Re-enter explicitly: storage restoration is not a page-intent/history claim.
    await openDrafts(page, "ko");
    await expect(
      region.getByRole("tab", { name: "보낸 메시지", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await region.locator('[role="tab"][data-tab-value="drafts"]').click();
    await expect(draftRow(region, "ko")).toBeVisible();
    await draftRow(region, "ko").focus();
    await draftRow(region, "ko").press("Enter");
    await expect(editor).toHaveJSProperty("value", plain);
    await expect(editor.locator("code")).toHaveText(code);
    await preview
      .getByRole("button", { name: "메시지 보내기", exact: true })
      .click();
    await expect.poll(() => messages().length).toBe(1);
    sentEvent = messages()[0].body;
    expect(sentEvent.kind).toBe(9);
    expect(sentEvent.content).toBe(raw);
    expect(sentEvent.pubkey).toBe(app.viewer);
    expect(sentEvent.tags.filter(([name]) => name === "h")).toEqual([
      ["h", "alpha"],
    ]);
    expect(
      sentEvent.tags.filter(([name]) => name === "e" || name === "p"),
    ).toEqual([]);
    expect(verifyEvent(sentEvent)).toBe(true);
    await expect
      .poll(() =>
        app.report.publications
          .filter(({ event }) => event.kind === 9)
          .map(({ event }) => event.id),
      )
      .toEqual([sentEvent.id]);
    await expect(preview).toHaveCount(0);
    await expect(region.getByRole("status")).toHaveText(
      `#${channel}에 보냈습니다.`,
    );
    await expect
      .poll(
        async () => JSON.parse((await stored(page, app.viewer)).draft)?.text,
      )
      .toBe("");
    await region.getByRole("tab", { name: "보낸 메시지", exact: true }).click();
    const sentRow = region.getByRole("button", {
      name: `#${channel}의 메시지 보기: ${summary}`,
      exact: true,
    });
    await expect(sentRow).toBeVisible();
    await sentRow.focus();
    await sentRow.press("Enter");
    const sentPreview = region.getByRole("region", {
      name: `#${channel}의 보낸 메시지`,
      exact: true,
    });
    const message = sentPreview.locator(`[data-message-id="${sentEvent.id}"]`);
    await expect(message).toContainText(lead);
    await expect(message.locator("code")).toHaveText(code);
    await expect(message).toContainText(tail);
    const dates = await message
      .locator("time")
      .evaluateAll((nodes) => nodes.map((node) => node.dateTime));
    expect(dates.length).toBeGreaterThan(0);
    expect([...new Set(dates)]).toEqual([
      new Date(sentEvent.created_at * 1000).toISOString(),
    ]);
    await sentPreview
      .getByRole("button", {
        name: "보낸 메시지 목록으로 돌아가기",
        exact: true,
      })
      .click();
    await expect(sentRow).toBeFocused();
    expect(messages()).toHaveLength(1);
    expect(requests.overflow()).toBe(0);
    expect(requests.events.filter((entry) => entry.parseError)).toEqual([]);
    expect(requests.events.filter((entry) => !entry.allowed)).toEqual([]);
    for (const entry of requests.events.filter((entry) =>
      entry.path.endsWith("/presence-snapshot"),
    ))
      expect(entry.body).toEqual([
        { kinds: [20001], authors: [app.viewer], limit: 1 },
      ]);
    for (const entry of requests.events.filter((entry) =>
      entry.path.endsWith("/sidebar-preferences"),
    ))
      expect(entry.body).toEqual([]);
    for (const entry of requests.events.filter(
      (entry) => entry.path === "/api/relay/register",
    ))
      expect([{ url: "primary" }, { url: "secondary" }]).toContainEqual(
        entry.body,
      );
    for (const entry of requests.events.filter((entry) =>
      entry.path.endsWith("/sign"),
    ))
      expect([9, 20002, 30078]).toContain(entry.body.kind);
    for (const { body } of publications()) {
      expect([9, 20002, 30078]).toContain(body.kind);
      expect(body.pubkey).toBe(app.viewer);
      expect(verifyEvent(body)).toBe(true);
    }
    expect(siblingConsole).toEqual([]);
    expect(app.report.errors).toEqual([]);
    expect(app.report.consoleErrors).toEqual([]);
    expect(app.report.unexpected).toEqual([]);
  } finally {
    try {
      await writeFile(
        info.outputPath("drafts-sent-evidence.json"),
        JSON.stringify(
          {
            raw,
            plain,
            expectedDraft,
            channel,
            beforeReload,
            after: page.isClosed() ? null : await stored(page, app.viewer),
            requests: requests.events,
            overflow: requests.overflow(),
            sentEvent,
            publicationKinds: publications().map(({ body }) => body?.kind),
            images,
            siblingConsole,
            report: app.report,
          },
          null,
          2,
        ),
      );
    } finally {
      await settings?.close();
    }
  }
});
