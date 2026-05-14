"use client"

import type { UseFormRegisterReturn } from "react-hook-form"

import { Trash2 } from "lucide-react"
import {
  isCreditLockedForAccountsGroup,
  isDebitLockedForAccountsGroup,
  normalizeVoucherLineAmounts,
  type VoucherAccountsGroup,
} from "@/lib/accounting/voucher-entry-rules"
import type { ChartFlatAccount } from "@/lib/hooks/useChartOfAccounts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type VoucherLineFormValues = {
  lines: Array<{
    accountsGroup: "expense" | "income" | "asset" | "liability" | ""
    accountHeadId: string
    debitAmount: number
    creditAmount: number
    description?: string
  }>
}

type LinePath =
  | `lines.${number}.accountsGroup`
  | `lines.${number}.accountHeadId`
  | `lines.${number}.debitAmount`
  | `lines.${number}.creditAmount`
  | `lines.${number}.description`

type RegisterLineDescription = (name: `lines.${number}.description`) => UseFormRegisterReturn

type SetLineValue = (name: LinePath, value: string | number) => void

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
  line: VoucherLineFormValues["lines"][number]
  accounts: ChartFlatAccount[]
  onRemove: () => void
  onAddLine: () => void
  register: RegisterLineDescription
  setValue: SetLineValue
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
  const debitLocked = isDebitLockedForAccountsGroup(line.accountsGroup)
  const creditLocked = isCreditLockedForAccountsGroup(line.accountsGroup)

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[0.75fr_1.3fr_0.7fr_0.7fr_1fr_auto]">
      <select
        disabled={disabled}
        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none"
        aria-label="Accounts Group"
        title="Accounts Group"
        value={line.accountsGroup}
        onChange={(event) => {
          const accountsGroup = event.target.value as VoucherAccountsGroup
          const normalizedLine = normalizeVoucherLineAmounts({
            ...line,
            accountsGroup,
          })

          setValue(
            `lines.${index}.accountsGroup`,
            accountsGroup
          )
          setValue(`lines.${index}.accountHeadId`, "")
          setValue(`lines.${index}.debitAmount`, normalizedLine.debitAmount)
          setValue(`lines.${index}.creditAmount`, normalizedLine.creditAmount)
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
        disabled={disabled || debitLocked}
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
        disabled={disabled || creditLocked}
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
