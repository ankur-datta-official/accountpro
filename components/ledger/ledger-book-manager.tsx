"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import {
  ArrowRight,
  BookOpenText,
  CalendarRange,
  Download,
  Filter,
  Printer,
  Search,
} from "lucide-react"
import { useReactToPrint } from "react-to-print"

import { LedgerPrint, type PrintableLedgerSection } from "@/components/ledger/LedgerPrint"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-shell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { signedBalanceToLabel } from "@/lib/accounting/ledger"
import { useLedgerDataset } from "@/lib/hooks/useLedgerDataset"
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
  section,
  periodLabel,
}: {
  section: PrintableLedgerSection
  periodLabel: string
}) {
  return (
    <Card className="overflow-hidden rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-5 border-b border-slate-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ledger statement
            </p>
            <CardTitle className="mt-2 text-2xl text-slate-950">{section.accountName}</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              {section.groupName} | {periodLabel}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="text-slate-500">Rows in period</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{section.rows.length}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Opening</p>
            <p className="mt-2 font-semibold text-slate-950">{section.openingBalanceLabel}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Debit</p>
            <p className="mt-2 font-semibold text-slate-950">{amount(section.totalDebit)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Credit</p>
            <p className="mt-2 font-semibold text-slate-950">{amount(section.totalCredit)}</p>
          </div>
          <div className={`rounded-2xl p-4 ${statTone(section.closingBalance)}`}>
            <p className="text-xs font-medium uppercase tracking-wide">Closing</p>
            <p className="mt-2 font-semibold">
              {signedBalanceToLabel(section.closingBalance, section.groupType)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </TableHead>
                <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Voucher
                </TableHead>
                <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </TableHead>
                <TableHead className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mode
                </TableHead>
                <TableHead className="min-w-64 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Particulars
                </TableHead>
                <TableHead className="w-28 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Debit
                </TableHead>
                <TableHead className="w-28 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Credit
                </TableHead>
                <TableHead className="w-36 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Balance
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              <TableRow className="bg-slate-50/70">
                <TableCell colSpan={5} className="font-medium text-slate-800">
                  Opening Balance
                </TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right font-medium">{section.openingBalanceLabel}</TableCell>
              </TableRow>

              {section.rows.map((entry) => (
                <TableRow key={entry.id} className="border-slate-100 hover:bg-slate-50/60">
                  <TableCell className="py-3 text-slate-900">
                    {format(new Date(entry.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="py-3 font-medium text-slate-950">#{entry.voucherNo}</TableCell>
                  <TableCell className="py-3 uppercase text-slate-600">{entry.voucherType}</TableCell>
                  <TableCell className="py-3 text-slate-600">{entry.paymentMode ?? "-"}</TableCell>
                  <TableCell className="max-w-[340px] py-3 text-sm text-slate-700">
                    <p className="truncate">{entry.description ?? "-"}</p>
                  </TableCell>
                  <TableCell className="py-3 text-right font-medium">{amount(entry.debit)}</TableCell>
                  <TableCell className="py-3 text-right font-medium">{amount(entry.credit)}</TableCell>
                  <TableCell
                    className={`py-3 text-right font-semibold ${
                      entry.runningBalance < 0 ? "text-red-600" : "text-slate-900"
                    }`}
                  >
                    {signedBalanceToLabel(entry.runningBalance, section.groupType)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

            <tfoot>
              <TableRow className="bg-slate-100 font-semibold">
                <TableCell colSpan={5} className="text-right">
                  Total
                </TableCell>
                <TableCell className="text-right">{amount(section.totalDebit)}</TableCell>
                <TableCell className="text-right">{amount(section.totalCredit)}</TableCell>
                <TableCell
                  className={`text-right ${
                    section.closingBalance < 0 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {signedBalanceToLabel(section.closingBalance, section.groupType)}
                </TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function LedgerWorkspaceSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-2xl border border-slate-100 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>

      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-5 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SummaryChip({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
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
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [fiscalYearId, setFiscalYearId] = useState(selectedFiscalYearId)
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [accountSearch, setAccountSearch] = useState("")
  const [sortBy, setSortBy] = useState<"activity" | "name" | "closing">("activity")
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false)
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0)
  const deferredSearch = useDeferredValue(accountSearch)
  const hasValidDateRange = !fromDate || !toDate || fromDate <= toDate

  const { dataset, isLoading, isFetching, error } = useLedgerDataset(
    hasValidDateRange
      ? {
          clientId,
          fiscalYearId,
          from: fromDate,
          to: toDate,
        }
      : null
  )

  const selectedFiscalYear =
    fiscalYears.find((year) => year.id === fiscalYearId) ??
    fiscalYears.find((year) => year.id === selectedFiscalYearId) ??
    fiscalYears[0]

  const periodLabel = `${format(new Date(fromDate), "dd MMM yyyy")} - ${format(new Date(toDate), "dd MMM yyyy")}`

  const searchSuggestions = useMemo(() => {
    const search = accountSearch.trim().toLowerCase()
    const sections = dataset?.sections ?? []

    if (!search) {
      return sections
        .filter((section) => section.rows.length > 0 || section.openingBalanceLabel !== "0.00 Dr")
        .sort((left, right) => right.rows.length - left.rows.length || left.accountName.localeCompare(right.accountName))
        .slice(0, 6)
    }

    const scored = sections
      .map((section) => {
        const accountName = section.accountName.toLowerCase()
        const groupName = section.groupName.toLowerCase()
        const exactStarts = accountName.startsWith(search) ? 3 : 0
        const accountMatch = accountName.includes(search) ? 2 : 0
        const groupMatch = groupName.includes(search) ? 1 : 0
        const score = exactStarts + accountMatch + groupMatch

        return {
          section,
          score,
        }
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        if (right.section.rows.length !== left.section.rows.length) {
          return right.section.rows.length - left.section.rows.length
        }

        return left.section.accountName.localeCompare(right.section.accountName)
      })
      .slice(0, 6)
      .map((item) => item.section)

    return scored
  }, [accountSearch, dataset?.sections])

  const filteredSections = useMemo<PrintableLedgerSection[]>(() => {
    const sections = dataset?.sections ?? []
    const search = deferredSearch.trim().toLowerCase()

    const scoped = sections.filter((section) => {
      if (!search) {
        return true
      }

      return (
        section.accountName.toLowerCase().includes(search) ||
        section.groupName.toLowerCase().includes(search)
      )
    })

    return [...scoped].sort((left, right) => {
      if (sortBy === "name") {
        return left.accountName.localeCompare(right.accountName)
      }

      if (sortBy === "closing") {
        return Math.abs(right.closingBalance) - Math.abs(left.closingBalance)
      }

      return right.rows.length - left.rows.length || left.accountName.localeCompare(right.accountName)
    })
  }, [dataset?.sections, deferredSearch, sortBy])

  const activeSections = useMemo(
    () => filteredSections.filter((section) => section.rows.length > 0 || section.openingBalanceLabel !== "0.00 Dr"),
    [filteredSections]
  )

  const totals = useMemo(() => {
    return {
      accounts: activeSections.length,
      rows: activeSections.reduce((sum, section) => sum + section.rows.length, 0),
      debit: activeSections.reduce((sum, section) => sum + section.totalDebit, 0),
      credit: activeSections.reduce((sum, section) => sum + section.totalCredit, 0),
    }
  }, [activeSections])

  useEffect(() => {
    setHighlightedSuggestionIndex(0)
  }, [accountSearch])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setIsSuggestionOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${clientName}-ledger-book`,
  })

  const applySuggestion = (value: string) => {
    setAccountSearch(value)
    setIsSuggestionOpen(false)
  }

  const handleExport = () => {
    if (!activeSections.length) return

    exportLedgerBook(
      activeSections.map((section) => ({
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
        description={`Review all filtered accounts for ${clientName} in one clean scrollable view.`}
        icon={BookOpenText}
        badge={isFetching ? "Refreshing" : "Ready"}
        className="py-3"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg border-slate-200"
              onClick={() => void handlePrint()}
              disabled={!activeSections.length}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg border-slate-200"
              onClick={handleExport}
              disabled={!activeSections.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-base font-semibold text-slate-950">Ledger filters</p>
              <p className="mt-1 text-sm text-slate-500">
                Search, date range, and quick totals in one compact control area.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
                {selectedFiscalYear?.label ?? ""}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-slate-200"
                onClick={() => {
                  setAccountSearch("")
                  setSortBy("activity")
                  setFiscalYearId(selectedFiscalYearId)
                  setFromDate(defaultFrom)
                  setToDate(defaultTo)
                }}
              >
                <Filter className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Search</label>
            <div ref={searchWrapRef} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={accountSearch}
                onChange={(event) => {
                  setAccountSearch(event.target.value)
                  setIsSuggestionOpen(true)
                }}
                onFocus={() => setIsSuggestionOpen(true)}
                onKeyDown={(event) => {
                  if (!searchSuggestions.length) {
                    return
                  }

                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setIsSuggestionOpen(true)
                    setHighlightedSuggestionIndex((current) =>
                      current >= searchSuggestions.length - 1 ? 0 : current + 1
                    )
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault()
                    setIsSuggestionOpen(true)
                    setHighlightedSuggestionIndex((current) =>
                      current <= 0 ? searchSuggestions.length - 1 : current - 1
                    )
                  }

                  if (event.key === "Enter" && isSuggestionOpen) {
                    event.preventDefault()
                    const selectedSuggestion = searchSuggestions[highlightedSuggestionIndex]
                    if (selectedSuggestion) {
                      applySuggestion(selectedSuggestion.accountName)
                    }
                  }

                  if (event.key === "Escape") {
                    setIsSuggestionOpen(false)
                  }
                }}
                placeholder="Search account head or group..."
                className="h-11 rounded-xl border-slate-200 pl-10"
                autoComplete="off"
              />

              {isSuggestionOpen && searchSuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Matching account heads
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.accountHeadId}
                        type="button"
                        className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${
                          index === highlightedSuggestionIndex
                            ? "bg-slate-950 text-white"
                            : "hover:bg-slate-50"
                        }`}
                        onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySuggestion(suggestion.accountName)}
                      >
                        <div className="min-w-0">
                          <p
                            className={`truncate text-sm font-medium ${
                              index === highlightedSuggestionIndex ? "text-white" : "text-slate-950"
                            }`}
                          >
                            {suggestion.accountName}
                          </p>
                          <p
                            className={`truncate text-xs ${
                              index === highlightedSuggestionIndex ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {suggestion.groupName} | {suggestion.rows.length} rows
                          </p>
                        </div>
                        <ArrowRight
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            index === highlightedSuggestionIndex ? "text-slate-300" : "text-slate-400"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Sort by</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activity">Rows count</SelectItem>
                <SelectItem value="name">Account name</SelectItem>
                <SelectItem value="closing">Closing balance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

          {!hasValidDateRange ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              `From date` cannot be after `To date`.
            </div>
          ) : null}

          {!isLoading && hasValidDateRange && dataset ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryChip label="Accounts" value={totals.accounts} />
              <SummaryChip label="Rows" value={totals.rows} />
              <SummaryChip label="Total debit" value={amount(totals.debit)} />
              <SummaryChip label="Total credit" value={amount(totals.credit)} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <LedgerWorkspaceSkeleton />
      ) : !hasValidDateRange ? null : dataset ? (
        <>
          <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950">Scrollable ledger list</p>
                <p className="text-sm text-slate-500">
                  {activeSections.length === 1
                    ? `Showing 1 account for ${periodLabel}`
                    : `Showing ${activeSections.length} accounts for ${periodLabel}`}
                </p>
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Scroll down for account tables
              </div>
            </CardContent>
          </Card>

          {activeSections.length > 0 ? (
            <div className="space-y-6">
              {activeSections.map((section) => (
                <LedgerSection
                  key={section.accountHeadId}
                  section={section}
                  periodLabel={periodLabel}
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
                      ? "Try clearing your search or adjusting the date filters."
                      : "There are no ledger balances or posted rows for the selected fiscal year and date range."
                  }
                />
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="rounded-[1.5rem] border-dashed border-slate-300 bg-white shadow-sm">
          <CardContent className="py-14">
            <EmptyState
              icon={BookOpenText}
              title="Unable to load ledger workspace"
              description={error?.message ?? "There was a problem loading the ledger dataset for this period."}
            />
          </CardContent>
        </Card>
      )}

      <div className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0">
        <LedgerPrint
          ref={printRef}
          companyName={clientName}
          fiscalYearLabel={selectedFiscalYear?.label ?? ""}
          sections={activeSections}
        />
      </div>
    </div>
  )
}
