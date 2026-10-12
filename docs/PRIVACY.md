# Local data and optional network use

PLaTOP renders its office and handles activity on your device. The production
bridge listens on `127.0.0.1`, never on a public network interface. The default
port can be changed with `PLATOP_PORT`; no account, remote API key or personal
location is built into the app.

The supplied teams and characters are starter artwork. Connecting your own
chats does not copy their messages into the app. The bridge accepts only its
documented team IDs, activity states and source labels. It creates timestamps
locally and stores only the latest sanitized state. Private chat IDs, chat
contents, contacts and command output are not accepted as activity payloads.

## What stays on the device

- The bridge generates a random local write token. Its ignored `.local/`
  directory has owner-only permissions; token and state files are owner-only.
  The browser cannot retrieve that token through an app API.
- View, selected office, decorations and any chosen weather area stay in local
  browser/WebKit storage. They are not written to tracked source files or sent
  with activity signals.
- Device location is requested only when you choose the location button. The
  Mac companion requests a single kilometer-accuracy fix; both native and
  browser flows round coordinates to two decimal places before storing or
  requesting weather. This is an approximate area, not an anonymity guarantee.
- Turning weather off removes the saved weather area and stops future weather
  requests. You can also revoke PLaTOP's location permission in system settings.

## Optional weather goes online

The 3D playground does not require weather. Choosing a weather area enables
requests to Open-Meteo: a city search sends your search text to its geocoding
service; weather sends rounded latitude and longitude to its forecast service.
As with any internet request, the provider also sees the connection's public
IP address. Requests go through the local bridge with fixed HTTPS provider URLs,
not a caller-supplied URL. No PLaTOP account, chat content or local write token
is sent. Refresh runs at most every 15 minutes while the window is visible.

Weather responses are cached only in bounded process memory, and errors omit
provider bodies. The app does not log locations or search text. Weather is an
external model estimate, rather than a sensor reading at your window.

## Browser and file boundaries

The bridge checks the loopback Host and Origin, rejects cross-site browser Fetch
Metadata, does not enable CORS, and requires the local bearer token for activity
writes. Built files are constrained to the real `dist/` directory; traversal,
outside symlinks and hidden files are rejected. The native bridge accepts only
documented actions from the main frame at the configured loopback port.

Only public assets belong under `public/`: the build copies that directory.
Keep personal recordings, transcripts, credentials and custom private reference
material under ignored `.local/`, outside `public/`. The separately approved
published sound package contains derived synthesis parameters and synthesized
previews; it contains no original recording and does not record the microphone.

These boundaries protect against unintended web access; they are not isolation
from another program already running with your macOS account's file access.
