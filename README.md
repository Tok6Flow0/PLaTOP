# PLaTOP

A little local office for your AI teams. PLaTOP turns selected activity states
into a cozy, top-down 3D playground with six offices and sixteen characters.
Active teams move and work; confirmed idle teams sleep with little Zs. Missing
observations stay **unknown**, and active signals expire without a heartbeat. Preview mode is clearly simulated.

The six teams are **Savor Bridge**, **Clear Path**, **Savor Wayfinders**,
**Beacon**, **The Lantern Desk**, and **Savor Dispatch**. Each office has local
decoration controls and a portrait of the team's chosen identity.

**Current status:** the office is a real 3D scene modeled toward the supplied
concept. Editable ceramic robot models and reviewed lantern/owl GLBs share the
same environment. Claude has delivered all sixteen character files; only IDs
in `public/assets/approved.json` are enabled after visual review. The rest remain
available as source assets. The [asset contract](docs/ASSET-CONTRACT.md) and
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

`set` changes display state. `run` executes the specified local command with
activity heartbeats, then reports sleeping on success or waiting on failure.
Neither command starts or prompts a native chat. Active observations expire
after two minutes without a heartbeat. See the [activity bridge](docs/ACTIVITY-BRIDGE.md)
for snapshots, team IDs, and alternate ports.

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

New MCP sessions expose `platop_status` and `platop_set_activity`. Add the skill
to each authorized team automation so it reports active while working, sends
heartbeats during long tasks, and reports its final state. Existing sessions can
use the local CLI fallback until they load the MCP server. This does not give an
automation permission to start work outside its original instructions.

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
than the previous 1.5-pixel budget, especially tiny text within the room. Static transforms and colors are cached, and compatible animated
parts share multi-draw submissions when the device supports them. The original
instanced rendering path remains available on other devices. One
small static shadow map, contact textures and modest lamp glows create soft
lighting. An opaque canvas avoids transparent compositing, and the cached warm
background preserves the office palette. These are rendering budgets, not
whole-device CPU/GPU measurements.

The bridge binds to loopback and accepts only public team IDs, activity states,
and fixed source labels; it assigns timestamps locally. Chat contents, contacts, private thread IDs,
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

The supplied portraits and office concept are project references. No repository
license has been selected; public visibility does not grant additional reuse
rights. Source attribution and character descriptions are in [ASSETS.md](docs/ASSETS.md).
