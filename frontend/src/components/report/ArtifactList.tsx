import { DownloadIcon } from '@/components/ui/Icons'
import { absoluteUrl } from '@/lib/apiClient'
import { formatBytes } from '@/lib/format'
import type { ArtifactRef, FormatDescriptor, GeneratedModel } from '@/types/api'

interface ArtifactListProps {
  model: GeneratedModel
  formats: FormatDescriptor[]
}

export function ArtifactList({ model, formats }: ArtifactListProps) {
  const available = formats
    .map((descriptor) => ({ descriptor, artifact: model.artifacts[descriptor.format] }))
    .filter(
      (entry): entry is { descriptor: FormatDescriptor; artifact: ArtifactRef } =>
        entry.artifact !== undefined,
    )

  if (available.length === 0) {
    return <p className="text-xs text-ink-faint">No artifacts were requested.</p>
  }

  return (
    <ul className="space-y-1.5">
      {available.map(({ descriptor, artifact }) => (
        <li key={artifact.format}>
          <a
            href={absoluteUrl(artifact.url)}
            download={artifact.filename}
            className="group flex items-center gap-3 rounded-md border border-line bg-raised px-2.5 py-2 transition-colors hover:border-line-strong"
          >
            <DownloadIcon className="size-4 shrink-0 text-ink-faint transition-colors group-hover:text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-ink">{descriptor.label}</span>
              <span className="block truncate text-[0.6875rem] text-ink-faint">
                {descriptor.description}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="numeric block text-[0.6875rem] text-ink-muted">
                {formatBytes(artifact.size_bytes)}
              </span>
              <span className="block text-[0.625rem] text-ink-faint uppercase">
                {/* Exact geometry and a tessellated approximation are not
                    interchangeable, and the difference has to be visible at the
                    point of download. */}
                {artifact.source === 'brep' ? 'exact' : 'mesh'}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
