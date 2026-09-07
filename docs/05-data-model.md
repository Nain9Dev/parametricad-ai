# Data Model: ParametriCAD AI

This document details the core data entities and specifications used across ParametriCAD AI.

## Entity Relationship Diagram

```mermaid
erDiagram
    COMPONENT_SPEC ||--o{ PIPE_SPEC : "specializes"
    COMPONENT_SPEC ||--o{ ELBOW_SPEC : "specializes"
    COMPONENT_SPEC ||--o{ FLANGE_SPEC : "specializes"
    COMPONENT_SPEC ||--o{ PLATE_SPEC : "specializes"

    GENERATION_RESULT ||--|| COMPONENT_SPEC : "defines"
    GENERATION_RESULT ||--|| MESH_QUALITY_REPORT : "validates"
    GENERATION_RESULT ||--|| PHYSICAL_PROPERTIES : "characterizes"
    GENERATION_RESULT ||--o{ GENERATED_ARTIFACT : "publishes"

    COMPONENT_SPEC {
        string kind
        string material
    }

    PIPE_SPEC {
        float outer_diameter_mm
        float wall_thickness_mm
        float length_mm
    }

    ELBOW_SPEC {
        float outer_diameter_mm
        float wall_thickness_mm
        float bend_radius_mm
        float bend_angle_deg
        float leg_length_mm
    }

    FLANGE_SPEC {
        float outer_diameter_mm
        float bore_diameter_mm
        float thickness_mm
        int bolt_hole_count
        float bolt_circle_diameter_mm
        float bolt_hole_diameter_mm
    }

    PLATE_SPEC {
        float width_mm
        float depth_mm
        float thickness_mm
        float corner_radius_mm
        float center_hole_diameter_mm
    }

    GENERATION_RESULT {
        string model_id
        boolean cached
        float duration_ms
    }

    GENERATED_ARTIFACT {
        string format
        string url
        string filename
        int size_bytes
        string sha256
    }

    MESH_QUALITY_REPORT {
        string status
        int vertex_count
        int triangle_count
        boolean is_watertight
        boolean is_manifold
        boolean is_oriented
        int self_intersections
    }

    PHYSICAL_PROPERTIES {
        float volume_mm3
        float surface_area_mm2
        float estimated_mass_g
    }
```

## Invariants & Field Validation

- **Immutability**: All specs inherit from Pydantic `BaseModel` with `frozen = True`, ensuring unalterable hash keys for caching.
- **Physical Feasibility**:
  - `outer_diameter_mm > 2 * wall_thickness_mm`
  - `flange.bore_diameter_mm < flange.outer_diameter_mm`
  - `elbow.bend_radius_mm > outer_diameter_mm / 2`
  - `plate.center_hole_diameter_mm < min(width_mm, depth_mm)`
