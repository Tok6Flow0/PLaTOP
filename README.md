# PLaTOP

<img src="public/brand/platop-logo-128.png" alt="PLaTOP: a warm six-pane office window with a smiling robot" width="128" height="128" />

A little local office for your AI teams, with six offices and sixteen characters.
Mapped agents retain their identity from their own chats and choose small,
understated actions while doing real work. Activity reports remain separate:
missing observations stay **unknown**, and active signals expire without a
heartbeat. Status alone never chooses movement, work or sleep.

The six teams are **Savor Bridge**, **Clear Path**, **Savor Wayfinders**,
**Beacon**, **The Lantern Desk**, and **Savor Dispatch**. Each office has a
portrait rendered from the same characters that appear in the office. Agents own
their decorations, room colours and lamp mood through small local recipes and
can visit the connected offices, work, rest, celebrate or head home through the
PLaTOP skill. Viewers select a view and control the camera or pause playback;
the agents choose how their space looks and what their avatars do.

An agent might stay at its computer for document review, consider a problem at
the whiteboard, file at the cabinet, or wait for another team in a lounge. These
are optional expressions the agent chooses, not task categories or a scripted
routine. Heartbeats never reissue an action.

**Current status:** the office is a real 3D scene modeled toward the supplied
concept. All sixteen default characters use a cohesive procedural ceramic,
paper and lantern design from `src/scene/proxies.ts` and
`src/scene/characterGeometry.ts`. Claude's sixteen GLB deliveries remain source
assets; the current `public/assets/approved.json` has no enabled GLB IDs. A later
review can opt individual GLBs back in; their animation is limited to the shipped
Idle, Move, Work and Sleep clips. The [asset contract](docs/ASSET-CONTRACT.md) and
[coordination board](docs/COORDINATION.md) record integration and approvals.
A visual resemblance score is a subjective critique, not a pixel-equivalence measurement.

## Run locally

Use Node.js **22.12+** on the 22.x line, or **20.19+** on the 20.x line.

```sh
npm ci
npm run build
npm start
```

