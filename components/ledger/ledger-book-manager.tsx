"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { BookOpenText, Download, Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"

import { LedgerPrint, type PrintableLedgerSection } from "@/components/ledger/LedgerPrint"
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

function LedgerSection({
  clientId,
  accountHeadId,
  fiscalYearId,
  fromDate,
  toDate,
  periodLabel,
  onLoaded,
}: {
  clientId: string
  accountHeadId: string
  fiscalYearId: string
  fromDate: string
  toDate: string
  periodLabel: string
  onLoaded?: (section: PrintableLedgerSection) => void
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
    return (
      <EmptyState
        icon={BookOpenText}
        title="No ledger data available"
        description="There are no ledger rows for this account in the selected period."
      />
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
      <CardHeader>
        <CardTitle className="text-xl text-slate-950">{accountHead.name}</CardTitle>
        <div className="grid gap-1 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-800">Group:</span> {accountHead.groupName}
          </p>
          <p>
            <span className="font-medium text-slate-800">Period:</span> {periodLabel}
          </p>
          <p>
            <span className="font-medium text-slate-800">Opening Balance:</span>{" "}
            {signedBalanceToLabel(ledger.openingBalanceAmount, accountHead.groupType)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Voucher No</TableHead>
              <TableHead>Voucher Type</TableHead>
              <TableHead>Payment Mode</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
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
              <TableRow key={entry.id}>
                <TableCell>{format(new Date(entry.date), "dd MMM yyyy")}</TableCell>
                <TableCell>{entry.voucherNo}</TableCell>
                <TableCell className="uppercase">{entry.voucherType}</TableCell>
                <TableCell>{entry.paymentMode ?? "-"}</TableCell>
                <TableCell>{entry.description ?? "-"}</TableCell>
                <TableCell className="text-right">{amount(entry.debit)}</TableCell>
                <TableCell className="text-right text-blue-700">{amount(entry.credit)}</TableCell>
                <TableCell
                  className={`text-right ${
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
  const [accountHeadId, setAccountHeadId] = useState("")
  const [allLedgersMode, setAllLedgersMode] = useState(false)
  const [allLedgerCache, setAllLedgerCache] = useState<Record<string, PrintableLedgerSection>>({})
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

  const singleLedger = useLedger(
    accountHeadId
      ? {
          clientId,
          accountHeadId,
          fiscalYearId,
          from: fromDate,
          to: toDate,
        }
      : null
  )

  const periodLabel = `${format(new Date(fromDate), "dd MMM yyyy")} - ${format(new Date(toDate), "dd MMM yyyy")}`

  const printSections = useMemo<PrintableLedgerSection[]>(() => {
    if (allLedgersMode) {
      return accountOptions
        .map((account) => allLedgerCache[account.id])
        .filter((section): section is PrintableLedgerSection => Boolean(section))
    }

    if (!singleLedger.ledger?.accountHead) {
      return []
    }

    const section = singleLedger.ledger
    const accountHead = section.accountHead

    if (!accountHead) {
      return []
    }

    return [
      {
        accountHeadId: accountHead.id,
        accountName: accountHead.name,
        groupName: accountHead.groupName,
        groupType: accountHead.groupType,
        periodLabel,
        openingBalanceLabel: signedBalanceToLabel(section.openingBalanceAmount, accountHead.groupType),
        totalDebit: section.totals.debit,
        totalCredit: section.totals.credit,
        closingBalance: section.totals.closingBalance,
        rows: section.entries.map((entry) => ({
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
      },
    ]
  }, [accountOptions, allLedgerCache, allLedgersMode, periodLabel, singleLedger.ledger])

  useEffect(() => {
    setAllLedgerCache({})
  }, [fiscalYearId, fromDate, toDate, allLedgersMode])

  const handleSectionLoaded = useCallback((section: PrintableLedgerSection) => {
    setAllLedgerCache((current) => ({ ...current, [section.accountHeadId]: section }))
  }, [])

  const handleExport = () => {
    if (!printSections.length) {
      return
    }

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
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Ledger Book</h2>
          <p className="mt-2 text-sm text-slate-500">
            Browse account-wise ledger with running balances for {clientName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200"
            onClick={() => setAllLedgersMode((current) => !current)}
          >
            {allLedgersMode ? "Single Ledger" : "All Ledgers"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200"
            onClick={() => void handlePrint()}
            disabled={!printSections.length}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200"
            onClick={handleExport}
            disabled={!printSections.length}
          >
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-4">
          <div>
            <Input
              list={`ledger-account-heads-${clientId}`}
              value={accountSearch}
              onChange={(event) => {
                const value = event.target.value
                setAccountSearch(value)
                const matched = accountOptions.find(
                  (account) =>
                    account.hierarchyLabel === value ||
                    account.name === value ||
                    account.id === value
                )
                setAccountHeadId(matched?.id ?? "")
              }}
              className="h-11 rounded-xl border-slate-200"
              placeholder="Search Account Head"
              disabled={allLedgersMode}
            />
            <datalist id={`ledger-account-heads-${clientId}`}>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.hierarchyLabel} />
              ))}
            </datalist>
          </div>

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

      {allLedgersMode ? (
        <div className="space-y-5">
          {accountOptions.map((account) => (
            <LedgerSection
              key={account.id}
              clientId={clientId}
              accountHeadId={account.id}
              fiscalYearId={fiscalYearId}
              fromDate={fromDate}
              toDate={toDate}
              periodLabel={periodLabel}
              onLoaded={handleSectionLoaded}
            />
          ))}
        </div>
      ) : accountHeadId ? (
        <LedgerSection
          clientId={clientId}
          accountHeadId={accountHeadId}
          fiscalYearId={fiscalYearId}
          fromDate={fromDate}
          toDate={toDate}
          periodLabel={periodLabel}
        />
      ) : (
        <EmptyState
          icon={BookOpenText}
          title="Choose an account head"
          description="Select an account head to view the ledger table for the chosen fiscal year and date range."
        />
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
