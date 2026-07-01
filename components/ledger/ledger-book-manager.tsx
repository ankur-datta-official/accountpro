"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { BookOpenText, Download, Layers3, Printer, Search } from "lucide-react"
import { useReactToPrint } from "react-to-print"

import { LedgerPrint, type PrintableLedgerSection } from "@/components/ledger/LedgerPrint"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/input"
import { LoadingTable } from "@/components/ui/LoadingTable"
import { FilterPanel, PageHeader } from "@/components/ui/page-shell"
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
import { signedBalanceToLabel } from "@/lib/accounting/ledger"
import { useChartOfAccounts } from "@/lib/hooks/useChartOfAccounts"
import { useLedger } from "@/lib/hooks/useLedger"
import { exportLedgerBook } from "@/lib/utils/export"

function amount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function statTone(value: number) {
  if (value < 0) return "bg-red-50 text-red-700"
  if (value > 0) return "bg-emerald-50 text-emerald-700"
  return "bg-slate-50 text-slate-700"
}

function LedgerSection({
  clientId,
  accountHeadId,
  fiscalYearId,
  fromDate,
  toDate,
  periodLabel,
  onLoaded,
  hideEmpty = false,
}: {
  clientId: string
  accountHeadId: string
  fiscalYearId: string
  fromDate: string
  toDate: string
  periodLabel: string
  onLoaded?: (section: PrintableLedgerSection) => void
  hideEmpty?: boolean
}) {
  const { ledger, isLoading } = useLedger({
    clientId,
    accountHeadId,
    fiscalYearId,
    from: fromDate,
    to: toDate,
  })
  const [cursorStack, setCursorStack] = useState<string[]>([])

  useEffect(() => {
    if (!onLoaded || !ledger?.accountHead) {
      return
    }

    onLoaded({
      accountHeadId: ledger.accountHead.id,
      accountName: ledger.accountHead.name,
      groupName: ledger.accountHead.groupName,
      groupType: ledger.accountHead.groupType,
      periodLabel,
      openingBalanceLabel: signedBalanceToLabel(ledger.openingBalanceAmount, ledger.accountHead.groupType),
      totalDebit: ledger.totals.debit,
      totalCredit: ledger.totals.credit,
      closingBalance: ledger.totals.closingBalance,
      rows: ledger.entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        voucherNo: entry.voucherNo,
        voucherType: entry.voucherType,
        paymentMode: entry.paymentMode,
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit,
        runningBalance: entry.runningBalance,
      })),
    })
  }, [ledger, onLoaded, periodLabel])

  useEffect(() => {
    setCursorStack([])
  }, [accountHeadId, fiscalYearId, fromDate, toDate])

  if (isLoading) {
    return (
      <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <LoadingTable
            columns={[
              "Date",
              "Voucher No",
              "Voucher Type",
              "Payment Mode",
              "Description",
              "Debit",
              "Credit",
              "Balance",
            ]}
            rows={10}
          />
        </CardContent>
      </Card>
    )
  }

  if (!ledger?.accountHead) {
    if (hideEmpty) return null
    return (
      <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
        <CardContent className="py-12">
          <EmptyState
            icon={BookOpenText}
            title="No ledger data available"
            description="There are no ledger rows for this account in the selected period."
          />
        </CardContent>
      </Card>
    )
  }

  if (ledger.entries.length === 0 && hideEmpty) {
    return null
  }

  if (ledger.entries.length === 0 && !hideEmpty) {
    return (
      <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
        <CardContent className="py-12">
          <EmptyState
            icon={BookOpenText}
            title="No ledger data available"
            description="There are no ledger rows for this account in the selected period."
          />
        </CardContent>
      </Card>
    )
  }

  const accountHead = ledger.accountHead
  const pageSize = 50
  const currentCursor = cursorStack[cursorStack.length - 1] ?? null
  const startIndex = currentCursor
    ? Math.max(
        ledger.entries.findIndex((entry) => entry.id === currentCursor) + 1,
        0
      )
    : 0
  const visibleEntries = ledger.entries.slice(startIndex, startIndex + pageSize)
  const hasPreviousPage = cursorStack.length > 0
  const hasNextPage = startIndex + pageSize < ledger.entries.length

  return (
    <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ledger statement
            </p>
            <CardTitle className="mt-2 text-2xl text-slate-950">{accountHead.name}</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              {accountHead.groupName}
              {accountHead.subGroupName ? ` / ${accountHead.subGroupName}` : ""} · {periodLabel}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white">
            <p className="text-slate-300">Rows in period</p>
            <p className="mt-1 text-2xl font-semibold">{ledger.entries.length}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Opening</p>
            <p className="mt-2 font-semibold text-slate-950">
              {signedBalanceToLabel(ledger.openingBalanceAmount, accountHead.groupType)}
            </p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-4 text-blue-700">
            <p className="text-xs font-medium uppercase tracking-wide">Debit</p>
            <p className="mt-2 font-semibold">{amount(ledger.totals.debit)}</p>
          </div>
          <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-700">
            <p className="text-xs font-medium uppercase tracking-wide">Credit</p>
            <p className="mt-2 font-semibold">{amount(ledger.totals.credit)}</p>
          </div>
          <div className={`rounded-2xl p-4 ${statTone(ledger.totals.closingBalance)}`}>
            <p className="text-xs font-medium uppercase tracking-wide">Closing</p>
            <p className="mt-2 font-semibold">
              {signedBalanceToLabel(ledger.totals.closingBalance, accountHead.groupType)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-slate-50">
              <TableHead className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-500">Date</TableHead>
              <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-500">Voucher</TableHead>
              <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-500">Type</TableHead>
              <TableHead className="w-36 text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</TableHead>
              <TableHead className="min-w-64 text-xs font-semibold uppercase tracking-wide text-slate-500">Particulars</TableHead>
              <TableHead className="w-32 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Debit</TableHead>
              <TableHead className="w-32 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Credit</TableHead>
              <TableHead className="w-40 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-slate-50/80">
              <TableCell colSpan={5} className="font-medium text-slate-800">
                Opening Balance
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right font-medium">
                {signedBalanceToLabel(ledger.openingBalanceAmount, accountHead.groupType)}
              </TableCell>
            </TableRow>

            {visibleEntries.map((entry) => (
              <TableRow key={entry.id} className="border-slate-100 hover:bg-slate-50/80">
                <TableCell className="py-3">
                  <p className="font-medium text-slate-900">{format(new Date(entry.date), "dd MMM yyyy")}</p>
                </TableCell>
                <TableCell className="py-3 font-semibold text-slate-950">#{entry.voucherNo}</TableCell>
                <TableCell className="py-3 uppercase text-slate-600">{entry.voucherType}</TableCell>
                <TableCell className="py-3">
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {entry.paymentMode ?? "-"}
                  </span>
                </TableCell>
                <TableCell className="max-w-[340px] py-3">
                  <p className="truncate text-sm text-slate-700">{entry.description ?? "-"}</p>
                </TableCell>
                <TableCell className="py-3 text-right font-medium">{amount(entry.debit)}</TableCell>
                <TableCell className="py-3 text-right font-medium text-blue-700">{amount(entry.credit)}</TableCell>
                <TableCell
                  className={`py-3 text-right font-semibold ${
                    entry.runningBalance < 0 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {signedBalanceToLabel(entry.runningBalance, accountHead.groupType)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot>
            <TableRow className="bg-slate-100 font-semibold">
              <TableCell colSpan={5} className="text-right">
                Total
              </TableCell>
              <TableCell className="text-right">{amount(ledger.totals.debit)}</TableCell>
              <TableCell className="text-right text-blue-700">{amount(ledger.totals.credit)}</TableCell>
              <TableCell
                className={`text-right ${
                  ledger.totals.closingBalance < 0 ? "text-red-600" : "text-slate-900"
                }`}
              >
                {signedBalanceToLabel(ledger.totals.closingBalance, accountHead.groupType)}
              </TableCell>
            </TableRow>
          </tfoot>
        </Table>
        </div>

        {ledger.entries.length > pageSize ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing {Math.min(startIndex + 1, ledger.entries.length)}-
              {Math.min(startIndex + visibleEntries.length, ledger.entries.length)} of {ledger.entries.length} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200"
                disabled={!hasPreviousPage}
                onClick={() => setCursorStack((current) => current.slice(0, -1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200"
                disabled={!hasNextPage}
                onClick={() =>
                  setCursorStack((current) =>
                    visibleEntries.length ? [...current, visibleEntries[visibleEntries.length - 1].id] : current
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function LedgerBookManager({
  clientId,
  clientName,
  fiscalYears,
  selectedFiscalYearId,
  defaultFrom,
  defaultTo,
}: {
  clientId: string
  clientName: string
  fiscalYears: Array<{ id: string; label: string; start_date: string; end_date: string }>
  selectedFiscalYearId: string
  defaultFrom: string
  defaultTo: string
}) {
  const printRef = useRef<HTMLDivElement>(null)
  const [fiscalYearId, setFiscalYearId] = useState(selectedFiscalYearId)
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [accountSearch, setAccountSearch] = useState("")
  const [allLedgerCache, setAllLedgerCache] = useState<Record<string, PrintableLedgerSection>>({})
  const [isLoading, setIsLoading] = useState(true)
  const { flatAccounts } = useChartOfAccounts(clientId)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${clientName}-ledger-book`,
  })

  const selectedFiscalYear =
    fiscalYears.find((year) => year.id === fiscalYearId) ??
    fiscalYears.find((year) => year.id === selectedFiscalYearId) ??
    fiscalYears[0]

  const accountOptions = useMemo(
    () =>
      flatAccounts
        .filter((account) => account.isActive)
        .map((account) => ({
          ...account,
          hierarchyLabel: `${account.groupName} > ${account.subGroupName} > ${account.name}`,
        }))
        .sort((left, right) => left.hierarchyLabel.localeCompare(right.hierarchyLabel)),
    [flatAccounts]
  )

  // Filter account heads based on search only (cache gets populated as they render)
  const filteredAccountHeads = useMemo(() => {
    const search = accountSearch.trim().toLowerCase()
    
    if (!search) {
      return accountOptions
    }
    
    return accountOptions.filter((account) =>
      account.name.toLowerCase().includes(search) ||
      account.hierarchyLabel.toLowerCase().includes(search)
    )
  }, [accountOptions, accountSearch])

  // Count of account heads that actually have data
  const accountHeadsWithDataCount = useMemo(() => {
    return filteredAccountHeads.filter((account) => {
      const section = allLedgerCache[account.id]
      return section && section.rows.length > 0
    }).length
  }, [filteredAccountHeads, allLedgerCache])

  // Check if we've loaded all account heads
  const allAccountHeadsLoaded = useMemo(() => {
    return filteredAccountHeads.every(account => account.id in allLedgerCache)
  }, [filteredAccountHeads, allLedgerCache])

  // Update isLoading when all account heads are loaded or when filters change
  useEffect(() => {
    if (filteredAccountHeads.length > 0 && allAccountHeadsLoaded) {
      setIsLoading(false)
    }
  }, [filteredAccountHeads, allAccountHeadsLoaded])

  const periodLabel = `${format(new Date(fromDate), "dd MMM yyyy")} - ${format(new Date(toDate), "dd MMM yyyy")}`

  const printSections = useMemo<PrintableLedgerSection[]>(() => {
    return filteredAccountHeads
      .map((account) => allLedgerCache[account.id])
      .filter((section): section is PrintableLedgerSection => Boolean(section) && section.rows.length > 0)
  }, [filteredAccountHeads, allLedgerCache])

  useEffect(() => {
    setAllLedgerCache({})
    setIsLoading(true)
  }, [fiscalYearId, fromDate, toDate])

  const handleSectionLoaded = useCallback((section: PrintableLedgerSection) => {
    setAllLedgerCache((current) => ({ ...current, [section.accountHeadId]: section }))
  }, [])

  const handleExport = () => {
    if (!printSections.length) return

    exportLedgerBook(
      printSections.map((section) => ({
        accountName: section.accountName,
        groupName: section.groupName,
        period: section.periodLabel,
        openingBalance: section.openingBalanceLabel,
        rows: section.rows.map((entry) => ({
          date: entry.date,
          voucherNo: entry.voucherNo,
          voucherType: entry.voucherType.toUpperCase(),
          paymentMode: entry.paymentMode ?? "",
          description: entry.description ?? "",
          debit: entry.debit,
          credit: entry.credit,
          balance: signedBalanceToLabel(entry.runningBalance, section.groupType),
        })),
        totalDebit: section.totalDebit,
        totalCredit: section.totalCredit,
        closingBalance: signedBalanceToLabel(section.closingBalance, section.groupType),
      })),
      clientName
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account movement"
        title="Ledger Book"
        description={`Review account-wise movement, opening balances, period transactions, and closing balances for ${clientName}.`}
        icon={BookOpenText}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg border-slate-200"
              onClick={() => void handlePrint()}
              disabled={!printSections.length}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg border-slate-200"
              onClick={handleExport}
              disabled={!printSections.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          </>
        }
      />

      <FilterPanel title="Ledger controls" description="Search and filter account heads, or adjust fiscal year and date range.">
        <div className="grid gap-4 xl:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Account head</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
                placeholder="Search account heads..."
                className="h-11 rounded-xl border-slate-200 pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Fiscal year</label>
            <Select
              value={fiscalYearId}
              onValueChange={(value) => {
                setFiscalYearId(value)
                const year = fiscalYears.find((item) => item.id === value)
                if (year) {
                  setFromDate(year.start_date)
                  setToDate(year.end_date)
                }
              }}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200">
                <SelectValue placeholder="Fiscal year" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">From date</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="h-11 rounded-xl border-slate-200"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">To date</label>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="h-11 rounded-xl border-slate-200"
            />
          </div>
        </div>
      </FilterPanel>

      <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-950">Ledgers</p>
            <p className="mt-1 text-sm text-slate-500">
              {accountHeadsWithDataCount === 1 
                ? `Showing ${accountHeadsWithDataCount} account for ${periodLabel}`
                : `Showing ${accountHeadsWithDataCount} accounts for ${periodLabel}`}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            <Layers3 className="mr-1.5 h-3.5 w-3.5" />
            Batch review
          </span>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-5">
          {filteredAccountHeads.map((account) => (
            <LedgerSection
              key={account.id}
              clientId={clientId}
              accountHeadId={account.id}
              fiscalYearId={fiscalYearId}
              fromDate={fromDate}
              toDate={toDate}
              periodLabel={periodLabel}
              onLoaded={handleSectionLoaded}
              hideEmpty={true}
            />
          ))}
        </div>
      ) : accountHeadsWithDataCount > 0 ? (
        <div className="space-y-5">
          {filteredAccountHeads.map((account) => (
            <LedgerSection
              key={account.id}
              clientId={clientId}
              accountHeadId={account.id}
              fiscalYearId={fiscalYearId}
              fromDate={fromDate}
              toDate={toDate}
              periodLabel={periodLabel}
              onLoaded={handleSectionLoaded}
              hideEmpty={true}
            />
          ))}
        </div>
      ) : (
        <Card className="rounded-[1.5rem] border-dashed border-slate-300 bg-white shadow-sm">
          <CardContent className="py-14">
            <EmptyState
              icon={BookOpenText}
              title={accountSearch ? "No matching account heads" : "No ledger data available"}
              description={
                accountSearch 
                  ? "Try clearing your search or adjusting your filters."
                  : "There are no ledger entries for the selected fiscal year and date range."
              }
            />
          </CardContent>
        </Card>
      )}

      <div className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0">
        <LedgerPrint
          ref={printRef}
          companyName={clientName}
          fiscalYearLabel={selectedFiscalYear?.label ?? ""}
          sections={printSections}
        />
      </div>
    </div>
  )
}
