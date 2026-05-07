"use client"

import { Trash2 } from "lucide-react"
import type { UseFormRegister, UseFormSetValue } from "react-hook-form"

import type { ChartFlatAccount } from "@/lib/hooks/useChartOfAccounts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type VoucherFormValues = {
  lines: Array<{
    accountsGroup: "expense" | "income" | "asset" | "liability" | ""
    accountHeadId: string
    debitAmount: number
    creditAmount: number
    description?: string
  }>
}

export function VoucherLineRow({
  index,
  line,
  accounts,
  onRemove,
  onAddLine,
  register,
  setValue,
  disabled = false,
}: {
  index: number
  line: VoucherFormValues["lines"][number]
  accounts: ChartFlatAccount[]
  onRemove: () => void
  onAddLine: () => void
  register: UseFormRegister<any>
  setValue: UseFormSetValue<any>
  disabled?: boolean
}) {
  const filteredAccounts = accounts.filter((account) => account.groupType === line.accountsGroup)
  const groupedAccounts = filteredAccounts.reduce<Record<string, ChartFlatAccount[]>>((acc, account) => {
    if (!acc[account.subGroupName]) {
      acc[account.subGroupName] = []
    }

    acc[account.subGroupName].push(account)
    return acc
  }, {})

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[0.75fr_1.3fr_0.7fr_0.7fr_1fr_auto]">
      <select
        disabled={disabled}
        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none"
        aria-label="Accounts Group"
        title="Accounts Group"
        value={line.accountsGroup}
        onChange={(event) => {
          setValue(
            `lines.${index}.accountsGroup`,
            event.target.value as VoucherFormValues["lines"][number]["accountsGroup"]
          )
          setValue(`lines.${index}.accountHeadId`, "")
        }}
      >
        <option value="" disabled>
          Accounts Group
        </option>
        <option value="expense">Expenses</option>
        <option value="income">Income</option>
        <option value="asset">Assets</option>
        <option value="liability">Liabilities</option>
      </select>

      <select
        disabled={disabled}
        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none"
        aria-label="Accounts Head"
        title="Accounts Head"
        value={line.accountHeadId}
        onChange={(event) => setValue(`lines.${index}.accountHeadId`, event.target.value)}
      >
        <option value="">Accounts Head</option>
        {Object.entries(groupedAccounts).map(([subGroupName, heads]) => (
          <optgroup key={subGroupName} label={subGroupName}>
            {heads.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <Input
        type="number"
        step="0.01"
        placeholder="Debit"
        value={line.debitAmount === 0 ? "" : line.debitAmount}
        onChange={(event) =>
          setValue(
            `lines.${index}.debitAmount`,
            event.target.value === "" ? 0 : Number(event.target.value)
          )
        }
        aria-label="Debit"
        disabled={disabled}
        onFocus={(event) => {
          if (event.target.value === "0") {
            event.target.select()
          }
        }}
      />

      <Input
        type="number"
        step="0.01"
        placeholder="Credit"
        value={line.creditAmount === 0 ? "" : line.creditAmount}
        onChange={(event) =>
          setValue(
            `lines.${index}.creditAmount`,
            event.target.value === "" ? 0 : Number(event.target.value)
          )
        }
        aria-label="Credit"
        disabled={disabled}
        onFocus={(event) => {
          if (event.target.value === "0") {
            event.target.select()
          }
        }}
      />

      <Input
        placeholder="Optional line note"
        disabled={disabled}
        {...register(`lines.${index}.description`)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onAddLine()
          }
        }}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 rounded-xl text-destructive hover:text-destructive"
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
