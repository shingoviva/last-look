# LAST LOOK

LAST LOOK is a mobile-first web app for the final check before posting photos to Instagram.

It helps users preview Instagram-style crops, compare a preview-only upload shift, apply Leica-inspired looks, run a lightweight Post Doctor check, and export clean post-ready JPEG files.

## Features

- Instagram preview contexts: Feed, Grid, Carousel, Story
- Leica-inspired looks: Soft Classic, Deep Classic, Night Black
- Preview-only IG Shift simulation
- Clean Instagram Safe Export
- Post Doctor risk scan for frame, shadow, highlight, color, and texture
- Safe Fix with reset
- Multi-image export selection
- Japanese / English UI
- Local-first processing: images stay in the browser

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/app`.

## QA

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm qa:looks
pnpm qa:pipeline
pnpm build
```

## GitHub Pages

The app is configured for static export. For project pages such as:

```text
https://shingoviva.github.io/last-look/
```

set the base path during build:

```bash
NEXT_PUBLIC_BASE_PATH=/last-look pnpm build
```

The included GitHub Actions workflow builds and deploys the static `out/` directory to GitHub Pages.
