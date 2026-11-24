/**
 * @fileoverview Checks CedoScript files without running them: syntax, unknown API, missing capabilities, shadowed
 * globals and things that do not exist in scripts. No dependencies, no network.
 *
 * Usage: node check-script.mjs <file or folder>...
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const reference = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "reference");
const typings = readFileSync(path.join(reference, "cedoscript.d.ts"), "utf8");
const caps = JSON.parse(readFileSync(path.join(reference, "capabilities.json"), "utf8"));

const invert = (section) => new Map(Object.entries(section).flatMap(([cap, names]) => names.map((n) => [n, cap])));
const gatedMembers = invert(caps.members);
const gatedEvents = invert(caps.events);

function interfaceMembers(type) {
    const body = new RegExp(`^interface ${type}(?:<[^\\n]*>)? \\{\\n([\\s\\S]*?)^\\}`, "m").exec(typings)?.[1] ?? "";
    return new Set([...body.matchAll(/^ {4}(?:readonly )?(\w+)[(:<]/gm)].map((m) => m[1]));
}

const globals = new Map(
    [...typings.matchAll(/^declare const (\w+): (\w+);/gm)].map(([, name, type]) => [name, interfaceMembers(type)]),
);
const functions = [...typings.matchAll(/^declare function (\w+)/gm)].map((m) => m[1]);
const reserved = new Set([...globals.keys(), ...functions]);
const scriptMembers = interfaceMembers("Script");
const busEvents = interfaceMembers("ScriptEvents");
const javaTypes = new Set(
    [...(/declare const Java: \{[\s\S]*?^\};/m.exec(typings)?.[0] ?? "").matchAll(/"([\w.]+)"/g)].map((m) => m[1]),
);
const MISSING = ["require", "fetch", "setTimeout", "setInterval", "XMLHttpRequest", "process", "window", "document"];
const HEADER = /^﻿?\s*\/\/\s*==Script==[^\n]*\n([\s\S]*?)\/\/\s*==\/Script==/;
const TOKENS = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g;

const blank = (source, strings) =>
    source.replace(TOKENS, (t) => (!strings && /^["']/.test(t) ? t : t.replace(/[^\n]/g, " ")));

/** Returns the problems in one script, as { line, message }. */
export function check(source, name = "script.js") {
    source = source.replace(/\r\n/g, "\n");
    const problems = [];
    const at = (index, message) => problems.push({ line: source.slice(0, index).split("\n").length, message });
    try {
        new vm.Script(source, { filename: name });
    } catch (e) {
        const line = Number(/:(\d+)\n/.exec(e.stack ?? "")?.[1] ?? 1);
        return [{ line, message: `syntax: ${e.message}` }];
    }

    const code = blank(source, true);
    const text = blank(source, false);
    const have = new Set(
        [...(HEADER.exec(source)?.[1] ?? "").matchAll(/@capability\s+(.+)/g)].flatMap((m) =>
            m[1].toLowerCase().split(/[\s,]+/).filter(Boolean),
        ),
    );
    if (!HEADER.test(source) && /\/\/\s*==Script==/.test(source)) {
        at(source.indexOf("==Script=="), "the header must be the first thing in the file and end with // ==/Script==");
    }
    for (const cap of have) {
        if (!(cap in caps.members)) at(source.indexOf("@capability"), `unknown capability ${cap}`);
    }

    const init = /\binitScript\s*\(/.exec(code);
    if (!init) at(0, "no initScript call, so the script has no module");
    const script = /\b(?:var|let|const)\s+(\w+)\s*=\s*initScript\s*\(/.exec(code)?.[1];
    const need = (cap, use, index) => {
        if (cap && !have.has(cap)) at(index, `${use} needs "// @capability ${cap}" in the header`);
    };

    const shadowed = new Set();
    for (const m of code.matchAll(/\b(?:var|let|const|function|class)\s+(\w+)/g)) {
        if (reserved.has(m[1])) {
            shadowed.add(m[1]);
            at(m.index, `${m[1]} hides the global with that name; rename it`);
        }
    }
    for (const m of code.matchAll(/(?<![\w$.])(\w+)\s*\??\.\s*(\w+)/g)) {
        const [, owner, member] = m;
        if (owner === script) {
            if (!scriptMembers.has(member)) at(m.index, `${owner}.${member} does not exist`);
            need(gatedMembers.get(`script.${member}`), `${owner}.${member}`, m.index);
        } else if (globals.has(owner) && !shadowed.has(owner)) {
            if (!globals.get(owner).has(member)) at(m.index, `${owner}.${member} does not exist`);
            need(gatedMembers.get(`${owner}.${member}`), `${owner}.${member}`, m.index);
        }
    }
    for (const m of text.matchAll(/(?<![\w$.])on\s*\(\s*["'](\w+)["']/g)) {
        if (!busEvents.has(m[1])) at(m.index, `there is no event "${m[1]}"`);
        need(gatedEvents.get(m[1]), `on("${m[1]}")`, m.index);
    }
    for (const m of text.matchAll(/\bJava\s*\.\s*type\s*\(\s*["']([^"']*)["']/g)) {
        if (!javaTypes.has(m[1])) at(m.index, `Java.type("${m[1]}") is not available`);
    }
    for (const m of code.matchAll(new RegExp(`(?<![\\w$.])(${MISSING.join("|")})(?=\\s*[(.])`, "g"))) {
        at(m.index, `${m[1]} does not exist in scripts`);
    }
    if (script && !new RegExp(`\\b${script}\\s*\\.\\s*on[A-Z]`).test(code) && !/(?<![\w$.])on\s*\(/.test(code)) {
        at(init.index, "no event is hooked, so the module does nothing");
    }
    return problems.sort((a, b) => a.line - b.line);
}

function files(target) {
    return statSync(target).isDirectory()
        ? readdirSync(target)
              .filter((f) => f.endsWith(".js"))
              .map((f) => path.join(target, f))
        : [target];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const targets = process.argv.slice(2);
    if (targets.length === 0) {
        console.error("usage: check-script.mjs <file or folder>...");
        process.exit(2);
    }
    let count = 0;
    for (const file of targets.flatMap(files)) {
        if (!file.endsWith(".js")) {
            console.log(`${file}: scripts are .js files`);
            count++;
            continue;
        }
        for (const p of check(readFileSync(file, "utf8"), path.basename(file))) {
            console.log(`${file}:${p.line}: ${p.message}`);
            count++;
        }
    }
    console.log(count ? `${count} problem(s)` : "ok");
    process.exitCode = count ? 1 : 0;
}
