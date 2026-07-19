"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import {
  Download,
  Eye,
  FileSearch,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Printer,
  RotateCcw,
  Search,
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import { toast } from "sonner"

import { bulkDeleteVouchersAction } from "@/lib/actions/vouchers"
import { getVoucherTypeBadgeClass, getVoucherTypeLabel } from "@/lib/accounting/vouchers"
import { useChartOfAccounts } from "@/lib/hooks/useChartOfAccounts"
import { useVouchers, type VoucherFilters, type VoucherSortBy } from "@/lib/hooks/useVouchers"
import { DeleteVoucherButton } from "@/components/voucher/delete-voucher-button"
import { VoucherShareActions } from "@/components/voucher/voucher-share-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { ErrorFallback } from "@/components/ui/ErrorBoundary"
import { Autocomplete } from "@/components/ui/autocomplete"
import { Input } from "@/components/ui/input"
import { LoadingTable } from "@/components/ui/LoadingTable"
import { ActionBar, FilterPanel, MetricCard, PageHeader } from "@/components/ui/page-shell"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

function amount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
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
  const isFiltered =
    filters.from !== defaultFrom ||
    filters.to !== defaultTo ||
    filters.voucherType !== "all" ||
    Boolean(filters.paymentModeId) ||
    Boolean(filters.accountHeadId) ||
    Boolean(filters.month) ||
    Boolean(filters.search) ||
    filters.sortBy !== "date" ||
    filters.sortOrder !== "desc"
  const activeFilterCount = [
    filters.from !== defaultFrom || filters.to !== defaultTo,
    filters.voucherType !== "all",
    Boolean(filters.paymentModeId),
    Boolean(filters.accountHeadId),
    Boolean(filters.month),
    Boolean(filters.search),
    filters.sortBy !== "date" || filters.sortOrder !== "desc",
  ].filter(Boolean).length
  const selectedTotals = useMemo(() => {
    const selectedItems = items.filter((item) => selectedVoucherIds.includes(item.id))

    return selectedItems.reduce(
      (totals, item) => ({
        debit: totals.debit + item.debit,
        credit: totals.credit + item.credit,
      }),
      { debit: 0, credit: 0 }
    )
  }, [items, selectedVoucherIds])

  const updateFilter = <Key extends keyof VoucherFilters>(key: Key, value: VoucherFilters[Key]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? (value as number) : 1,
    }))
  }

  const resetFilters = () => {
    setFilters({
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
    setSelectedVoucherIds([])
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
      try {
        const result = await bulkDeleteVouchersAction({
          clientId,
          voucherIds: selectedVoucherIds,
        })

        if (!result?.success) {
          toast.error(result?.error || "Failed to delete vouchers")
          return
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete vouchers")
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
      <PageHeader
        eyebrow="Daily entry"
        title="Vouchers"
        description={`Browse and manage voucher activity for ${clientName}.`}
        icon={PlusCircle}
        actions={
          <Button asChild className="h-10 rounded-lg px-4">
            <Link href={`/clients/${clientId}/vouchers/new?fiscalYear=${fiscalYearId}`}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Voucher
            </Link>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>{totalItems} vouchers</span>
          <span className="text-slate-300">•</span>
          <span>
            {format(new Date(filters.from), "dd MMM yyyy")} to {format(new Date(filters.to), "dd MMM yyyy")}
          </span>
        </div>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Receipts", value: currency(stats.totalReceipts) },
          { label: "Payments", value: currency(stats.totalPayments) },
          { label: "Net", value: currency(stats.netBalance) },
        ].map((stat) => (
          <MetricCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <FilterPanel
        title="Find vouchers"
        description="Filter the register by date, type, payment mode, account head, month, or description."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-slate-200"
              disabled={!isFiltered}
              onClick={resetFilters}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 xl:grid-cols-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From date</p>
            <Input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
              className="h-11 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">To date</p>
            <Input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
              className="h-11 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Voucher type</p>
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
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment mode</p>
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
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account head</p>
            <Autocomplete
              options={accountOptions.map((account) => ({
                id: account.id,
                value: account.id,
                label: account.label,
              }))}
              value={filters.accountHeadId}
              onChange={(newValue) => {
                updateFilter("accountHeadId", newValue || undefined)
              }}
              onInputChange={() => undefined}
              placeholder="Search account head"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Posting month</p>
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
        </div>

        <div className="grid gap-3 xl:grid-cols-[1fr_220px_160px]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description search</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search ?? ""}
                onChange={(event) => updateFilter("search", event.target.value)}
                className="h-11 rounded-xl border-slate-200 pl-10"
                placeholder="Search in voucher description"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sort by</p>
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
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order</p>
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
        </div>
      </FilterPanel>

      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl text-slate-950">Voucher Register</CardTitle>
            <p className="text-sm text-slate-500">Posted entries for the selected filter range.</p>
          </div>
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
          {selectedCount ? (
            <ActionBar>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {selectedCount} voucher{selectedCount === 1 ? "" : "s"} selected
                </p>
                <p className="text-xs text-slate-500">
                  Debit {currency(selectedTotals.debit)} and credit {currency(selectedTotals.credit)} in selection
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg border-slate-200"
                  disabled={isBulkPending}
                  onClick={handleExportSelected}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Selected
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg border-slate-200 text-destructive hover:text-destructive"
                  disabled={isBulkPending}
                  onClick={handleBulkDelete}
                >
                  {isBulkPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Bulk Delete
                </Button>
              </div>
            </ActionBar>
          ) : null}
          {error ? <ErrorFallback error={error} onRetry={() => void mutate()} /> : null}

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table className="table-fixed">
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-200 hover:bg-slate-50">
                  <TableHead className="w-10 px-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={allSelectedOnPage}
                      onChange={(event) =>
                        setSelectedVoucherIds(event.target.checked ? items.map((item) => item.id) : [])
                      }
                    />
                  </TableHead>
                  <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-500">Voucher</TableHead>
                  <TableHead className="w-20 text-xs font-semibold uppercase tracking-wide text-slate-500">Date</TableHead>
                  <TableHead className="w-24 text-xs font-semibold uppercase tracking-wide text-slate-500">Type</TableHead>
                  <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</TableHead>
                  <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wide text-slate-500">Account Head</TableHead>
                  <TableHead className="w-24 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Debit</TableHead>
                  <TableHead className="w-24 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Credit</TableHead>
                  <TableHead className="w-[20%] text-xs font-semibold uppercase tracking-wide text-slate-500">Description</TableHead>
                  <TableHead className="w-16 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</TableHead>
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
                      className="cursor-pointer border-slate-100 transition-colors hover:bg-slate-50/80"
                      onClick={() => router.push(`/clients/${clientId}/vouchers/${item.id}`)}
                    >
                      <TableCell className="px-4 py-4 align-middle" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
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
                      <TableCell className="py-4 align-middle">
                        <p className="font-semibold text-slate-950">#{item.voucherNo}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.monthLabel ?? "No month assigned"}</p>
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <p className="font-medium text-slate-900">{format(new Date(item.voucherDate), "dd MMM yyyy")}</p>
                        <p className="mt-1 text-xs text-slate-500">{format(new Date(item.voucherDate), "EEE")}</p>
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <Badge className={`rounded-full ${getVoucherTypeBadgeClass(item.voucherType)}`}>
                          {getVoucherTypeLabel(item.voucherType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {item.paymentModeName ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <p className="line-clamp-2 break-words font-medium text-slate-950">{item.accountHeadLabel}</p>
                      </TableCell>
                      <TableCell className="py-4 text-right align-middle font-semibold text-slate-950">
                        {amount(item.debit)}
                      </TableCell>
                      <TableCell className="py-4 text-right align-middle font-semibold text-slate-950">
                        {amount(item.credit)}
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <p className="line-clamp-2 break-words text-sm text-slate-600">{item.description || "-"}</p>
                      </TableCell>
                      <TableCell className="py-4 text-right align-middle" onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-slate-200">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open voucher actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <Link href={`/clients/${clientId}/vouchers/${item.id}`}>
                                <Eye className="h-4 w-4" />
                                View Voucher
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/clients/${clientId}/vouchers/${item.id}/edit`}>
                                <Pencil className="h-4 w-4" />
                                Edit Voucher
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/clients/${clientId}/vouchers/${item.id}?print=1`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Printer className="h-4 w-4" />
                                Print Voucher
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <VoucherShareActions clientId={clientId} voucherId={item.id} renderAsItems />
                            <DropdownMenuSeparator />
                            <div className="px-1">
                              <DeleteVoucherButton
                                clientId={clientId}
                                voucherId={item.id}
                                voucherNo={item.voucherNo}
                                className="h-8 w-full justify-start px-2 text-destructive hover:text-destructive"
                                onDeleted={() => {
                                  setSelectedVoucherIds((current) =>
                                    current.filter((voucherId) => voucherId !== item.id)
                                  )
                                  void mutate()
                                }}
                              />
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
