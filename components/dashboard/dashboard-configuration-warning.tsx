import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { DashboardWarning } from "@/lib/dashboard/dashboard-types"

export function DashboardConfigurationWarning({
  warnings,
}: {
  warnings: DashboardWarning[]
}) {
  if (!warnings.length) {
    return null
  }

  return (
    <div className="space-y-3">
      {warnings.map((warning) => (
        <Card key={warning.id} className="rounded-[1.5rem] border-warning-border bg-warning-bg shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-warning-icon">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-warning-fg">{warning.title}</p>
                <p className="mt-1 text-sm text-warning-fg/90">{warning.description}</p>
              </div>
            </div>
            {warning.href ? (
              <Link
                href={warning.href}
                className="inline-flex items-center gap-2 text-sm font-semibold text-warning-fg transition-opacity hover:opacity-80"
              >
                Open
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
