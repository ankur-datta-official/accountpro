import type { SupabaseClient } from "@supabase/supabase-js"

import { calculateTrialBalance } from "@/lib/accounting/trial-balance"
import type { Database } from "@/lib/types"

export type ProfitLossResult = {
  fiscalYearLabel: string
  endDate: string
  revenueItems: Array<{ name: string; amount: number }>
  otherIncomeItems: Array<{ name: string; amount: number }>
  adminExpenseItems: Array<{ name: string; amount: number }>
  revenueExpenseItems: Array<{ name: string; amount: number }>
  openingStock: number
  purchases: number
  closingStock: number
  cogs: number
  grossProfit: number
  totalRevenue: number
  totalOtherIncome: number
  totalIncome: number
  totalAdminExpenses: number
  totalRevenueExpenses: number
  totalExpenses: number
  netProfit: number
}

function signedAmount(debit: number, credit: number, groupType: string) {
  if (groupType === "income" || groupType === "liability") {
    return credit - debit
  }
  return debit - credit
}

export async function calculateProfitLoss(
  supabase: SupabaseClient<Database>,
  clientId: string,
  fiscalYearId: string
): Promise<ProfitLossResult> {
  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("id", fiscalYearId)
    .eq("client_id", clientId)
    .maybeSingle()

  if (!fiscalYear) {
    throw new Error("Fiscal year not found.")
  }

  const trialBalance = await calculateTrialBalance(
    supabase,
    clientId,
    fiscalYearId,
    fiscalYear.end_date,
    fiscalYear.start_date
  )

  const incomeRows = trialBalance.accounts.filter((row) => row.groupType === "income")
  const expenseRows = trialBalance.accounts.filter((row) => row.groupType === "expense")

  const revenueItems = incomeRows
    .filter((row) => !row.accountHeadName.toLowerCase().includes("interest"))
    .map((row) => ({
      name: row.accountHeadName,
      amount: Math.max(0, signedAmount(row.debit, row.credit, row.groupType)),
    }))

  const otherIncomeItems = incomeRows
    .filter((row) => row.accountHeadName.toLowerCase().includes("interest"))
    .map((row) => ({
      name: row.accountHeadName,
      amount: Math.max(0, signedAmount(row.debit, row.credit, row.groupType)),
    }))

  const openingStock =
    expenseRows.find((row) => row.accountHeadName.toLowerCase().includes("opening stock"))?.debit ?? 0
  const purchases =
    expenseRows.find((row) => row.accountHeadName.toLowerCase().includes("purchase"))?.debit ?? 0
  const closingStock =
    incomeRows.find((row) => row.accountHeadName.toLowerCase().includes("closing stock"))?.credit ?? 0

  const adminExpenseItems = expenseRows
    .filter((row) => row.semiSubGroupName.toLowerCase().includes("administrative"))
    .map((row) => ({
      name: row.accountHeadName,
      amount: Math.max(0, signedAmount(row.debit, row.credit, row.groupType)),
    }))

  const revenueExpenseItems = expenseRows
    .filter((row) => !row.semiSubGroupName.toLowerCase().includes("administrative"))
    .map((row) => ({
      name: row.accountHeadName,
      amount: Math.max(0, signedAmount(row.debit, row.credit, row.groupType)),
    }))

  const totalRevenue = revenueItems.reduce((sum, item) => sum + item.amount, 0)
  const cogs = openingStock + purchases - closingStock
  const grossProfit = totalRevenue - cogs
  const totalOtherIncome = otherIncomeItems.reduce((sum, item) => sum + item.amount, 0)
  const totalIncome = grossProfit + totalOtherIncome
  const totalAdminExpenses = adminExpenseItems.reduce((sum, item) => sum + item.amount, 0)
  const totalRevenueExpenses = revenueExpenseItems.reduce((sum, item) => sum + item.amount, 0)
  const totalExpenses = totalAdminExpenses + totalRevenueExpenses
  const netProfit = totalIncome - totalExpenses

  return {
    fiscalYearLabel: fiscalYear.label,
    endDate: fiscalYear.end_date,
    revenueItems,
    otherIncomeItems,
    adminExpenseItems,
    revenueExpenseItems,
    openingStock,
    purchases,
    closingStock,
    cogs,
    grossProfit,
    totalRevenue,
    totalOtherIncome,
    totalIncome,
    totalAdminExpenses,
    totalRevenueExpenses,
    totalExpenses,
    netProfit,
  }
}
