# Local activity bridge

PLaTOP's Node bridge binds to `127.0.0.1:4317`. Build with `npm run build`, then run `npm start`. It serves only `dist/` and sanitized public activity and office choices; it never opens Codex private databases, session files, or transcripts. Native chat monitoring is a skill workflow using tools available to the current Codex chat, not a background service included in this release.

The default state for every team is **unknown**. Observation is opt-in. Activity
reports do not choose avatar actions, routes or sleep/work poses.

## Public data contract

Stable team IDs: `merchant`, `hr`, `intake`, `support`, `reflection`, `email`.

States: `active` (freshly observed working), `sleeping` (observed idle), `waiting`
(needs required input or attention, including a real dependency when independent
work cannot proceed), `unknown` (not observed, unavailable, or stale).

Sources: `codex`, `skill`, `manual`. Source is an enum, never a chat title, user name, thread ID, or free text. Missing source defaults to `skill` for writes. Default unknown entries use source `manual` with `updatedAt: null`; this does not represent an observation. Legacy `demo` writes are rejected; a saved activity snapshot containing that source is invalid and starts with unknown activity.

`GET /api/state` returns:

```json
{
  "app": "platop",
  "schemaVersion": 1,
  "teams": [{ "teamId": "merchant", "state": "active", "updatedAt": "2026-10-12T12:00:00.000Z", "source": "codex" }],
  "serverTime": "2026-10-12T12:00:00.000Z"
}
```

Every response includes all six teams. The example abbreviates the array. The bridge assigns `updatedAt`; clients cannot forge observation times. `active` becomes `unknown` after 120 seconds without an update. The previous observation timestamp remains visible. Idle and waiting observations remain until updated; they are not proof of an ongoing native connection.

`GET /api/events` is Server-Sent Events. It sends `event: state` with the full snapshot on connection and each state update or expiry. Comment heartbeats arrive every 25 seconds. Clients should reconnect using EventSource's retry behavior rather than polling. A maximum of 12 streams and bounded write buffers prevent unbounded connection growth.

`POST /api/events` requires `Authorization: Bearer <local token>` and `Content-Type: application/json`. The body is one exact update:

```json
{ "teamId": "merchant", "state": "active", "source": "codex" }
```

Or one exact snapshot with 1–6 unique teams:

```json
{ "teams": [{ "teamId": "merchant", "state": "sleeping", "source": "codex" }] }
```

Unknown keys, private fields, arbitrary sources, duplicates, invalid states, and bodies over 8 KiB are rejected. Batches update only included teams, atomically. The local token is generated in ignored `.local/token` (0600). Latest sanitized states are atomically persisted in ignored `.local/state.json` (0600), at most one state per team. No history or task content is retained. Do not expose this bridge through a proxy or public listener.

All routes require a loopback Host. A supplied Origin must exactly match the loopback bridge origin; no permissive CORS is enabled. Writes from the CLI may omit Origin and still require the secret. Browser read clients do not receive the write token. Static responses use a Content Security Policy, MIME types, and nosniff; malformed or traversing paths and symlinks outside `dist/` are rejected.

## CLI

Run from any directory using the repository's script path:

```sh
node scripts/platop.mjs status
node scripts/platop.mjs set merchant active --source codex
node scripts/platop.mjs snapshot /path/to/public-snapshot.json
node scripts/platop.mjs run support -- node scripts/authorized-task.mjs
```

`snapshot` accepts exactly the batch body above, not transcripts or a raw native tool response. It validates the entire file before writing. `status` prints only the sanitized GET response. `run` uses `spawn(executable, args, {shell:false})`, inherits normal terminal I/O without collecting it, sends active heartbeats every 30 seconds, and marks sleeping on success or waiting on error. A command failure preserves its exit code. SIGINT/SIGTERM are forwarded to the child. A wrapper whose initial bridge update fails does not start the command; final-update failures are reported without changing the child exit code.

`PLATOP_PORT` selects a different local port for both server and CLI. `PLATOP_ROOT` overrides where the CLI looks for `.local/token`; otherwise it uses its own repository. Neither setting permits a remote host. Keep the port consistent with the desktop shell and client URL.

## Local MCP

`node scripts/platop-mcp.mjs` exposes five tools over MCP stdio: `platop_status` accepts an empty object, `platop_set_activity` accepts exactly a public `teamId` and `state`, and `platop_action`, `platop_decorate` and `platop_style` accept the bounded office intents below. The adapter does not launch commands, read chats, take arbitrary paths or URLs, or make external network requests. Activity writes use source `skill`. Active calls renew the two-minute freshness timeout; they are intentionally not marked idempotent. All tools are closed-world and nondestructive; only status is read-only.

