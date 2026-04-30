import type { SupabaseClient } from "@supabase/supabase-js"

import { calculateTrialBalance, type TrialBalanceRow } from "@/lib/accounting/trial-balance"
import type { Database } from "@/lib/types"

type LineItem = {
  label: string
  amount: number
}

type StatementSection = {
  title: string
  lines: LineItem[]
  total: number
}

export type BalanceSheetPeriod = {
  fiscalYearId: string
  fiscalYearLabel: string
  endDate: string
  assets: {
    nonCurrentAssets: StatementSection
    currentAssets: StatementSection
    preliminaryExpenses: StatementSection
    totalAssets: number
  }
  liabilitiesEquity: {
    equity: StatementSection
    nonCurrentLiabilities: StatementSection
    currentLiabilities: StatementSection
    totalLiabilitiesEquity: number
  }
  netProfitLoss: number
  retainedEarnings: number
}

export type ComparativeBalanceSheet = {
  current: BalanceSheetPeriod
  previous: BalanceSheetPeriod | null
  isBalanced: boolean
  difference: number
}

function sum(lines: LineItem[]) {
  return lines.reduce((total, line) => total + line.amount, 0)
}

function signedByGroup(row: TrialBalanceRow) {
  if (row.groupType === "asset" || row.groupType === "expense") {
    return row.debit - row.credit
  }
  return row.credit - row.debit
}

function includesAny(source: string, terms: string[]) {
  const value = source.toLowerCase()
  return terms.some((term) => value.includes(term))
}

function toLineItem(row: TrialBalanceRow): LineItem {
  const amount = Math.abs(signedByGroup(row))
  return { label: row.accountHeadName, amount }
}

function buildStatementFromRows(
  rows: TrialBalanceRow[],
  fiscalYear: { id: string; label: string; end_date: string },
  retainedEarningsFromPrevious: number
): BalanceSheetPeriod {
  const assetRows = rows.filter((row) => row.groupType === "asset")
  const liabilityRows = rows.filter((row) => row.groupType === "liability")
  const incomeRows = rows.filter((row) => row.groupType === "income")
  const expenseRows = rows.filter((row) => row.groupType === "expense")

  const nonCurrentAssets = assetRows
    .filter((row) =>
      includesAny(row.accountHeadName, [
        "fixed",
        "property",
        "plant",
        "equipment",
        "vehicle",
        "machinery",
        "furniture",
        "depreciation",
      ])
    )
    .map(toLineItem)

  const preliminaryExpenses = assetRows
    .filter((row) => includesAny(row.accountHeadName, ["preliminary", "pre-operating"]))
    .map(toLineItem)

  const usedAssetIds = new Set([
    ...nonCurrentAssets.map((line) => line.label),
    ...preliminaryExpenses.map((line) => line.label),
  ])

  const currentAssets = assetRows
    .filter((row) => !usedAssetIds.has(row.accountHeadName))
    .map(toLineItem)

  const shareCapital = liabilityRows
    .filter((row) => includesAny(row.accountHeadName, ["share capital", "capital"]))
    .map(toLineItem)

  const nonCurrentLiabilities = liabilityRows
    .filter((row) => includesAny(row.accountHeadName, ["long term", "long-term", "term loan"]))
    .map(toLineItem)

  const usedLiabilityNames = new Set([
    ...shareCapital.map((line) => line.label),
    ...nonCurrentLiabilities.map((line) => line.label),
  ])

  const currentLiabilities = liabilityRows
    .filter((row) => !usedLiabilityNames.has(row.accountHeadName))
    .map(toLineItem)

  const totalIncome = incomeRows.reduce((acc, row) => acc + Math.max(0, signedByGroup(row)), 0)
  const totalExpense = expenseRows.reduce((acc, row) => acc + Math.max(0, signedByGroup(row)), 0)
  const netProfitLoss = totalIncome - totalExpense
  const retainedEarnings = retainedEarningsFromPrevious + netProfitLoss

  const equityLines: LineItem[] = [
    ...shareCapital,
    { label: "Retained Earnings", amount: retainedEarnings },
    {
      label: `Current Year Net ${netProfitLoss >= 0 ? "Profit" : "Loss"}`,
      amount: Math.abs(netProfitLoss),
    },
  ]

  const nonCurrentAssetSection: StatementSection = {
    title: "A. Non-Current Assets",
    lines: nonCurrentAssets,
    total: sum(nonCurrentAssets),
  }
  const currentAssetSection: StatementSection = {
    title: "B. Current Assets",
    lines: currentAssets,
    total: sum(currentAssets),
  }
  const preliminarySection: StatementSection = {
    title: "C. Preliminary Expenses",
    lines: preliminaryExpenses,
    total: sum(preliminaryExpenses),
  }

  const equitySection: StatementSection = {
    title: "A. Equity",
    lines: equityLines,
    total: sum(equityLines),
  }
  const nonCurrentLiabilitySection: StatementSection = {
    title: "B. Non-Current Liabilities",
    lines: nonCurrentLiabilities,
    total: sum(nonCurrentLiabilities),
  }
  const currentLiabilitySection: StatementSection = {
    title: "C. Current Liabilities",
    lines: currentLiabilities,
    total: sum(currentLiabilities),
  }

  const totalAssets =
    nonCurrentAssetSection.total + currentAssetSection.total + preliminarySection.total
  const totalLiabilitiesEquity =
    equitySection.total + nonCurrentLiabilitySection.total + currentLiabilitySection.total

  return {
    fiscalYearId: fiscalYear.id,
    fiscalYearLabel: fiscalYear.label,
    endDate: fiscalYear.end_date,
    assets: {
      nonCurrentAssets: nonCurrentAssetSection,
      currentAssets: currentAssetSection,
      preliminaryExpenses: preliminarySection,
      totalAssets,
    },
    liabilitiesEquity: {
      equity: equitySection,
      nonCurrentLiabilities: nonCurrentLiabilitySection,
      currentLiabilities: currentLiabilitySection,
      totalLiabilitiesEquity,
    },
    netProfitLoss,
    retainedEarnings,
  }
}

