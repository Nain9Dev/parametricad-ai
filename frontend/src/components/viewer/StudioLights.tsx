/**
 * Neutral three-point studio lighting.
 *
 * Built from lights rather than an HDRI environment map on purpose: drei's
 * `Environment` presets fetch a multi-megabyte texture from a CDN, which adds a
 * network dependency to a viewer that otherwise works offline, and a stylised
 * environment tints a surface whose real colour the engineer is trying to read.
 * Plain lights are neutral, instant and free.
 */
export function StudioLights() {
  return (
    <>
      {/* Sky/ground fill keeps the underside legible without flattening form. */}
      <hemisphereLight args={['#c9d4e4', '#20242c', 0.55]} />
      <ambientLight intensity={0.25} />

      {/* Key: defines the primary form and casts the readable highlight. */}
      <directionalLight position={[4, 6, 5]} intensity={2.1} color="#ffffff" />
      {/* Fill: lifts the shadow side just enough to keep edges readable. */}
      <directionalLight position={[-5, 2, 3]} intensity={0.7} color="#dce6f5" />
      {/* Rim: separates the silhouette from the background. */}
      <directionalLight position={[0, -3, -6]} intensity={0.5} color="#8fb4e8" />
    </>
  )
}
