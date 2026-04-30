"use client"

import { useMemo } from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"

import type { ChartFlatAccount } from "@/lib/hooks/useChartOfAccounts"
import type { AccountGroup, AccountSemiSubGroup, AccountSubGroup } from "@/lib/types"
import { AddAccountHeadDialog } from "@/components/accounts/AddAccountHeadDialog"
import { DeactivateAccountHeadButton } from "@/components/accounts/account-head-actions"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function AccountTable({
  clientId,
  data,
  groups,
  semiSubGroups,
  subGroups,
}: {
  clientId: string
  data: ChartFlatAccount[]
  groups: AccountGroup[]
  semiSubGroups: AccountSemiSubGroup[]
  subGroups: AccountSubGroup[]
}) {
  const columns = useMemo<ColumnDef<ChartFlatAccount>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Account Head",
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <p className="font-medium text-slate-900">{row.original.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <AddAccountHeadDialog
                clientId={clientId}
                groups={groups}
                semiSubGroups={semiSubGroups}
                subGroups={subGroups}
                head={{
                  id: row.original.id,
                  client_id: clientId,
                  sub_group_id: row.original.subGroupId,
                  name: row.original.name,
                  opening_balance: row.original.openingBalance,
                  balance_type: row.original.balanceType,
                  is_active: row.original.isActive,
                  sort_order: 0,
                  created_at: null,
                }}
              />
              <DeactivateAccountHeadButton
                clientId={clientId}
                accountHeadId={row.original.id}
                disabled={!row.original.isActive}
              />
            </div>
          </div>
        ),
      },
      {
        accessorKey: "groupName",
        header: "Group",
      },
      {
        accessorKey: "subGroupName",
        header: "Sub-Group",
      },
      {
        accessorKey: "openingBalance",
        header: "Opening Balance",
        cell: ({ row }) => Number(row.original.openingBalance).toFixed(2),
      },
      {
        accessorKey: "balanceType",
        header: "Balance Type",
        cell: ({ row }) => row.original.balanceType.charAt(0).toUpperCase() + row.original.balanceType.slice(1),
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
    ],
    [clientId, groups, semiSubGroups, subGroups]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
    </div>
  )
}
