# Dira OS premium brand jingle 2.0

This is a dedicated motion project; it does not modify the application apps.

The source-of-truth logo is referenced from `apps/desktop/public/dira-os-logo.png`. The repository inventory contained no application screenshots, promotional artwork, bundled fonts, or audio assets, so the cinematic product reveal uses an abstract business-system surface and repo-documented capabilities rather than invented screenshot content or chat attachments.

## Render

```powershell
cd video
pnpm install --ignore-workspace --node-linker=hoisted --no-frozen-lockfile
node render.mjs
```

Outputs are written to `video/output/`:

- `dira-os-premium-jingle-16x9.mp4` — 1920×1080, 30 fps, 8 seconds
- `dira-os-premium-jingle-9x16.mp4` — 1080×1920, 30 fps, 8 seconds

`pnpm preview` renders a half-resolution QA pass.

For the preview command, use `node render.mjs --preview` when running inside this monorepo so pnpm does not try to reconcile the root workspace.
