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
    ui/                Base design system primitives (Button, NumberField, Panel, Badge)
    generator/         ComponentPicker, ParameterForm, PromptComposer
    report/            QualityReport, PropertiesPanel, ArtifactList, GenerationError
    viewer/            Three.js Canvas, CameraRig, StudioLights, DimensionOverlay
```

## Architecture & Design Principles

1. **Schema-Driven Form Generation**: Every parameter input (type, unit, step, constraints, default value) is derived dynamically from `/api/v1/catalog`. Adding a new mechanical parameter to the backend automatically reflects in the web interface without updating the frontend.
2. **Debounced Lifecycle with Cancellation**: Changing a parameter triggers model generation after a 350 ms debounce. Outdated requests are immediately aborted using `AbortSignal` to prevent stale geometries from landing over recent edits.
3. **On-Demand Format Generation**: The live interactive 3D viewer requests only GLB meshes. Exact B-Rep formats (STEP) and 2D profiles (DXF) are generated on-demand when explicitly downloaded.
4. **Explicit Scene Graph Memory Cleanup**: Three.js does not automatically deallocate buffers or textures upon unmounting. Every loaded model is managed through dedicated `GLTFLoader` lifecycles and explicitly disposed of across scene graph traversals to prevent memory leaks during parameter scrubbing.
5. **Calibrated Studio Lighting**: Three neutral directional and ambient lights provide accurate geometric depth without the network overhead or tinting artifacts of external HDRI textures.
6. **On-Demand Rendering**: `frameloop="demand"` ensures GPU resources are idle when the camera and model are static.

## Development & Build Commands

```bash
npm run dev          # Start local Vite development server
npm run typecheck    # TypeScript strict type validation
npm run lint         # Run oxlint across all source files
npm run build        # Production bundle compilation
```

## Environment Configuration

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Target backend API base URL |
