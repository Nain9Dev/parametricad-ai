# ParametriCAD Frontend

Interactive parametric CAD interface: schema-driven parameter controls, 3D WebGL viewer, and automated mesh quality inspector.

## Directory Structure

```
src/
  types/api.ts         API contract and wire models
  lib/
    apiClient.ts       Typed Fetch client with request cancellation
    catalog.ts         Catalog schema parsing and parameter state mapping
    format.ts          Engineering unit formatters
    hooks/             useCatalog, useGeneration, useDebouncedValue
  components/
    ui/                Base design system primitives (Button, NumberField, Panel, Badge, BottomSheet)
    layout/            AppHeader, HeaderMenu, WorkspaceTabs (the compact workspace's section switcher)
    generator/         ComponentPicker, ParameterForm, PromptComposer
    report/            QualityReport, PropertiesPanel, ArtifactList, GenerationError
    viewer/            Three.js Canvas, CameraRig, StudioLights, DimensionOverlay,
                       ViewerToolbar (wide), ViewerToolbarCompact + ViewOptionsSheet (compact)
```

## Layout

One component tree, restyled by breakpoint through the `.workspace` grid in
`src/index.css`:

| Context | Layout |
|---|---|
| 1024 px and up | Three pinned columns: inputs, viewer, report |
| Below 1024 px | Viewer pinned at the top, tab bar below it, one panel that scrolls on its own |
| Below 1024 px, landscape, 34 rem tall or less | Viewer on the left, tab bar and panel on the right |

Touch sizing is driven by the pointer, not the width: the `pointer-coarse:`
variants give every control a 44 px target and 16 px text on a touch screen,
and leave a mouse the compact sizes. The canvas is never remounted when the
layout changes, so rotating a phone keeps the camera.

## Architecture & Design Principles

1. **Schema-Driven Form Generation**: Every parameter input (type, unit, step, constraints, default value) is derived dynamically from `/api/v1/catalog`. Adding a new mechanical parameter to the backend automatically reflects in the web interface without updating the frontend.
2. **Debounced Lifecycle with Cancellation**: Changing a parameter triggers model generation after a 350 ms debounce. Outdated requests are immediately aborted using `AbortSignal` to prevent stale geometries from landing over recent edits.
3. **On-Demand Format Generation**: The live interactive 3D viewer requests only GLB meshes. Exact B-Rep formats (STEP) and 2D profiles (DXF) are generated on-demand when explicitly downloaded.
4. **Explicit Scene Graph Memory Cleanup**: Three.js does not automatically deallocate buffers or textures upon unmounting. Every loaded model is managed through dedicated `GLTFLoader` lifecycles and explicitly disposed of across scene graph traversals to prevent memory leaks during parameter scrubbing.
5. **Calibrated Studio Lighting**: Three neutral directional and ambient lights provide accurate geometric depth without the network overhead or tinting artifacts of external HDRI textures.
6. **On-Demand Rendering**: `frameloop="demand"` ensures GPU resources are idle when the camera and model are static.

## Development & Build Commands

```bash
npm run dev          # Start local Vite development server on port 5300
npm run typecheck    # TypeScript strict type validation
npm run lint         # Run oxlint across all source files
npm test             # Vitest (jsdom)
npm run build        # Production bundle compilation, service worker included
npm run verify:pwa   # Check the built service worker (run after build)
npm run preview      # Serve the built bundle on port 5301
```

## Progressive Web App

The client installs from Chrome and works offline for the four bundled parts
([ADR-0007](../docs/06-decisions/ADR-0007-installable-pwa.md)).

| File | Role |
|---|---|
| `public/manifest.webmanifest` | Static manifest: name, colours, `standalone` display, icons |
| `public/icons/` | 192 and 512 px icons, a maskable icon, the Apple touch icon (`scripts/generate-pwa-icons.py` draws them) |
| `pwa.config.ts` | Service worker settings: what is precached, no runtime caching, update on request |
| `scripts/verify-pwa-build.mjs` | Reads the built `dist/sw.js` and fails if it lists the wrong files |
| `src/lib/hooks/usePwaUpdate.ts`, `useInstallPrompt.ts`, `useOnlineStatus.ts` | Update prompt, Install control, offline indicator |

No worker is registered under `npm run dev`. To try installation or offline start,
run `npm run build && npm run preview` and open `http://localhost:5301`. The steps
for a real phone, the update flow and the kill switch are in
[`docs/10-runbook.md`](../docs/10-runbook.md), section 6.

### Offline and the bundled presets

`generateFromSpec` and `generateFromPrompt` fall back to a bundled model only when
the request is exactly the one that model was built from, and only after a
transport failure, a timeout or a 5xx. Any other request keeps the previous model
and reports that a connection is needed; a failure the backend described, such as a
422, is always shown as it is
([ADR-0008](../docs/06-decisions/ADR-0008-bundled-presets-match-only.md)).
`src/lib/presets.test.ts` keeps each showcase card equal to the model it shows.

Both ports are fixed with `strictPort`, so a collision fails the start instead of
moving the server to a port nobody wrote down. See `docs/10-runbook.md`.

## Environment Configuration

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8130` | Target backend API base URL |

## Deployment

`vercel.json` declares the response headers for the deployed client: a Content
Security Policy, transport and framing policy, and a one-year immutable
`Cache-Control` for the content-hashed files under `/assets/`.

The policy's `connect-src` names the API origin literally, so **a change of API
host has to land in `vercel.json` in the same commit** or the browser blocks
every request the client makes.
