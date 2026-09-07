import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Contains a render failure to one region.
 *
 * WebGL context creation and glTF parsing both throw during render, and an
 * unhandled throw there unmounts the whole application. Keeping the viewer
 * behind a boundary means a bad model costs the canvas, not the session.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error in subtree', error, info.componentStack)
  }

  private readonly reset = () => this.setState({ error: null })

  override render(): ReactNode {
    const { error } = this.state
    return error ? this.props.fallback(error, this.reset) : this.props.children
  }
}
