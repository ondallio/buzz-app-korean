// 원본 업데이트(이전 태그 → 새 태그)가 한글화에 미치는 영향을 보고한다.
//  1) changedSource: 이전 원본에 있던 카탈로그 영어 문장이 새 원본에서 사라짐
//     → 원본이 문장을 고쳤거나 지웠다. 충돌 없이 조용히 들어오므로 반드시 확인.
//  2) untranslated: 새 원본에서 추가된 줄 중 화면 문구로 보이는 영어가
//     현재 작업 트리에도 그대로 남아 있음 → 번역 필요 후보.
// 사용: node scripts/korean/upstream-text-report.mjs <이전태그> <새태그> [--json 파일]
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "rolldown/utils";

const root = fileURLToPath(new URL("../../", import.meta.url));
const [from, to] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const jsonIndex = process.argv.indexOf("--json");
const jsonOut = jsonIndex > 0 ? process.argv[jsonIndex + 1] : undefined;
if (!from || !to) {
  console.error(
    "usage: upstream-text-report.mjs <from-ref> <to-ref> [--json out]",
  );
  process.exit(2);
}

const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 512,
  });

const SOURCE = /^src\/.*\.(ts|tsx)$/;
const SKIP =
  /(\.test\.|\.stories\.|\/i18n\/|^src\/design\/|test-support|fixtures)/;
const sourceFiles = (ref) =>
  git("ls-tree", "-r", "--name-only", ref, "--", "src")
    .split("\n")
    .filter((file) => SOURCE.test(file) && !SKIP.test(file));

const normalize = (text) =>
  text
    .replace(/\\n/g, " ")
    .replace(/\\(["'`])/g, "$1")
    .replace(/\{" "\}/g, " ")
    .replace(/\s+/g, " ");

function corpus(ref) {
  const files = sourceFiles(ref);
  const chunks = [];
  for (let i = 0; i < files.length; i += 200) {
    const batch = files.slice(i, i + 200).map((file) => `${ref}:${file}`);
    chunks.push(
      execFileSync("git", ["cat-file", "--batch"], {
        cwd: root,
        input: batch.join("\n"),
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 512,
      }),
    );
  }
  return normalize(chunks.join("\n"));
}

async function englishCatalog() {
  const directory = path.join(root, "src/shared/i18n/catalogs");
  const english = {};
  for (const name of (await fs.readdir(directory)).filter((n) =>
    n.endsWith(".ts"),
  )) {
    const file = path.join(directory, name);
    const result = transformSync(file, await fs.readFile(file, "utf8"));
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(result.code).toString("base64")}`
    );
    Object.assign(english, module.en);
  }
  return english;
}

// 변수({name}) 사이의 고정 조각 중 가장 긴 것으로 원본에서 찾는다.
const probe = (message) =>
  normalize(message)
    .split(/\{[a-zA-Z][a-zA-Z0-9_]*\}/)
    .map((part) => part.trim())
    .sort((a, b) => b.length - a.length)[0] ?? "";

const before = corpus(from);
const after = corpus(to);
const english = await englishCatalog();
const changedSource = [];
for (const [key, message] of Object.entries(english)) {
  const text = probe(message);
  // 짧은 조각("Save", "Cancel")은 어디에나 있어 판정이 무의미하다.
  if (text.length < 12 || !/[a-z]{3}/.test(text)) continue;
  if (before.includes(text) && !after.includes(text))
    changedSource.push({ key, english: message });
}

const UI_TEXT = [
  /(?:title|label|aria-label|description|placeholder|subtitle|message|alt)=["`]([A-Z][^"`{]*[a-z][^"`]*)["`]/g,
  /(?:title|label|aria-label|description|placeholder|subtitle|message):\s*["`]([A-Z][^"`]*[a-z][^"`]*)["`]/g,
  /^\s*([A-Z][a-z’']+(?: [A-Za-z’',.:!?—-]+){1,})\s*$/g,
  />([A-Z][a-z’']+(?: [A-Za-z’',.!?]+)+)</g,
  /(?:notify|toast(?:\.\w+)?|setError|setStatus)\(\s*["`]([A-Z][^"`]*[a-z][^"`]*)["`]/g,
];
const diff = git("diff", "-U0", from, to, "--", "src");
const untranslated = [];
let file;
const current = new Map();
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ ")) {
    file = line.slice(6);
    continue;
  }
  if (!file || !SOURCE.test(file) || SKIP.test(file)) continue;
  if (!line.startsWith("+") || line.startsWith("+++")) continue;
  const text = line.slice(1);
  if (/^\s*(\/\/|\*|\/\*|import |export type|console\.|throw )/.test(text))
    continue;
  if (/\bt\(|rich\(|localMessage\(/.test(text)) continue;
  const found = UI_TEXT.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => match[1].trim()),
  );
  if (!found.length) continue;
  if (!current.has(file)) {
    current.set(
      file,
      await fs.readFile(path.join(root, file), "utf8").catch(() => ""),
    );
  }
  // 이미 번역해서 현재 파일에 그 줄이 없으면 제외한다.
  if (!current.get(file).includes(text.trim())) continue;
  for (const english of found)
    untranslated.push({ file, english, line: text.trim() });
}

const report = { from, to, changedSource, untranslated };
if (jsonOut)
  await fs.writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
console.log(`## 원본 텍스트 영향 보고 (${from} → ${to})\n`);
console.log(
  `### 원본 영어 문장이 바뀌었거나 사라진 번역 키: ${changedSource.length}개`,
);
for (const item of changedSource)
  console.log(`- \`${item.key}\`: ${item.english}`);
console.log(
  `\n### 새로 추가됐고 아직 번역되지 않은 영어 문구 후보: ${untranslated.length}개`,
);
for (const item of untranslated)
  console.log(`- \`${item.file}\`: ${item.english}`);
process.exitCode = changedSource.length || untranslated.length ? 1 : 0;
