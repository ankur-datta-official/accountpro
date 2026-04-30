"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Download, Printer } from "lucide-react"

import { exportDayBook, type DayBookExportRow } from "@/lib/utils/export"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type DayBookRow = DayBookExportRow & {
  id: string
  voucherId: string
  accountHeadId: string
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function DayBookReport({
  clientName,
  fiscalYearLabel,
  defaultFrom,
  defaultTo,
  rows,
  months,
  paymentModes,
  openingCashBankBalance,
  cashBankHeadIds,
}: {
  clientName: string
  fiscalYearLabel: string
  defaultFrom: string
  defaultTo: string
  rows: DayBookRow[]
  months: string[]
  paymentModes: Array<{ id: string; name: string }>
  openingCashBankBalance: number
  cashBankHeadIds: string[]
}) {
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [monthFilter, setMonthFilter] = useState("all")
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("all")
  const [paymentModeFilter, setPaymentModeFilter] = useState("all")

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesDate = row.date >= fromDate && row.date <= toDate
      const matchesMonth = monthFilter === "all" || row.month === monthFilter
      const matchesVoucherType = voucherTypeFilter === "all" || row.voucherType === voucherTypeFilter
      const matchesPaymentMode = paymentModeFilter === "all" || row.paymentMode === paymentModeFilter

      return matchesDate && matchesMonth && matchesVoucherType && matchesPaymentMode
    })
  }, [fromDate, monthFilter, paymentModeFilter, rows, toDate, voucherTypeFilter])

  const groupedRows = useMemo(() => {
    const grouped = new Map<string, DayBookRow[]>()

    for (const row of filteredRows) {
      if (!grouped.has(row.date)) {
        grouped.set(row.date, [])
      }

      grouped.get(row.date)?.push(row)
    }

    return Array.from(grouped.entries()).map(([date, items]) => ({
      date,
      items,
      receipts: items.reduce((sum, item) => sum + item.receipt, 0),
      payments: items.reduce((sum, item) => sum + item.payment, 0),
    }))
  }, [filteredRows])

  const openingBalance = useMemo(() => {
    const priorCashBankMovement = rows
      .filter((row) => row.date < fromDate && cashBankHeadIds.includes(row.accountHeadId))
      .reduce((sum, row) => sum + row.receipt - row.payment, 0)

    return openingCashBankBalance + priorCashBankMovement
  }, [cashBankHeadIds, fromDate, openingCashBankBalance, rows])

  const totalReceipts = filteredRows.reduce((sum, row) => sum + row.receipt, 0)
  const totalPayments = filteredRows.reduce((sum, row) => sum + row.payment, 0)
  const closingBalance = openingBalance + totalReceipts - totalPayments

  const exportRows = filteredRows.map<DayBookExportRow>((row) => ({
    voucherNo: row.voucherNo,
    date: row.date,
    accountsGroup: row.accountsGroup,
    semiSubGroup: row.semiSubGroup,
    subGroup: row.subGroup,
    accountHead: row.accountHead,
    voucherType: row.voucherType,
    paymentMode: row.paymentMode,
    receipt: row.receipt,
    payment: row.payment,
    description: row.description,
    month: row.month,
  }))

  return (
    <div className="space-y-6 day-book-report">
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 12mm;
        }

        @media print {
          .day-book-screen-only {
            display: none !important;
          }

          .day-book-print-shell {
            box-shadow: none !important;
            border: 0 !important;
            padding: 0 !important;
          }

          .day-book-print-footer {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            font-size: 11px;
            text-align: center;
            color: #64748b;
          }

          .day-book-print-footer::after {
            content: "Page " counter(page);
          }
        }
      `}</style>

      <div className="day-book-screen-only flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{clientName} Day Book</h2>
          <p className="mt-2 text-sm text-slate-500">Fiscal year: {fiscalYearLabel}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200"
            onClick={() => exportDayBook(exportRows, clientName, { from: fromDate, to: toDate })}
          >
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      <div className="day-book-screen-only grid gap-4 xl:grid-cols-4">
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
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="h-11 rounded-xl border-slate-200">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={voucherTypeFilter} onValueChange={setVoucherTypeFilter}>
          <SelectTrigger className="h-11 rounded-xl border-slate-200">
            <SelectValue placeholder="Voucher Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Voucher Types</SelectItem>
            <SelectItem value="Payment">Payment</SelectItem>
            <SelectItem value="Received">Received</SelectItem>
            <SelectItem value="Journal">Journal</SelectItem>
            <SelectItem value="Contra">Contra</SelectItem>
            <SelectItem value="B/F">B/F</SelectItem>
            <SelectItem value="B/P">B/P</SelectItem>
            <SelectItem value="B/R">B/R</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="day-book-screen-only max-w-sm">
        <Select value={paymentModeFilter} onValueChange={setPaymentModeFilter}>
          <SelectTrigger className="h-11 rounded-xl border-slate-200">
            <SelectValue placeholder="Payment Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment Modes</SelectItem>
            {paymentModes.map((mode) => (
              <SelectItem key={mode.id} value={mode.name}>
                {mode.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Opening Balance", value: openingBalance },
          { label: "Total Receipts", value: totalReceipts },
          { label: "Total Payments", value: totalPayments },
          { label: "Closing Balance", value: closingBalance },
        ].map((item) => (
          <Card key={item.label} className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm day-book-print-shell">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-500">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-semibold tracking-tight ${item.value < 0 ? "text-red-600" : "text-slate-950"}`}>
                {formatCurrency(item.value)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm day-book-print-shell">
        <CardHeader className="pb-4 print:pb-2">
          <CardTitle className="text-xl text-slate-950">Day Book</CardTitle>
          <p className="text-sm text-slate-500">
            {clientName} · {fiscalYearLabel} · {format(new Date(fromDate), "dd MMM yyyy")} to{" "}
            {format(new Date(toDate), "dd MMM yyyy")}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-slate-700">
                {[
                  "Voucher #",
                  "Date",
                  "Accounts Group",
                  "Accounts Head",
                  "Voucher Type",
                  "Payment Mode",
                  "Receipts(Dr)",
                  "Payments(Cr)",
                  "Description",
                  "Month",
                ].map((header) => (
                  <th key={header} className="px-3 py-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((group) => (
                <>
                  <tr key={`${group.date}-header`} className="bg-slate-100/80">
                    <td colSpan={10} className="px-3 py-2 font-semibold text-slate-900">
                      {format(new Date(group.date), "dd MMM yyyy")}
                    </td>
                  </tr>
                  {group.items.map((row, index) => (
                    <tr
                      key={row.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">{row.voucherNo}</td>
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">{row.accountsGroup}</td>
                      <td className="px-3 py-2">{row.accountHead}</td>
                      <td className="px-3 py-2">{row.voucherType}</td>
                      <td className="px-3 py-2">{row.paymentMode || "—"}</td>
                      <td className={`px-3 py-2 text-right ${row.receipt < 0 ? "text-red-600" : "text-slate-900"}`}>
                        {formatAmount(row.receipt)}
                      </td>
                      <td className={`px-3 py-2 text-right ${row.payment < 0 ? "text-red-600" : "text-slate-900"}`}>
                        {formatAmount(row.payment)}
                      </td>
                      <td className="px-3 py-2">{row.description || "—"}</td>
                      <td className="px-3 py-2">{row.month}</td>
                    </tr>
                  ))}
                  <tr key={`${group.date}-subtotal`} className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                    <td colSpan={6} className="px-3 py-2 text-right">
                      Daily Total
                    </td>
                    <td className="px-3 py-2 text-right">{formatAmount(group.receipts)}</td>
                    <td className="px-3 py-2 text-right">{formatAmount(group.payments)}</td>
                    <td colSpan={2} />
                  </tr>
                </>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold text-slate-950">
                <td colSpan={6} className="px-3 py-3 text-right">
                  Grand Total
                </td>
                <td className="px-3 py-3 text-right">{formatAmount(totalReceipts)}</td>
                <td className="px-3 py-3 text-right">{formatAmount(totalPayments)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <div className="day-book-print-footer hidden print:block" />
    </div>
  )
}
