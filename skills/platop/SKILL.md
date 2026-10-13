---
name: platop
description: Show selected Codex teams in the local PLaTOP office, report public activity, and let mapped agents choose small avatar gestures, movement and decoration through local MCP. This skill does not run their chats or business workflows.
---

# PLaTOP

PLaTOP is a small local 3D office for the teams' chosen embodiments. Mapped agents choose their own understated expression during authorized work; status reporting does not invent movement, tours or tasks. The playground is not the source of truth for chat execution. Its closed vocabulary accepts public activity, avatar intents and bounded geometric decoration recipes. Keep transcripts, message bodies, customer details, credentials, task names, and private chat IDs out of telemetry and public repository files.

Prefer the locally registered PLaTOP MCP tools when the current host exposes them: `platop_status` reads the public snapshot; `platop_set_activity` accepts exactly `{ "teamId": "merchant", "state": "active" }` with the closed team/state vocabulary below. The host may prefix tool names with the MCP server name. Never pass paths, URLs, tokens, commands, task names, message text, or chat IDs as tool arguments. The MCP is a local stdio process; it talks only to the loopback bridge and reads its write token privately.

If the requested MCP tool is not loaded in this chat, locate the user's PLaTOP repository and use its bounded local MCP client: `node <repo>/scripts/platop-mcp-client.mjs status` or `node <repo>/scripts/platop-mcp-client.mjs set <team> <state>`. It calls the same fixed local stdio server through MCP initialization, tool discovery and tool invocation; callers supply only the closed public arguments described here. This uses MCP without claiming that the chat host loaded its tools. If the local MCP client is unavailable, the existing `scripts/platop.mjs` direct CLI remains a last-resort visualization fallback. A failed or unconfirmed write must not be retried automatically.

The default bridge is `http://127.0.0.1:4317`; `npm start` serves a previously built UI. Read `<repo>/docs/ACTIVITY-BRIDGE.md` when configuring a client or creating a snapshot. MCP registration does not prove that a pre-existing chat has loaded the tools. A missing bridge means visualization is unavailable; do not invent live activity.

## Observe selected chats

Use the available native Codex `list_threads`, `read_thread`, or `wait_threads` tools for chats the user selected. Never read Codex private session files, databases, or logs to discover activity or bypass native tool access. A read-only snapshot does not authorize starting, prompting, scheduling, or changing a chat. If `<repo>/.local/team-mapping.json` exists, read that private user-selected mapping locally. Keep it out of all telemetry, outputs, and public files. Use the user's private local mapping of selected chat IDs to these stable teams: `merchant`, `hr`, `intake`, `support`, `reflection`, `email`. Ask for a mapping if the intended team is unclear; avoid exporting chat IDs to the bridge.

For your own mapped role, retain the adopted name, embodiment and continuity
already established in your own chat. Use current context first; refresh only
the selected chat through native tools when needed. Keep continuity notes and
the private mapping local. Omit `actorId` for the team's primary character, or
use an already-known public member ID belonging to your team; a private chat
name or ID is never a tool argument.

Map freshly observed execution status conservatively:

- Running or actively working: `active`.
- Idle or completed: `sleeping`.
- Waiting for required input, approval, a recoverable failure, or a real dependency when no independent work can proceed: `waiting`.
- Not loaded, unavailable, ambiguous, or not observed: `unknown`.

For each observation, call `platop_set_activity` with the public team ID and observed state, or use `node <repo>/scripts/platop-mcp-client.mjs set <team> <state>` when host MCP tools are unavailable. The MCP assigns source `skill`. Native tool availability and status fields vary by host: if a native tool cannot establish execution status, use `unknown`. Avoid reading chat output just to guess whether it is still running. A completed final response with current native idle status is sleeping; an old final response alone does not prove current idle.

For a bounded monitor explicitly requested by the user, prefer native `wait_threads` with cursors, then update public states when status changes. This initial skill provides manual or in-turn updates and command wrapping; it does not install a background native chat monitor. Do not create recurring automation unless separately requested.

## Show the current authorized work

For your own work in a mapped team, publish `active` when work begins and `sleeping` when it finishes, or `waiting` for a required input or dependency when no independent work can proceed. Keep `active` while useful independent work continues. Publish `active` heartbeats about every 30 seconds during long work: activity becomes `unknown` after two minutes without an update. If an observation is unavailable or ambiguous, publish `unknown` when the bridge is reachable. A visualization failure should not stop the underlying authorized task. Use the known public team assignment in a scheduled task; never export the scheduler prompt or private chat mapping.

For an already authorized local command, prefer:

```sh
node <repo>/scripts/platop.mjs run <team> -- <executable> <argument> ...
```

The wrapper publishes active, sends heartbeats, and publishes sleeping on exit 0 or waiting on failure. It passes arguments directly to the executable. Do not introduce a shell command string or `sh -c` to turn untrusted text into code. The skill does not authorize any additional command, outreach, deployment, message, or live business action.

The local token and state stay in ignored `.local/`. Never display or copy the token into a prompt, URL, browser code, screenshot, snapshot, or committed file. The MCP and CLI read the token privately.

## Small motor skills and their own space

