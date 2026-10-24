import { readFile, writeFile, mkdir, cp, rm, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCatalog } from "./engine-catalog.mjs";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pin = JSON.parse(
  await readFile(path.join(root, "vendor/noname/pin.json"), "utf8"),
);
const output = path.join(root, "public/engine");
const cache = path.join(root, ".engine-cache");
const archive = path.join(cache, `${pin.commit}.tar.gz`);
await mkdir(cache, { recursive: true });
let bytes;
try {
  bytes = await readFile(archive);
} catch {
  console.log("Downloading pinned, GPL-3.0 noname engine…");
  const response = await fetch(
    `https://codeload.github.com/${pin.repository}/tar.gz/${pin.commit}`,
    { signal: AbortSignal.timeout(180000) },
  );
  if (!response.ok)
    throw new Error(`Engine download failed: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (createHash("sha256").update(bytes).digest("hex") !== pin.archiveSha256)
  throw new Error("Engine archive checksum mismatch");
await writeFile(archive, bytes);
const unpack = path.join(cache, pin.commit);
await rm(unpack, { recursive: true, force: true });
await mkdir(unpack, { recursive: true });
execFileSync("tar", ["-xzf", archive, "--strip-components=1", "-C", unpack]);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const item of [
  "audio",
  "card",
  "character",
  "font",
  "game",
  "image",
  "layout",
  "mode",
  "noname",
  "theme",
  "noname.js",
  "noname-compatible.js",
  "LICENSE",
]) {
  await cp(path.join(unpack, item), path.join(output, item), {
    recursive: true,
  });
}
// The imported browser engine is self-hosted. It must not submit matches,
// connect to the upstream public hall, or install remote extensions.
async function patch(file, before, after) {
  const location = path.join(output, file);
  const text = await readFile(location, "utf8");
  if (!text.includes(before))
    throw new Error(`Pinned engine patch no longer matches: ${file}`);
  await writeFile(location, text.replace(before, after));
}
await patch(
  "noname/library/index.js",
  'configprefix = "noname_0.9_"',
  'configprefix = "star_grail_full_v1_"',
);
await patch(
  "noname/library/index.js",
  "dbURL = 'https://agdatabase.ssyy.tech:50000'",
  "dbURL = ''",
);
await patch(
  "noname/library/index.js",
  'hallURL = "agserver.ssyy.tech:50000"',
  'hallURL = ""',
);
// Direct launch bypasses the upstream settings menu that normally writes
// defaults. Populate every missing mode setting before the mode starts.
await patch(
  "noname/init/index.js",
  "const config2 = await loadConfigPromise;",
  `const config2 = await loadConfigPromise;
  for (const [key, setting] of Object.entries(lib.mode.xingBei.config)) {
    const storedKey = key + '_mode_config_xingBei';
    if (config2[storedKey] === undefined && setting.init !== undefined) config2[storedKey] = setting.init;
  }`,
);
// The embedded mode uses localStorage (nodb). IndexedDB may exist in the
// browser even though this engine has no open database; replay saving must
// never interrupt victory/defeat cleanup in that case.
await patch(
  "noname/game/index.js",
  "if (!_status.video && vinum && game.getVideoName && window.indexedDB && _status.videoInited)",
  "if (!_status.video && vinum && game.getVideoName && window.indexedDB && lib.db && _status.videoInited)",
);
const modePath = path.join(output, "mode/xingBei.js");
let mode = await readFile(modePath, "utf8");
const start = mode.indexOf("submitMatchData:async function(matchData){");
const end = mode.indexOf("checkResult:function(){", start);
if (start < 0 || end < 0)
  throw new Error("Match submission patch does not match");
mode =
  mode.slice(0, start) +
  "submitMatchData:async function(){ /* Local game: no upstream submission. */ },\n\t\t\t" +
  mode.slice(end);
await writeFile(modePath, mode);
// Remove community character registrations, not just their menu buttons.
const specialPath = path.join(output, "character/teDian.js");
let special = await readFile(specialPath, "utf8");
const ast = ts.createSourceFile(
  "teDian.js",
  special,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
const removals = [];
function visit(node) {
  if (
    ts.isPropertyAssignment(node) &&
    node.name.getText(ast) === "character" &&
    ts.isObjectLiteralExpression(node.initializer)
  ) {
    for (const p of node.initializer.properties)
      if (
        pin.excludedSpecialCharacters.includes(
          p.name?.getText(ast).replace(/^['"]|['"]$/g, ""),
        )
      ) {
        let end = p.end;
        if (special[end] === ",") end++;
        removals.push([p.getStart(ast), end]);
      }
  }
  ts.forEachChild(node, visit);
}
visit(ast);
for (const [start, end] of removals.sort((a, b) => b[0] - a[0]))
  special = special.slice(0, start) + special.slice(end);
special =
  'import { installOfficialGlutton } from "./official-glutton.js";\n' +
  special
    .replace("return {", "return installOfficialGlutton({")
    .replace(/\n    };\s*\n\}\);\s*$/, "\n    });\n});\n");
await writeFile(specialPath, special);
await cp(
  path.join(output, "image/character/nong_baoShiShaoNv.jpg"),
  path.join(output, "image/character/baoShiShaoNv.jpg"),
);
for (const file of [
  "character/poXiao.js",
  "character/boss.js",
  "mode/boss.js",
  "mode/leaderboard.js",
  "mode/connect.js",
  "game/server.js",
])
  await rm(path.join(output, file), { force: true });
// Only the explicitly selected editions appear in the game menus.
await writeFile(
  path.join(output, "game/package.js"),
  `window.noname_package = ${JSON.stringify({ character: { shiZhouNian: "十週年", yiDuanYeHuo: "異端業火", shenZiChuangLin: "神子創臨", zhongMoDaoZhu: "終末禱鑄", teDian: "特典", sanBan: "三版（舊版）", siBan: "四版（舊版）" }, card: { xingBei: "星杯傳說" }, play: {}, mode: { xingBei: "星杯傳說", illustration: "圖鑑", tutorial: "教學" }, submode: {}, background: {}, music: {}, font: {}, theme: { music: "星杯" } })};`,
);
await cp(path.join(root, "vendor/noname/overrides"), output, {
  recursive: true,
});
// Share the same Three.js flight renderer with the React core mode.
const motionSource = await readFile(path.join(root, "lib/card-motion.ts"), "utf8");
const motionModule = ts.transpileModule(motionSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace('from "three"', 'from "./vendor/three.module.js"');
await writeFile(path.join(output, "card-motion.js"), motionModule);
await mkdir(path.join(output, "vendor"), { recursive: true });
for (const name of ["three.module.js", "three.core.js"])
  await cp(
    path.join(root, "node_modules/three/build", name),
    path.join(output, "vendor", name),
  );
const catalog = await createCatalog(output, pin);
await writeFile(path.join(output, "catalog.json"), JSON.stringify(catalog));
await writeFile(
  path.join(root, "public/full-engine/catalog.json"),
  JSON.stringify(catalog),
);
await cp(
  path.join(root, "vendor/noname/NOTICE.md"),
  path.join(output, "NOTICE.md"),
);
await writeFile(
  path.join(output, "build.json"),
  JSON.stringify({
    commit: pin.commit,
    sha256: pin.archiveSha256,
    characters: catalog.characters.length,
    deck: catalog.deck.length,
  }),
);
console.log(
  `Prepared ${catalog.characters.length} current-edition characters, ${catalog.legacyCharacters.length} legacy variants and ${catalog.deck.length} physical cards.`,
);
