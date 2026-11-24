---
name: cedoscript
description: This skill should be used when writing, fixing, reviewing or porting CedoScript scripts for the Tenacity Minecraft client, when a JavaScript file calls initScript, or when the user asks for a "Tenacity script", "cedoscript", a Tenacity HUD, module or packet script, or asks why a Tenacity script does not load.
---

# CedoScript

JavaScript scripts for Tenacity, a Minecraft 1.8.9 client. Each script is one `.js` file in `Tenacity/Scripts`; saving
it reloads it. A script declares one module, which the user turns on in the client under Scripts.

## Workflow

1. Look up every member you use in [reference/cedoscript.d.ts](reference/cedoscript.d.ts) before writing. It is the
   complete API. Grep it: `interface PlayerBinding`, `interface RenderBinding`, `interface Script {`. If it is not
   there, it does not exist; say so instead of inventing it.
2. Write the script from the shape below. [examples/target-hud.js](examples/target-hud.js) shows most features.
3. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/cedoscript/scripts/check-script.mjs" <file>` and fix what it reports.
4. Tell the user what you could not test: scripts only run inside the client.

## Shape

```js
// ==Script==
// @name        Auto Jump
// @version     1.0
// @capability  movement
// ==/Script==

const script = initScript({ name: "Auto Jump", description: "Jumps when you land", author: "you" });
const delay = script.numberSetting("Delay", 200, 0, 1000, 50);
const timer = client.createTimer();

script.onMotion((event) => {
    if (event.isPre() && player.onGround() && timer.hasTimeElapsed(delay.getValue(), true)) player.jump();
});
```

## Capabilities

The header must be the first thing in the file. A gated member is `undefined` without its capability, so the symptom is
"is not a function". Ask only for what the script uses.

| Capability | Unlocks |
|---|---|
| `movement` | `onMotion`, `onMove`, `onSafeWalk`, `player` setters and `jump`, `world.setTimer` |
| `packets` | `onPacketSend`, `onPacketReceive`, `sendPacket` |
| `chat` | `onChatReceived`, `onPlayerSendMessage`, `player.sendMessage` |

[reference/capabilities.json](reference/capabilities.json) has the exact list.

## Rules

- No `import`, `require`, `fetch`, `setTimeout`, files or Java classes. `Java.type` gives stand-ins for a fixed list of
  names (see the typings) and throws for the rest. For delays use `client.createTimer()` in a tick handler.
- Never name a variable after a global (`color`, `font`, `render`, `player`, `client`, `packet`, `world`, `action`,
  `stats`, `user`, `keys`, `mouse`, `gl`, `gl20`, `on`, `off`). `const color = color(...)` cannot run.
- Check for null: `client.getAuraTarget()`, `client.getModule()`, `get*Setting()`, `getHeldItem()`, `getUUID()`.
- `player.*` throws outside a world, and ticks run in menus too. A handler that throws is turned off, so do not touch
  `player` at the top level, and start per-world work in `onWorldLoad` or a render or motion handler.
- Each call has 250 ms. A handler that overruns is off until the script reloads. Keep render handlers light and create
  settings, timers, animations, drags, shaders and framebuffers once, at the top level.
- Packet handlers run on the network thread. Read and cancel there; set a flag and do game work in `onTick`. Drawing and
  most `player` setters are refused off the client thread.
- Draw only in `onRender2D`, `onShader` (2D) or `onRender3D` (`render.drawBoundingBox`). To blur or glow a shape, draw
  the same shape again in `onShader`.
- Set a drag's width and height every frame.
- `ShaderUtil` sources are GLSL 4.10 core: `in vec2 v_uv;`, `layout(location = 0) out vec4 fragColor;`. No
  `gl_FragColor`, `texture2D` or `gl_TexCoord`.
- `Java.type("org.lwjgl.opengl.GL20")` is SafeGL20: own shaders and programs, no buffers, no `#extension`. Without a
  vertex shader draw `glDrawArrays(GL20.GL_TRIANGLES, 0, 3)`. Matrices are plain arrays. Prefer `ShaderUtil` for one
  fragment shader.
- `notification.post` takes milliseconds. Colors are `color({ red, green, blue, alpha })` or `color({ hex })`.
- Handlers belong on `script` (`script.onTick`), one per event. `on("tick", fn)` also works and allows several.

## Porting old scripts

- Add the header with the capabilities the checker names.
- `client.getClientColors()` is a pair: use `getFirst()` and `getSecond()`, not `[0]` and `[1]`.
- `client.getIRCUsernameMap()` returns a plain object, so use `map[name]`. `.load` share codes are gone.
- Java streams are gone; use array methods. `size()`, `get(i)` and `contains()` still work on lists.

Docs for people: https://tenacity.rip/docs
