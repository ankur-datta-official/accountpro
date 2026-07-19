"use client"

import { Fragment, useMemo, useState } from "react"
import { format } from "date-fns"
import { Download, Printer, Search } from "lucide-react"

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

function HighlightedText({ text, search }: { text: string; search: string }) {
  if (!search || !text) {
    return <>{text}</>
  }

  const lowerText = text.toLowerCase()
  const lowerSearch = search.toLowerCase()
  const index = lowerText.indexOf(lowerSearch)

  if (index === -1) {
    return <>{text}</>
  }

  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-200 px-1 rounded">{text.slice(index, index + search.length)}</mark>
      {text.slice(index + search.length)}
    </>
  )
}

type SortColumn = "date" | "voucherNo" | "accountsGroup" | "accountHead" | "voucherType" | "paymentMode" | "receipt" | "payment" | "description"
type SortDirection = "asc" | "desc"

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
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const itemsPerPage = 20

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesDate = row.date >= fromDate && row.date <= toDate
      const matchesMonth = monthFilter === "all" || row.month === monthFilter
      const matchesVoucherType = voucherTypeFilter === "all" || row.voucherType === voucherTypeFilter
      const matchesPaymentMode = paymentModeFilter === "all" || row.paymentMode === paymentModeFilter
      const matchesSearch = !searchQuery || 
        String(row.voucherNo).toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.accountHead.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.description && row.description.toLowerCase().includes(searchQuery.toLowerCase()))

      return matchesDate && matchesMonth && matchesVoucherType && matchesPaymentMode && matchesSearch
    })
  }, [fromDate, toDate, monthFilter, paymentModeFilter, rows, voucherTypeFilter, searchQuery])

  const sortedAndGroupedRows = useMemo(() => {
    const grouped = new Map<string, DayBookRow[]>()

    // Group rows by date
    for (const row of filteredRows) {
      if (!grouped.has(row.date)) {
        grouped.set(row.date, [])
      }
      grouped.get(row.date)?.push(row)
    }

    // Sort items within each date group by voucher number (default), or selected sort column
    const sortedGroups = Array.from(grouped.entries()).map(([date, items]) => {
      const sortedItems = [...items]
      sortedItems.sort((a, b) => {
        // Primary sort by selected column, default to voucher number
        const primaryCol = sortColumn || "voucherNo"
        const aVal = a[primaryCol] as string | number | null | undefined
        const bVal = b[primaryCol] as string | number | null | undefined

        // Handle null/undefined values
        const aComparable = aVal ?? ""
        const bComparable = bVal ?? ""

        let comparison: number

        // Convert to strings for string comparison, numbers for numeric
        if (typeof aComparable === "number" && typeof bComparable === "number") {
          comparison = sortDirection === "asc" ? aComparable - bComparable : bComparable - aComparable
        } else {
          const aStr = String(aComparable).toLowerCase()
          const bStr = String(bComparable).toLowerCase()
          if (aStr < bStr) comparison = sortDirection === "asc" ? -1 : 1
          else if (aStr > bStr) comparison = sortDirection === "asc" ? 1 : -1
          else comparison = 0
        }

        // Secondary sort by voucher number if primary is equal
        if (comparison === 0 && primaryCol !== "voucherNo") {
          const aVoucher = String(a.voucherNo).toLowerCase()
          const bVoucher = String(b.voucherNo).toLowerCase()
          if (aVoucher < bVoucher) return -1
          if (aVoucher > bVoucher) return 1
        }

        return comparison
      })

      return {
        date,
        items: sortedItems,
        receipts: sortedItems.reduce((sum, item) => sum + item.receipt, 0),
        payments: sortedItems.reduce((sum, item) => sum + item.payment, 0),
      }
    })

    // Sort the date groups themselves by date (ascending)
    sortedGroups.sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return dateA.getTime() - dateB.getTime()
    })

    return sortedGroups
  }, [filteredRows, sortColumn, sortDirection])

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedAndGroupedRows.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedAndGroupedRows, currentPage])

  const totalPages = Math.ceil(sortedAndGroupedRows.length / itemsPerPage)

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
          size: A4 portrait;
          margin: 15mm !important;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000000 !important;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            background: #ffffff !important;
          }

          body {
            display: block !important;
          }

          .day-book-screen-only {
            display: none !important;
          }

          .day-book-report {
            width: 100% !important;
            display: block !important;
          }

          .day-book-print-page {
            width: 100% !important;
            display: block !important;
          }

          .day-book-print-sheet {
            width: 100% !important;
            max-width: 186mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: #ffffff !important;
          }

          .day-book-print-root {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .day-book-print-header {
            margin-bottom: 5mm !important;
            padding-bottom: 3.5mm !important;
            border-bottom: 1px solid #000000 !important;
            text-align: center !important;
          }

          .day-book-print-table {
            width: 100% !important;
            margin: 0 !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 8.75px !important;
            line-height: 1.2 !important;
            background: #ffffff !important;
          }

          .day-book-print-table thead {
            display: table-header-group !important;
          }

          .day-book-print-table th {
            background-color: #ffffff !important;
            color: #000000 !important;
            padding: 6px 5px;
            text-align: left;
            font-weight: bold !important;
            border: 1px solid #000000 !important;
            border-bottom: 2px solid #000000 !important;
            word-break: break-word;
          }

          .day-book-print-table td {
            padding: 5px 4px;
            border: 1px solid #000000 !important;
            vertical-align: top;
            word-break: break-word;
            color: #000000 !important;
            background-color: #ffffff !important;
          }

          .day-book-print-table .date-header {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-weight: bold !important;
            padding: 6px 5px;
            border: 1px solid #000000 !important;
          }

          .day-book-print-table .daily-total {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-weight: bold !important;
          }

          .day-book-print-table .grand-total {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-weight: bold !important;
            font-size: 9px;
            border-top: 2px solid #000000 !important;
          }

          .day-book-print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .day-book-print-footer {
            margin-top: 8mm !important;
            padding-top: 4mm !important;
            border-top: 1px solid #000000 !important;
          }

          .day-book-signatures {
            display: flex !important;
            justify-content: space-between !important;
            gap: 10mm !important;
            align-items: flex-end !important;
          }

          .day-book-signature {
            flex: 1 1 0 !important;
            max-width: 60mm !important;
            text-align: center !important;
            color: #000000 !important;
          }

          .day-book-signature-line {
            width: 100% !important;
            border-top: 1px solid #000000 !important;
            margin: 0 auto !important;
          }
        }
      `}</style>

      <div className="day-book-screen-only rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        {/* Main Header + Filter + Action Row */}
        <div className="flex flex-col gap-6">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{clientName} Day Book</h2>
              <p className="mt-2 text-sm text-slate-500">Fiscal year: {fiscalYearLabel}</p>
            </div>

            {/* Action Buttons (aligned to right) */}
            <div className="flex flex-wrap gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-slate-200"
                      onClick={() => window.print()}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print Day Book
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Print the current Day Book entries in professional format
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-slate-200"
                      onClick={() => exportDayBook(exportRows, clientName, { from: fromDate, to: toDate })}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export to Excel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export Day Book entries to Excel file
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Filters Section (Single row on desktop, wraps on mobile/tablet) */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(event) => {
                        setFromDate(event.target.value)
                        setCurrentPage(1)
                        setSortColumn("date")
                        setSortDirection("asc")
                      }}
                      className="h-11 rounded-xl border-slate-200 w-full"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Select the start date for the Day Book range</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(event) => {
                        setToDate(event.target.value)
                        setCurrentPage(1)
                        setSortColumn("date")
                        setSortDirection("asc")
                      }}
                      className="h-11 rounded-xl border-slate-200 w-full"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Select the end date for the Day Book range</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
                    <Select value={monthFilter} onValueChange={(val) => { setMonthFilter(val); setCurrentPage(1); }}>
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 w-full">
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
                  </div>
                </TooltipTrigger>
                <TooltipContent>Filter Day Book entries by month</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Voucher Type</label>
                    <Select value={voucherTypeFilter} onValueChange={(val) => { setVoucherTypeFilter(val); setCurrentPage(1); }}>
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 w-full">
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
                </TooltipTrigger>
                <TooltipContent>Filter Day Book entries by voucher type</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                    <Select value={paymentModeFilter} onValueChange={(val) => { setPaymentModeFilter(val); setCurrentPage(1); }}>
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 w-full">
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
                </TooltipTrigger>
                <TooltipContent>Filter Day Book entries by payment mode</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      <div className="day-book-screen-only">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by Voucher #, Accounts Head, or Description..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="h-11 rounded-xl border-slate-200 pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4 print:hidden">
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

      {/* Print Layout */}
      <div className="hidden print:block day-book-print-root">
        <div className="day-book-print-page w-full">
          <div className="day-book-print-sheet">
            <div className="day-book-print-header">
              <h1 className="text-3xl font-bold">{clientName}</h1>
              <h2 className="mt-3 text-xl font-semibold">Day Book</h2>
              <p className="mt-3 text-sm">
                Fiscal Year: <span className="font-semibold">{fiscalYearLabel}</span> | Date Range:{" "}
                <span className="font-semibold">
                  {`${format(new Date(fromDate), "dd MMM yyyy")} to ${format(new Date(toDate), "dd MMM yyyy")}`}
                </span>
              </p>
            </div>

            {/* Summary Section */}
            <div className="mb-5 pt-3 pb-3 border-b">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-sm">Opening Balance</div>
                  <div className="text-lg font-semibold">{formatCurrency(openingBalance)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm">Total Receipts</div>
                  <div className="text-lg font-semibold">{formatCurrency(totalReceipts)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm">Total Payments</div>
                  <div className="text-lg font-semibold">{formatCurrency(totalPayments)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm">Closing Balance</div>
                  <div className="text-lg font-semibold">{formatCurrency(closingBalance)}</div>
                </div>
              </div>
            </div>

            {sortedAndGroupedRows.length === 0 ? (
              <div className="py-16 text-center">No vouchers available for the selected date range.</div>
            ) : (
              <table className="day-book-print-table">
                <thead>
                  <tr>
                    <th style={{ width: "8%" }}>Date</th>
                    <th style={{ width: "7%" }}>Voucher #</th>
                    <th style={{ width: "13%" }}>Accounts Group</th>
                    <th style={{ width: "16%" }}>Accounts Head</th>
                    <th style={{ width: "10%" }}>Voucher Type</th>
                    <th style={{ width: "11%" }}>Payment Mode</th>
                    <th style={{ width: "9%", textAlign: "right" }}>Receipts (Dr)</th>
                    <th style={{ width: "9%", textAlign: "right" }}>Payments (Cr)</th>
                    <th style={{ width: "17%" }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndGroupedRows.map((group) => (
                    <Fragment key={group.date}>
                      <tr key={`${group.date}-header`}>
                        <td colSpan={9} className="date-header font-semibold">
                          {format(new Date(group.date), "dd MMM yyyy")}
                        </td>
                      </tr>
                      {group.items.map((row) => (
                        <tr key={row.id}>
                          <td>{format(new Date(row.date), "dd MMM yyyy")}</td>
                          <td className="font-medium">{row.voucherNo}</td>
                          <td>{row.accountsGroup}</td>
                          <td>{row.accountHead}</td>
                          <td>{row.voucherType}</td>
                          <td>{row.paymentMode || "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            {formatAmount(row.receipt)}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {formatAmount(row.payment)}
                          </td>
                          <td>{row.description || "—"}</td>
                        </tr>
                      ))}
                      <tr key={`${group.date}-subtotal`} className="daily-total">
                        <td colSpan={6} style={{ textAlign: "right" }}>
                          Daily Total
                        </td>
                        <td style={{ textAlign: "right" }}>{formatAmount(group.receipts)}</td>
                        <td style={{ textAlign: "right" }}>{formatAmount(group.payments)}</td>
                        <td />
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="grand-total">
                    <td colSpan={6} style={{ textAlign: "right" }}>
                      Grand Total
                    </td>
                    <td style={{ textAlign: "right" }}>{formatAmount(totalReceipts)}</td>
                    <td style={{ textAlign: "right" }}>{formatAmount(totalPayments)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}

            <div className="day-book-print-footer">
              <div className="day-book-signatures">
                <div className="day-book-signature">
                  <div className="mb-2 text-sm">Prepared By</div>
                  <div className="day-book-signature-line" />
                </div>
                <div className="day-book-signature">
                  <div className="mb-2 text-sm">Approved By</div>
                  <div className="day-book-signature-line" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screen Layout */}
      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm print:hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl text-slate-950">Day Book</CardTitle>
          <p className="text-sm text-slate-500">
            {clientName} · {fiscalYearLabel} · {`${format(new Date(fromDate), "dd MMM yyyy")} to ${format(new Date(toDate), "dd MMM yyyy")}`}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {paginatedGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No entries found for the selected criteria
            </div>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-slate-700">
                  {[
                    { label: "Date", column: "date" as SortColumn },
                    { label: "Voucher #", column: "voucherNo" as SortColumn },
                    { label: "Accounts Group", column: "accountsGroup" as SortColumn },
                    { label: "Accounts Head", column: "accountHead" as SortColumn },
                    { label: "Voucher Type", column: "voucherType" as SortColumn },
                    { label: "Payment Mode", column: "paymentMode" as SortColumn },
                    { label: "Receipts(Dr)", column: "receipt" as SortColumn },
                    { label: "Payments(Cr)", column: "payment" as SortColumn },
                    { label: "Description", column: "description" as SortColumn },
                  ].map(({ label, column }) => (
                    <th
                      key={column}
                      className="px-3 py-3 text-left font-semibold cursor-pointer select-none hover:bg-slate-100 transition-colors"
                      onClick={() => {
                        if (sortColumn === column) {
                          setSortDirection(prev => prev === "asc" ? "desc" : "asc")
                        } else {
                          setSortColumn(column)
                          setSortDirection("asc")
                        }
                        setCurrentPage(1)
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        {sortColumn === column && (
                          <span className="text-slate-500">
                            {sortDirection === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedGroups.map((group) => (
                  <Fragment key={group.date}>
                    <tr key={`${group.date}-header`} className="bg-slate-100/80">
                      <td colSpan={9} className="px-3 py-2 font-semibold text-slate-900">
                        {format(new Date(group.date), "dd MMM yyyy")}
                      </td>
                    </tr>
                    {group.items.map((row, index) => (
                      <tr
                        key={row.id}
                        className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50/50"} ${
                          row.voucherType === "Payment" ? "border-l-4 border-red-400" : 
                          row.voucherType === "Received" ? "border-l-4 border-green-400" : 
                          "border-l-4 border-slate-300"
                        }`}
                      >
                        <td className="px-3 py-2">{format(new Date(row.date), "dd MMM yyyy")}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          <HighlightedText text={String(row.voucherNo)} search={searchQuery} />
                        </td>
                        <td className="px-3 py-2">{row.accountsGroup}</td>
                        <td className="px-3 py-2">
                          <HighlightedText text={row.accountHead} search={searchQuery} />
                        </td>
                        <td className="px-3 py-2">{row.voucherType}</td>
                        <td className="px-3 py-2">{row.paymentMode || "—"}</td>
                        <td className={`px-3 py-2 text-right ${row.receipt < 0 ? "text-red-600" : "text-slate-900"}`}>
                          {formatAmount(row.receipt)}
                        </td>
                        <td className={`px-3 py-2 text-right ${row.payment < 0 ? "text-red-600" : "text-slate-900"}`}>
                          {formatAmount(row.payment)}
                        </td>
                        <td className="px-3 py-2">
                          {row.description ? <HighlightedText text={row.description} search={searchQuery} /> : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr key={`${group.date}-subtotal`} className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                      <td colSpan={6} className="px-3 py-2 text-right">
                        Daily Total
                      </td>
                      <td className="px-3 py-2 text-right">{formatAmount(group.receipts)}</td>
                      <td className="px-3 py-2 text-right">{formatAmount(group.payments)}</td>
                      <td colSpan={1} />
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold text-slate-950">
                  <td colSpan={6} className="px-3 py-3 text-right">
                    Grand Total
                  </td>
                  <td className="px-3 py-3 text-right">{formatAmount(totalReceipts)}</td>
                  <td className="px-3 py-3 text-right">{formatAmount(totalPayments)}</td>
                  <td colSpan={1} />
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="day-book-screen-only flex items-center justify-between rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Screen-only footer */}
      <div className="day-book-print-footer hidden print:block" />
    </div>
  )
}
