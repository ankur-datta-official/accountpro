import type { AccountGroupType, AccountHeadBalanceType, VoucherType } from "@/lib/types"

export type LedgerEntryInput = {
  id: string
  date: string
  voucherNo: number
  voucherType: VoucherType
  paymentMode: string | null
  description: string | null
  debit: number
  credit: number
}

export type LedgerEntryWithBalance = LedgerEntryInput & {
  runningBalance: number
}

function isDebitFirstAccount(groupType: AccountGroupType) {
  return groupType === "asset" || groupType === "expense"
}

export function openingBalanceToSignedAmount({
  openingBalance,
  balanceType,
  groupType,
}: {
  openingBalance: number
  balanceType: AccountHeadBalanceType
  groupType: AccountGroupType
}) {
  if (openingBalance === 0) {
    return 0
  }

  const debitFirst = isDebitFirstAccount(groupType)

  if (debitFirst) {
    return balanceType === "debit" ? openingBalance : -openingBalance
  }

  return balanceType === "credit" ? openingBalance : -openingBalance
}

export function signedBalanceToLabel(balance: number, groupType: AccountGroupType) {
  if (balance === 0) {
    return "0.00 Dr"
  }

  const debitFirst = isDebitFirstAccount(groupType)
  const isNaturalSide = balance > 0
  const suffix = debitFirst ? (isNaturalSide ? "Dr" : "Cr") : isNaturalSide ? "Cr" : "Dr"

  return `${Math.abs(balance).toFixed(2)} ${suffix}`
}

export function calculateLedgerBalance(
  entries: LedgerEntryInput[],
  openingBalance: number,
  balanceType: AccountHeadBalanceType,
  groupType: AccountGroupType
): { entries: LedgerEntryWithBalance[]; closingBalance: number } {
  let runningBalance = openingBalanceToSignedAmount({
    openingBalance,
    balanceType,
    groupType,
  })

  const debitFirst = isDebitFirstAccount(groupType)
  const rows: LedgerEntryWithBalance[] = []

  for (const entry of entries) {
    const debit = Number(entry.debit || 0)
    const credit = Number(entry.credit || 0)
    runningBalance += debitFirst ? debit - credit : credit - debit

    rows.push({
      ...entry,
      debit,
      credit,
      runningBalance,
    })
  }

  return {
    entries: rows,
    closingBalance: runningBalance,
  }
}
