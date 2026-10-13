# Exploring the PLaTOP workspace

The starting view is a centered perspective view of the connected offices, facing the characters at a 34° downward elevation. A restrained 14° field of view makes the back of the building narrower than the front, matching the starting-space reference. **Reset view** always returns to that same view.

| Input | Action |
| --- | --- |
| Click a room | Select its team |
| Left drag | Pan across the offices |
| Right drag, or Shift / Ctrl / Command + left drag | Orbit and tilt |
| Scroll, trackpad pinch, or the + / − buttons | Zoom |
| One-finger touch drag | Pan |
| Two-finger touch gesture | Pinch to zoom and orbit / tilt |
| Arrow keys while the canvas has keyboard focus | Pan |
| Shift + arrow keys while focused | Orbit / tilt |
| + / − while focused | Zoom |
| Home while focused | Reset the starting view |

A drag beyond five screen pixels does not select a room. Tilt is limited to 35°–65° above the floor. Orbit zoom now reaches 32× the fitted starting scale, with a minimum distance of 0.8 world units; the focus point stays within the campus. Walls facing the camera become transparent as the view turns, preserving sightlines to the team inside. Focus the canvas by clicking it or using Tab; navigation keys are scoped to that surface.

## Unseen mist visits

At 4.5× zoom or closer, a small nonmodal invitation offers **Enter as mist**. Zooming never enters automatically or changes keyboard focus. Dismiss the invitation to keep looking from outside; zooming out and back in makes it available again.

Entry creates a local, softly glowing 3D mist, starting near the orbit focus point. This is a spectator camera, not an agent or office occupant. It has no identity in agent state, no collision body, no room-light occupancy, no chat or bridge connection, and no action/decorating authority. Agents neither see it nor react to it. Walls and furniture do not block movement. Only the outer campus exploration envelope and a safe floating-height range are bounded.

| Mist input | Action |
| --- | --- |
| First person / Third person | Look through the mist or see it floating ahead of you |
| Click the view, then W / S or up / down arrows | Float forward / backward |
| A / D or left / right arrows | Float sideways |
| Q / E | Descend / rise |
| Pointer or one-finger drag on the view | Look around |
| Navigate | Show or hide the optional Float, Rise, Down and Look buttons for keyboard-accessible and touch navigation |
| Escape or Exit mist | Restore the exact orbit position, orientation, focus, cursor and projection settings saved at entry |

First person hides your own mist and uses a 55° field of view; third person shows the translucent volume and uses 45°. Navigation remains available with reduced motion or paused agent playback. The mist itself is static: no idle particle loop, animation timer, external texture or extra light. Only actual input requests a camera redraw. Ordinary orbit controls and room selection are disabled during the visit. Reset view, window-view changes, WebGL interruption and disposal also exit the visit, restoring the prior camera before their normal behavior continues. Visits are not persisted.

If the workspace changed size during a visit, exit restores the orbit and then applies its normal responsive fit for the new dimensions. An unchanged viewport keeps the saved camera pose exactly.

Camera input redraws only when it changes the view, coalesced by the existing frame pacer. Team animation is capped at 30 fps while active; an idle campus has no standing render loop. Pausing or reduced motion holds character poses still; the camera remains usable. Hidden documents and minimized native windows have no render timer.

Warm directional light uses one softly blurred 2048 px static shadow map, refreshed when office decorations change. Moving characters use inexpensive soft ground-contact pads rather than continuously redrawing the shadow map. Bounded depth-reusing contact shading is independent of the camera controls and mist; the observer adds no physics or light animation.

Authored character deliveries are kept separately from the approved starting space. The root-owned `public/assets/approved.json` allowlist selects stable character IDs for GLB loading. An empty list retains the reviewed procedural characters and does not fetch the character manifest or models. `public/assets/characters/manifest.json` remains owned by the character author.
