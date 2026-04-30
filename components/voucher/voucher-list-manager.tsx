"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { Download, FileSearch, Loader2, PlusCircle, Printer, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import { toast } from "sonner"

import { bulkDeleteVouchersAction } from "@/lib/actions/vouchers"
import { getVoucherTypeBadgeClass, getVoucherTypeLabel } from "@/lib/accounting/vouchers"
import { useChartOfAccounts } from "@/lib/hooks/useChartOfAccounts"
import { useVouchers, type VoucherFilters, type VoucherSortBy } from "@/lib/hooks/useVouchers"
import { DeleteVoucherButton } from "@/components/voucher/delete-voucher-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { ErrorFallback } from "@/components/ui/ErrorBoundary"
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

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value)
}

export function VoucherListManager({
  clientId,
  clientName,
  fiscalYearId,
  defaultFrom,
  defaultTo,
  months,
  paymentModes,
}: {
  clientId: string
  clientName: string
  fiscalYearId: string
  defaultFrom: string
  defaultTo: string
  months: string[]
  paymentModes: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>([])
  const [accountHeadSearch, setAccountHeadSearch] = useState("")
  const [isBulkPending, startBulkTransition] = useTransition()
  const { flatAccounts } = useChartOfAccounts(clientId)
  const [filters, setFilters] = useState<VoucherFilters>({
    fiscalYearId,
    from: defaultFrom,
    to: defaultTo,
    voucherType: "all",
    paymentModeId: undefined,
    accountHeadId: undefined,
    month: undefined,
    search: "",
    page: 1,
    sortBy: "date",
    sortOrder: "desc",
  })

  const { items, stats, page, totalPages, totalItems, isLoading, error, mutate } = useVouchers(
    clientId,
    filters
  )

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      fiscalYearId,
      from: defaultFrom,
      to: defaultTo,
      month: undefined,
      page: 1,
    }))
    setSelectedVoucherIds([])
    setAccountHeadSearch("")
  }, [defaultFrom, defaultTo, fiscalYearId])

  useEffect(() => {
    setSelectedVoucherIds((current) => {
      const next = current.filter((id) => items.some((item) => item.id === id))

      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current
      }

      return next
    })
  }, [items])

  const accountOptions = useMemo(
    () =>
      flatAccounts
        .filter((account) => account.isActive)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [flatAccounts]
  )

  const selectedCount = selectedVoucherIds.length
  const allSelectedOnPage = items.length > 0 && selectedCount === items.length

  const updateFilter = <Key extends keyof VoucherFilters>(key: Key, value: VoucherFilters[Key]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? (value as number) : 1,
    }))
  }

  const handleExportSelected = () => {
    const selectedItems = items.filter((item) => selectedVoucherIds.includes(item.id))

    if (!selectedItems.length) {
      toast.error("Select at least one voucher to export.")
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(
      selectedItems.map((item) => ({
        "Voucher No": item.voucherNo,
        Date: item.voucherDate,
        Type: getVoucherTypeLabel(item.voucherType),
        "Payment Mode": item.paymentModeName ?? "",
        "Account Head": item.accountHeadLabel,
        Debit: item.debit,
        Credit: item.credit,
        Description: item.description ?? "",
        Month: item.monthLabel ?? "",
      }))
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vouchers")
    XLSX.writeFile(workbook, `${clientName}-vouchers-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`)
  }

  const handleBulkDelete = () => {
    if (!selectedVoucherIds.length) {
      toast.error("Select at least one voucher to delete.")
      return
    }

    if (!window.confirm(`Delete ${selectedVoucherIds.length} selected vouchers? This cannot be undone.`)) {
      return
    }

    startBulkTransition(async () => {
      const result = await bulkDeleteVouchersAction({
        clientId,
        voucherIds: selectedVoucherIds,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`${selectedVoucherIds.length} vouchers deleted.`)
      setSelectedVoucherIds([])
      await mutate()
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Vouchers</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            Browse, filter, and manage voucher activity for {clientName}.
          </p>
        </div>
        <Button asChild className="rounded-xl">
          <Link href={`/clients/${clientId}/vouchers/new?fiscalYear=${fiscalYearId}`}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Voucher
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { label: "Total Receipts", value: currency(stats.totalReceipts) },
          { label: "Total Payments", value: currency(stats.totalPayments) },
          { label: "Net Balance", value: currency(stats.netBalance) },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-500">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-6">
            <Input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
              className="h-11 rounded-xl border-slate-200"
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
              className="h-11 rounded-xl border-slate-200"
            />
            <Select
              value={filters.voucherType}
              onValueChange={(value) => updateFilter("voucherType", value as VoucherFilters["voucherType"])}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200">
                <SelectValue placeholder="Voucher type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="journal">Journal</SelectItem>
                <SelectItem value="contra">Contra</SelectItem>
                <SelectItem value="bf">B/F</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.paymentModeId ?? "all"}
              onValueChange={(value) => updateFilter("paymentModeId", value === "all" ? undefined : value)}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200">
                <SelectValue placeholder="Payment mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Modes</SelectItem>
                {paymentModes.map((mode) => (
                  <SelectItem key={mode.id} value={mode.id}>
                    {mode.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <Input
                list={`voucher-account-heads-${clientId}`}
                value={accountHeadSearch}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setAccountHeadSearch(nextValue)
                  const matchedAccount = accountOptions.find(
                    (account) => account.label === nextValue || account.name === nextValue
                  )

                  updateFilter("accountHeadId", matchedAccount?.id)

                  if (!nextValue) {
                    updateFilter("accountHeadId", undefined)
                  }
                }}
                className="h-11 rounded-xl border-slate-200"
                placeholder="Search account head"
              />
              <datalist id={`voucher-account-heads-${clientId}`}>
                {accountOptions.map((account) => (
                  <option key={account.id} value={account.label} />
                ))}
              </datalist>
            </div>
            <Select
              value={filters.month ?? "all"}
              onValueChange={(value) => updateFilter("month", value === "all" ? undefined : value)}
            >
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
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_220px_160px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search ?? ""}
                onChange={(event) => updateFilter("search", event.target.value)}
                className="h-11 rounded-xl border-slate-200 pl-10"
                placeholder="Search in voucher description"
              />
            </div>
            <Select
              value={filters.sortBy}
              onValueChange={(value) => updateFilter("sortBy", value as VoucherSortBy)}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="voucherNo">Voucher No</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.sortOrder}
              onValueChange={(value) => updateFilter("sortOrder", value as VoucherFilters["sortOrder"])}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-xl text-slate-950">Voucher Register</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
              {totalItems} vouchers
            </Badge>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-slate-200"
              disabled={!selectedCount || isBulkPending}
              onClick={handleExportSelected}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Selected
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-slate-200 text-destructive hover:text-destructive"
              disabled={!selectedCount || isBulkPending}
              onClick={handleBulkDelete}
            >
              {isBulkPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Bulk Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <ErrorFallback error={error} onRetry={() => void mutate()} /> : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={(event) =>
                        setSelectedVoucherIds(event.target.checked ? items.map((item) => item.id) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>Voucher No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Account Head</TableHead>
                  <TableHead className="text-right">Dr</TableHead>
                  <TableHead className="text-right">Cr</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="p-0">
                      <LoadingTable
                        columns={[
                          "Select",
                          "Voucher No",
                          "Date",
                          "Type",
                          "Payment Mode",
                          "Account Head",
                          "Dr",
                          "Cr",
                          "Description",
                          "Actions",
                        ]}
                        rows={8}
                      />
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/clients/${clientId}/vouchers/${item.id}`)}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedVoucherIds.includes(item.id)}
                          onChange={(event) => {
                            setSelectedVoucherIds((current) =>
                              event.target.checked
                                ? [...current, item.id]
                                : current.filter((voucherId) => voucherId !== item.id)
                            )
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{item.voucherNo}</TableCell>
                      <TableCell>{item.voucherDate}</TableCell>
                      <TableCell>
                        <Badge className={`rounded-full ${getVoucherTypeBadgeClass(item.voucherType)}`}>
                          {getVoucherTypeLabel(item.voucherType)}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.paymentModeName ?? "-"}</TableCell>
                      <TableCell>{item.accountHeadLabel}</TableCell>
                      <TableCell className="text-right">{item.debit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{item.credit.toFixed(2)}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{item.description || "-"}</TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="ghost" className="h-8 px-2">
                            <Link href={`/clients/${clientId}/vouchers/${item.id}`}>View</Link>
                          </Button>
                          <Button asChild variant="ghost" className="h-8 px-2">
                            <Link href={`/clients/${clientId}/vouchers/${item.id}/edit`}>Edit</Link>
                          </Button>
                          <Button asChild variant="ghost" className="h-8 px-2">
                            <Link
                              href={`/clients/${clientId}/vouchers/${item.id}?print=1`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Printer className="mr-1 h-3.5 w-3.5" />
                              Print
                            </Link>
                          </Button>
                          <DeleteVoucherButton
                            clientId={clientId}
                            voucherId={item.id}
                            voucherNo={item.voucherNo}
                            className="h-8 px-2"
                            onDeleted={() => {
                              setSelectedVoucherIds((current) =>
                                current.filter((voucherId) => voucherId !== item.id)
                              )
                              void mutate()
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="py-16">
                      <EmptyState
                        icon={FileSearch}
                        title="No vouchers found"
                        description="Try adjusting the filters or create the first voucher for this client."
                        actionLabel="Create Voucher"
                        actionHref={`/clients/${clientId}/vouchers/new?fiscalYear=${fiscalYearId}`}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200"
                disabled={page <= 1}
                onClick={() => updateFilter("page", page - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200"
                disabled={page >= totalPages}
                onClick={() => updateFilter("page", page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
