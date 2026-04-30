"use client"

import { useState } from "react"
import { Download, Landmark } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/input"
import { LoadingTable } from "@/components/ui/LoadingTable"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBankStatement } from "@/lib/hooks/useBankStatement"
import { exportBankStatement } from "@/lib/utils/export"

function amount(value: number) {
  return new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function BankStatementsManager({
  clientId,
  fiscalYearId,
  defaultFrom,
  defaultTo,
  paymentModes,
}: {
  clientId: string
  fiscalYearId: string
  defaultFrom: string
  defaultTo: string
  paymentModes: Array<{ id: string; name: string }>
}) {
  const [paymentModeId, setPaymentModeId] = useState(paymentModes[0]?.id ?? "")
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)

  const { data, isLoading } = useBankStatement(
    paymentModeId
      ? {
          clientId,
          fiscalYearId,
          paymentModeId,
          fromDate,
          toDate,
        }
      : null
  )

  const grouped = (() => {
    const rows = data?.rows ?? []
    const map = new Map<string, typeof rows>()

    for (const row of rows) {
      const list = map.get(row.accountHead) ?? []
      list.push(row)
      map.set(row.accountHead, list)
    }

    return Array.from(map.entries())
  })()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Bank Statement</h2>
          <p className="mt-2 text-sm text-slate-500">Payment mode-wise statement with running balance.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-slate-200"
          disabled={!data || isLoading}
          onClick={() => data && exportBankStatement(data, { fromDate, toDate })}
        >
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Select value={paymentModeId} onValueChange={setPaymentModeId}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200">
              <SelectValue placeholder="Payment mode" />
            </SelectTrigger>
            <SelectContent>
              {paymentModes.map((mode) => (
                <SelectItem key={mode.id} value={mode.id}>
                  {mode.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="h-11 rounded-xl border-slate-200"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="h-11 rounded-xl border-slate-200"
          />
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">{data?.paymentModeName ?? "Statement"}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <LoadingTable
              columns={["Date", "Voucher No", "Account Head", "Description", "Debit", "Credit", "Balance"]}
              rows={10}
            />
          ) : data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher No</TableHead>
                  <TableHead>Account Head</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-slate-50/80">
                  <TableCell colSpan={6} className="font-medium">
                    Opening Balance
                  </TableCell>
                  <TableCell className="text-right font-medium">{amount(data.openingBalance)}</TableCell>
                </TableRow>
                {grouped.map(([head, rows]) => {
                  const debit = rows.reduce((sum, row) => sum + row.debit, 0)
                  const credit = rows.reduce((sum, row) => sum + row.credit, 0)

                  return (
                    <>
                      <TableRow key={`${head}-header`} className="bg-slate-100 font-medium">
                        <TableCell colSpan={7}>{head}</TableCell>
                      </TableRow>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.voucherNo}</TableCell>
                          <TableCell>{row.accountHead}</TableCell>
                          <TableCell>{row.description || "-"}</TableCell>
                          <TableCell className="text-right">{amount(row.debit)}</TableCell>
                          <TableCell className="text-right text-blue-700">{amount(row.credit)}</TableCell>
                          <TableCell className="text-right">{amount(row.runningBalance)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow key={`${head}-subtotal`} className="bg-slate-50 font-semibold">
                        <TableCell colSpan={4}>Subtotal</TableCell>
                        <TableCell className="text-right">{amount(debit)}</TableCell>
                        <TableCell className="text-right text-blue-700">{amount(credit)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </>
                  )
                })}
                <TableRow className="bg-slate-100 font-semibold">
                  <TableCell colSpan={4}>Grand Total</TableCell>
                  <TableCell className="text-right">{amount(data.totalDebit)}</TableCell>
                  <TableCell className="text-right text-blue-700">{amount(data.totalCredit)}</TableCell>
                  <TableCell className="text-right">{amount(data.closingBalance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Landmark}
              title="No bank statement data"
              description="Choose a payment mode and date range to review bank activity."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
