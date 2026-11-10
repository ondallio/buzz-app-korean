import { createHash } from "node:crypto";
import { verifyEvent } from "nostr-tools";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixture.mjs";
import { stopRoutes } from "./playwright-test.mjs";
import { open as openConversation } from "./timeline.mjs";
import {
  openPage,
  openSettings,
  selectSettingsSection,
  settingsDialog,
  settleDialogMotion,
} from "./navigation.mjs";

test.use({
  productionBroker: true,
  localAgentActivity: true,
  pluginFixtures: true,
  developmentReact: true,
  builderlabLogin: true,
  enabledPlugins: ["fixture.provider"],
  historyCounts: { alpha: 1, beta: 0 },
});

const samples = [
  { width: 1280, mode: "Light", scale: 100 },
  { width: 800, mode: "Dark", scale: 100 },
  { width: 480, mode: "Dark", scale: 150 },
];

async function sameNode(locator, original) {
  expect(await locator.evaluate((node, old) => node === old, original)).toBe(
    true,
  );
}

async function driver(context, app) {
  const sibling = await context.newPage();
  app.watchPageErrors(sibling);
  await sibling.goto(app.origin);
  await openSettings(sibling);
  await selectSettingsSection(sibling, "Appearance");
  const settings = sibling.getByRole("dialog", { name: /^(Settings|설정)$/ });
  return {
    async language(page, language) {
      await sibling.evaluate((language) => {
        localStorage.setItem("buzz-korean-beta.language.v1", language);
      }, language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
    },
    async sample(page, { width, mode, scale }) {
      await settings.getByRole("combobox", { name: /^(Mode|모드)$/ }).click();
      await sibling
        .getByRole("option", {
          name: mode === "Light" ? /^(Light|밝게)$/ : /^(Dark|어둡게)$/,
        })
        .click();
      const readout = settings.locator(
        'output[aria-label="Interface size"],output[aria-label="인터페이스 크기"]',
      );
      const current = Number.parseInt(await readout.textContent(), 10);
      const label =
        current > scale
          ? /^(Decrease interface size|인터페이스 축소)$/
          : /^(Increase interface size|인터페이스 확대)$/;
      for (let step = 0; step < Math.abs(current - scale) / 10; step++)
        await settings
          .getByRole("button", { name: label, exact: true })
          .click();
      await expect(readout).toHaveText(`${scale}%`);
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

function forbidWrites(context) {
  const writes = [];
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (
      request.method() !== "GET" &&
      (/\/api\/builderlab\/(?:login|agents|models)/.test(url.pathname) ||
        /\/api\/relay\/[^/]+\/(?:publish|upload|register-agent)$/.test(
          url.pathname,
        ))
    )
      writes.push({
        method: request.method(),
        path: url.pathname,
        body: request.postData(),
      });
  });
  return writes;
}

async function fixtureSetup(writes, app) {
  await expect.poll(() => writes.length).toBe(1);
  const event = JSON.parse(writes[0].body);
  expect(writes[0].path).toBe("/api/relay/primary/publish");
  expect(event.kind).toBe(30177);
  expect(event.pubkey).toBe(app.viewer);
  expect(verifyEvent(event)).toBe(true);
  expect(JSON.parse(event.content)).toEqual({
    parallelism: 1,
    respond_to: "owner-only",
    name: "Local tester",
  });
  expect(event.tags).toContainEqual(["runtime", "fixture.local-agent/tester"]);
  expect(event.tags).toContainEqual([
    "d",
    "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  ]);
  return writes.length;
}

async function capture(
  page,
  info,
  name,
  subject,
  hashes,
  clippedMedia = false,
) {
  await subject.scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
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
  await expect(subject).toBeInViewport();
  const bounds = await subject.evaluate((node) => ({
    width: node.clientWidth,
    scrollWidth: node.scrollWidth,
    left: node.getBoundingClientRect().left,
    right: node.getBoundingClientRect().right,
  }));
  if (clippedMedia) {
    await expect(subject).toHaveAttribute("data-comments-hidden");
    expect(
      await subject.evaluate((node) => getComputedStyle(node).overflowX),
    ).toBe("hidden");
    const pane = subject.locator(":scope > aside[data-media-comments]");
    await expect(pane).toHaveCSS("visibility", "hidden");
    await expect(pane).toHaveAttribute("aria-hidden", "true");
    await expect(pane).toHaveAttribute("inert", "");
    await expect(
      subject.getByRole("complementary", { name: "미디어 댓글", exact: true }),
    ).toHaveCount(0);
    bounds.hiddenComments = await pane.evaluate((node) => ({
      visibility: getComputedStyle(node).visibility,
      inert: node.inert,
      ariaHidden: node.getAttribute("aria-hidden"),
      left: node.getBoundingClientRect().left,
      right: node.getBoundingClientRect().right,
    }));
    bounds.controls = [];
    const frame = await subject.boundingBox();
    for (const control of await subject.getByRole("button").all()) {
      await expect(control).toBeInViewport();
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(frame.x);
      expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
      expect(box.y).toBeGreaterThanOrEqual(frame.y);
      expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);
      if (await control.isEnabled()) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await expect
          .poll(() =>
            control.evaluate((node) => {
              const box = node.getBoundingClientRect();
              const hit = document.elementFromPoint(
                box.x + box.width / 2,
                box.y + box.height / 2,
              );
              return hit !== null && node.contains(hit);
            }),
          )
          .toBe(true);
      }
      bounds.controls.push({
        name: await control.getAttribute("aria-label"),
        box,
        enabled: await control.isEnabled(),
      });
    }
  } else expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(
    await page
      .locator("html")
      .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true);
  const path = info.outputPath(`${name}.png`);
  await subject.screenshot({ path });
  const hash = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  expect(hashes.map((item) => item.sha256)).not.toContain(hash);
  hashes.push({ name, sha256: hash, bounds });
  await info.attach(name, { path, contentType: "image/png" });
}

async function evidence(info, app, value) {
  const path = info.outputPath("evidence.json");
  await writeFile(
    path,
    JSON.stringify({ ...value, report: app.report }, null, 2),
  );
  await info.attach("evidence", { path, contentType: "application/json" });
}

test("creation retains Instructions Optional through the actual main provider and signed-out harness", async ({
  page,
  context,
  app,
}, info) => {
  const writes = forbidWrites(context),
    hashes = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(app.origin);
  const language = await driver(context, app);
  const writeBaseline = await fixtureSetup(writes, app);
  try {
    await language.sample(page, samples[0]);
    await openPage(page, "Agents");
    const opener = page.getByRole("button", { name: "New agent", exact: true });
    await opener.click();
    await page
      .getByRole("menuitem", { name: "Create a new agent", exact: true })
      .click();
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("form") });
    await expect(dialog).toBeVisible();
    const harness = dialog.getByRole("combobox", {
      name: "Harness",
      exact: true,
    });
    await harness.focus();
    await harness.press("Enter");
    await page.getByRole("option", { name: "Builderlab", exact: true }).click();
    const instructions = dialog.locator("textarea");
    await expect(instructions).toHaveAccessibleName("Instructions Optional");
    await expect(instructions).toBeVisible();
    await expect(
      dialog.getByRole("button", {
        name: "Model: Choose a model",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", {
        name: "Sign in to Builderlab",
        exact: true,
      }),
    ).toBeVisible();
    const nameId = await dialog
      .getByRole("textbox", { name: "Name", exact: true })
      .getAttribute("id");
    const name = dialog.locator(`input[id=${JSON.stringify(nameId)}]`);
    const rawName = "Name 한글 {name}";
    const rawDraft =
      "Help me plan my week and prioritize tasks.\n그대로 {count} & <literal>";
    await name.fill(rawName);
    await instructions.fill(rawDraft);
    await instructions.evaluate((node) => node.setSelectionRange(5, 14));
    const nodes = {
      dialog: await dialog.elementHandle(),
      label: await instructions.evaluateHandle((node) => node.labels[0]),
      optional: await dialog
        .getByText("Optional", { exact: true })
        .elementHandle(),
      input: await instructions.elementHandle(),
      name: await name.elementHandle(),
      form: await dialog
        .getByRole("form", { name: "New agent", exact: true })
        .elementHandle(),
    };
    const ids = await instructions.evaluate((node) => ({
      id: node.id,
      name: node.name,
      required: node.required,
    }));
    for (const locale of ["ko", "en"]) {
      await language.language(page, locale);
      const liveDialog = page.getByRole("dialog", {
        name: locale === "ko" ? "에이전트 만들기" : "Create agent",
        exact: true,
      });
      const liveInput = liveDialog.getByRole("textbox", {
        name: locale === "ko" ? "지침 선택 사항" : "Instructions Optional",
        exact: true,
      });
      await sameNode(liveDialog, nodes.dialog);
      await sameNode(liveInput, nodes.input);
      expect(
        await liveInput.evaluate(
          (node, label) => node.labels[0] === label,
          nodes.label,
        ),
      ).toBe(true);
      await sameNode(
        liveDialog.getByText(locale === "ko" ? "선택 사항" : "Optional", {
          exact: true,
        }),
        nodes.optional,
      );
      await sameNode(
        liveDialog.getByRole("textbox", {
          name: locale === "ko" ? "이름" : "Name",
          exact: true,
        }),
        nodes.name,
      );
      await sameNode(
        liveDialog.getByRole("form", {
          name: locale === "ko" ? "새 에이전트" : "New agent",
          exact: true,
        }),
        nodes.form,
      );
      await expect(liveInput).toHaveValue(rawDraft);
      await expect(liveInput).toBeFocused();
      expect(
        await liveInput.evaluate((node) => [
          node.selectionStart,
          node.selectionEnd,
        ]),
      ).toEqual([5, 14]);
      expect(
        await liveInput.evaluate((node) => ({
          id: node.id,
          name: node.name,
          required: node.required,
        })),
      ).toEqual(ids);
      await expect(liveInput).toHaveAttribute(
        "placeholder",
        locale === "ko"
          ? "이번 주 일정을 계획하고 작업의 우선순위를 정하도록 도와주세요."
          : "Help me plan my week and prioritize tasks.",
      );
    }
    await harness.click();
    const popup = page.getByRole("listbox");
    const popupNode = await popup.elementHandle();
    await language.language(page, "ko");
    await sameNode(popup, popupNode);
    await expect(
      page.getByRole("option", { name: "Builderlab", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(popup.getByText("원격", { exact: true })).toBeVisible();
    await expect(popup.getByText("로컬", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    const liveDialog = page.getByRole("dialog", {
      name: "에이전트 만들기",
      exact: true,
    });
    await instructions.press("Escape");
    await expect(liveDialog).toBeVisible();
    for (const sample of samples) {
      await language.sample(page, sample);
      await expect(name).toHaveValue(rawName);
      await expect(instructions).toHaveValue(rawDraft);
      await sameNode(liveDialog, nodes.dialog);
      await instructions.scrollIntoViewIfNeeded();
      await capture(
        page,
        info,
        `create-${sample.width}-${sample.mode}-${sample.scale}`,
        liveDialog,
        hashes,
      );
    }
    await liveDialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(liveDialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "새 에이전트", exact: true }),
    ).toBeFocused();
    expect(writes.slice(writeBaseline)).toEqual([]);
    await evidence(info, app, {
      hashes,
      writes,
      writeBaseline,
      rawName,
      rawDraft,
      avatarMotion:
        "Existing prefers-reduced-motion still path; no animation/media validation",
      ids,
      unverified:
        "No create, provider login, model lookup or raw config receipt; signed-out real Instructions consumer only.",
    });
  } finally {
    await language.close();
  }
});

test.describe("workflow attribution from explicit relay authority", () => {
  test.use({ relayAuthorityDiscovery: true });
  test("actual message details retain signed source, workflow popup and thread controls across languages", async ({
    page,
    context,
    app,
  }, info) => {
    const writes = forbidWrites(context),
      hashes = [];
    await openConversation(page, app);
    const language = await driver(context, app);
    const writeBaseline = await fixtureSetup(writes, app);
    const excerpt = "원문 Workflow {thread}";
    const now = Math.floor(Date.now() / 1000);
    const root = app.append(
      "primary",
      "alpha",
      "Raw source 본문 {count}",
      true,
      true,
      undefined,
      undefined,
      [],
      now,
    );
    const reply = app.append(
      "primary",
      "alpha",
      "Raw reply 줄바꿈\n둘째 줄",
      true,
      true,
      root.id,
      undefined,
      [],
      now + 1,
    );
    const workflow = app.signRelay({
      kind: 9,
      created_at: now + 2,
      content: "Raw workflow 본문 {name}",
      tags: [
        ["h", "alpha"],
        ["buzz:workflow", "true"],
        ["buzz:workflow-owner", app.viewer],
      ],
    });
    app.histories.get("primary/alpha").push(workflow);
    app.relay.publish("primary", workflow);
    const shared = app.append(
      "primary",
      "alpha",
      "Raw shared message",
      true,
      true,
      undefined,
      undefined,
      [["buzz:sent-from-thread", root.id, excerpt]],
      now + 3,
    );
    app.threadSummary(root.id, [app.viewer], 23);
    const rootRow = page.locator(`[data-message-id="${root.id}"]`);
    const workflowRow = page.locator(`[data-message-id="${workflow.id}"]`);
    const sharedRow = page.locator(`[data-message-id="${shared.id}"]`);
    const summary = rootRow.locator("[data-thread-summary]");
    const detail = workflowRow.getByRole("button", {
      name: "Workflow message details",
      exact: true,
    });
    const owner = workflowRow.getByRole("button", {
      name: "View workflow owner Fixture Reader profile",
      exact: true,
    });
    const source = sharedRow.getByRole("link", {
      name: `Thread — ${excerpt}`,
      exact: true,
    });
    const url = `buzz://message?channel=alpha&id=${root.id}&thread=${root.id}`;
    try {
      await expect(summary).toHaveAccessibleName("View thread: 23 replies");
      await expect(owner).toHaveText("Fixture Reader");
      await expect(source).toHaveAttribute("href", url);
      const nodes = {
        summary: await summary.elementHandle(),
        detail: await detail.elementHandle(),
        owner: await owner.elementHandle(),
        source: await source.elementHandle(),
      };
      for (const sample of samples) {
        await language.sample(page, sample);
        const detailControl = workflowRow.getByRole("button", {
          name: /^(Workflow message details|워크플로 메시지 상세 정보)$/,
        });
        await detailControl.focus();
        await page.keyboard.press("Enter");
        const popup = page.getByRole("dialog", {
          name: /^(Workflow message|워크플로 메시지)$/,
        });
        await expect(popup).toBeVisible();
        const popupNode = await popup.elementHandle();
        // Focus moves into the popup after it is shown; wait for it.
        await expect
          .poll(() =>
            popup.evaluate((node) => node.contains(document.activeElement)),
          )
          .toBe(true);
        const focused = await page.evaluateHandle(() => document.activeElement);
        for (const locale of ["ko", "en"]) {
          await language.language(page, locale);
          const korean = locale === "ko";
          await sameNode(summary, nodes.summary);
          await expect(summary).toHaveAccessibleName(
            korean ? "스레드 보기: 답글 23개" : "View thread: 23 replies",
          );
          const currentOwner = workflowRow.getByRole("button", {
            name: korean
              ? "워크플로 소유자 Fixture Reader 프로필 보기"
              : "View workflow owner Fixture Reader profile",
            exact: true,
          });
          const currentDetail = workflowRow.getByRole("button", {
            name: korean
              ? "워크플로 메시지 상세 정보"
              : "Workflow message details",
            exact: true,
          });
          const currentSource = sharedRow.getByRole("link", {
            name: `${korean ? "스레드" : "Thread"} — ${excerpt}`,
            exact: true,
          });
          await sameNode(currentOwner, nodes.owner);
          await sameNode(currentDetail, nodes.detail);
          await sameNode(currentSource, nodes.source);
          await sameNode(popup, popupNode);
          await expect(popup).toHaveAccessibleName(
            korean ? "워크플로 메시지" : "Workflow message",
          );
          await expect(popup).toHaveAccessibleDescription(
            korean
              ? "워크플로가 자동으로 보낸 메시지입니다. 소유자가 워크플로를 설정했지만 이 메시지를 직접 보내지는 않았습니다."
              : "Sent automatically by a workflow. Its owner set it up but didn’t send this message personally.",
          );
          expect(
            await page.evaluate(
              (active) => document.activeElement === active,
              focused,
            ),
          ).toBe(true);
          await expect(currentOwner).toHaveText("Fixture Reader");
          await expect(currentSource).toHaveAttribute("href", url);
          await expect(sharedRow).toContainText(
            korean
              ? `스레드 — ${excerpt}에서 보냄`
              : `Sent from Thread — ${excerpt}`,
          );
          await expect(workflowRow).toContainText(workflow.content);
          await expect(rootRow).toContainText(root.content);
          expect(writes).toHaveLength(writeBaseline);
          if (korean)
            await capture(
              page,
              info,
              `message-details-${sample.width}-${sample.mode}-${sample.scale}`,
              popup,
              hashes,
            );
        }
        await page.keyboard.press("Escape");
        await expect(popup).toHaveCount(0);
        await expect(detailControl).toBeFocused();
      }
      await summary.focus();
      await page.keyboard.press("Enter");
      const thread = page.getByRole("complementary", {
        name: "Thread",
        exact: true,
      });
      await expect(thread).toBeVisible();
      const threadNode = await thread.elementHandle();
      await expect(
        thread.locator(`[data-message-id="${root.id}"]`),
      ).toContainText(root.content);
      await expect(
        thread.locator(`[data-message-id="${reply.id}"]`),
      ).toContainText("Raw reply 줄바꿈");
      await language.language(page, "ko");
      const koreanThread = page.getByRole("complementary", {
        name: "스레드",
        exact: true,
      });
      await sameNode(koreanThread, threadNode);
      await expect(
        koreanThread.locator(`[data-message-id="${reply.id}"]`),
      ).toContainText("둘째 줄");
      expect(writes).toHaveLength(writeBaseline);
      expect(app.report.errors).toEqual([]);
      expect(app.report.consoleErrors).toEqual([]);
      expect(app.report.unexpected).toEqual([]);
      await evidence(info, app, {
        hashes,
        writes,
        writeBaseline,
        additionalUiWrites: writes.length - writeBaseline,
        fixtureEvents: [root, reply, workflow, shared],
        url,
        excerpt,
        remaining:
          "Native IME/speech/account/send/update/human acceptance and activity-parent failure states remain separate.",
      });
    } finally {
      await language.close();
    }
  });
});

test("provider defaults and the real contribution body retain focus and authored labels across languages", async ({
  page,
  context,
  app,
}, info) => {
  const writes = forbidWrites(context),
    hashes = [];
  await page.goto(app.origin);
  const language = await driver(context, app);
  const writeBaseline = await fixtureSetup(writes, app);
  try {
    await language.sample(page, samples[0]);
    await openSettings(page);
    await selectSettingsSection(page, "Agent setup");
    await expect(
      settingsDialog(page).getByRole("heading", {
        name: "Harness defaults",
        exact: true,
      }),
    ).toBeVisible();
    const opener = page.getByRole("button", {
      name: "Fixture provider, ready",
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole("dialog", {
      name: "Fixture provider",
      exact: true,
    });
    await settleDialogMotion(dialog);
    const done = dialog.getByRole("button", { name: "Done", exact: true });
    await done.focus();
    const nodes = {
      dialog: await dialog.elementHandle(),
      done: await done.elementHandle(),
    };
    const entry = await page.evaluate(
      () => history.state.buzzNavigationV1.entry,
    );
    for (const locale of ["ko", "en", "ko"]) {
      await language.language(page, locale);
      await sameNode(dialog, nodes.dialog);
      await sameNode(done, nodes.done);
      await expect(done).toBeFocused();
      await expect(dialog).toHaveAccessibleName("Fixture provider");
      await expect(
        dialog.getByRole("button", {
          name: locale === "ko" ? "닫기" : "Close",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => history.state.buzzNavigationV1.entry),
      ).toEqual(entry);
    }
    for (const sample of samples) {
      await language.sample(page, sample);
      await sameNode(dialog, nodes.dialog);
      await sameNode(done, nodes.done);
      await capture(
        page,
        info,
        `provider-${sample.width}-${sample.mode}-${sample.scale}`,
        dialog,
        hashes,
      );
    }
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const translated = page.getByRole("button", {
      name: "Fixture provider, 준비됨",
      exact: true,
    });
    await expect(translated).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "하네스 기본값", exact: true }),
    ).toBeVisible();
    await translated.press("Enter");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(translated).toBeFocused();
    expect(writes.slice(writeBaseline)).toEqual([]);
    await evidence(info, app, {
      hashes,
      writes,
      writeBaseline,
      entry,
      rawProvider: "Fixture provider",
      rawBody: "Done",
      unverified:
        "Provider body has no draft/check counter; attention, pending and raw config remain component-test coverage.",
    });
  } finally {
    await language.close();
  }
});

test("actual message media retains gallery nodes and localizes owned parent and video failure captions", async ({
  page,
  context,
  app,
}, info) => {
  const writes = forbidWrites(context),
    hashes = [],
    requests = [];
  await context.route("**/api/relay/primary/media?**", async (route) => {
    const raw = new URL(route.request().url()).searchParams.get("url");
    requests.push(raw);
    if (raw === new URL("https://primary.example/media/원본-photo.png").href)
      await route.fulfill({
        path: fileURLToPath(
          new URL("../../public/shell-gradient.png", import.meta.url),
        ),
        contentType: "image/png",
      });
    else if (
      raw === new URL("https://primary.example/media/원본-video.mp4").href
    )
      await route.fulfill({
        status: 200,
        contentType: "video/mp4",
        body: "deliberately invalid local fixture media",
      });
    else await route.fallback();
  });
  await openConversation(page, app);
  const language = await driver(context, app);
  const writeBaseline = await fixtureSetup(writes, app);
  try {
    await language.sample(page, samples[0]);
    const event = app.append(
      "primary",
      "alpha",
      "Raw gallery 한글 {count}",
      true,
      true,
      undefined,
      undefined,
      [
        [
          "imeta",
          "url https://primary.example/media/원본-photo.png",
          "m image/png",
          "filename 원본-photo.png",
          "dim 800x600",
        ],
      ],
    );
    const video = app.append(
      "primary",
      "alpha",
      "Raw failed video",
      true,
      true,
      undefined,
      undefined,
      [
        [
          "imeta",
          "url https://primary.example/media/원본-video.mp4",
          "m video/mp4",
          "filename 원본-video.mp4",
        ],
      ],
    );
    const row = page.locator(`[data-message-id="${event.id}"]`);
    const failed = page.locator(
      `[data-message-id="${video.id}"] [role="status"]`,
    );
    await expect(
      page.locator(`[data-message-id="${video.id}"]`).getByRole("status"),
    ).toHaveText("Video unavailable");
    await expect(failed).toHaveText("Video unavailable");
    const statusNode = await failed.elementHandle();
    const opener = row.getByRole("link", {
      name: "Open image attachment",
      exact: true,
    });
    const openerNode = await opener.elementHandle();
    await opener.click();
    const dialog = page.getByRole("dialog", {
      name: "Image viewer",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toHaveAttribute("data-review-opening");
    const image = dialog.getByRole("img", {
      name: "Attachment preview",
      exact: true,
    });
    await expect(image).toBeVisible();
    await image.evaluate((node) => node.decode());
    const nodes = {
      dialog: await dialog.elementHandle(),
      image: await image.elementHandle(),
    };
    const source = await image.getAttribute("src"),
      baseline = requests.length;
    const close = dialog.getByRole("button", {
      name: "Close fullscreen viewer",
      exact: true,
    });
    await close.focus();
    const closeNode = await close.elementHandle();
    for (const locale of ["ko", "en", "ko"]) {
      await language.language(page, locale);
      const live = page.getByRole("dialog", {
        name: locale === "ko" ? "이미지 뷰어" : "Image viewer",
        exact: true,
      });
      const liveImage = live.getByRole("img", {
        name: locale === "ko" ? "첨부 파일 미리보기" : "Attachment preview",
        exact: true,
      });
      await sameNode(live, nodes.dialog);
      await sameNode(liveImage, nodes.image);
      await expect(liveImage).toHaveAttribute("src", source);
      const liveClose = live.getByRole("button", {
        name:
          locale === "ko" ? "전체 화면 뷰어 닫기" : "Close fullscreen viewer",
        exact: true,
      });
      await sameNode(liveClose, closeNode);
      await expect(liveClose).toBeFocused();
      await sameNode(
        page.locator(`[data-message-id="${video.id}"] [role="status"]`),
        statusNode,
      );
      await expect(failed).toHaveText(
        locale === "ko" ? "동영상을 사용할 수 없습니다" : "Video unavailable",
      );
      expect(requests.length).toBe(baseline);
    }
    const live = page.getByRole("dialog", { name: "이미지 뷰어", exact: true });
    for (const sample of samples) {
      await language.sample(page, sample);
      await sameNode(live, nodes.dialog);
      await capture(
        page,
        info,
        `media-${sample.width}-${sample.mode}-${sample.scale}`,
        live,
        hashes,
        true,
      );
    }
    await live
      .getByRole("button", { name: "전체 화면 뷰어 닫기", exact: true })
      .press("Enter");
    await expect(live).toHaveCount(0);
    const localizedOpener = row.getByRole("link", {
      name: "첨부 이미지 열기",
      exact: true,
    });
    await sameNode(localizedOpener, openerNode);
    await expect(localizedOpener).toBeFocused();
    await expect(
      page.locator(`[data-message-id="${video.id}"]`).getByRole("status"),
    ).toHaveText("동영상을 사용할 수 없습니다");
    await expect(localizedOpener).toHaveAccessibleName("첨부 이미지 열기");
    await expect(
      row.getByRole("group", { name: "이미지 1개", exact: true }),
    ).toBeVisible();
    await expect(row).toContainText("Raw gallery 한글 {count}");
    expect(event.tags).toContainEqual([
      "imeta",
      "url https://primary.example/media/원본-photo.png",
      "m image/png",
      "filename 원본-photo.png",
      "dim 800x600",
    ]);
    expect(writes.slice(writeBaseline)).toEqual([]);
    await evidence(info, app, {
      hashes,
      writes,
      writeBaseline,
      requests,
      event,
      video,
      source,
      remaining:
        "Sequence/mixed collapsed labels, no-callback fallback viewer, source-undefined image and empty gallery remain component-only; no playback/decoder correctness claim.",
    });
  } finally {
    await language.close();
  }
});
