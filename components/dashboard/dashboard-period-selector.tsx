"use client"

import { useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarRange, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DashboardPeriodKey } from "@/lib/dashboard/dashboard-types"

const PERIOD_OPTIONS: Array<{ value: DashboardPeriodKey; label: string }> = [
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "fiscal-year", label: "This Fiscal Year" },
  { value: "custom", label: "Custom Range" },
]

export function DashboardPeriodSelector({
  value,
  from,
  to,
  maxDate,
}: {
  value: DashboardPeriodKey
  from: string
  to: string
  maxDate: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  const paramsString = searchParams.toString()
  const isCustom = value === "custom"

  const currentParams = useMemo(() => new URLSearchParams(paramsString), [paramsString])

  function navigate(next: URLSearchParams) {
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    })
  }

  function handleValueChange(nextValue: DashboardPeriodKey) {
    const next = new URLSearchParams(currentParams)
    next.set("period", nextValue)

    if (nextValue !== "custom") {
      next.delete("from")
      next.delete("to")
    } else {
      next.set("from", customFrom)
      next.set("to", customTo)
    }

    navigate(next)
  }

  function applyCustomRange() {
    const next = new URLSearchParams(currentParams)
    next.set("period", "custom")
    next.set("from", customFrom)
    next.set("to", customTo)
    navigate(next)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={(nextValue) => handleValueChange(nextValue as DashboardPeriodKey)}>
          <SelectTrigger className="h-10 min-w-[170px] rounded-xl border-border bg-surface-page">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPending ? <LoaderCircle className="h-4 w-4 animate-spin text-text-muted" aria-hidden="true" /> : null}
      </div>

      {isCustom ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="date"
            value={customFrom}
            max={maxDate}
            onChange={(event) => setCustomFrom(event.target.value)}
            aria-label="Custom period start date"
            className="h-10 rounded-xl border-border bg-surface-page sm:w-[156px]"
          />
          <Input
            type="date"
            value={customTo}
            max={maxDate}
            onChange={(event) => setCustomTo(event.target.value)}
            aria-label="Custom period end date"
            className="h-10 rounded-xl border-border bg-surface-page sm:w-[156px]"
          />
          <Button
            type="button"
            variant="outline"
            onClick={applyCustomRange}
            className="h-10 rounded-xl border-border"
            disabled={isPending}
          >
            <CalendarRange className="h-4 w-4" />
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  )
}
