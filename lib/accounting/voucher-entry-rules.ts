export type VoucherAccountsGroup = "expense" | "income" | "asset" | "liability"

export type VoucherLineRuleInput = {
  accountsGroup: VoucherAccountsGroup
  debitAmount: number
  creditAmount: number
}

export function isDebitLockedForAccountsGroup(accountsGroup: VoucherAccountsGroup | "") {
  return accountsGroup === "income"
}

export function isCreditLockedForAccountsGroup(accountsGroup: VoucherAccountsGroup | "") {
  return accountsGroup === "expense"
}

export function normalizeVoucherLineAmounts<T extends VoucherLineRuleInput>(line: T): T {
  if (isDebitLockedForAccountsGroup(line.accountsGroup)) {
    return {
      ...line,
      debitAmount: 0,
    }
  }

  if (isCreditLockedForAccountsGroup(line.accountsGroup)) {
    return {
      ...line,
      creditAmount: 0,
    }
  }

  return line
}

export function getVoucherLineAmountRuleError(line: VoucherLineRuleInput) {
  if (line.accountsGroup === "expense" && Number(line.creditAmount || 0) > 0) {
    return "Expense lines cannot have a credit amount."
  }

  if (line.accountsGroup === "income" && Number(line.debitAmount || 0) > 0) {
    return "Income lines cannot have a debit amount."
  }

  return null
}
