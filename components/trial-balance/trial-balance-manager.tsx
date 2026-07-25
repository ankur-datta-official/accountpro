"use client"

import { Fragment, useRef, useState } from "react"
import { format } from "date-fns"
import { Download, FileSpreadsheet, Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"

import { TrialBalancePrint } from "@/components/trial-balance/TrialBalancePrint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/input"
import { LoadingTable } from "@/components/ui/LoadingTable"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

function getTrialBalanceRowKey(groupName: string, accountHeadId: string, accountHeadName: string, index: number) {
  return `${groupName}-${accountHeadId}-${accountHeadName}-${index}`
}

function getTrialBalanceGroupKey(accountGroupName: string, semiSubGroupName: string) {
  return `${accountGroupName}::${semiSubGroupName}`
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
  const [selectedAccountGroup, setSelectedAccountGroup] = useState("all")

  const { data, isLoading } = useTrialBalance({
    clientId,
    fiscalYearId,
    fromDate,
    asOfDate,
  })

  const accountGroupOptions = Array.from(
    new Set(data.accounts.map((account) => account.groupName).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right))

  const filteredAccounts =
    selectedAccountGroup === "all"
      ? data.accounts
      : data.accounts.filter((account) => account.groupName === selectedAccountGroup)

  const filteredTotalDebit = filteredAccounts.reduce((sum, row) => sum + row.debit, 0)
  const filteredTotalCredit = filteredAccounts.reduce((sum, row) => sum + row.credit, 0)
  const filteredDifference = Number(Math.abs(filteredTotalDebit - filteredTotalCredit).toFixed(2))
  const filteredIsBalanced = filteredDifference === 0
  const selectedAccountGroupLabel = selectedAccountGroup === "all" ? "All Account Groups" : selectedAccountGroup

  const groupedRows = (() => {
    const map = new Map<
      string,
      { accountGroupName: string; semiSubGroupName: string; rows: typeof filteredAccounts }
    >()

    for (const account of filteredAccounts) {
      const accountGroupName = account.groupName ?? "Other"
      const semiSubGroupName = account.semiSubGroupName ?? "Other"
      const key = getTrialBalanceGroupKey(accountGroupName, semiSubGroupName)
      const current = map.get(key)
      const list = current?.rows ?? []
      list.push(account)
      map.set(key, {
        accountGroupName,
        semiSubGroupName,
        rows: list,
      })
    }

    return Array.from(map.values()).sort((left, right) => {
      const groupComparison = left.accountGroupName.localeCompare(right.accountGroupName)
      if (groupComparison !== 0) {
        return groupComparison
      }

      return left.semiSubGroupName.localeCompare(right.semiSubGroupName)
    })
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
            disabled={isLoading || filteredAccounts.length === 0}
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
                rows: filteredAccounts,
                totalDebit: filteredTotalDebit,
                totalCredit: filteredTotalCredit,
                difference: filteredDifference,
                isBalanced: filteredIsBalanced,
              })
            }
            disabled={isLoading || filteredAccounts.length === 0}
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
              filteredIsBalanced
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                : "bg-red-100 text-red-700 hover:bg-red-100"
            }`}
          >
            {filteredIsBalanced ? "Balanced" : `Unbalanced - Diff: ৳${amount(filteredDifference)}`}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
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
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Account Group</p>
            <Select value={selectedAccountGroup} onValueChange={setSelectedAccountGroup}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200">
                <SelectValue placeholder="Select account group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Account Groups</SelectItem>
                {accountGroupOptions.map((groupName) => (
                  <SelectItem key={groupName} value={groupName}>
                    {groupName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">Trial Balance Statement</CardTitle>
          <p className="text-sm text-slate-500">Current view: {selectedAccountGroupLabel}</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Group</TableHead>
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
                  <TableCell colSpan={6} className="p-0">
                    <LoadingTable
                      columns={["Account Group", "Semi-Sub Accounts Group", "Account Head", "Debit", "Credit", "Balance"]}
                      rows={10}
                    />
                  </TableCell>
                </TableRow>
              ) : groupedRows.length ? (
                groupedRows.map(({ accountGroupName, semiSubGroupName, rows }) => {
                  const subTotalDebit = rows.reduce((sum, row) => sum + row.debit, 0)
                  const subTotalCredit = rows.reduce((sum, row) => sum + row.credit, 0)

                  return (
                    <Fragment key={getTrialBalanceGroupKey(accountGroupName, semiSubGroupName)}>
                      <TableRow className="bg-slate-100 font-semibold">
                        <TableCell>{accountGroupName}</TableCell>
                        <TableCell>{semiSubGroupName}</TableCell>
                        <TableCell />
                        <TableCell className="text-right" />
                        <TableCell className="text-right" />
                        <TableCell className="text-right" />
                      </TableRow>
                      {rows.map((row, index) => (
                        <TableRow
                          key={getTrialBalanceRowKey(
                            getTrialBalanceGroupKey(accountGroupName, semiSubGroupName),
                            row.accountHeadId,
                            row.accountHeadName,
                            index
                          )}
                        >
                          <TableCell />
                          <TableCell />
                          <TableCell>{row.accountHeadName}</TableCell>
                          <TableCell className="text-right">{amount(row.debit)}</TableCell>
                          <TableCell className="text-right text-blue-700">{amount(row.credit)}</TableCell>
                          <TableCell className="text-right">{row.balanceLabel}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-semibold">
                        <TableCell />
                        <TableCell />
                        <TableCell>Subtotal</TableCell>
                        <TableCell className="text-right">{amount(subTotalDebit)}</TableCell>
                        <TableCell className="text-right text-blue-700">{amount(subTotalCredit)}</TableCell>
                        <TableCell className="text-right">-</TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <EmptyState
                      icon={FileSpreadsheet}
                      title="No trial balance data found"
                      description="There are no trial balance rows for the selected period and account group."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <tfoot>
              <TableRow className="bg-slate-100 font-semibold">
                <TableCell />
                <TableCell />
                <TableCell className="text-right">Grand Total</TableCell>
                <TableCell className="text-right">{amount(filteredTotalDebit)}</TableCell>
                <TableCell className="text-right text-blue-700">{amount(filteredTotalCredit)}</TableCell>
                <TableCell className="text-right">-</TableCell>
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
          selectedAccountGroupLabel={selectedAccountGroupLabel}
          rows={filteredAccounts}
          totalDebit={filteredTotalDebit}
          totalCredit={filteredTotalCredit}
          isBalanced={filteredIsBalanced}
          difference={filteredDifference}
        />
      </div>
    </div>
  )
}
