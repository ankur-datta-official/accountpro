"use client"

import { useMemo, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DashboardCompareKey } from "@/lib/dashboard/dashboard-types"

export function DashboardComparisonSelector({
  value,
  options,
}: {
  value: DashboardCompareKey
  options: Array<{
    key: DashboardCompareKey
    label: string
    disabled?: boolean
  }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const paramsString = searchParams.toString()
  const currentParams = useMemo(() => new URLSearchParams(paramsString), [paramsString])

  function handleValueChange(nextValue: DashboardCompareKey) {
    const next = new URLSearchParams(currentParams)
    next.set("compare", nextValue)

    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-secondary">Compare with</span>
      <Select value={value} onValueChange={(nextValue) => handleValueChange(nextValue as DashboardCompareKey)}>
        <SelectTrigger className="h-10 min-w-[150px] rounded-xl border-border bg-surface-page">
          <SelectValue placeholder="Compare period" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.key} value={option.key} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending ? <LoaderCircle className="h-4 w-4 animate-spin text-text-muted" aria-hidden="true" /> : null}
    </div>
  )
}
