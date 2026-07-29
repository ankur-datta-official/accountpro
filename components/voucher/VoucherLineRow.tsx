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
import {
  BANGLADESH_BANK_OPTIONS,
  BANGLADESH_MOBILE_BANKING_OPTIONS,
  PAYMENT_MODE_GROUPS,
  normalizePaymentModeName,
} from "@/lib/accounting/payment-modes"
import type { ChartFlatAccount } from "@/lib/hooks/useChartOfAccounts"
import type { PaymentModeType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Autocomplete } from "@/components/ui/autocomplete"
import { Input } from "@/components/ui/input"

export type VoucherLineFormValues = {
  lines: Array<{
    accountsGroup: "expense" | "income" | "asset" | "liability" | ""
    accountHeadId: string
    paymentModeId?: string
    paymentModeName?: string
    paymentModeType?: PaymentModeType
    debitAmount: number
    creditAmount: number
    description?: string
  }>
}

type LinePath =
  | `lines.${number}.accountsGroup`
  | `lines.${number}.accountHeadId`
  | `lines.${number}.paymentModeId`
  | `lines.${number}.paymentModeName`
  | `lines.${number}.paymentModeType`
  | `lines.${number}.debitAmount`
  | `lines.${number}.creditAmount`
  | `lines.${number}.description`

type RegisterLineDescription = (name: `lines.${number}.description`) => UseFormRegisterReturn

type SetLineValue = (name: LinePath, value: string | number) => void

type PaymentModeOption = {
  id: string
  name: string
  type: string | null
  accountHeadId?: string | null
}

