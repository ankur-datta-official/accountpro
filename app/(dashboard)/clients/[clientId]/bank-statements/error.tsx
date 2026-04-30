"use client"

import { RouteError } from "@/components/ui/RouteError"

export default function BankStatementsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteError error={error} reset={reset} />
}