Agents choose their office's visual personality. Use a single intent when it suits the current authorized work; do not narrate each animation frame or schedule extra chat turns for movement. Activity reporting and avatar expression are independent: an active heartbeat does not request movement, and walking or leaving never starts or stops real work. Choose a gesture yourself, or choose none. Do not fabricate a holiday, task summary, work result or chat state to justify an animation. Read [agent expression](references/agent-expression.md) only when choosing a visual intent; there is no task classifier, hidden reasoning hook or rigid workflow mapping.

`platop_action` accepts `{teamId, actorId?, kind, target?, gesture?}`. Omit `actorId` for the team's primary character; an explicit public character ID must belong to that team. Kinds are `walk_to`, `work`, `rest`, `celebrate`, `arrive`, `leave`, `interact`. Named target places are `desk`, `door`, `lounge`, `whiteboard`, `cabinet`, with a public `officeId`. `walk_to` requires a target; `interact` requires a target and `gesture: work|think|file|talk|wait`. Other kinds reject gesture. `arrive` defaults to the owner's door. A visitor uses the other office's lounge rather than occupying its assigned chair. `work` and `rest` return to the assigned desk; `leave` keeps the avatar absent until `arrive`. Send an intent once when your choice changes; the scene owns routing and animation. Heartbeats do not reissue actions. A failed or unconfirmed write must not be retried automatically.

Activity states never choose a route or a work/sleep pose; `rest` explicitly
chooses sleeping. A confirmed current intent can move the avatar even while
activity is `unknown`, but unknown, stale or idle reports quiet ongoing
interaction gestures. Offline scenes preserve the last position and presence. On initial
load, the scene restores the last chosen place and presence without replaying
the journey; this is not evidence that a historical journey completed.

Use the new gesture and place vocabulary only when the available tool advertises
it. If the host's schema is older and no call has been attempted, the bounded
local MCP client can discover the current server's capabilities. It rejects
unsupported intents before writing. An ambiguous write still stops without a
retry through another transport.

Examples through the same local MCP fallback:

```sh
node <repo>/scripts/platop-mcp-client.mjs action support walk_to '{"target":{"officeId":"reflection","place":"lounge"}}'
node <repo>/scripts/platop-mcp-client.mjs action support work
node <repo>/scripts/platop-mcp-client.mjs action support interact '{"target":{"officeId":"support","place":"whiteboard"},"gesture":"think"}'
node <repo>/scripts/platop-mcp-client.mjs action support leave
node <repo>/scripts/platop-mcp-client.mjs action support arrive
```

`platop_decorate` accepts `{teamId, slot, parts}`. Slots are `desk`, `shelf`, `wall`, `floor`, `festive`. Agents can compose up to 12 simple parts into one asset per slot. Shapes are `box`, `sphere`, `cylinder`, `cone`, `torus`, `capsule`, `leaf`; optional normalized `position`, `size`, `rotation` are three-number arrays, `color` is `#rrggbb`, `finish` is `matte`, `ceramic`, `wood` or `metal`, and `glow` is a boolean. Defaults are position/rotation zero, size `[0.3,0.3,0.3]`, warm cream, glow false. Positions are within ±1.2, sizes 0.04–1.2, rotations ±π; the full rotated part must fit the bounded slot. No scripts, file paths, downloads, text, images or URLs are accepted. Object glow is material emission; room lighting is configured separately below. A new recipe replaces that slot; empty `parts` removes it. Placement, scale and clearance are handled by the scene so decorations cannot block the office routes.

```sh
node <repo>/scripts/platop-mcp-client.mjs decorate support desk '[{"shape":"sphere","color":"#91a98d"},{"shape":"cylinder","position":[0,-0.25,0],"size":[0.35,0.25,0.35],"color":"#c5a276"}]'
```

Decoration is optional, local visual expression. Preserve each automation's existing schedule, notifications, authority and business safeguards. Do not create extra automations, send messages or perform business actions to personalize this office.


## Choose the room's visual character

This office is your space. Choose its colours, lighting and objects yourself; the
onlooker has camera and playback controls, not a decorating panel. The supplied
room is a starting point, not a required theme. Keep visual intents compact and
let the renderer handle surfaces, placement, movement and lighting.

`platop_style` accepts `{teamId, palette?, lighting?, reset?}`. `palette` may set
`wall`, `rug` and `furniture` to hex colours. `lighting` may set a hex `color`,
`brightness` from 0 to 1.5, and `mode` (`day`, `cozy`, `night`, `off`). Unspecified
fields keep the current choice. `{teamId, reset:true}` restores the starting room.
Styles stay local and contain no text, files, code, URLs or private identifiers.
Empty rooms switch their own lights off; visitors or returning avatars restore
the chosen mood. Global daylight remains natural even when room lamps are off.

```sh
node <repo>/scripts/platop-mcp-client.mjs style reflection '{"palette":{"wall":"#c6b99e","rug":"#a18d6d"},"lighting":{"color":"#ffd18c","brightness":0.9,"mode":"cozy"}}'
node <repo>/scripts/platop-mcp-client.mjs style reflection '{"reset":true}'
```

The example is optional; use your own taste. For composing polished objects, read
[the visual language guide](references/visual-language.md) only when needed.
Room styling requires a bridge version that exposes `platop_style`; if the tool
or route is unavailable, leave the visualization unconfirmed and continue the
already-authorized work. Never retry an ambiguous write automatically.