export function VoucherLineRow({
  index,
  line,
  accounts,
  voucherType,
  paymentModes,
  paymentModeFundingHint,
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
  paymentModes: PaymentModeOption[]
  paymentModeFundingHint?: {
    tone: "neutral" | "positive" | "warning"
    text: string
  }
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
  const showPaymentMode = voucherType === "payment" || voucherType === "received"

  let filteredAccounts: ChartFlatAccount[]
  if (isContraVoucher) {
    filteredAccounts = accounts.filter(
      (account) =>
        account.semiSubGroupName === "Cash & Bank Balance" &&
        account.groupType === "asset"
    )
  } else {
    filteredAccounts = accounts.filter((account) => account.groupType === line.accountsGroup)
  }

  const accountOptions = filteredAccounts.map((account) => ({
    id: account.id,
    value: account.id,
    label: account.label,
    displayLabel: account.name,
    path: account.path,
  }))
  const debitLocked = isDebitLockedForAccountsGroup(line.accountsGroup)
  const creditLocked = isCreditLockedForAccountsGroup(line.accountsGroup)
  const selectedExistingPaymentMode = line.paymentModeId
    ? paymentModes.find((mode) => mode.id === line.paymentModeId) ?? null
    : null
  const selectedPaymentModeGroup = (selectedExistingPaymentMode?.type ??
    line.paymentModeType ??
    "") as PaymentModeType | ""
  const bankOptions = Array.from(
    new Set([
      ...BANGLADESH_BANK_OPTIONS,
      ...paymentModes.filter((mode) => mode.type === "bank").map((mode) => mode.name),
    ])
  ).sort((left, right) => left.localeCompare(right))
  const mobileBankingOptions = Array.from(
    new Set([
      ...BANGLADESH_MOBILE_BANKING_OPTIONS,
      ...paymentModes.filter((mode) => mode.type === "mobile_banking").map((mode) => mode.name),
    ])
  ).sort((left, right) => left.localeCompare(right))
  const defaultCashMode =
    paymentModes.find((mode) => mode.type === "cash" && normalizePaymentModeName(mode.name).toLowerCase() === "cash") ??
    paymentModes.find((mode) => mode.type === "cash") ??
    null
  const namedPaymentModeValue =
    selectedExistingPaymentMode?.name || (selectedPaymentModeGroup === "other" ? "" : line.paymentModeName || "")

  const handlePaymentModeGroupChange = (nextGroup: PaymentModeType | "") => {
    if (!nextGroup) {
      setValue(`lines.${index}.paymentModeId`, "")
      setValue(`lines.${index}.paymentModeName`, "")
      setValue(`lines.${index}.paymentModeType`, "")
      return
    }

    if (nextGroup === "cash") {
      setValue(`lines.${index}.paymentModeId`, defaultCashMode?.id ?? "")
      setValue(`lines.${index}.paymentModeName`, defaultCashMode?.name ?? "Cash")
      setValue(`lines.${index}.paymentModeType`, "cash")
      return
    }

    setValue(`lines.${index}.paymentModeId`, "")
    setValue(`lines.${index}.paymentModeName`, "")
    setValue(`lines.${index}.paymentModeType`, nextGroup)
  }

  const handleNamedPaymentModeChange = (name: string, type: Extract<PaymentModeType, "bank" | "mobile_banking">) => {
    const existingMode = paymentModes.find(
      (mode) => mode.type === type && normalizePaymentModeName(mode.name).toLowerCase() === name.toLowerCase()
    )

    setValue(`lines.${index}.paymentModeId`, existingMode?.id ?? "")
    setValue(`lines.${index}.paymentModeName`, name)
    setValue(`lines.${index}.paymentModeType`, type)
  }

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

      <div
        className={
          showPaymentMode
            ? "grid gap-4 md:grid-cols-2 xl:grid-cols-[0.9fr_1.05fr_1.3fr_0.62fr_0.62fr_1fr] xl:items-start"
            : "grid gap-4 md:grid-cols-2 xl:grid-cols-[0.9fr_1.1fr_0.62fr_0.62fr_1fr] xl:items-start"
        }
      >
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
            menuClassName="min-w-[min(34rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
            optionVariant="hierarchy"
            options={accountOptions}
            value={line.accountHeadId}
            onChange={(accountId) => setValue(`lines.${index}.accountHeadId`, accountId)}
          />
        </label>

        {showPaymentMode ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Payment Mode</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                disabled={disabled}
                className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
                value={selectedPaymentModeGroup}
                onChange={(event) => handlePaymentModeGroupChange(event.target.value as PaymentModeType | "")}
              >
                <option value="">No payment mode</option>
                {PAYMENT_MODE_GROUPS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {selectedPaymentModeGroup === "cash" ? (
                <Input value={line.paymentModeName || defaultCashMode?.name || "Cash"} readOnly />
              ) : null}

              {selectedPaymentModeGroup === "mobile_banking" ? (
                <select
                  disabled={disabled}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
                  value={namedPaymentModeValue}
                  onChange={(event) => handleNamedPaymentModeChange(event.target.value, "mobile_banking")}
                >
                  <option value="">Select mobile banking option</option>
                  {mobileBankingOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : null}

              {selectedPaymentModeGroup === "bank" ? (
                <select
                  disabled={disabled}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
                  value={namedPaymentModeValue}
                  onChange={(event) => handleNamedPaymentModeChange(event.target.value, "bank")}
                >
                  <option value="">Select bank</option>
                  {bankOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : null}

              {selectedPaymentModeGroup === "other" ? (
                <Input
                  placeholder="Enter other payment mode"
                  value={line.paymentModeName ?? ""}
                  onChange={(event) => {
                    setValue(`lines.${index}.paymentModeId`, "")
                    setValue(`lines.${index}.paymentModeName`, event.target.value)
                    setValue(`lines.${index}.paymentModeType`, "other")
                  }}
                />
              ) : null}

              {!selectedPaymentModeGroup ? (
                <Input value="" readOnly disabled placeholder="Select payment mode details" />
              ) : null}
            </div>
          </div>
        ) : null}

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

      {showPaymentMode && paymentModeFundingHint ? (
        <div
          className={
            paymentModeFundingHint.tone === "warning"
              ? "mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              : paymentModeFundingHint.tone === "positive"
                ? "mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                : "mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
          }
        >
          {paymentModeFundingHint.text}
        </div>
      ) : null}
    </div>
  )
}