The MCP uses the same ignored local token and loopback-only bridge as the CLI. It rejects redirects, bounds messages and response bodies, validates returned states, and returns generic failures without tokens, paths, private identifiers, or task contents. No SDK or cloud service is required. Its [stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [initialization](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle), and [tool messages](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) follow the MCP specification; supported protocol versions are 2024-11-05 through 2025-11-25.

To register with a local Codex host, use its supported `codex mcp add` command, replacing the placeholders with the locally resolved executable and repository paths:

```sh
codex mcp add platop -- <absolute-node-path> <absolute-repo-path>/scripts/platop-mcp.mjs
```

Personal installation paths belong only in host configuration. Do not commit them. Codex CLI and the desktop app share this configuration, but saving it does not prove an existing chat has loaded the tools. The [desktop setup guide](https://developers.openai.com/codex/mcp) calls for Restart after saving a server. A host that exposes the supported [MCP configuration reload API](https://developers.openai.com/codex/app-server) can queue a runtime refresh instead. Do not interrupt active work just to restart the host; the skill's bounded local MCP client works until host tools are actually available. Registration, a successful protocol test, and actual tool availability in a particular chat are separate checks.

The distributable skill is [skills/platop/SKILL.md](../skills/platop/SKILL.md). Install it by linking or copying that folder into the local Codex skills directory. It prefers host MCP tools when available and otherwise uses the local MCP client below, with native chat tools and a private user-defined mapping to public team IDs. Installation alone does not observe or activate a chat.

### MCP client for existing chats

```sh
node scripts/platop-mcp-client.mjs status
node scripts/platop-mcp-client.mjs set support active
node scripts/platop-mcp-client.mjs set support sleeping
node scripts/platop-mcp-client.mjs style support '{"lighting":{"mode":"cozy"}}'
```

This client launches only its fixed sibling MCP server with the current Node
executable, no shell, no caller-supplied program and no new dependency. It runs
initialization, tool discovery and invocation over stdio, verifies the server,
tool vocabulary and public snapshot, and confirms the requested activity or
office choice before printing success. Activity writes have source `skill`;
office choices retain only current public visual data. Callers cannot supply paths,
tokens, URLs, commands, private IDs or message text as tool arguments.

An eight-second deadline and bounded input streams prevent a stalled or noisy
server from lingering. Child stderr is discarded, failures are generic, and
only validated public fields are returned. The child receives only the existing
operator-controlled `PLATOP_ROOT` and `PLATOP_PORT` settings; unrelated credentials
and Node preload variables are not inherited. The process closes after each
call and is terminated if it fails to close. Failed or ambiguous writes are
not retried automatically. The original direct CLI remains a last-resort
fallback if no MCP call was attempted; a visualization failure never authorizes
new business work or blocks the already-authorized task.

This is actual local MCP protocol use, but it does not mean the chat host has
loaded native MCP tools. Existing automation runs can use the client without
restarting the host or changing their schedules and authority.

For user-authorized existing scheduled team tasks, add the skill to their current prompt: publish active at the beginning, renew it about every 30 seconds while working, sleeping after completion, waiting for required input or a dependency when independent work cannot proceed, and unknown for unavailable observations. Preserve their cadence, target chat, notification policy, and underlying business authorization. Heartbeats do not choose or repeat avatar actions. A missing avatar bridge must never trigger extra business actions or prevent the authorized workflow from continuing. This integration supplies task-owned observations; it does not independently prove that all scheduled runs have executed successfully.


## Agent-owned office intents

The optional `actions`, `assets` and `rooms` maps extend the existing public state snapshot
without changing its activity fields. `POST /api/actions`, `POST /api/assets` and `POST /api/rooms`
require the same local token, loopback Host, exact Origin (when supplied) and
8 KiB body limit as activity writes. The browser never receives the token.
Current office state is atomically saved to ignored `.local/office.json` with
0600 permissions. Public snapshots are bounded to 128 KiB; persistence reserves
8 KiB of that budget for the remaining snapshot fields. A candidate that exceeds
the limit leaves the previous state intact. There is no history, transcript or arbitrary
metadata field. Public character IDs must belong to the supplied team.

- `platop_action`: `{teamId, actorId?, kind, target?, gesture?}`. Kinds are
  `walk_to`, `work`, `rest`, `celebrate`, `arrive`, `leave`, `interact`. Named
  targets are `{officeId, place}` with a public team ID and `desk`, `door`,
  `lounge`, `whiteboard` or `cabinet`. `walk_to` and `interact` require a target;
  `interact` also requires `gesture: work|think|file|talk|wait`. Other kinds
  reject gesture. `arrive` accepts a target and defaults to the owner's door;
  other kinds reject targets. Each accepted intent has a fresh server UUID;
  the motor consumes an ID once, owns routing and turn easing, and keeps
  departed characters absent until arrival.
- `platop_decorate`: `{teamId, slot, parts}` replaces one of `desk`, `shelf`,
  `wall`, `floor`, `festive`. Empty parts clears the slot. Up to 12 normalized
  primitive parts (`box`, `sphere`, `cylinder`, `cone`, `torus`, `capsule`, `leaf`) have bounded
  position, size, rotation, hex color and boolean glow. `finish` chooses `matte`
  (the default), `ceramic`, `wood` or `metal`. Positions default to zero within
  ±1.2, sizes default to `[0.3,0.3,0.3]` within 0.04–1.2, rotations default to zero
  within ±π, colour defaults to warm cream and glow defaults to false. Every
  primitive is normalized to its full width/height/depth before scaling. Rotated extents stay
  within a fixed slot; no code, file path, URL, text or external asset is accepted.
  Glow is material emission and creates no additional light. At most 30 current
  assets / 360 parts exist. Unchanged recipes do not emit redundant updates.
- `platop_style`: `{teamId, palette?, lighting?, reset?}`. `palette` accepts
  any of `wall`, `rug`, `furniture`, each a `#rrggbb` colour. `lighting` accepts
  `color` as `#rrggbb`, `brightness` from 0 to 1.5, and `mode` as `day`, `cozy`,
  `night` or `off`. Supply at least one field; empty palette or lighting patches
  are rejected. Only explicit fields merge into the team's current choices.
  `{teamId, reset:true}` is exclusive and removes the room style, restoring the
  authored palette and lamp settings. Reset does not remove the team's assets.
  Identical choices preserve their UUID and do not emit redundant updates.

`rooms` is keyed by public team ID. Each entry contains a server UUID, sparse
`palette` and sparse `lighting` objects; both objects are present, but either
may be empty. Omitted fields preserve the authored appearance or the preceding
choice. At most six room styles exist. Palette changes tint only tagged room
surfaces, leaving plants and character identities intact. Lamp mood and colour
affect that room's existing lamps and glows; an explicit lighting choice can
enable one bounded, shadow-free room fill. `off` also suppresses its decoration
emission. Global daylight remains readable. Room choices do not change paths,
wall openings or camera bounds.

Both local transports support the same short commands:

```sh
node scripts/platop-mcp-client.mjs action support walk_to '{"target":{"officeId":"reflection","place":"lounge"}}'
node scripts/platop-mcp-client.mjs action support work
node scripts/platop-mcp-client.mjs action support interact '{"target":{"officeId":"support","place":"cabinet"},"gesture":"file"}'
node scripts/platop-mcp-client.mjs action support leave
node scripts/platop-mcp-client.mjs action support arrive
node scripts/platop-mcp-client.mjs decorate support desk '[{"shape":"capsule","finish":"ceramic","color":"#e7ddc5"},{"shape":"leaf","position":[0,0.3,0],"color":"#91a98d"}]'
node scripts/platop-mcp-client.mjs decorate support desk '[]'
node scripts/platop-mcp-client.mjs style support '{"palette":{"wall":"#355a46"},"lighting":{"color":"#ffd18c","brightness":0.8,"mode":"cozy"}}'
node scripts/platop-mcp-client.mjs style support '{"reset":true}'
```

The original direct CLI accepts `action`, `decorate` and `style` with the same inline JSON
arguments as a last-resort fallback. Neither transport accepts a file or program
for these intents. Failed or unconfirmed writes are never retried automatically.
Office appearance and presence are the agents' visual choices; the viewer has
no decorating or avatar-action buttons. They do not execute, pause or authorize
business work. The mapped agent retains its adopted identity from its own chat
and chooses optional expressions during real work. The renderer receives only
the bounded intent, not task contents, a classifier result or hidden reasoning.
The skill's [expression guide](../skills/platop/references/agent-expression.md)
offers examples without prescribed transitions.

Activity alone never chooses a route, work pose or sleep pose. Explicit `rest`
chooses sleeping. A confirmed current action can move even when activity is
`unknown`; unknown, stale or idle reports quiet ongoing interaction gestures.
Disconnect preserves position and presence until a valid connection returns.
Initial scene load restores the last chosen place and presence without
replaying a journey. That restored placement is not historical arrival proof.
