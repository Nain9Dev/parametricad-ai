/**
 * Inline icon set.
 *
 * Bundled as components rather than pulled from an icon package: the interface
 * needs a dozen glyphs, and inlining them keeps the payload small and avoids a
 * runtime dependency for what amounts to a few paths.
 */

interface IconProps {
  className?: string
}

function Icon({ className = 'size-4', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const GridIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 3h18v18H3z" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </Icon>
)

export const WireframeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="m3 7 9 5 9-5M12 12v10" />
  </Icon>
)

export const AxesIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 20V4M12 20H4M12 20l6 4" />
  </Icon>
)

export const RulerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 8h18v8H3z" />
    <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
  </Icon>
)

export const CameraIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 6h18v12H3z" />
    <path d="m3 6 9 6 9-6" />
  </Icon>
)

export const ResetIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Icon>
)

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v12M7 11l5 5 5-5M4 21h16" />
  </Icon>
)

export const SparkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  </Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 12 5 5L20 6" />
  </Icon>
)

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
)

export const CubeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="m3 7 9 5 9-5M12 22V12" />
  </Icon>
)
