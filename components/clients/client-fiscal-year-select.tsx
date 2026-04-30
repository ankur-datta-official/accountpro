"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFiscalYearContext } from "@/components/clients/fiscal-year-context"

export function ClientFiscalYearSelect({
  className,
}: {
  className?: string
}) {
  const { fiscalYears, selectedFiscalYearId, setSelectedFiscalYearId } = useFiscalYearContext()

  return (
    <Select value={selectedFiscalYearId ?? undefined} onValueChange={setSelectedFiscalYearId}>
      <SelectTrigger className={className ?? "w-full rounded-xl border-slate-200 sm:w-[220px]"}>
        <SelectValue placeholder="Select fiscal year" />
      </SelectTrigger>
      <SelectContent>
        {fiscalYears.map((year) => (
          <SelectItem key={year.id} value={year.id}>
            {year.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
