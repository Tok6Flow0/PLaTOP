# Local activity bridge

PLaTOP's Node bridge binds to `127.0.0.1:4317`. Build with `npm run build`, then run `npm start`. It serves only `dist/` and sanitized activity; it never opens Codex private databases, session files, or transcripts. Native chat monitoring is a skill workflow using tools available to the current Codex chat, not a background service included in this release.

The default state for every team is **unknown**. Observation is opt-in. Demo animations are separate from real bridge telemetry.

## Public data contract

Stable team IDs: `merchant`, `hr`, `intake`, `support`, `reflection`, `email`.

States: `active` (freshly observed working), `sleeping` (observed idle), `waiting` (needs input or attention), `unknown` (not observed, unavailable, or stale).

Sources: `codex`, `skill`, `demo`, `manual`. Source is an enum, never a chat title, user name, thread ID, or free text. Missing source defaults to `skill` for writes. Default unknown entries use source `manual` with `updatedAt: null`; this does not represent an observation.

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

The distributable skill is [skills/platop/SKILL.md](../skills/platop/SKILL.md). Install it by linking or copying that folder into the local Codex skills directory. Its instructions use native chat tools and a private user-defined mapping to public team IDs. Installation alone does not observe or activate a chat.
