# CLAUDE.md

One Claude Code plugin with one skill, two commands and a checker.

- `skills/cedoscript/reference/` is copied from cedoscript-ide's `typings/`. Never edit it here.
- `scripts/check-script.mjs` inside the skill reads the reference, so new API needs no change to it.
- SKILL.md holds only what the typings cannot say. Keep it short, and keep its example passing the checker.
- Never describe API that is not in the reference.
- Commits follow Conventional Commits and carry no AI-attribution trailers. You own every commit.
