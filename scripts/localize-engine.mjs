import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import OpenCC from "opencc-js";

const convert = OpenCC.Converter({ from: "cn", to: "twp" });
const han = /\p{Script=Han}/u;
// Keep links, HTML attributes and asset names byte-for-byte intact. Only
// language-bearing text is converted; URLs may contain simplified Chinese.
const protectedText = /(?:https?:\/\/[^\s<>"'`]+)|(?:\b(?:href|src|id|class|style|data-[\w-]+)\s*=\s*(?:"[^"]*"|'[^']*'))|(?:[^\s<>"'`]*\.(?:png|jpe?g|webp|gif|svg|woff2?|ttf|mp3|ogg|wav|mp4|js|mjs|css|json)(?:[?#][^\s<>"'`]*)?)/gi;

export function traditionalText(value) {
  if (!han.test(value)) return value;
  return value.split(new RegExp(`(${protectedText.source})`, "gi"))
    .map((part, index) => index % 2 ? part : convert(part)
      // Match the official Traditional Chinese role names in our source.
      .replaceAll("染汙者", "染污者").replaceAll("遊擊士", "游擊士")).join("");
}

// Localize strings at build time, including matching choice/result strings.
// A DOM-only converter would break upstream checks such as
// result.control === '选项一' or button.innerHTML === '添加收藏'.
// Do not reprint or recompile the program: replace only literal/token spans,
// leaving event steps, operators, numeric costs and ASCII identifiers intact.
export function localizeJavaScript(source, filename = "engine.js") {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const changes = [];
  function visit(node) {
    const start = node.getStart(ast), end = node.end;
    if (ts.isStringLiteral(node)) {
      const value = traditionalText(node.text);
      if (value !== node.text) changes.push([start, end, JSON.stringify(value)]);
    } else if (ts.isTemplateLiteralToken(node)) {
      // Preserve interpolation boundaries and raw escape sequences.
      const raw = source.slice(start, end), value = traditionalText(raw);
      if (value !== raw) changes.push([start, end, value]);
    } else if (ts.isIdentifier(node) || ts.isRegularExpressionLiteral(node)) {
      // Chinese object keys and references must agree with their string forms.
      const raw = source.slice(start, end), value = traditionalText(raw);
      if (value !== raw) changes.push([start, end, value]);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let localized = source;
  for (const [start, end, value] of changes.sort((a, b) => b[0] - a[0])) {
    localized = localized.slice(0, start) + value + localized.slice(end);
  }
  const result = ts.createSourceFile(filename, localized, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (result.parseDiagnostics.length > ast.parseDiagnostics.length) {
    throw new Error(`Traditional Chinese localization produced invalid JavaScript: ${filename}`);
  }
  return { source: localized, strings: changes.length };
}

export async function localizeEngine(root) {
  let files = 0, strings = 0;
  async function walk(folder) {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.name.endsWith(".js")) {
        const before = await fs.readFile(filename, "utf8");
        const result = localizeJavaScript(before, filename);
        if (result.strings) {
          await fs.writeFile(filename, result.source);
          files++; strings += result.strings;
        }
      }
    }
  }
  for (const folder of ["noname", "character", "card", "mode"]) await walk(path.join(root, folder));
  // Exclude bundled third-party compilers/polyfills and upstream asset lists.
  for (const file of ["game/config.js", "game/game.js", "game/entry.js", "game/fallback.js", "game/keyWords.js", "noname.js", "noname-compatible.js"]) {
    const filename = path.join(root, file);
    const result = localizeJavaScript(await fs.readFile(filename, "utf8"), file);
    if (result.strings) { await fs.writeFile(filename, result.source); files++; strings += result.strings; }
  }
  return { locale: "zh-Hant-TW", files, strings };
}
