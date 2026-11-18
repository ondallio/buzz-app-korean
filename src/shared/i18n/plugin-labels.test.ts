import { expect, it } from "vitest";
import { conversationFeatures } from "../../app/conversation-features";
import { english } from "./index";
import {
  ownedAgentTabLabel,
  ownedAgentTypeLabel,
  ownedPageLabel,
  ownedPanelLabel,
} from "./owned-labels";
import {
  pluginDescription,
  pluginName,
  pluginSubjectLabel,
} from "./plugin-labels";

const manifests = Object.values(
  import.meta.glob<{ id: string; name: string; description?: string }>(
    "../../bundled/*/manifest.json",
    { eager: true, import: "default" },
  ),
);

it("keeps every bundled manifest's text in the plugin catalog", () => {
  const all = [
    ...manifests,
    ...conversationFeatures.map(({ manifest }) => manifest),
  ];
  for (const manifest of all) {
    const name = `fuplugins.name.${manifest.id}`;
    const description = `fuplugins.description.${manifest.id}`;
    expect(english[name as keyof typeof english], name).toBe(manifest.name);
    expect(english[description as keyof typeof english], description).toBe(
      manifest.description,
    );
  }
});

it("translates bundled names only at display time", () => {
  const watching = {
    manifest: {
      id: "buzz.watching",
      name: "Attention",
      description:
        "Show and control what each agent is watching. While it is off, agents' watches don't run on this device.",
    },
    source: "bundled" as const,
  };
  expect(pluginName(watching, "ko")).toBe("지켜보기");
  expect(pluginName(watching, "en")).toBe("Attention");
  expect(pluginDescription(watching, "en")).toBe(watching.manifest.description);
  expect(pluginName({ ...watching, source: "external" }, "ko")).toBe(
    "Attention",
  );
  expect(
    pluginName({ manifest: { ...watching.manifest, name: "Mine" } }, "ko"),
  ).toBe("Mine");
  expect(
    pluginDescription({ manifest: { id: "x.y", name: "Y" } }, "ko"),
  ).toBeUndefined();
});

it("localizes owned panel titles and common access subjects", () => {
  expect(
    ownedPanelLabel({ key: "buzz.channels/canvas", title: "Canvas" }, "ko"),
  ).toBe("캔버스");
  expect(
    ownedPanelLabel({ key: "other.plugin/canvas", title: "Canvas" }, "ko"),
  ).toBe("Canvas");
  expect(pluginSubjectLabel("Workspace", "ko")).toBe("작업 공간");
  expect(pluginSubjectLabel("Workspace", "en")).toBe("Workspace");
  expect(pluginSubjectLabel("board", "ko")).toBe("board");
});

it("localizes bundled Bestie and Shared Compute registration titles", () => {
  expect(ownedPageLabel("buzz.bestie/bestie", "Bestie", "ko")).toBe("베스티");
  expect(
    ownedAgentTabLabel("buzz.bestie/former-bestie", "Former Bestie", "ko"),
  ).toBe("이전 베스티");
  expect(
    ownedAgentTabLabel(
      "buzz.mesh-compute/mesh#transcript",
      "Transcripts",
      "ko",
    ),
  ).toBe("대화 기록");
  expect(
    ownedAgentTabLabel("buzz.codex/codex#settings", "Settings", "en"),
  ).toBe("Settings");
  expect(
    ownedAgentTypeLabel("buzz.mesh-compute/mesh", "Shared Compute", "ko"),
  ).toBe("공유 컴퓨팅");
  expect(ownedAgentTypeLabel("other/mesh", "Shared Compute", "ko")).toBe(
    "Shared Compute",
  );
});
