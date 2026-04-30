"use client"

import { useRef, useState } from "react"
import { format } from "date-fns"
import { Download, Loader2, Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"

import { TrialBalancePrint } from "@/components/trial-balance/TrialBalancePrint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTrialBalance } from "@/lib/hooks/useTrialBalance"
import { exportTrialBalance } from "@/lib/utils/export"

function amount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function TrialBalanceManager({
  clientId,
  clientName,
  fiscalYearId,
  fiscalYearLabel,
  defaultFrom,
  defaultTo,
}: {
  clientId: string
  clientName: string
  fiscalYearId: string
  fiscalYearLabel: string
  defaultFrom: string
  defaultTo: string
}) {
  const printRef = useRef<HTMLDivElement>(null)
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [asOfDate, setAsOfDate] = useState(defaultTo)

  const { data, isLoading } = useTrialBalance({
    clientId,
    fiscalYearId,
    fromDate,
    asOfDate,
  })

  const groupedRows = (() => {
    const map = new Map<string, typeof data.accounts>()

    for (const account of data.accounts) {
      const list = map.get(account.semiSubGroupName) ?? []
      list.push(account)
      map.set(account.semiSubGroupName, list)
    }

    return Array.from(map.entries())
  })()

  const periodLabel = `${format(new Date(fromDate), "dd MMM yyyy")} - ${format(new Date(asOfDate), "dd MMM yyyy")}`
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${clientName}-trial-balance`,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Trial Balance</h2>
          <p className="mt-2 text-sm text-slate-500">
            {clientName} · {fiscalYearLabel}
          </p>
          <p className="mt-1 text-xs text-slate-500">Period: {periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200"
            onClick={() => void handlePrint()}
            disabled={isLoading}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200"
            onClick={() =>
              exportTrialBalance({
                clientName,
                fiscalYearLabel,
                periodLabel,
                rows: data.accounts,
                totalDebit: data.totalDebit,
                totalCredit: data.totalCredit,
                difference: data.difference,
                isBalanced: data.isBalanced,
              })
            }
            disabled={isLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-xl text-slate-950">Filters</CardTitle>
          <Badge
            variant="secondary"
            className={`rounded-full px-3 py-1 text-xs ${
              data.isBalanced
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                : "bg-red-100 text-red-700 hover:bg-red-100"
            }`}
          >
            {data.isBalanced
              ? "✓ Balanced"
              : `✗ Unbalanced — Diff: ৳${amount(data.difference)}`}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">From Date</p>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="h-11 rounded-xl border-slate-200"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">As of Date</p>
            <Input
              type="date"
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value)}
              className="h-11 rounded-xl border-slate-200"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">Trial Balance Statement</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semi-Sub Accounts Group</TableHead>
                <TableHead>Account Head</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading trial balance...
                  </TableCell>
                </TableRow>
              ) : groupedRows.length ? (
                groupedRows.map(([groupName, rows]) => {
                  const subTotalDebit = rows.reduce((sum, row) => sum + row.debit, 0)
                  const subTotalCredit = rows.reduce((sum, row) => sum + row.credit, 0)

                  return (
                    <>
                      <TableRow key={`${groupName}-header`} className="bg-slate-100 font-semibold">
                        <TableCell>{groupName}</TableCell>
                        <TableCell />
                        <TableCell className="text-right" />
                        <TableCell className="text-right" />
                        <TableCell className="text-right" />
                      </TableRow>
                      {rows.map((row) => (
                        <TableRow key={row.accountHeadId}>
                          <TableCell />
                          <TableCell>{row.accountHeadName}</TableCell>
                          <TableCell className="text-right">{amount(row.debit)}</TableCell>
                          <TableCell className="text-right text-blue-700">{amount(row.credit)}</TableCell>
                          <TableCell className="text-right">{row.balanceLabel}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow key={`${groupName}-subtotal`} className="bg-slate-50 font-semibold">
                        <TableCell />
                        <TableCell>Subtotal</TableCell>
                        <TableCell className="text-right">{amount(subTotalDebit)}</TableCell>
                        <TableCell className="text-right text-blue-700">{amount(subTotalCredit)}</TableCell>
                        <TableCell className="text-right">—</TableCell>
                      </TableRow>
                    </>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                    No trial balance data found for selected range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <tfoot>
              <TableRow className="bg-slate-100 font-semibold">
                <TableCell />
                <TableCell className="text-right">Grand Total</TableCell>
                <TableCell className="text-right">{amount(data.totalDebit)}</TableCell>
                <TableCell className="text-right text-blue-700">{amount(data.totalCredit)}</TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </CardContent>
      </Card>

      <div className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0">
        <TrialBalancePrint
          ref={printRef}
          companyName={clientName}
          fiscalYearLabel={fiscalYearLabel}
          periodLabel={periodLabel}
          rows={data.accounts}
          totalDebit={data.totalDebit}
          totalCredit={data.totalCredit}
          isBalanced={data.isBalanced}
          difference={data.difference}
        />
      </div>
    </div>
  )
}
