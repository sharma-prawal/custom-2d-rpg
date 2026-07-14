# Dev Log — Chapters of Us

A shared, tool-agnostic build journal. `dev-log.jsonl` sitting next to this
file is the source of truth; `npm run stats` turns it into `public/stats.json`,
which the in-game **Stats Terminal** (Behind the Scenes room) reads at
runtime.

## Format

One JSON object per line in `dev-log.jsonl`:

```jsonc
{"tool": "claude-code", "type": "session_start", "timestamp": "2026-07-07T14:00:00.000Z"}
{"tool": "claude-code", "type": "prompt", "timestamp": "2026-07-07T14:00:12.000Z", "text": "scaffold the project"}
{"tool": "claude-code", "type": "session_end", "timestamp": "2026-07-07T15:30:00.000Z"}
```

- `tool` — one of `claude-code`, `codex`, `antigravity`, or any other CLI you
  use. Free text, matched exactly when grouping stats.
- `type` — `session_start`, `session_end`, or `prompt`.
- `timestamp` — ISO 8601, UTC.
- `text` — required for `type: "prompt"`, the raw prompt text (even trivial
  ones — that's the point, this is meant to be funny/honest in the BTS room).

Hours worked per tool are computed by pairing consecutive
`session_start`/`session_end` timestamps; prompt counts are a simple tally.

## Automatic logging (Claude Code)

This project has a `UserPromptSubmit` hook and `SessionStart`/`Stop` hooks
configured in `.claude/settings.json` that append to `dev-log.jsonl`
automatically — nothing to do here, it just works during any Claude Code
session in this repo.

## Manual/other tools (Codex, Antigravity, etc.)

If a tool doesn't support an equivalent hook, append lines by hand (or ask
the tool to do it as a first/last action of a session) using the exact
format above with `"tool"` set to that tool's name. A minimal manual
session looks like:

```jsonc
{"tool": "codex", "type": "session_start", "timestamp": "2026-07-08T09:00:00.000Z"}
{"tool": "codex", "type": "prompt", "timestamp": "2026-07-08T09:00:05.000Z", "text": "add footstep sfx"}
{"tool": "codex", "type": "session_end", "timestamp": "2026-07-08T09:40:00.000Z"}
```

After editing, run `npm run stats` to regenerate `public/stats.json`.
