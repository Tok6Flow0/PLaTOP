# PLaTOP logo

The mark is a little window into the six teams: an ivory six-pane office window,
warm amber lights, sage plants, and a smiling ceramic robot. The sage tile and
soft shading match the playground's office concept.

## Assets

- `public/brand/platop-logo.png`: transparent 1024 × 1024 master.
- `public/brand/platop-logo-128.png`: app header, window caption, and README.
- `public/brand/platop-logo-64.png`: browser favicon.
- `public/brand/platop-logo-180.png`: touch icon.

All images ship locally. No image service, account, key, or network request is
needed at runtime. `scripts/build-macos.sh` derives the ten standard iconset
sizes from the master, bundles `PLaTOP.icns`, and signs the updated app.

## Creation

Created with the built-in imagegen tool. Generation prompt specification:

> Create a polished logo for PLaTOP, a cozy local office playground for six AI
> teams. A sage green rounded-square app tile holds a sculpted ivory office
> window, three columns by two rows. Warm amber office lights and small green
> plants show through the panes. A tiny friendly cream ceramic robot with a
> dark green visor peeks out of the lower middle pane. Match the app's soft,
> tactile 3D style, gentle shadows, warm glow, and cream, sage, forest green,
> and amber palette. Center the mark, keep it legible at app-icon size, and
> use a transparent background. No lettering or watermark.

A targeted imagegen pass cleaned the outer background. AppKit then prepared
the square crop, standard rounded icon boundary, transparent padding, and
1024-pixel master; Apple's `sips` generated the smaller copies. The artwork
inside the window is unchanged.