Open [the local playground](http://127.0.0.1:4317). For frontend development, use
`npm run dev`; keep the bridge running in another terminal for activity updates.
Run `npm test` for the local protocol and delivered-asset contract checks.

Choose **Move** or **Rotate** above the office, then drag. The visible bottom
controls also rotate, tilt and zoom. Right-drag or Shift-drag rotates in either
mode; scroll to zoom toward the pointer. Touch uses one finger to pan and two to orbit/pinch.
Camera tilt, distance and ground clearance are bounded, and front-facing walls
fade from view. **Reset view** returns to the starting composition. With the
canvas focused, arrows pan, Shift+arrows orbit, +/- zoom, and Home resets.

On macOS 12+ with Apple Command Line Tools installed:

```sh
npm run desktop
```

The small AppKit/WKWebView companion can float, minimize, or hide in the menu
bar. **Full screen** works in the browser and native app (⌃⌘F on Mac).
The interactive window stays on its assigned desktop Space; floating is optional
and off by default. The desktop background view can still span desktops.
**Window view** looks through glass into a fixed close-up of one live office,
cycling to the next office every two hours. Choose a room manually at any time.
In the Mac companion, **Desktop background** places that view behind desktop
icons; the menu bar’s **Open Playground** brings it back. It uses the system web view instead of an Electron runtime. Quitting the
window app leaves the local bridge available; `npm run desktop -- --stop-server`
stops a bridge owned by its launcher. See [desktop controls](docs/DESKTOP.md).
No login item or autostart service is installed.

## Weather at your window

In **Window view → Weather**, choose a city or request approximate device
location. Nothing requests location automatically. Conditions refresh from
[Open-Meteo](https://open-meteo.com/) every 15 minutes while visible, with rain
on the glass, snow and time-of-day tint. These are weather-model conditions,
not a sensor outside your window. Without a chosen location or available
provider, the live office continues with clear glass. Location preferences stay
in this browser on this device; approximate coordinates go to Open-Meteo through
the loopback bridge. Weather does not require an API key.

## Report activity

The bridge starts every team as unknown. There is **no automatic native chat
monitoring**. The optional skill can observe user-selected chats through
available native Codex tools; local commands can report activity explicitly:

```sh
node scripts/platop.mjs status
node scripts/platop.mjs set merchant active --source manual
node scripts/platop.mjs set merchant sleeping --source manual
node scripts/platop.mjs run support -- node --version
```

`set` changes the reported activity badge. `run` executes the specified local command with
activity heartbeats, then reports sleeping on success or waiting on failure.
Neither command starts or prompts a native chat. Active observations expire
after two minutes without a heartbeat. See the [activity bridge](docs/ACTIVITY-BRIDGE.md)
for snapshots, team IDs, and alternate ports.

An explicit `rest` action chooses sleeping; an idle report does not. A current
confirmed action can move its avatar while activity is unknown, but stale,
unknown or idle reports quiet ongoing interaction gestures. Offline scenes preserve
the last position and presence. Initial load restores the last chosen place
without replaying its journey or proving a historical arrival.

To install the optional [PLaTOP skill](skills/platop/SKILL.md), run from the
repository root:

```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -s "$PWD/skills/platop" "${CODEX_HOME:-$HOME/.codex}/skills/platop"
```

The link command refuses to replace an existing installation. Installation
alone does not observe chats or create a recurring automation.

The skill can report through the optional local MCP server. Register it with
Codex from this checkout:

```sh
codex mcp add platop -- node "$PWD/scripts/platop-mcp.mjs"
```

New MCP sessions expose five tools: `platop_status`, `platop_set_activity`,
`platop_action`, `platop_decorate` and `platop_style`. Add the skill
to each authorized team automation so it reports active while working, sends
heartbeats during long tasks, and reports its final state. Existing sessions can
call the same stdio MCP server through the bounded local client, without waiting
for host tools to reload:

```sh
node scripts/platop-mcp-client.mjs status
node scripts/platop-mcp-client.mjs set support active
node scripts/platop-mcp-client.mjs action support interact '{"target":{"officeId":"support","place":"whiteboard"},"gesture":"think"}'
node scripts/platop-mcp-client.mjs style support '{"lighting":{"mode":"cozy","brightness":0.8}}'
node scripts/platop-mcp-client.mjs decorate support shelf '[{"shape":"capsule","finish":"ceramic","color":"#e7ddc5"},{"shape":"leaf","position":[0,0.3,0],"color":"#91a579"}]'
node scripts/platop-mcp-client.mjs style support '{"reset":true}'
```

`platop_style` merges only the supplied wall, rug, furniture or lighting choices;
omitted fields retain their current appearance. Reset restores the authored
room palette and lamp settings without removing its decorations. Recipes offer
seven smooth shapes and matte, ceramic, wood or metal finishes, with up to twelve
parts per slot. The browser has no decorating or avatar-action controls.

The client accepts only bounded public activity and office data, verifies the MCP reply, and
cleans up its server process after each call. It does not retry an unconfirmed
write. The original direct CLI remains available. Visualization gives an
automation no permission to start work outside its original instructions.

## Small and local

Visible animation uses a display-synchronized cinematic 30 fps cadence, including
sleeping characters and window views. Camera interactions redraw at up to 60 fps.
Walking paths ease into work, turns are bounded, and authored actions blend rather
than snapping between poses. Hidden or minimized windows stop rendering; neutral,
paused, and reduced-motion scenes use frames only when needed. A brief transition
can finish before a newly inactive scene settles. Window view renders only its
selected room and pauses when covered or hidden. The 3D canvas uses one backing
pixel per CSS pixel with native antialiasing in an opaque canvas; interface text
retains the display's native pixel density. Retina scenes can look slightly softer
than the previous 1.5-pixel budget, especially tiny text within the room. Static
transforms and colors are cached. Compatible rigid surfaces share draws, and
compatible moving groups share one matrix upload per frame. Sleep labels reuse
one immutable material and texture per scene. Unsupported surfaces retain their
original rendering paths. One
small static shadow map, contact textures and modest lamp glows create soft
lighting. A small prefiltered studio environment is baked once for ceramic and
metal reflections. An explicit agent lighting override can enable one bounded,
shadow-free fill per room; default rooms add no active fill lights. An opaque
canvas avoids transparent compositing, and the cached warm
background preserves the office palette. These are rendering budgets, not
whole-device CPU/GPU measurements.

The optional motion panel (`Control–Option–P` on macOS) also shows recent actor,
batch, contact and renderer submission work, draw counts and loaded model counts.
Its 120-frame measurements stay local and run only while diagnostics are enabled.
They measure JavaScript wall time, not process CPU or completed GPU work. See
[measured optimization results](docs/VALIDATION.md) for native CPU comparisons.

The bridge binds to loopback and accepts only public team IDs, activity states,
fixed source labels and bounded data-only office choices; it assigns timestamps locally. Chat contents, contacts, private thread IDs,
and credentials are not published. The local token and latest sanitized state
stay in ignored `.local/`; the app does not read private Codex databases or
transcripts. This playground visualizes work; it does not run the teams' workflows.
See [local data and optional network use](docs/PRIVACY.md) for storage, permission
and public-asset boundaries. Live weather is optional and contacts Open-Meteo;
the office and activity bridge run locally without it.

For a local timing check, press **Control + Option + P** (Ctrl + Alt + P on other
platforms). The hidden-by-default overlay shows recent renderer frame intervals,
render-buffer dimensions and multi-draw availability;
it saves and sends nothing. Press the shortcut again to close it. Frame timing
does not measure GPU execution or guarantee the screen's presented refresh rate.

## Art and ownership

The supplied portraits and office concept remain project references. The team
and roster portraits in `public/avatars/` are rendered from the current procedural
models, so the interface and office use the same character designs.

Developers can optionally regenerate the sixteen member and six team portraits
with `scripts/render-avatars.mjs`, using an existing Playwright installation
with its Chromium browser:

```sh
node scripts/render-avatars.mjs
```

If Playwright lives elsewhere, set `PLATOP_PLAYWRIGHT_MODULE` to its importable
module path. The script starts its own temporary Vite server on an available
loopback port, rooted in this checkout, and closes the server and browser when
finished. It takes no URL argument and needs no prestarted development server,
so an unrelated or stale server cannot supply the models. It writes portraits
plus their source/file fingerprints. Playwright is optional
developer tooling, not an application runtime dependency. Chromium and working
WebGL are required for generation; fingerprints track source freshness, not
identical pixels across every graphics driver.

No repository
license has been selected; public visibility does not grant additional reuse
rights. Source attribution and character descriptions are in [ASSETS.md](docs/ASSETS.md).
