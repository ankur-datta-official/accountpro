"use client"

import { ErrorFallback } from "@/components/ui/ErrorBoundary"

export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorFallback error={error} onRetry={reset} />
}
