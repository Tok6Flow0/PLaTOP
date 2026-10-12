# Exploring the PLaTOP workspace

The starting view is a centered perspective view of the connected offices, facing the characters at a 43° downward elevation. A restrained 23° field of view makes the back of the building narrower than the front, matching the starting-space reference. **Reset view** always returns to that same view.

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

A drag beyond five screen pixels does not select a room. Tilt is limited to 35°–65° above the floor, zoom is bounded, and the focus point stays within the campus so the camera cannot drop through the floor or get lost outside the workspace. Walls facing the camera become transparent as the view turns, preserving sightlines to the team inside. Focus the canvas by clicking it or using Tab; navigation keys are scoped to that surface.

Camera input redraws only when it changes the view, coalesced to a maximum 24 fps. Team animation is capped at 24 fps while active and 4 fps for sleep-only scenes. Pausing or reduced motion holds character poses still; the camera remains usable. Hidden documents and minimized native windows have no render timer.

Warm directional light uses one softly blurred 1024 px static shadow map, refreshed when office decorations change. Moving characters use inexpensive soft ground-contact pads rather than continuously redrawing the shadow map. No postprocessing, physics or extra light animation is required.

Authored character deliveries are kept separately from the approved starting space. The root-owned `public/assets/approved.json` allowlist selects stable character IDs for GLB loading. An empty list retains the reviewed procedural characters and does not fetch the character manifest or models. `public/assets/characters/manifest.json` remains owned by the character author.
