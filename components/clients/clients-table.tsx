"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Building2, Copy, Eye, Loader2, PencilLine, Search, UserPlus, UserX2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FilterPanel, PageHeader } from "@/components/ui/page-shell"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getClientTypeLabel } from "@/lib/accounting/clients"
import { buildClientPath } from "@/lib/routing/clients"
import { createClient } from "@/lib/supabase/client"

export type ClientTableRow = {
  id: string
  name: string
  type: string
  tin: string | null
  bin: string | null
  fiscalYearLabel: string
  isActive: boolean
  routeSegment?: string | null
}

export function ClientsTable({ data }: { data: ClientTableRow[] }) {
  const [globalFilter, setGlobalFilter] = useState("")
  const [updatingClientId, setUpdatingClientId] = useState<string | null>(null)
  const [replicationTarget, setReplicationTarget] = useState<ClientTableRow | null>(null)
  const [replicationName, setReplicationName] = useState("")
  const [isReplicating, setIsReplicating] = useState(false)
  const router = useRouter()

  const handleClientStatusChange = useCallback(async (clientId: string, isActive: boolean) => {
    setUpdatingClientId(clientId)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      toast.error("Your session has expired. Please sign in again.")
      setUpdatingClientId(null)
      router.replace("/login")
      return
    }

    const action = isActive ? "deactivate" : "activate"
    const response = await fetch(`/api/clients/${clientId}/${action}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const fallbackError = `Unable to ${action} client.`
    const result = await response.json().catch(() => ({ error: fallbackError }))
    setUpdatingClientId(null)

    if (!response.ok) {
      toast.error(result.error ?? fallbackError)
      return
    }

    toast.success(isActive ? "Client deactivated." : "Client activated.")
    router.refresh()
  }, [router])

  const openReplicationDialog = useCallback((client: ClientTableRow) => {
    setReplicationTarget(client)
    setReplicationName(`${client.name} Copy`)
  }, [])

  const handleReplicationDialogChange = useCallback((open: boolean) => {
    if (!open && !isReplicating) {
      setReplicationTarget(null)
      setReplicationName("")
    }
  }, [isReplicating])

  const handleReplicateClient = useCallback(async () => {
    if (!replicationTarget) return

    const name = replicationName.trim()
    if (name.length < 2) {
      toast.error("Copy name must be at least 2 characters.")
      return
    }

    setIsReplicating(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      toast.error("Your session has expired. Please sign in again.")
      setIsReplicating(false)
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${replicationTarget.id}/replicate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name }),
    })

    const result = await response.json().catch(() => ({ error: "Unable to replicate client." }))
    setIsReplicating(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to replicate client.")
      return
    }

    toast.success("Client replication completed successfully.")
    setReplicationTarget(null)
    setReplicationName("")
    router.replace(buildClientPath({ id: result.clientId, name }))
    router.refresh()
  }, [replicationName, replicationTarget, router])

  const columns = useMemo<ColumnDef<ClientTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link href={buildClientPath(row.original)} className="block">
            <p className="font-medium text-slate-900 hover:text-slate-600 transition-colors">{row.original.name}</p>
            <p className="text-xs text-slate-500">{row.original.fiscalYearLabel}</p>
          </Link>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
            {getClientTypeLabel(row.original.type)}
          </Badge>
        ),
      },
      {
        accessorKey: "tin",
        header: "TIN",
        cell: ({ row }) => row.original.tin || "-",
      },
      {
        accessorKey: "bin",
        header: "BIN",
        cell: ({ row }) => row.original.bin || "-",
      },
      {
        accessorKey: "fiscalYearLabel",
        header: "Fiscal Year",
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-500">
              Inactive
            </Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-slate-600">
              <Link href={buildClientPath(row.original)}>
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                View
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-slate-600">
              <Link href={buildClientPath(row.original, "/settings")}>
                <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-600"
              disabled={isReplicating}
              onClick={() => openReplicationDialog(row.original)}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Replicate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={
                row.original.isActive
                  ? "h-8 px-2 text-destructive hover:text-destructive"
                  : "h-8 px-2 text-emerald-700 hover:text-emerald-700"
              }
              disabled={updatingClientId === row.original.id}
              onClick={() => handleClientStatusChange(row.original.id, row.original.isActive)}
            >
              <UserX2 className="mr-1.5 h-3.5 w-3.5" />
              {row.original.isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ),
      },
    ],
    [handleClientStatusChange, isReplicating, openReplicationDialog, updatingClientId]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, value) => {
      const search = String(value).toLowerCase()
      return [
        row.original.name,
        row.original.type,
        row.original.tin,
        row.original.bin,
        row.original.fiscalYearLabel,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(search))
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (!data.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace setup"
          title="Clients"
          description="Create client workspaces for each business or account you manage. Each client keeps its own fiscal years, vouchers, ledger, and reports."
          icon={Building2}
          actions={
            <Button asChild className="h-11 rounded-lg px-5">
              <Link href="/clients/new">
                <UserPlus className="mr-2 h-4 w-4" />
                Add New Client
              </Link>
            </Button>
          }
        />

        <FilterPanel title="Find a client" description="Search will become useful after you add your first client.">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              onFocus={() => setGlobalFilter("")}
              className="h-11 rounded-xl border-slate-200 pl-10"
              placeholder="Search clients by name, type, TIN, or BIN"
            />
          </div>
        </FilterPanel>

        <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Users className="h-10 w-10" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
              No clients added yet
            </h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">
              Create your first client workspace to start managing fiscal years, vouchers,
              ledgers, and reporting for that account.
            </p>
            <Button asChild className="mt-8 h-11 rounded-xl px-5">
              <Link href="/clients/new">
                <UserPlus className="mr-2 h-4 w-4" />
                Add New Client
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
      <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Clients"
        description="Manage client workspaces across your organization. Open a client to post vouchers, review ledgers, and generate reports."
        icon={Building2}
        actions={
          <Button asChild className="h-11 rounded-lg px-5">
            <Link href="/clients/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Add New Client
            </Link>
          </Button>
        }
      />

      <FilterPanel title="Search clients" description="Find clients by name, type, TIN, BIN, or active fiscal year.">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="h-11 rounded-xl border-slate-200 pl-10"
            placeholder="Search clients by name, type, TIN, or BIN"
          />
        </div>
      </FilterPanel>

      <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">Client Register</h2>
          <p className="mt-1 text-sm text-slate-500">{table.getRowModel().rows.length} clients shown</p>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12 text-center text-sm text-slate-500">
                  No clients match this search. Clear the search text or add a new client.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={Boolean(replicationTarget)}
        onOpenChange={handleReplicationDialogChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replicate Client Workspace</DialogTitle>
            <DialogDescription>
              {replicationTarget
                ? `Create a complete copy of ${replicationTarget.name} with its latest fiscal years, chart of accounts, payment modes, and vouchers.`
                : "Create a complete copy of this client workspace."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="replication-name" className="text-sm font-medium text-slate-700">
              New client name
            </label>
            <Input
              id="replication-name"
              value={replicationName}
              onChange={(event) => setReplicationName(event.target.value)}
              placeholder="Enter a name for the replicated client"
              disabled={isReplicating}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-slate-200"
              disabled={isReplicating}
              onClick={() => handleReplicationDialogChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={isReplicating} onClick={handleReplicateClient}>
              {isReplicating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
              Create Replication Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
