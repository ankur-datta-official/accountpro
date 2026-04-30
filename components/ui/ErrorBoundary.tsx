"use client"

import { AlertTriangle, RotateCcw } from "lucide-react"
import { Component, ErrorInfo, ReactNode } from "react"

import { Button } from "@/components/ui/button"

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

export function ErrorFallback({
  error,
  onRetry,
}: {
  error?: Error | null
  onRetry?: () => void
}) {
  return (
    <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/5 px-6 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">Something went wrong</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
        {error?.message || "An unexpected error occurred while loading this page."}
      </p>
      {onRetry ? (
        <Button type="button" variant="outline" className="mt-5 rounded-xl" onClick={onRetry}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AccountPro UI error boundary caught an error", error, errorInfo)
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
    }

    return this.props.children
  }
}
