/**
 * Wire types for the ParametriCAD API.
 *
 * These mirror the Pydantic models the backend serves. The parameter shape of
 * each component is deliberately left open: the form is built from the catalog
 * at runtime, so hardcoding field names here would create a second source of
 * truth that could drift from the backend's.
 */

export type ComponentKind = 'pipe' | 'elbow' | 'flange' | 'plate'

export type ExportFormat = 'glb' | 'gltf' | 'stl' | 'step' | 'dxf'

export type ArtifactSource = 'mesh' | 'brep'

export type ParameterType = 'number' | 'integer' | 'enum'

export type MeshQualityStatus = 'valid' | 'degraded' | 'invalid'

export type Severity = 'error' | 'warning'

/** A parameter value as it travels to and from the API. */
export type ParameterValue = number | string

/** A component specification: the discriminator plus its parameters. */
export interface ComponentSpec {
  kind: ComponentKind
  material: string
  [parameter: string]: ParameterValue
}

export interface ParameterOption {
  value: string
  label: string
}

export interface ParameterDescriptor {
  name: string
  label: string
  type: ParameterType
  group: string
  description: string | null
  unit: string | null
  default: ParameterValue | null
  minimum: number | null
  maximum: number | null
  /** True when `minimum` is a strict bound, as for any positive length. */
  exclusive_minimum: boolean
  step: number | null
  options: ParameterOption[]
}

export interface ComponentDescriptor {
  kind: ComponentKind
  label: string
  description: string
  parameters: ParameterDescriptor[]
}

export interface FormatDescriptor {
  format: ExportFormat
  label: string
  description: string
  extension: string
  media_type: string
  source: ArtifactSource
}

export interface TessellationSettings {
  linear_deflection_mm: number
  angular_deflection_rad: number
  weld_tolerance_mm: number
}

export interface Catalog {
  components: ComponentDescriptor[]
  materials: ParameterOption[]
  formats: FormatDescriptor[]
  tessellation: TessellationSettings
}

export interface ArtifactRef {
  format: ExportFormat
  filename: string
  url: string
  media_type: string
  size_bytes: number
  sha256: string
  source: ArtifactSource
}

export interface MeshIssue {
  code: string
  severity: Severity
  message: string
  count: number | null
}

export interface Vector3Record {
  x: number
  y: number
  z: number
}

export interface BoundingBoxReport {
  min: Vector3Record
  max: Vector3Record
  size: Vector3Record
  center: Vector3Record
}

export interface MeshQualityReport {
  status: MeshQualityStatus
  issues: MeshIssue[]
  triangle_count: number
  vertex_count: number
  is_watertight: boolean
  is_edge_manifold: boolean
  is_winding_consistent: boolean
  has_outward_normals: boolean
  has_self_intersections: boolean
  volume_mm3: number
  surface_area_mm2: number
  bounding_box: BoundingBoxReport
  euler_characteristic: number
  genus: number | null
  connected_component_count: number
  degenerate_face_count: number
  duplicate_face_count: number
  unreferenced_vertex_count: number
  boundary_edge_count: number
  non_manifold_edge_count: number
  self_intersecting_pair_count: number
  self_intersection_check_complete: boolean
  reference_volume_mm3: number | null
  volume_deviation_ratio: number | null
}

export interface SolidProperties {
  volume_mm3: number
  surface_area_mm2: number
  mass_g: number
  density_g_cm3: number
}

export interface GenerationTimings {
  build_ms: number
  tessellate_ms: number
  inspect_ms: number
  export_ms: number
  total_ms: number
}

export interface GeneratedModel {
  model_id: string
  spec: ComponentSpec
  properties: SolidProperties
  quality: MeshQualityReport
  artifacts: Partial<Record<ExportFormat, ArtifactRef>>
  timings: GenerationTimings
  cached: boolean
}

export interface GenerationResponse {
  model: GeneratedModel
  extractor: string | null
}

export interface HealthResponse {
  status: string
  service: string
  version: string
  geometry_kernel: string
  parameter_extractor: string
}

/** The structured failure envelope every non-2xx response carries. */
export interface ApiErrorBody {
  code: string
  message: string
  hint: string | null
  details: Record<string, unknown>
}

export interface ApiErrorResponse {
  error: ApiErrorBody
}