export async function calculateBalanceSheet(
  supabase: SupabaseClient<Database>,
  clientId: string,
  fiscalYearId: string
): Promise<ComparativeBalanceSheet> {
  const { data: fiscalYears } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", clientId)
    .order("start_date", { ascending: true })

  const currentIndex = (fiscalYears ?? []).findIndex((year) => year.id === fiscalYearId)
  const currentFiscalYear = currentIndex >= 0 ? (fiscalYears ?? [])[currentIndex] : null

  if (!currentFiscalYear) {
    throw new Error("Fiscal year not found.")
  }

  const previousFiscalYear = currentIndex > 0 ? (fiscalYears ?? [])[currentIndex - 1] : null

  const currentTrialBalance = await calculateTrialBalance(
    supabase,
    clientId,
    currentFiscalYear.id,
    currentFiscalYear.end_date,
    currentFiscalYear.start_date
  )

  let previousPeriod: BalanceSheetPeriod | null = null
  let retainedSeed = 0

  if (previousFiscalYear) {
    const previousTrialBalance = await calculateTrialBalance(
      supabase,
      clientId,
      previousFiscalYear.id,
      previousFiscalYear.end_date,
      previousFiscalYear.start_date
    )

    previousPeriod = buildStatementFromRows(previousTrialBalance.accounts, previousFiscalYear, 0)
    retainedSeed = previousPeriod.retainedEarnings
  }

  const currentPeriod = buildStatementFromRows(
    currentTrialBalance.accounts,
    currentFiscalYear,
    retainedSeed
  )

  const difference = Number(
    Math.abs(currentPeriod.assets.totalAssets - currentPeriod.liabilitiesEquity.totalLiabilitiesEquity).toFixed(2)
  )

  return {
    current: currentPeriod,
    previous: previousPeriod,
    isBalanced: difference === 0,
    difference,
  }
}
