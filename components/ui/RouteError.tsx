"use client"

import { ErrorFallback } from "@/components/ui/ErrorBoundary"

export function RouteError({
  error,
  reset,
  title,
  description,
}: {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
  description?: string
}) {
  return (
    <ErrorFallback
      error={error}
      onRetry={reset}
      title={title ?? "This page could not load"}
      description={description}
    />
  )
}
