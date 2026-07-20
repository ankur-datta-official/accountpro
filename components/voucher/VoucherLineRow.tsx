"use client"

import type { WheelEvent } from "react"
import type { UseFormRegisterReturn } from "react-hook-form"

import { PlusCircle, Trash2 } from "lucide-react"
import {
  isCreditLockedForAccountsGroup,
  isDebitLockedForAccountsGroup,
  normalizeVoucherLineAmounts,
  type VoucherAccountsGroup,
} from "@/lib/accounting/voucher-entry-rules"
import type { ChartFlatAccount } from "@/lib/hooks/useChartOfAccounts"
import { Button } from "@/components/ui/button"
import { Autocomplete } from "@/components/ui/autocomplete"
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
  voucherType,
  onRemove,
  onAddLine,
  register,
  setValue,
  disabled = false,
}: {
  index: number
  line?: VoucherLineFormValues["lines"][number]
  accounts: ChartFlatAccount[]
  voucherType: string
  onRemove: () => void
  onAddLine: () => void
  register: RegisterLineDescription
  setValue: SetLineValue
  disabled?: boolean
}) {
  if (!line) {
    return null
  }

  const preventWheelValueChange = (event: WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur()
  }
  
  const isContraVoucher = voucherType === "contra"
  
  let filteredAccounts: ChartFlatAccount[]
  if (isContraVoucher) {
    // For contra vouchers, only show Cash & Bank Balance accounts
    filteredAccounts = accounts.filter(
      (account) => 
        account.semiSubGroupName === "Cash & Bank Balance" && 
        account.groupType === "asset"
    )
  } else {
    // For other voucher types, normal filtering
    filteredAccounts = accounts.filter((account) => account.groupType === line.accountsGroup)
  }
  
  const accountOptions = filteredAccounts.map((account) => ({
    id: account.id,
    value: account.id,
    label: account.label,
    displayLabel: account.name,
  }))
  const debitLocked = isDebitLockedForAccountsGroup(line.accountsGroup)
  const creditLocked = isCreditLockedForAccountsGroup(line.accountsGroup)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Line {index + 1}</p>
          {isContraVoucher ? (
            <p className="text-xs text-slate-500">Contra voucher only allows cash and bank balance accounts.</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-slate-200 px-3"
            disabled={disabled}
            onClick={onAddLine}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add next
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-destructive hover:bg-red-50 hover:text-destructive"
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[0.95fr_0.95fr_0.7fr_0.7fr_1.15fr]">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Accounts Group</span>
          <select
            disabled={disabled}
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
            aria-label="Accounts Group"
            title="Accounts Group"
            value={line.accountsGroup}
            onChange={(event) => {
              const accountsGroup = event.target.value as VoucherAccountsGroup
              const normalizedLine = normalizeVoucherLineAmounts({
                ...line,
                accountsGroup,
              })

              setValue(`lines.${index}.accountsGroup`, accountsGroup)
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
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Accounts Head</span>
          <Autocomplete
            disabled={disabled}
            className="w-full"
            placeholder="Accounts Head"
            options={accountOptions}
            value={line.accountHeadId}
            onChange={(accountId) => setValue(`lines.${index}.accountHeadId`, accountId)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Debit</span>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={line.debitAmount === 0 ? "" : line.debitAmount}
            onChange={(event) =>
              setValue(`lines.${index}.debitAmount`, event.target.value === "" ? 0 : Number(event.target.value))
            }
            aria-label="Debit"
            disabled={disabled || debitLocked}
            onFocus={(event) => {
              if (event.target.value === "0") {
                event.target.select()
              }
            }}
            onWheel={preventWheelValueChange}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Credit</span>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={line.creditAmount === 0 ? "" : line.creditAmount}
            onChange={(event) =>
              setValue(`lines.${index}.creditAmount`, event.target.value === "" ? 0 : Number(event.target.value))
            }
            aria-label="Credit"
            disabled={disabled || creditLocked}
            onFocus={(event) => {
              if (event.target.value === "0") {
                event.target.select()
              }
            }}
            onWheel={preventWheelValueChange}
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-1">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Line Note</span>
          <Input
            placeholder="Add context for this line if needed"
            disabled={disabled}
            {...register(`lines.${index}.description`)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                onAddLine()
              }
            }}
          />
        </label>
      </div>
    </div>
  )
}
