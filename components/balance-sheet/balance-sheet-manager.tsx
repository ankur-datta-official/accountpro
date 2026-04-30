"use client"

import { useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { Download, Landmark, Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"

import { BalanceSheetPrint } from "@/components/balance-sheet/BalanceSheetPrint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingTable } from "@/components/ui/LoadingTable"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBalanceSheet } from "@/lib/hooks/useBalanceSheet"
import { exportBalanceSheet } from "@/lib/utils/export"

function amount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function renderSectionLines(lines: Array<{ label: string; amount: number }>) {
  return lines.map((line) => (
    <div key={line.label} className="flex items-center justify-between text-sm">
      <span>{line.label}</span>
      <span className="font-medium">{amount(line.amount)}</span>
    </div>
  ))
}

function ComparativeAmount({
  current,
  previous,
}: {
  current: number
  previous: number | null
}) {
  return (
    <div className="grid grid-cols-2 gap-3 text-right text-sm">
      <span className="font-medium text-slate-900">{amount(current)}</span>
      <span className="text-slate-600">{previous == null ? "-" : amount(previous)}</span>
    </div>
  )
}

export function BalanceSheetManager({
  clientId,
  clientName,
  fiscalYears,
  selectedFiscalYearId,
}: {
  clientId: string
  clientName: string
  fiscalYears: Array<{ id: string; label: string }>
  selectedFiscalYearId: string
}) {
  const printRef = useRef<HTMLDivElement>(null)
  const [fiscalYearId, setFiscalYearId] = useState(selectedFiscalYearId)
  const { data, isLoading } = useBalanceSheet({
    clientId,
    fiscalYearId,
  })

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${clientName}-balance-sheet`,
  })

  const endDateLabel = useMemo(() => {
    if (!data) {
      return ""
    }

    return format(new Date(data.current.endDate), "dd MMM yyyy")
  }, [data])

  const currentLabel = data?.current.fiscalYearLabel ?? ""
  const previousLabel = data?.previous?.fiscalYearLabel ?? "Previous Year"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
            Balance Sheet as at {endDateLabel || "-"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {clientName} · {currentLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={fiscalYearId} onValueChange={setFiscalYearId}>
            <SelectTrigger className="h-10 w-[220px] rounded-xl border-slate-200">
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
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200"
            onClick={() => void handlePrint()}
            disabled={!data || isLoading}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200"
            disabled={!data || isLoading}
            onClick={() => data && exportBalanceSheet(clientName, data)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-xl text-slate-950">Statement of Financial Position</CardTitle>
          {data ? (
            <Badge
              variant="secondary"
              className={`rounded-full px-3 py-1 text-xs ${
                data.isBalanced
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : "bg-red-100 text-red-700 hover:bg-red-100"
              }`}
            >
              {data.isBalanced ? "Balanced" : `Unbalanced - Diff: ৳${amount(data.difference)}`}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingTable columns={["Section", "Current Year", "Previous Year"]} rows={10} />
          ) : !data ? (
            <EmptyState
              icon={Landmark}
              title="No balance sheet available"
              description="There isn't enough posted data to build a balance sheet for this fiscal year yet."
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                <h3 className="text-lg font-semibold text-slate-900">ASSETS</h3>

                <div className="space-y-2">
                  <p className="font-medium text-slate-800">{data.current.assets.nonCurrentAssets.title}</p>
                  {renderSectionLines(data.current.assets.nonCurrentAssets.lines)}
                  <ComparativeAmount
                    current={data.current.assets.nonCurrentAssets.total}
                    previous={data.previous?.assets.nonCurrentAssets.total ?? null}
                  />
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-slate-800">{data.current.assets.currentAssets.title}</p>
                  {renderSectionLines(data.current.assets.currentAssets.lines)}
                  <ComparativeAmount
                    current={data.current.assets.currentAssets.total}
                    previous={data.previous?.assets.currentAssets.total ?? null}
                  />
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-slate-800">{data.current.assets.preliminaryExpenses.title}</p>
                  {renderSectionLines(data.current.assets.preliminaryExpenses.lines)}
                  <ComparativeAmount
                    current={data.current.assets.preliminaryExpenses.total}
                    previous={data.previous?.assets.preliminaryExpenses.total ?? null}
                  />
                </div>

                <div className="border-t border-slate-300 pt-3">
                  <p className="mb-1 font-semibold text-slate-900">TOTAL ASSETS</p>
                  <ComparativeAmount
                    current={data.current.assets.totalAssets}
                    previous={data.previous?.assets.totalAssets ?? null}
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                <h3 className="text-lg font-semibold text-slate-900">LIABILITIES & EQUITY</h3>

                <div className="space-y-2">
                  <p className="font-medium text-slate-800">{data.current.liabilitiesEquity.equity.title}</p>
                  {renderSectionLines(data.current.liabilitiesEquity.equity.lines)}
                  <ComparativeAmount
                    current={data.current.liabilitiesEquity.equity.total}
                    previous={data.previous?.liabilitiesEquity.equity.total ?? null}
                  />
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-slate-800">
                    {data.current.liabilitiesEquity.nonCurrentLiabilities.title}
                  </p>
                  {renderSectionLines(data.current.liabilitiesEquity.nonCurrentLiabilities.lines)}
                  <ComparativeAmount
                    current={data.current.liabilitiesEquity.nonCurrentLiabilities.total}
                    previous={data.previous?.liabilitiesEquity.nonCurrentLiabilities.total ?? null}
                  />
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-slate-800">{data.current.liabilitiesEquity.currentLiabilities.title}</p>
                  {renderSectionLines(data.current.liabilitiesEquity.currentLiabilities.lines)}
                  <ComparativeAmount
                    current={data.current.liabilitiesEquity.currentLiabilities.total}
                    previous={data.previous?.liabilitiesEquity.currentLiabilities.total ?? null}
                  />
                </div>

                <div className="border-t border-slate-300 pt-3">
                  <p className="mb-1 font-semibold text-slate-900">TOTAL LIABILITIES & EQUITY</p>
                  <ComparativeAmount
                    current={data.current.liabilitiesEquity.totalLiabilitiesEquity}
                    previous={data.previous?.liabilitiesEquity.totalLiabilitiesEquity ?? null}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium">Comparative Columns</p>
          <p className="mt-1">
            Left value = {currentLabel}, Right value = {previousLabel}
          </p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0">
        {data ? (
          <BalanceSheetPrint
            ref={printRef}
            companyName={clientName}
            fiscalYearLabel={currentLabel}
            current={data.current}
            previous={data.previous}
            isBalanced={data.isBalanced}
            difference={data.difference}
          />
        ) : null}
      </div>
    </div>
  )
}
