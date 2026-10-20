import type { ComponentKind, ComponentSpec } from '@/types/api'

export interface ShowcasePreset {
  id: string
  kind: ComponentKind
  label: string
  subtitle: string
  spec: ComponentSpec
  badge?: string
  promptText?: string
}

/**
 * The one-click demos.
 *
 * Each specification equals the specification of the model bundled under
 * `public/presets/`. That equality is what lets the bundle answer for the
 * generation service while it is unreachable without showing a part the form
 * did not ask for (ADR-0008); `presets.test.ts` keeps the two in step.
 */
export const SHOWCASE_PRESETS: ShowcasePreset[] = [
  {
    id: 'flange',
    kind: 'flange',
    label: 'Brida 8 Pernos',
    subtitle: 'Ø100mm · Genus 9 · Euler -16',
    badge: 'Industrial',
    spec: {
      kind: 'flange',
      material: 'stainless_steel',
      outer_diameter_mm: 100.0,
      bore_diameter_mm: 50.0,
      thickness_mm: 12.0,
      bolt_hole_count: 8,
      bolt_hole_diameter_mm: 10.0,
      bolt_circle_diameter_mm: 80.0,
    },
  },
  {
    id: 'elbow',
    kind: 'elbow',
    label: 'Codo 90°',
    subtitle: 'Radio 50mm · Ø25mm · e=2.5mm',
    badge: 'Swept B-Rep',
    spec: {
      kind: 'elbow',
      material: 'stainless_steel',
      outer_diameter_mm: 25.0,
      wall_thickness_mm: 2.5,
      bend_radius_mm: 50.0,
      bend_angle_deg: 90.0,
      leg_length_mm: 20.0,
    },
  },
  {
    id: 'pipe',
    kind: 'pipe',
    label: 'Tubo Extruido',
    subtitle: 'Ø25mm · L=200mm · e=2.5mm',
    badge: 'Toroidal',
    spec: {
      kind: 'pipe',
      material: 'stainless_steel',
      outer_diameter_mm: 25.0,
      wall_thickness_mm: 2.5,
      length_mm: 200.0,
    },
  },
  {
    id: 'plate',
    kind: 'plate',
    label: 'Placa Mecanizada',
    subtitle: '120x80mm · Taladro Ø20 · Filetes',
    badge: 'Prismatic',
    spec: {
      kind: 'plate',
      material: 'stainless_steel',
      width_mm: 120.0,
      depth_mm: 80.0,
      thickness_mm: 10.0,
      corner_radius_mm: 8.0,
      center_hole_diameter_mm: 20.0,
    },
  },
  {
    id: 'prompt',
    kind: 'pipe',
    label: 'Prompt IA',
    subtitle: 'Lenguaje natural a B-Rep',
    badge: 'NLP AI',
    promptText: 'Tubo de acero inoxidable con diametro exterior 25mm, espesor 2.5mm y longitud 200mm',
    spec: {
      kind: 'pipe',
      material: 'stainless_steel',
      outer_diameter_mm: 25.0,
      wall_thickness_mm: 2.5,
      length_mm: 200.0,
    },
  },
]
