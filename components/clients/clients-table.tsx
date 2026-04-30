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
import { Eye, PencilLine, Search, UserPlus, UserX2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"

export type ClientTableRow = {
  id: string
  name: string
  type: string
  tin: string | null
  bin: string | null
  fiscalYearLabel: string
  isActive: boolean
}

function formatType(value: string) {
  return value.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export function ClientsTable({ data }: { data: ClientTableRow[] }) {
  const [globalFilter, setGlobalFilter] = useState("")
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const router = useRouter()

  const handleDeactivate = useCallback(async (clientId: string) => {
    setDeactivatingId(clientId)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      toast.error("Your session has expired. Please sign in again.")
      setDeactivatingId(null)
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${clientId}/deactivate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const result = await response.json().catch(() => ({ error: "Unable to deactivate client." }))
    setDeactivatingId(null)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to deactivate client.")
      return
    }

    toast.success("Client deactivated.")
    router.refresh()
  }, [router])

  const columns = useMemo<ColumnDef<ClientTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-900">{row.original.name}</p>
            <p className="text-xs text-slate-500">{row.original.fiscalYearLabel}</p>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
            {formatType(row.original.type)}
          </Badge>
        ),
      },
      {
        accessorKey: "tin",
        header: "TIN",
        cell: ({ row }) => row.original.tin || "—",
      },
      {
        accessorKey: "bin",
        header: "BIN",
        cell: ({ row }) => row.original.bin || "—",
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
              <Link href={`/clients/${row.original.id}`}>
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                View
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-slate-600">
              <Link href={`/clients/${row.original.id}/settings`}>
                <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:text-destructive"
              disabled={!row.original.isActive || deactivatingId === row.original.id}
              onClick={() => handleDeactivate(row.original.id)}
            >
              <UserX2 className="mr-1.5 h-3.5 w-3.5" />
              Deactivate
            </Button>
          </div>
        ),
      },
    ],
    [deactivatingId, handleDeactivate]
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
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="h-11 rounded-xl border-slate-200 pl-10"
              placeholder="Search clients by name, type, TIN, or BIN"
            />
          </div>
          <Button asChild className="h-11 rounded-xl px-5">
            <Link href="/clients/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Add New Client
            </Link>
          </Button>
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-sm">
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
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="h-11 rounded-xl border-slate-200 pl-10"
            placeholder="Search clients by name, type, TIN, or BIN"
          />
        </div>
        <Button asChild className="h-11 rounded-xl px-5">
          <Link href="/clients/new">
            <UserPlus className="mr-2 h-4 w-4" />
            Add New Client
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">Manage client workspaces across your organization.</p>
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
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
