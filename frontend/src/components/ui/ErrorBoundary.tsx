import { RefreshCw } from 'lucide-react'
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Catches render errors so one broken view never blanks the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-red-900">This page hit an unexpected error</h1>
        <p className="mt-2 text-sm leading-relaxed text-red-900">
          Your saved parts, searches and comparison selection are stored in your browser and have not been
          changed. Reloading usually fixes this.
        </p>
        <p className="mt-2 break-words font-mono text-xs text-red-700">{this.state.error.message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      </div>
    )
  }
}
