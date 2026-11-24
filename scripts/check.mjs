/**
 * @fileoverview Repository checks: manifests, skill frontmatter, machine paths and secrets. With --typings, also that
 * the reference matches the latest cedoscript-ide.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const problems = [];

const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
const market = JSON.parse(read(".claude-plugin/marketplace.json"));
if (!/^\d+\.\d+\.\d+$/.test(plugin.version)) problems.push("plugin.json: version must be semver");
if (!market.plugins.some((p) => p.name === plugin.name)) problems.push("marketplace.json: plugin not listed");
if (!read("CHANGELOG.md").includes(`## ${plugin.version} `)) problems.push("CHANGELOG.md: version missing");

const skill = read("skills/cedoscript/SKILL.md");
const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? "";
const description = /^description: (.+)$/m.exec(front)?.[1] ?? "";
if (!/^name: cedoscript$/m.test(front)) problems.push("SKILL.md: name must equal the directory");
if (!description || description.length > 1024 || description.includes(": ")) problems.push("SKILL.md: description");
for (const [, link] of skill.matchAll(/\]\((?!https?:)([^)]+)\)/g)) {
    if (!existsSync(path.join(root, "skills/cedoscript", link))) problems.push(`SKILL.md: broken link ${link}`);
}

const MACHINE_PATH = /([A-Za-z]:\\Users\\|\/home\/[a-z]|\/Users\/[A-Za-z])/;
const SECRET = /(gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8" });
for (const file of files.split("\n").filter((f) => f && f !== "scripts/check.mjs")) {
    if (MACHINE_PATH.test(read(file))) problems.push(`${file}: machine path`);
    if (SECRET.test(read(file))) problems.push(`${file}: possible secret`);
}

if (process.argv.includes("--typings")) {
    for (const file of ["cedoscript.d.ts", "capabilities.json"]) {
        const url = `https://raw.githubusercontent.com/tenacityrip/cedoscript-ide/main/typings/${file}`;
        const latest = await (await fetch(url)).text();
        if (latest.replace(/\r\n/g, "\n") !== read(`skills/cedoscript/reference/${file}`)) {
            problems.push(`reference/${file}: differs from cedoscript-ide`);
        }
    }
}

for (const p of problems) console.error(p);
console.log(problems.length ? `${problems.length} problem(s)` : "ok");
process.exitCode = problems.length ? 1 : 0;
