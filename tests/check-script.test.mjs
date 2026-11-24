import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { check } from "../skills/cedoscript/scripts/check-script.mjs";

const init = 'const script = initScript({ name: "a", description: "", author: "" });\n';
const messages = (source) => check(source).map((p) => p.message);

test("the example and the script in SKILL.md are clean", () => {
    const read = (p) => readFileSync(new URL(`../skills/cedoscript/${p}`, import.meta.url), "utf8").replace(/\r/g, "");
    assert.deepEqual(check(read("examples/target-hud.js")), []);
    assert.deepEqual(check(/```js\n([\s\S]*?)```/.exec(read("SKILL.md"))[1]), []);
});

test("finds syntax errors with their line", () => {
    const [problem] = check(`${init}script.onTick(() => {`);
    assert.match(problem.message, /^syntax/);
    assert.ok(problem.line >= 2);
});

test("finds unknown members, events and Java types", () => {
    assert.deepEqual(
        messages(`${init}script.onTick(() => player.fly());\nscript.onFoo(() => {});\non("nope", () => {});\nJava.type("java.io.File");`),
        ["player.fly does not exist", "script.onFoo does not exist", 'there is no event "nope"', 'Java.type("java.io.File") is not available'],
    );
});

test("finds missing capabilities", () => {
    const source = `${init}script.onMotion(() => player.jump());`;
    assert.equal(messages(source).length, 2);
    assert.deepEqual(messages(`// ==Script==\n// @capability movement\n// ==/Script==\n${source}`), []);
});

test("finds a header that is not first, and unknown capabilities", () => {
    assert.match(messages(`${init}// ==Script==\n// ==/Script==\nscript.onTick(() => {});`)[0], /header must be the first/);
    assert.match(messages(`// ==Script==\n// @capability fly\n// ==/Script==\n${init}script.onTick(() => {});`)[0], /unknown capability/);
});

test("finds shadowed globals and browser or Node API", () => {
    assert.deepEqual(messages(`${init}script.onTick(() => { const font = 1; setTimeout(() => {}, 1); });`), [
        "font hides the global with that name; rename it",
        "setTimeout does not exist in scripts",
    ]);
});

test("ignores comments and strings", () => {
    assert.deepEqual(messages(`${init}script.onTick(() => { /* player.fly() */ print("player.fly() setTimeout("); });`), []);
});
