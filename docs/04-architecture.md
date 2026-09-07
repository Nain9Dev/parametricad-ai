# Architecture Specification: ParametriCAD AI

ParametriCAD AI follows a strict **Hexagonal Architecture (Ports and Adapters)**. The application separates pure business logic and mathematical geometric verification from I/O mechanisms, solid modeling kernels, and transport protocols.

## Architectural Layers

```
+------------------------------------------------------------------------+
|                         Infrastructure Layer                           |
|  [FastAPI HTTP Routes]    [CadQuery/OpenCASCADE]    [Trimesh Exporter] |
|  [Groq / Rule Extractor]  [Filesystem Storage]      [Web 3D Viewer]    |
+-----------------------------------+------------------------------------+
                                    |
+-----------------------------------v------------------------------------+
|                          Application Layer                             |
|  [GenerateFromSpecUseCase]              [GenerateFromPromptUseCase]    |
|  [ModelGenerationService]               [ComponentCatalog]             |
+-----------------------------------+------------------------------------+
                                    |
+-----------------------------------v------------------------------------+
|                            Domain Layer                                |
|  [Pydantic Component Specs]             [TriangleMesh Data Structure]  |
|  [Mesh Quality & Topological Analysis]  [Domain Ports / Protocols]     |
|  [Deterministic Content Key Hash]       [Domain Error Hierarchy]       |
+------------------------------------------------------------------------+
```

## Hexagonal Component Interaction Flow

```mermaid
flowchart TD
    subgraph Client["Client Tier"]
        UI["React 19 Three.js UI"]
        HTTP["HTTP / REST Client"]
    end

    subgraph API["Infrastructure: Web & Transport"]
        Router["FastAPI Routers (/models, /generate, /catalog)"]
        Deps["Dependency Injection Composition Root"]
    end

    subgraph App["Application Layer: Use Cases & Orchestration"]
        UC_Prompt["GenerateFromPromptUseCase"]
        UC_Spec["GenerateFromSpecUseCase"]
        Service["ModelGenerationService (Cache & Lock)"]
        Catalog["ComponentCatalog"]
    end

    subgraph Domain["Domain Layer: Pure Core & Invariants"]
        Specs["ComponentSpec Validation (Pydantic)"]
        Mesh["TriangleMesh (Pure Vertices/Faces)"]
        Analysis["Topological Analysis (Manifold, Watertight, Normals)"]
        Ports["Domain Ports (Protocols)"]
    end

    subgraph Adapters["Infrastructure: External Adapters"]
        Kernel["CadQueryKernel (OpenCASCADE B-Rep)"]
        Inspector["GeometricMeshInspector"]
        Exporter["TrimeshExporter (GLB, glTF, STL, STEP, DXF)"]
        Storage["FilesystemArtifactStorage"]
        LLM["GroqParameterExtractor / RuleBasedExtractor"]
    end

    UI --> HTTP
    HTTP --> Router
    Router --> Deps
    Deps --> UC_Prompt
    Deps --> UC_Spec
    Deps --> Catalog

    UC_Prompt --> LLM
    UC_Prompt --> UC_Spec
    UC_Spec --> Service

    Service --> Specs
    Service --> Kernel
    Service --> Inspector
    Service --> Exporter
    Service --> Storage

    Inspector --> Analysis
    Inspector --> Mesh
    Kernel --> Mesh
    Exporter --> Mesh
```

## Architectural Invariants

1. **Domain Isolation**:
   - `backend/app/domain` contains zero imports of `fastapi`, `starlette`, `cadquery`, `trimesh`, or `groq`.
   - Domain tests run fully in-memory without starting external engines.
2. **Deterministic Quality Verification**:
   - Mesh topological checks (Euler characteristic, boundary edges, manifoldness, normal winding, signed volume) are evaluated in the domain.
   - Any model failing blocking invariants is denied publication when `reject_invalid_meshes` is enabled.
3. **Deterministic Cache & Content Addressing**:
   - `model_id` is an invariant SHA-256 hash computed from canonical JSON parameter strings and tessellation deflections.
