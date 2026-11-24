# CedoScript for Claude Code

Teaches [Claude Code](https://claude.com/claude-code) to write scripts for the [Tenacity](https://tenacity.rip)
Minecraft client. It knows the whole [script API](https://tenacity.rip/docs) and checks what it writes.

## Install

In Claude Code:

```
/plugin marketplace add tenacityrip/cedoscript-claude
/plugin install cedoscript@tenacityrip
```

## Use

Open Claude Code in your `Tenacity/Scripts` folder and ask, for example:

> Write a draggable target HUD with a health bar in my client colors.

| Command | What it does |
|---|---|
| `/cedoscript:new-script <idea>` | Writes a script and checks it |
| `/cedoscript:check-script [file]` | Finds mistakes: unknown API, missing capabilities, shadowed globals, syntax |

The checker needs Node 20 or newer. The plugin has no hooks or servers and makes no network requests.

Matches Tenacity 7.0. Read a script before you run it, whoever wrote it. For completion in your editor, see
[cedoscript-ide](https://github.com/tenacityrip/cedoscript-ide).

## Development

```sh
node --test
node scripts/check.mjs             # add --typings to compare with cedoscript-ide
claude plugin validate .
```

## For AI agents

Read [CLAUDE.md](CLAUDE.md). [llms.txt](llms.txt) indexes the files. Assistants other than Claude Code can read
[skills/cedoscript/SKILL.md](skills/cedoscript/SKILL.md) directly.

## License

[MIT](LICENSE). Not affiliated with Anthropic, Mojang or Microsoft.
