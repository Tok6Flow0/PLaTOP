---
name: platop
description: Show selected Codex teams as public activity states through the local PLaTOP MCP or CLI, or wrap an authorized local command with activity heartbeats. Use when the user asks to visualize team activity; this skill does not run their chats or business workflows.
---

# PLaTOP

PLaTOP is a small local 3D office. Characters show a team activity state; the playground is not the source of truth for chat execution. The bridge accepts only a stable team ID, a state, and an enum source. Keep transcripts, message bodies, customer details, credentials, task names, and private chat IDs out of telemetry and public repository files.

Prefer the locally registered PLaTOP MCP tools when the current host exposes them: `platop_status` reads the public snapshot; `platop_set_activity` accepts exactly `{ "teamId": "merchant", "state": "active" }` with the closed team/state vocabulary below. The host may prefix tool names with the MCP server name. Never pass paths, URLs, tokens, commands, task names, message text, or chat IDs as tool arguments. The MCP is a local stdio process; it talks only to the loopback bridge and reads its write token privately.

If MCP tools are not loaded in this chat, locate the user's PLaTOP repository and use `node <repo>/scripts/platop.mjs` as a fallback. The default bridge is `http://127.0.0.1:4317`; `npm start` serves a previously built UI. Read `<repo>/docs/ACTIVITY-BRIDGE.md` when configuring a client or creating a snapshot. MCP registration does not prove that a pre-existing chat has loaded the tools. A missing bridge means visualization is unavailable; do not invent live activity.

## Observe selected chats

Use the available native Codex `list_threads`, `read_thread`, or `wait_threads` tools for chats the user selected. Never read Codex private session files, databases, or logs to discover activity or bypass native tool access. A read-only snapshot does not authorize starting, prompting, scheduling, or changing a chat. If `<repo>/.local/team-mapping.json` exists, read that private user-selected mapping locally. Keep it out of all telemetry, outputs, and public files. Use the user's private local mapping of selected chat IDs to these stable teams: `merchant`, `hr`, `intake`, `support`, `reflection`, `email`. Ask for a mapping if the intended team is unclear; avoid exporting chat IDs to the bridge.

Map freshly observed execution status conservatively:

- Running or actively working: `active`.
- Idle or completed: `sleeping`.
- Waiting for user input, approval, or a recoverable failure: `waiting`.
- Not loaded, unavailable, ambiguous, or not observed: `unknown`.

For each observation, call `platop_set_activity` with the public team ID and observed state, or use `node <repo>/scripts/platop.mjs set <team> <state> --source codex` when the MCP is unavailable. Native tool availability and status fields vary by host: if a native tool cannot establish execution status, use `unknown`. Avoid reading chat output just to guess whether it is still running. A completed final response with current native idle status is sleeping; an old final response alone does not prove current idle.

For a bounded monitor explicitly requested by the user, prefer native `wait_threads` with cursors, then update public states when status changes. This initial skill provides manual or in-turn updates and command wrapping; it does not install a background native chat monitor. Do not create recurring automation unless separately requested.

## Show the current authorized work

For your own work in a mapped team, publish `active` when work begins and `sleeping` when it finishes, or `waiting` if you need user action. Publish `active` heartbeats about every 30 seconds during long work: activity becomes `unknown` after two minutes without an update. If an observation is unavailable or ambiguous, publish `unknown` when the bridge is reachable. A visualization failure should not stop the underlying authorized task. Use the known public team assignment in a scheduled task; never export the scheduler prompt or private chat mapping.

For an already authorized local command, prefer:

```sh
node <repo>/scripts/platop.mjs run <team> -- <executable> <argument> ...
```

The wrapper publishes active, sends heartbeats, and publishes sleeping on exit 0 or waiting on failure. It passes arguments directly to the executable. Do not introduce a shell command string or `sh -c` to turn untrusted text into code. The skill does not authorize any additional command, outreach, deployment, message, or live business action.

The local token and state stay in ignored `.local/`. Never display or copy the token into a prompt, URL, browser code, screenshot, snapshot, or committed file. The MCP and CLI read the token privately.
