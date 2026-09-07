# Project Charter: ParametriCAD AI

## Mission & Vision

ParametriCAD AI is an open-source parametric CAD generation engine designed to build solid B-Rep geometry via OpenCASCADE, tessellate it into polygon meshes, and execute deterministic geometric quality verification before exporting artifacts to web and manufacturing formats.

The project bridges the gap between conversational parameter inputs (natural language or structured forms) and rigorous mechanical engineering validation. By enforcing fabricability rules prior to CAD solid kernel execution and running topological invariant verification directly within the domain layer, ParametriCAD AI ensures that only watertight, manifold, and physically realizable models are published.

## Core Value Proposition

1. **Deterministic Geometry**: The identical parameter specification produces the identical mesh and topological digest bit-by-bit.
2. **Fabricability Validation**: Rules reject non-viable parameters (e.g. wall thickness exceeding outer radius, bolt circle outside flange) before touching the CAD kernel.
3. **Domain-Isolated Quality Inspection**: Watertightness, normal orientation, manifoldness, and self-intersections are verified by pure domain algorithms without external library lock-in.
4. **Multi-Format Publishing**: Export to 5 distinct formats: GLB (web 3D rendering), glTF (embedded buffers), STL (additive manufacturing), STEP (exact B-Rep), and DXF (2D cutting profiles).
5. **Interactive 3D Web Experience**: Built with React 19, Three.js / React Three Fiber, and dynamic parameter forms auto-generated from backend schema definitions.

## Scope Boundaries

- **In Scope**:
  - Mechanical components: pipes, elbows, flanges, and mounting plates.
  - Natural language extraction via LLM (Groq) with deterministic rule-based fallback.
  - Deterministic content-addressed artifact caching.
  - Comprehensive browser-based 3D viewer with lighting, wireframe, normal visualization, and dimension overlays.
- **Out of Scope**:
  - Full parametric assembly kinematics and motion simulation.
  - Multi-tenant cloud billing or user account management.
