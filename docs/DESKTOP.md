# Desktop companion

PLaTOP has a small macOS companion built with AppKit and the system WKWebView.
The same local playground runs inside it; no Electron runtime, Rust toolchain,
administrator installation, or signing account is required for a local build.

Requires macOS 12 or later, Apple Command Line Tools (`xcode-select --install`),
and the Node.js version declared in `package.json`.

```sh
npm install
npm run desktop
```

The launcher verifies the frontend against its source, assets and build settings,
rebuilds missing or outdated content, compiles the native app when needed, and
starts the bridge on `http://127.0.0.1:4317` if a
healthy PLaTOP bridge is not already there. The generated app is
`build/PLaTOP.app`. Logs and a record of the launcher-owned bridge process stay
in `.local/`. Both folders are ignored by Git.

An occupied port is reused only when `/api/state` identifies PLaTOP, schema
version 1, and the six known teams. The launcher refuses other services without
stopping them. Set `PLATOP_PORT` to use another port:

```sh
PLATOP_PORT=4318 npm run desktop
```

Quit the companion before changing its port; reopening an existing macOS app
keeps that instance's original launch arguments.

`npm run build` records a deterministic source and output fingerprint under
`dist/`. The launcher also detects missing or modified output files. Private
`.local/` settings never enter that fingerprint, and the existing app bundle is
updated in place. Compile the native bundle alone with `npm run desktop:build`.
Verify the launcher and bridge without opening a
window with:

```sh
npm run desktop -- --no-open
```

## Window controls

- The window starts at 1000 × 720 and can resize down to 440 × 420 content pixels.
- **Float Window** keeps it above normal windows and remembers the setting; it is off by default.
- The interactive window stays on its current or assigned macOS desktop Space. It
  does not follow you across all desktops. Use the Dock’s **Options → Assign To →
  This Desktop** for a dedicated workspace. The click-through desktop background
  can still appear across desktops.
- The yellow title bar button or **⌘M** minimizes it normally.
- The close button or **⌘W** hides it. **Open Playground** in the menu bar icon,
  the app menu, or the Dock reopens it.
- **Full screen** in the header, the green title bar control, or **⌃⌘F** opens
  a native full-screen Space. Use **⌃⌘F** again to return.
- **Window view** locks a close-up camera into a live office, viewed through
  glass. Offices cycle every two hours, with manual previous/next controls.
- **Desktop background**, in Window view or the native menu, places that live
  scene behind desktop icons on the window’s current display. It is click-through.
  The menu bar icon’s **Open Playground** (or **⌘O**) restores the interactive
  window and its floating preference. The same live web view moves between two
  windows so returning from the click-through desktop preserves working controls.
  It does not replace the system wallpaper or add autostart.
- **⌘R** reloads the local playground. **⌘Q** quits the native companion.
- **Control–Option–P** opens or closes a local motion check in the interactive
  window. It shows recent frame timing, render-buffer dimensions and multi-draw
  availability, keeps only a bounded sample in memory, and saves or sends nothing.
  Visible animation targets cinematic 30 FPS; 3D uses one backing pixel per CSS
  pixel with native antialiasing while interface text keeps the display's native
  density. Tiny in-room text can look softer on Retina than the previous budget.

Quitting the companion leaves the bridge running so local agents can continue
reporting their state. To stop a bridge started by this launcher:

```sh
npm run desktop -- --stop-server
```

This checks both the recorded process command and its start time before sending
SIGTERM. It will not stop a separately started bridge or a reused PID. For a
bridge started with `npm start` in a terminal, use that terminal's usual **CtrlC**.

If the bridge is offline, the companion shows a friendly native recovery screen
with a retry button. Start the bridge again and choose **Wake it up** or **⌘R**.
The native shell permits only HTTP navigation to `localhost` or `127.0.0.1` on
its configured port. External navigation, file URLs, and popup windows are blocked.
The page can request full screen, desktop background, window restoration and an
explicit one-time location fix through a main-frame loopback-checked native
bridge. The weather button uses macOS Location Services at kilometer accuracy;
coordinates are rounded to two decimals before returning to the page. Requests
stop on success, cancellation, failure or timeout. No filesystem or command
execution is exposed.

## Visibility and rendering

At page load, the shell sets `window.__PLATOP_DESKTOP_VISIBLE__`. When the window
is minimized, hidden, or fully covered, it updates that value and emits:

```js
window.addEventListener('platop:visibility', (event) => {
  const visible = event.detail.visible;
  // Stop the scene render loop while visible is false.
});
```

Restoring the window emits `visible: true`. The frontend should combine this with
the browser visibility API and the user's motion settings. The native companion
does not run the agents or change their chat execution state.

The current package is a local developer build for the Mac's current architecture.
A signed, notarized installer and Windows/Linux native shells are later work;
the browser playground remains available on those platforms.
