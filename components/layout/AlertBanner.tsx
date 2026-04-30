"use client"

import Link from "next/link"
import { useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"

export type AlertItem = {
  id: string
  message: string
  href?: string
}

export function AlertBanner({ alerts }: { alerts: AlertItem[] }) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})

  const visibleAlerts = alerts.filter((alert) => !dismissed[alert.id])
  if (!visibleAlerts.length) return null

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <p className="text-sm text-amber-900">
            {alert.href ? (
              <Link href={alert.href} className="font-medium underline decoration-amber-400 underline-offset-2">
                {alert.message}
              </Link>
            ) : (
              alert.message
            )}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-amber-900 hover:bg-amber-100"
            onClick={() => setDismissed((previous) => ({ ...previous, [alert.id]: true }))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}
