"use client"

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PlanLimitBannerProps = {
  clientsUsed: number
  clientLimit: number | null
}

const DISMISS_KEY = "accountpro-plan-limit-banner-dismissed"

export function PlanLimitBanner({ clientsUsed, clientLimit }: PlanLimitBannerProps) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const wasDismissed = window.sessionStorage.getItem(DISMISS_KEY) === "1"
    setDismissed(wasDismissed)
  }, [])

  const approachingLimit = useMemo(() => {
    if (clientLimit === null) return false
    return clientsUsed >= Math.max(clientLimit - 1, 1)
  }, [clientLimit, clientsUsed])

  if (!approachingLimit || dismissed || clientLimit === null) {
    return null
  }

  const isFull = clientsUsed >= clientLimit

  return (
    <div
      className={cn(
        "flex items-start justify-between rounded-2xl border px-4 py-3 text-sm",
        isFull
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-sky-300 bg-sky-50 text-sky-900"
      )}
    >
      <p>
        You've used {clientsUsed}/{clientLimit} clients. Upgrade to add more.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={() => {
          window.sessionStorage.setItem(DISMISS_KEY, "1")
          setDismissed(true)
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
