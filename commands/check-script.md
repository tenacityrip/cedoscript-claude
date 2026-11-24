---
description: Check CedoScript scripts for mistakes
argument-hint: [file or folder]
---

Use the cedoscript skill. Run its checker on $ARGUMENTS, or on every `.js` file in the current folder if nothing was
given. Then read each script for what the checker cannot see: missing null checks, work in packet handlers that belongs
on the client thread, heavy work per frame. Report problems by file and line; fix them only if asked.
