import { addDays, addMonths, differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns"

import { canManageClient, canWriteClientData } from "@/lib/api-auth"
import { resolveAccountHierarchy } from "@/lib/accounting/chart-hierarchy"
import { calculateTrialBalance, type TrialBalanceRow } from "@/lib/accounting/trial-balance"
import { getClientTypeLabel } from "@/lib/accounting/clients"
import { getCurrentDateInAppTimeZone } from "@/lib/dates/current-date"
import { formatDashboardCurrency, formatDashboardPercent } from "@/lib/dashboard/dashboard-formatters"
import { resolveDashboardPeriodSelection } from "@/lib/dashboard/dashboard-period"
import type {
  DashboardCompareKey,
  DashboardComparison,
  DashboardExpenseCategory,
  DashboardFinancialSeriesPoint,
  DashboardLinkedValue,
  DashboardMetric,
  DashboardMetricState,
  DashboardMetricTone,
  DashboardOperationalStat,
  DashboardWarning,
  OrganizationDashboardViewModel,
} from "@/lib/dashboard/dashboard-types"
import { buildClientPath } from "@/lib/routing/clients"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"

type Client = Database["public"]["Tables"]["clients"]["Row"]
type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"]
type VoucherRow = Pick<
  Database["public"]["Tables"]["vouchers"]["Row"],
  "id" | "voucher_date" | "voucher_no" | "voucher_type" | "description" | "is_reversal" | "created_at"
>
type VoucherEntryRow = Pick<
  Database["public"]["Tables"]["voucher_entries"]["Row"],
  "voucher_id" | "account_head_id" | "debit" | "credit"
>
type AccountHeadRow = Database["public"]["Tables"]["account_heads"]["Row"]
type AccountGroupRow = Database["public"]["Tables"]["account_groups"]["Row"]
type AccountSemiSubGroupRow = Database["public"]["Tables"]["account_semi_sub_groups"]["Row"]
type AccountSubGroupRow = Database["public"]["Tables"]["account_sub_groups"]["Row"]

const CANONICAL_TAX_HEADS = new Set([
  "Income Tax Payable",
  "Salary TDS Payable",
  "AIT Payable",
  "Withholding Tax Payable",
])
const CANONICAL_VAT_HEADS = new Set(["VAT Payable"])
const CANONICAL_ADVANCE_TAX_PATH = "advance income tax (ait)"
const CANONICAL_TDS_ASSET_HEADS = new Set([
  "AIT â€“ TDS (Withholding Tax)",
  "AIT â€“ Contractor Payment TDS",
  "AIT â€“ Salary TDS",
])

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase()
}

function rowAmount(row: TrialBalanceRow) {
  if (row.groupType === "income" || row.groupType === "liability") {
    return Number(row.credit ?? 0) - Number(row.debit ?? 0)
  }

  return Number(row.debit ?? 0) - Number(row.credit ?? 0)
}

function positiveRowAmount(row: TrialBalanceRow) {
  return Math.max(0, rowAmount(row))
}

function isEquityRow(row: TrialBalanceRow) {
  return normalize(row.semiSubGroupName) === "equity / capital"
}

function isCurrentAssetRow(row: TrialBalanceRow) {
  return row.groupType === "asset" && normalize(row.semiSubGroupName) === "current assets"
}

function isCurrentLiabilityRow(row: TrialBalanceRow) {
  return row.groupType === "liability" && normalize(row.semiSubGroupName) === "current liabilities"
}

function isInventoryRow(row: TrialBalanceRow) {
  return row.groupType === "asset" && normalize(row.subGroupName) === "inventories"
}

function isCashAndBankRow(row: TrialBalanceRow) {
  const semi = normalize(row.semiSubGroupName)
  const sub = normalize(row.subGroupName)

  return (
    row.groupType === "asset" &&
    ((semi === "current assets" && sub === "cash & cash equivalents") ||
      (semi === "cash & bank balance" && sub === "cash & bank balance"))
  )
}

function isOperatingIncomeRow(row: TrialBalanceRow) {
  return row.groupType === "income" && normalize(row.semiSubGroupName) === "operating income"
}

function isCostOfSalesRow(row: TrialBalanceRow) {
  const semi = normalize(row.semiSubGroupName)
  return row.groupType === "expense" && (semi === "cost of goods sold (cogs)" || semi === "cost of services(cos)")
}

function isAdvanceTaxRow(row: TrialBalanceRow) {
  return row.groupType === "asset" && row.path.some((segment) => normalize(segment) === CANONICAL_ADVANCE_TAX_PATH)
}

function isExpenseCategoryRow(row: TrialBalanceRow) {
  return row.groupType === "expense" && positiveRowAmount(row) > 0
}

function isTaxPayableRow(row: TrialBalanceRow) {
  return row.groupType === "liability" && CANONICAL_TAX_HEADS.has(row.accountHeadName)
}

function isVatPayableRow(row: TrialBalanceRow) {
  return row.groupType === "liability" && CANONICAL_VAT_HEADS.has(row.accountHeadName)
}

function isTdsAssetRow(row: TrialBalanceRow) {
  return row.groupType === "asset" && CANONICAL_TDS_ASSET_HEADS.has(row.accountHeadName)
}

function sumRows(rows: TrialBalanceRow[], predicate: (row: TrialBalanceRow) => boolean) {
  return rows.filter(predicate).reduce((sum, row) => sum + positiveRowAmount(row), 0)
}

function safePercent(numerator: number, denominator: number) {
  if (!denominator || !Number.isFinite(denominator)) {
    return null
  }

  return (numerator / denominator) * 100
}

function buildComparison({
  currentValue,
  previousValue,
  label,
  favorableDirection,
  formatter,
}: {
  currentValue: number | null
  previousValue: number | null
  label: string
  favorableDirection: "up" | "down" | "neutral"
  formatter: (value: number | null) => string
}): DashboardComparison | null {
  if (currentValue == null || previousValue == null) {
    return null
  }

  const deltaPercent =
    previousValue !== 0 && Number.isFinite(previousValue)
      ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100
      : null

  const tone: DashboardMetricTone =
    deltaPercent == null || deltaPercent === 0 || favorableDirection === "neutral"
      ? "neutral"
      : favorableDirection === "up"
        ? deltaPercent > 0
          ? "positive"
          : "warning"
        : deltaPercent < 0
          ? "positive"
          : "warning"

  return {
    label,
    formattedValue: formatter(previousValue),
    deltaPercent,
    tone,
  }
}

function metricFromValue({
  key,
  label,
  value,
  formatter,
  periodLabel,
  tooltip,
  tone = "neutral",
  state = "ready",
  comparison = null,
  statusLabel,
}: {
  key: string
  label: string
  value: number | null
  formatter: (value: number | null) => string
  periodLabel: string
  tooltip: string
  tone?: DashboardMetricTone
  state?: DashboardMetricState
  comparison?: DashboardComparison | null
  statusLabel?: string
}): DashboardMetric {
  return {
    key,
    label,
    rawValue: value,
    formattedValue:
      state === "configurationRequired"
        ? "Account mapping required"
        : state === "unavailable"
          ? formatDashboardPercent(null, 0)
          : formatter(value),
    periodLabel,
    tooltip,
    tone,
    state,
    comparison,
    statusLabel,
  }
}

function buildExpenseCategories(rows: TrialBalanceRow[], totalExpenses: number): DashboardExpenseCategory[] {
  const totals = new Map<string, number>()

  for (const row of rows.filter(isExpenseCategoryRow)) {
    const label = row.subGroupName || row.semiSubGroupName || row.groupName
    totals.set(label, (totals.get(label) ?? 0) + positiveRowAmount(row))
  }

  return Array.from(totals.entries())
    .map(([label, amount]) => ({
      label,
      amount,
      formattedAmount: formatDashboardCurrency(amount),
      shareOfExpenses: safePercent(amount, totalExpenses),
      formattedShare: formatDashboardPercent(safePercent(amount, totalExpenses)),
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5)
}

function hasNonZeroFinancialData(rows: TrialBalanceRow[]) {
  return rows.some((row) => Math.abs(rowAmount(row)) > 0)
}

function getMonthBuckets(startDate: string, endDate: string) {
  const buckets: Array<{ label: string; key: string }> = []
  let current = parseISO(startDate)
  const end = parseISO(endDate)

  while (current <= end) {
    buckets.push({
      label: format(current, "MMM"),
      key: format(current, "yyyy-MM"),
    })
    current = addMonths(current, 1)
  }

  return buckets
}

function sumByMatch(rows: TrialBalanceRow[], matcher: (row: TrialBalanceRow) => boolean) {
  return rows.filter(matcher).reduce((sum, row) => sum + positiveRowAmount(row), 0)
}

function formatActivityTitle(voucher: VoucherRow) {
  if (voucher.is_reversal) {
    return `Voucher reversed JV-${voucher.voucher_no}`
  }

  const typeLabel =
    voucher.voucher_type === "received"
      ? "Receipt recorded"
      : voucher.voucher_type === "payment"
        ? "Payment recorded"
        : voucher.voucher_type === "contra"
          ? "Contra voucher created"
          : "Voucher posted"

  return `${typeLabel} ${voucher.voucher_type.toUpperCase()}-${voucher.voucher_no}`
}

function buildFinancialSeries({
  buckets,
  voucherEntries,
  voucherDates,
  accountHeads,
  accountGroups,
  accountSemiSubGroups,
  accountSubGroups,
}: {
  buckets: Array<{ label: string; key: string }>
  voucherEntries: VoucherEntryRow[]
  voucherDates: Map<string, string>
  accountHeads: AccountHeadRow[]
  accountGroups: AccountGroupRow[]
  accountSemiSubGroups: AccountSemiSubGroupRow[]
  accountSubGroups: AccountSubGroupRow[]
}): DashboardFinancialSeriesPoint[] {
  const amountByBucket = new Map<
    string,
    {
      incomeByHead: Map<string, number>
      expenseByHead: Map<string, number>
    }
  >(
    buckets.map((bucket) => [
      bucket.key,
      {
        incomeByHead: new Map<string, number>(),
        expenseByHead: new Map<string, number>(),
      },
    ])
  )

  const accountMetaById = new Map(
    accountHeads.map((head) => [
      head.id,
      resolveAccountHierarchy(head, {
        accountHeads,
        groups: accountGroups,
        semiSubGroups: accountSemiSubGroups,
        subGroups: accountSubGroups,
      }),
    ])
  )

  for (const entry of voucherEntries) {
    const voucherDate = voucherDates.get(entry.voucher_id ?? "")
    const accountHeadId = entry.account_head_id ?? ""

    if (!voucherDate || !accountHeadId) {
      continue
    }

    const bucketKey = voucherDate.slice(0, 7)
    const bucket = amountByBucket.get(bucketKey)
    const accountMeta = accountMetaById.get(accountHeadId)

    if (!bucket || !accountMeta) {
      continue
    }

    const debit = Number(entry.debit ?? 0)
    const credit = Number(entry.credit ?? 0)

    if (accountMeta.groupType === "income") {
      bucket.incomeByHead.set(accountHeadId, (bucket.incomeByHead.get(accountHeadId) ?? 0) + (credit - debit))
    }

    if (accountMeta.groupType === "expense") {
      bucket.expenseByHead.set(accountHeadId, (bucket.expenseByHead.get(accountHeadId) ?? 0) + (debit - credit))
    }
  }

  return buckets.map((bucket) => {
    const amounts = amountByBucket.get(bucket.key)
    const income = Array.from(amounts?.incomeByHead.values() ?? []).reduce((sum, value) => sum + Math.max(0, value), 0)
    const expense = Array.from(amounts?.expenseByHead.values() ?? []).reduce((sum, value) => sum + Math.max(0, value), 0)

    return {
      key: bucket.key,
      label: bucket.label,
      income,
      expense,
      profit: income - expense,
    }
  })
}

function resolveComparisonConfig({
  selectedFiscalYear,
  previousFiscalYear,
  periodSelection,
  requestedCompare,
}: {
  selectedFiscalYear: FiscalYear
  previousFiscalYear: FiscalYear | null
  periodSelection: ReturnType<typeof resolveDashboardPeriodSelection>
  requestedCompare?: string
}) {
  const chosenKey: DashboardCompareKey =
    requestedCompare === "previous-fiscal-year" && previousFiscalYear
      ? "previous-fiscal-year"
      : "previous-period"

  if (chosenKey === "previous-fiscal-year" && previousFiscalYear) {
    const startOffset = differenceInCalendarDays(
      parseISO(periodSelection.startDate),
      parseISO(selectedFiscalYear.start_date)
    )
    const endOffset = differenceInCalendarDays(
      parseISO(periodSelection.endDate),
      parseISO(selectedFiscalYear.start_date)
    )

    const comparisonStart = format(addDays(parseISO(previousFiscalYear.start_date), startOffset), "yyyy-MM-dd")
    const comparisonEndRaw = format(addDays(parseISO(previousFiscalYear.start_date), endOffset), "yyyy-MM-dd")
    const comparisonEnd =
      comparisonEndRaw > previousFiscalYear.end_date ? previousFiscalYear.end_date : comparisonEndRaw

    return {
      key: chosenKey,
      label: "Previous FY",
      period:
        comparisonStart <= previousFiscalYear.end_date
          ? {
              startDate: comparisonStart,
              endDate: comparisonEnd,
              fiscalYearId: previousFiscalYear.id,
            }
          : null,
      options: [
        { key: "previous-period" as const, label: "Previous Period" },
        { key: "previous-fiscal-year" as const, label: "Previous FY" },
      ],
    }
  }

  return {
    key: "previous-period" as const,
    label: "Previous Period",
    period: periodSelection.comparison
      ? {
          startDate: periodSelection.comparison.startDate,
          endDate: periodSelection.comparison.endDate,
          fiscalYearId: selectedFiscalYear.id,
        }
      : null,
    options: [
      { key: "previous-period" as const, label: "Previous Period" },
      { key: "previous-fiscal-year" as const, label: "Previous FY", disabled: !previousFiscalYear },
    ],
  }
}

export const __dashboardTestUtils = {
  buildComparison,
  buildExpenseCategories,
  hasNonZeroFinancialData,
  isCashAndBankRow,
  isCostOfSalesRow,
  isInventoryRow,
  isOperatingIncomeRow,
  isTaxPayableRow,
  isVatPayableRow,
  metricFromValue,
  positiveRowAmount,
  rowAmount,
  safePercent,
}

export async function getOrganizationDashboard({
  client,
  routeSegment,
  selectedFiscalYear,
  fiscalYears,
  searchParams,
}: {
  client: Client
  routeSegment: string
  selectedFiscalYear: FiscalYear | null
  fiscalYears: FiscalYear[]
  searchParams: {
    fiscalYear?: string
    period?: string
    from?: string
    to?: string
    compare?: string
  }
}): Promise<OrganizationDashboardViewModel> {
  const clientPath = buildClientPath({
    id: client.id,
    name: client.name,
    routeSegment,
  })

  const context = {
    primaryActionHref: `${clientPath}/vouchers/new${selectedFiscalYear ? `?fiscalYear=${selectedFiscalYear.id}` : ""}`,
    manageFiscalYearsHref: `${clientPath}/settings/fiscal-years`,
    dayBookHref: `${clientPath}/day-book${selectedFiscalYear ? `?fiscalYear=${selectedFiscalYear.id}` : ""}`,
    settingsHref: `${clientPath}/settings`,
    trialBalanceHref: `${clientPath}/trial-balance${selectedFiscalYear ? `?fiscalYear=${selectedFiscalYear.id}` : ""}`,
    balanceSheetHref: `${clientPath}/balance-sheet${selectedFiscalYear ? `?fiscalYear=${selectedFiscalYear.id}` : ""}`,
    profitLossHref: `${clientPath}/profit-loss${selectedFiscalYear ? `?fiscalYear=${selectedFiscalYear.id}` : ""}`,
    reportsHref: `${clientPath}/reports${selectedFiscalYear ? `?fiscalYear=${selectedFiscalYear.id}` : ""}`,
  }

  const baseViewModel: OrganizationDashboardViewModel = {
    organization: {
      id: client.id,
      name: client.name,
      typeLabel: getClientTypeLabel(client.type),
      tin: client.tin,
      bin: client.bin,
      isActive: client.is_active !== false,
    },
    fiscalYear: selectedFiscalYear
      ? {
          id: selectedFiscalYear.id,
          label: selectedFiscalYear.label,
          startDate: selectedFiscalYear.start_date,
          endDate: selectedFiscalYear.end_date,
        }
      : null,
    selectedPeriod: null,
    comparison: {
      key: "previous-period",
      label: "Previous Period",
      options: [
        { key: "previous-period", label: "Previous Period" },
        { key: "previous-fiscal-year", label: "Previous FY", disabled: true },
      ],
    },
    context,
    financialOverview: [],
    financialSeries: [],
    financialPosition: [],
    profitAndTax: [],
    expenses: null,
    warnings: [],
    topAccounts: [],
    cashFlow: {
      inflow: metricFromValue({
        key: "cash-inflow",
        label: "Cash Inflow",
        value: null,
        formatter: formatDashboardCurrency,
        periodLabel: "No fiscal year selected",
        tooltip: "Cash flow is unavailable until a fiscal year is selected.",
        state: "unavailable",
      }),
      outflow: metricFromValue({
        key: "cash-outflow",
        label: "Cash Outflow",
        value: null,
        formatter: formatDashboardCurrency,
        periodLabel: "No fiscal year selected",
        tooltip: "Cash flow is unavailable until a fiscal year is selected.",
        state: "unavailable",
      }),
      net: metricFromValue({
        key: "net-cash-flow",
        label: "Net Cash Flow",
        value: null,
        formatter: formatDashboardCurrency,
        periodLabel: "No fiscal year selected",
        tooltip: "Cash flow is unavailable until a fiscal year is selected.",
        state: "unavailable",
      }),
      points: [],
      href: context.dayBookHref,
    },
    recentActivities: [],
    quickActions: [],
    operationalStats: [],
    isEmpty: false,
  }

  if (!selectedFiscalYear) {
    return {
      ...baseViewModel,
      warnings: [
        {
          id: "missing-fiscal-year",
          title: "No fiscal year selected",
          description: "Create or activate a fiscal year to unlock the organization dashboard.",
          href: context.manageFiscalYearsHref,
        },
      ],
      recentActivities: [
        {
          title: "Create a fiscal year",
          description: "Set up the first fiscal year to activate dashboard reporting.",
          href: context.manageFiscalYearsHref,
          kind: "setup",
        },
      ],
      quickActions: [
        {
          label: "Manage Fiscal Years",
          description: "Create and activate a fiscal period",
          href: context.manageFiscalYearsHref,
        },
        {
          label: "Organization Settings",
          description: "Review organization profile",
          href: context.settingsHref,
        },
      ],
      operationalStats: [
        {
          key: "fiscal-years",
          label: "Fiscal Years",
          value: String(fiscalYears.length),
          helper: "Available periods",
        },
      ],
      isEmpty: true,
    }
  }

  const periodSelection = resolveDashboardPeriodSelection({
    fiscalYear: selectedFiscalYear,
    requestedKey: searchParams.period,
    requestedFrom: searchParams.from,
    requestedTo: searchParams.to,
    todayDate: getCurrentDateInAppTimeZone(),
  })

  const previousFiscalYear =
    fiscalYears
      .slice()
      .sort((left, right) => left.start_date.localeCompare(right.start_date))
      .find((year) => year.end_date < selectedFiscalYear.start_date) ?? null

  const comparisonConfig = resolveComparisonConfig({
    selectedFiscalYear,
    previousFiscalYear,
    periodSelection,
    requestedCompare: searchParams.compare,
  })

  const supabase = await createClient()
  const { membership } = await getCurrentOrganizationContext()
  const canCreateVoucher = canWriteClientData(membership)
  const canCreateAccountHead = canManageClient(membership)
  const periodVoucherCountQuery = supabase
    .from("vouchers")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .eq("fiscal_year_id", selectedFiscalYear.id)
    .or("is_posted.eq.true,is_posted.is.null")
    .gte("voucher_date", periodSelection.startDate)
    .lte("voucher_date", periodSelection.endDate)

  const recentVouchersQuery = supabase
    .from("vouchers")
    .select("id,voucher_date,voucher_no,voucher_type,description,is_reversal,created_at")
    .eq("client_id", client.id)
    .eq("fiscal_year_id", selectedFiscalYear.id)
    .or("is_posted.eq.true,is_posted.is.null")
    .order("voucher_date", { ascending: false })
    .limit(4)

  const accountHeadCountQuery = supabase
    .from("account_heads")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .or("is_active.eq.true,is_active.is.null")

  const paymentModeCountQuery = supabase
    .from("payment_modes")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .or("is_active.eq.true,is_active.is.null")

  const accountGroupCountQuery = supabase
    .from("account_groups")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)

  const activeAccountHeadsQuery = supabase
    .from("account_heads")
    .select("*")
    .eq("client_id", client.id)
    .or("is_active.eq.true,is_active.is.null")

  const accountGroupsQuery = supabase.from("account_groups").select("*").eq("client_id", client.id)
  const accountSemiSubGroupsQuery = supabase.from("account_semi_sub_groups").select("*").eq("client_id", client.id)
  const accountSubGroupsQuery = supabase.from("account_sub_groups").select("*").eq("client_id", client.id)

  const [
    periodTrialBalance,
    asOfTrialBalance,
    previousFiscalYearTrialBalance,
    periodVoucherCountResult,
    recentVouchersResult,
    accountHeadCountResult,
    paymentModeCountResult,
    accountGroupCountResult,
    activeAccountHeadsResult,
    accountGroupsResult,
    accountSemiSubGroupsResult,
    accountSubGroupsResult,
  ] =
    await Promise.all([
      calculateTrialBalance(
        supabase,
        client.id,
        selectedFiscalYear.id,
        periodSelection.endDate,
        periodSelection.startDate
      ),
      calculateTrialBalance(
        supabase,
        client.id,
        selectedFiscalYear.id,
        periodSelection.endDate,
        selectedFiscalYear.start_date
      ),
      previousFiscalYear
        ? calculateTrialBalance(
            supabase,
            client.id,
            previousFiscalYear.id,
            previousFiscalYear.end_date,
            previousFiscalYear.start_date
          )
        : Promise.resolve(null),
      periodVoucherCountQuery,
      recentVouchersQuery,
      accountHeadCountQuery,
      paymentModeCountQuery,
      accountGroupCountQuery,
      activeAccountHeadsQuery,
      accountGroupsQuery,
      accountSemiSubGroupsQuery,
      accountSubGroupsQuery,
    ])

  const comparisonTrialBalance = comparisonConfig.period
    ? await calculateTrialBalance(
        supabase,
        client.id,
        comparisonConfig.period.fiscalYearId,
        comparisonConfig.period.endDate,
        comparisonConfig.period.startDate
      )
    : null

  const currentFlowRows = periodTrialBalance.accounts
  const currentAsOfRows = asOfTrialBalance.accounts
  const comparisonRows = comparisonTrialBalance?.accounts ?? []
  const activeAccountHeads = (activeAccountHeadsResult.data ?? []) as AccountHeadRow[]
  const accountGroups = (accountGroupsResult.data ?? []) as AccountGroupRow[]
  const accountSemiSubGroups = (accountSemiSubGroupsResult.data ?? []) as AccountSemiSubGroupRow[]
  const accountSubGroups = (accountSubGroupsResult.data ?? []) as AccountSubGroupRow[]

  const previousRetainedEarnings = previousFiscalYearTrialBalance
    ? previousFiscalYearTrialBalance.accounts
        .filter((row) => row.groupType === "income" || row.groupType === "expense")
        .reduce((sum, row) => {
          const amount = positiveRowAmount(row)
          return row.groupType === "income" ? sum + amount : sum - amount
        }, 0)
    : 0

  const turnover = sumRows(currentFlowRows, isOperatingIncomeRow)
  const cogs = sumRows(currentFlowRows, isCostOfSalesRow)
  const grossProfit = turnover - cogs
  const totalIncome = currentFlowRows
    .filter((row) => row.groupType === "income")
    .reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const totalExpenses = currentFlowRows
    .filter((row) => row.groupType === "expense")
    .reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const netProfit = totalIncome - totalExpenses

  const comparisonTurnover = comparisonRows.length ? sumRows(comparisonRows, isOperatingIncomeRow) : null
  const comparisonCogs = comparisonRows.length ? sumRows(comparisonRows, isCostOfSalesRow) : null
  const comparisonGrossProfit =
    comparisonTurnover != null && comparisonCogs != null ? comparisonTurnover - comparisonCogs : null
  const comparisonTotalIncome =
    comparisonRows.length > 0
      ? comparisonRows.filter((row) => row.groupType === "income").reduce((sum, row) => sum + positiveRowAmount(row), 0)
      : null
  const comparisonTotalExpenses =
    comparisonRows.length > 0
      ? comparisonRows.filter((row) => row.groupType === "expense").reduce((sum, row) => sum + positiveRowAmount(row), 0)
      : null
  const comparisonNetProfit =
    comparisonTotalIncome != null && comparisonTotalExpenses != null
      ? comparisonTotalIncome - comparisonTotalExpenses
      : null

  const grossProfitPercent = safePercent(grossProfit, turnover)
  const netProfitPercent = safePercent(netProfit, turnover)
  const comparisonGrossProfitPercent =
    comparisonGrossProfit != null && comparisonTurnover != null
      ? safePercent(comparisonGrossProfit, comparisonTurnover)
      : null
  const comparisonNetProfitPercent =
    comparisonNetProfit != null && comparisonTurnover != null
      ? safePercent(comparisonNetProfit, comparisonTurnover)
      : null

  const cashAndBankRows = currentAsOfRows.filter(isCashAndBankRow)
  const cashAndBank = cashAndBankRows.reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const comparisonCashAndBank = comparisonRows.length > 0 ? sumRows(comparisonRows, isCashAndBankRow) : null

  const equityBase = currentAsOfRows.filter(isEquityRow).reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const currentYearProfitRow = currentAsOfRows.find(
    (row) => normalize(row.accountHeadName) === "current year profit / loss"
  )
  const totalEquity =
    equityBase +
    (currentYearProfitRow && Math.abs(rowAmount(currentYearProfitRow)) > 0 ? 0 : totalIncome - totalExpenses) +
    previousRetainedEarnings
  const totalAssets = currentAsOfRows
    .filter((row) => row.groupType === "asset")
    .reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const totalLiabilities = currentAsOfRows
    .filter((row) => row.groupType === "liability" && !isEquityRow(row))
    .reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const currentAssets = currentAsOfRows.filter(isCurrentAssetRow).reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const currentLiabilities = currentAsOfRows
    .filter(isCurrentLiabilityRow)
    .reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const inventories = currentAsOfRows.filter(isInventoryRow).reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const workingCapital = currentAssets - currentLiabilities
  const currentRatio = currentLiabilities === 0 ? null : currentAssets / currentLiabilities
  const quickRatio = currentLiabilities === 0 ? null : (currentAssets - inventories) / currentLiabilities
  const equityRatio = safePercent(totalEquity, totalAssets)

  const taxRows = currentAsOfRows.filter(isTaxPayableRow)
  const vatRows = currentAsOfRows.filter(isVatPayableRow)
  const advanceTaxRows = currentFlowRows.filter(isAdvanceTaxRow)
  const tdsRows = currentFlowRows.filter(isTdsAssetRow)
  const taxDueState: DashboardMetricState = taxRows.length ? "ready" : "configurationRequired"
  const vatDueState: DashboardMetricState = vatRows.length ? "ready" : "configurationRequired"
  const taxDue = taxRows.length ? taxRows.reduce((sum, row) => sum + positiveRowAmount(row), 0) : null
  const vatDue = vatRows.length ? vatRows.reduce((sum, row) => sum + positiveRowAmount(row), 0) : null
  const advanceTaxPaid = advanceTaxRows.reduce((sum, row) => sum + positiveRowAmount(row), 0)
  const tdsAmount = tdsRows.reduce((sum, row) => sum + positiveRowAmount(row), 0)

  const warnings: DashboardWarning[] = []

  if (periodSelection.hadValidationIssue) {
    warnings.push({
      id: "period-adjusted",
      title: "Date range adjusted",
      description: "The custom range was normalized inside the active fiscal year.",
    })
  }

  if ((periodVoucherCountResult.count ?? 0) === 0) {
    warnings.push({
      id: "no-posted-vouchers",
      title: "No posted vouchers in this period",
      description: "Period-based cards will stay calm until posted vouchers are recorded.",
      href: context.primaryActionHref,
    })
  }

  if (taxDueState === "configurationRequired") {
    warnings.push({
      id: "tax-mapping",
      title: "Tax mapping required",
      description: "No canonical income-tax payable accounts were found for this organization.",
      href: `${clientPath}/accounts`,
    })
  }

  if (vatDueState === "configurationRequired") {
    warnings.push({
      id: "vat-mapping",
      title: "VAT mapping required",
      description: "No canonical VAT payable account was found for this organization.",
      href: `${clientPath}/accounts`,
    })
  }

  const financialOverview: DashboardMetric[] = [
    metricFromValue({
      key: "sales",
      label: "Sales (Turnover)",
      value: turnover,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Operating income recognized from posted vouchers during the selected period.",
      tone: turnover > 0 ? "positive" : "neutral",
      comparison: buildComparison({
        currentValue: turnover,
        previousValue: comparisonTurnover,
        label: comparisonConfig.label,
        favorableDirection: "up",
        formatter: formatDashboardCurrency,
      }),
    }),
    metricFromValue({
      key: "gp-percent",
      label: "Gross Profit %",
      value: grossProfitPercent,
      formatter: formatDashboardPercent,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Gross profit divided by operating turnover for the selected period.",
      tone: grossProfit >= 0 ? "positive" : "danger",
      state: turnover > 0 ? "ready" : "unavailable",
      comparison: buildComparison({
        currentValue: grossProfitPercent,
        previousValue: comparisonGrossProfitPercent,
        label: comparisonConfig.label,
        favorableDirection: "up",
        formatter: formatDashboardPercent,
      }),
    }),
    metricFromValue({
      key: "np-percent",
      label: "Net Profit %",
      value: netProfitPercent,
      formatter: formatDashboardPercent,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Net profit divided by operating turnover for the selected period.",
      tone: netProfit >= 0 ? "positive" : "danger",
      state: turnover > 0 ? "ready" : "unavailable",
      comparison: buildComparison({
        currentValue: netProfitPercent,
        previousValue: comparisonNetProfitPercent,
        label: comparisonConfig.label,
        favorableDirection: "up",
        formatter: formatDashboardPercent,
      }),
    }),
    metricFromValue({
      key: "tax-due",
      label: "Tax Due",
      value: taxDue,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Closing balance of canonical income-tax and withholding-tax payable accounts.",
      tone: "warning",
      state: taxDueState,
    }),
    metricFromValue({
      key: "vat-due",
      label: "VAT Due",
      value: vatDue,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Closing balance of the canonical VAT payable account.",
      tone: "warning",
      state: vatDueState,
    }),
    metricFromValue({
      key: "cash-bank",
      label: "Cash & Bank",
      value: cashAndBank,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Combined closing balance of cash and bank asset accounts as of the selected end date.",
      tone: cashAndBank >= 0 ? "info" : "danger",
      comparison: buildComparison({
        currentValue: cashAndBank,
        previousValue: comparisonCashAndBank,
        label: comparisonConfig.label,
        favorableDirection: "up",
        formatter: formatDashboardCurrency,
      }),
    }),
  ]

  const financialPosition: DashboardMetric[] = [
    metricFromValue({
      key: "assets",
      label: "Total Assets",
      value: totalAssets,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Total asset balance based on posted vouchers plus opening balances as of the selected end date.",
    }),
    metricFromValue({
      key: "liabilities",
      label: "Total Liabilities",
      value: totalLiabilities,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Total liabilities excluding the equity section.",
      tone: "warning",
    }),
    metricFromValue({
      key: "equity",
      label: "Total Equity",
      value: totalEquity,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Equity section balances plus current-year profit carried into the statement position.",
      tone: totalEquity >= 0 ? "positive" : "danger",
    }),
    metricFromValue({
      key: "equity-ratio",
      label: "Equity Ratio",
      value: equityRatio,
      formatter: formatDashboardPercent,
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Total equity divided by total assets.",
      tone: "info",
      state: totalAssets > 0 ? "ready" : "unavailable",
    }),
    metricFromValue({
      key: "working-capital",
      label: "Working Capital",
      value: workingCapital,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Current assets minus current liabilities.",
      tone: workingCapital >= 0 ? "positive" : "danger",
    }),
    metricFromValue({
      key: "current-ratio",
      label: "Current Ratio",
      value: currentRatio,
      formatter: (value) => (value == null ? "--" : value.toFixed(2)),
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Current assets divided by current liabilities.",
      tone: "info",
      state: currentLiabilities > 0 ? "ready" : "unavailable",
    }),
    metricFromValue({
      key: "quick-ratio",
      label: "Quick Ratio",
      value: quickRatio,
      formatter: (value) => (value == null ? "--" : value.toFixed(2)),
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Current assets excluding inventories, divided by current liabilities.",
      tone: "info",
      state: currentLiabilities > 0 ? "ready" : "unavailable",
    }),
  ]

  const profitAndTax: DashboardMetric[] = [
    metricFromValue({
      key: "summary-sales",
      label: "Sales / Turnover",
      value: turnover,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Operating income for the selected period.",
      tone: "positive",
    }),
    metricFromValue({
      key: "summary-gross-profit",
      label: "Gross Profit",
      value: grossProfit,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Operating turnover minus cost of goods sold and cost of services.",
      tone: grossProfit >= 0 ? "positive" : "danger",
    }),
    metricFromValue({
      key: "summary-gp-percent",
      label: "GP %",
      value: grossProfitPercent,
      formatter: formatDashboardPercent,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Gross profit divided by operating turnover.",
      tone: "info",
      state: turnover > 0 ? "ready" : "unavailable",
    }),
    metricFromValue({
      key: "summary-net-profit",
      label: "Net Profit",
      value: netProfit,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Total income minus total expenses for the selected period.",
      tone: netProfit >= 0 ? "positive" : "danger",
    }),
    metricFromValue({
      key: "summary-np-percent",
      label: "NP %",
      value: netProfitPercent,
      formatter: formatDashboardPercent,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Net profit divided by operating turnover.",
      tone: "info",
      state: turnover > 0 ? "ready" : "unavailable",
    }),
    metricFromValue({
      key: "summary-advance-tax",
      label: "Advance Tax Paid",
      value: advanceTaxPaid,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Balances recorded in the canonical Advance Income Tax asset path for the selected period.",
    }),
    metricFromValue({
      key: "summary-tds",
      label: "TDS (Tax Deducted)",
      value: tdsAmount,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Selected posted TDS-related balances recorded in canonical advance tax heads.",
      state: tdsRows.length > 0 ? "ready" : "unavailable",
    }),
    metricFromValue({
      key: "summary-tax-due",
      label: "Tax Due / Payable",
      value: taxDue,
      formatter: formatDashboardCurrency,
      periodLabel: periodSelection.asOfLabel,
      tooltip: "Closing tax payable balance as of the selected end date.",
      tone: "warning",
      state: taxDueState,
    }),
    metricFromValue({
      key: "summary-effective-tax-rate",
      label: "Effective Tax Rate",
      value: null,
      formatter: formatDashboardPercent,
      periodLabel: periodSelection.periodLabel,
      tooltip: "Requires an explicit current-tax-expense source; this stays unavailable until that source is configured.",
      state: "unavailable",
    }),
  ]

  const expenseRatio = safePercent(totalExpenses, turnover)
  const expenseMetric = metricFromValue({
    key: "expense-total",
    label: "Total Expenses",
    value: totalExpenses,
    formatter: formatDashboardCurrency,
    periodLabel: periodSelection.periodLabel,
    tooltip: "Total expense recognized from posted vouchers during the selected period.",
    tone: "warning",
  })
  const expenseRatioMetric = metricFromValue({
    key: "expense-ratio",
    label: "Expense Ratio",
    value: expenseRatio,
    formatter: formatDashboardPercent,
    periodLabel: periodSelection.periodLabel,
    tooltip: "Total expenses divided by operating turnover.",
    tone: "info",
    state: turnover > 0 ? "ready" : "unavailable",
  })

  const topAccounts: DashboardLinkedValue[] = [
    {
      label: "Cash in Hand",
      value: sumByMatch(
        currentAsOfRows,
        (row) => row.groupType === "asset" && normalize(row.accountHeadName).includes("cash")
      ),
      formattedValue: formatDashboardCurrency(
        sumByMatch(currentAsOfRows, (row) => row.groupType === "asset" && normalize(row.accountHeadName).includes("cash"))
      ),
      href: context.trialBalanceHref,
      meta: "Current Assets",
    },
    {
      label: "Bank Accounts",
      value: sumByMatch(
        currentAsOfRows,
        (row) =>
          row.groupType === "asset" &&
          (normalize(row.accountHeadName).includes("bank") || normalize(row.subGroupName).includes("cash & bank"))
      ),
      formattedValue: formatDashboardCurrency(
        sumByMatch(
          currentAsOfRows,
          (row) =>
            row.groupType === "asset" &&
            (normalize(row.accountHeadName).includes("bank") || normalize(row.subGroupName).includes("cash & bank"))
        )
      ),
      href: context.trialBalanceHref,
      meta: "Current Assets",
    },
    {
      label: "Accounts Receivable",
      value: sumByMatch(
        currentAsOfRows,
        (row) =>
          row.groupType === "asset" &&
          (normalize(row.subGroupName).includes("receivable") || normalize(row.accountHeadName).includes("receivable"))
      ),
      formattedValue: formatDashboardCurrency(
        sumByMatch(
          currentAsOfRows,
          (row) =>
            row.groupType === "asset" &&
            (normalize(row.subGroupName).includes("receivable") || normalize(row.accountHeadName).includes("receivable"))
        )
      ),
      href: context.trialBalanceHref,
      meta: "Current Assets",
    },
    {
      label: "Inventory",
      value: inventories,
      formattedValue: formatDashboardCurrency(inventories),
      href: context.trialBalanceHref,
      meta: "Current Assets",
    },
    {
      label: "Accounts Payable",
      value: sumByMatch(
        currentAsOfRows,
        (row) =>
          row.groupType === "liability" &&
          (normalize(row.accountHeadName).includes("payable") || normalize(row.subGroupName).includes("payable"))
      ),
      formattedValue: formatDashboardCurrency(
        sumByMatch(
          currentAsOfRows,
          (row) =>
            row.groupType === "liability" &&
            (normalize(row.accountHeadName).includes("payable") || normalize(row.subGroupName).includes("payable"))
        )
      ),
      href: context.trialBalanceHref,
      meta: "Current Liabilities",
    },
    {
      label: "Short Term Borrowings",
      value: sumByMatch(
        currentAsOfRows,
        (row) => row.groupType === "liability" && normalize(row.subGroupName).includes("short-term")
      ),
      formattedValue: formatDashboardCurrency(
        sumByMatch(
          currentAsOfRows,
          (row) => row.groupType === "liability" && normalize(row.subGroupName).includes("short-term")
        )
      ),
      href: context.trialBalanceHref,
      meta: "Current Liabilities",
    },
  ]

  const cashAccountIds = cashAndBankRows.map((row) => row.accountHeadId)
  const cashAccountIdSet = new Set(cashAccountIds)
  const { data: fiscalYearVouchers } = await supabase
    .from("vouchers")
    .select("id,voucher_date,voucher_type")
    .eq("client_id", client.id)
    .eq("fiscal_year_id", selectedFiscalYear.id)
    .or("is_posted.eq.true,is_posted.is.null")
    .gte("voucher_date", selectedFiscalYear.start_date)
    .lte("voucher_date", periodSelection.endDate)

  const voucherIds = (fiscalYearVouchers ?? []).map((voucher) => voucher.id)
  const voucherDateById = new Map((fiscalYearVouchers ?? []).map((voucher) => [voucher.id, voucher.voucher_date]))
  const allVoucherEntries = voucherIds.length
    ? ((
        await supabase
          .from("voucher_entries")
          .select("voucher_id,account_head_id,debit,credit")
          .in("voucher_id", voucherIds)
      ).data ?? []) as VoucherEntryRow[]
    : []

  const financialSeries = buildFinancialSeries({
    buckets: getMonthBuckets(periodSelection.startDate, periodSelection.endDate),
    voucherEntries: allVoucherEntries.filter((entry) => {
      const voucherDate = voucherDateById.get(entry.voucher_id ?? "")
      return Boolean(voucherDate && voucherDate >= periodSelection.startDate && voucherDate <= periodSelection.endDate)
    }),
    voucherDates: voucherDateById,
    accountHeads: activeAccountHeads,
    accountGroups,
    accountSemiSubGroups,
    accountSubGroups,
  })

  const cashFlowBuckets = getMonthBuckets(selectedFiscalYear.start_date, periodSelection.endDate)
  const cashFlowPointMap = new Map(
    cashFlowBuckets.map((bucket) => [bucket.key, { label: bucket.label, inflow: 0, outflow: 0, net: 0 }])
  )
  const entriesByVoucherId = new Map<string, VoucherEntryRow[]>()

  for (const entry of allVoucherEntries) {
    const voucherId = entry.voucher_id ?? ""
    if (!voucherId) {
      continue
    }

    entriesByVoucherId.set(voucherId, [...(entriesByVoucherId.get(voucherId) ?? []), entry])
  }

  let cashInflow = 0
  let cashOutflow = 0

  for (const [voucherId, entries] of entriesByVoucherId.entries()) {
    const voucherDate = voucherDateById.get(voucherId)
    if (!voucherDate) {
      continue
    }

    const hasOnlyCashAndBankLegs =
      entries.length > 0 &&
      entries.every((entry) => entry.account_head_id && cashAccountIdSet.has(entry.account_head_id))

    if (hasOnlyCashAndBankLegs) {
      continue
    }

    const monthKey = voucherDate.slice(0, 7)
    const bucket = cashFlowPointMap.get(monthKey)

    for (const entry of entries) {
      if (!entry.account_head_id || !cashAccountIdSet.has(entry.account_head_id)) {
        continue
      }

      const debit = Number(entry.debit ?? 0)
      const credit = Number(entry.credit ?? 0)

      if (bucket) {
        bucket.inflow += debit
        bucket.outflow += credit
        bucket.net += debit - credit
      }

      if (voucherDate >= periodSelection.startDate && voucherDate <= periodSelection.endDate) {
        cashInflow += debit
        cashOutflow += credit
      }
    }
  }

  const netCashFlow = cashInflow - cashOutflow
  const trialBalanceDifference = asOfTrialBalance.difference
  const latestVoucherDate = ((recentVouchersResult.data ?? []) as VoucherRow[])[0]?.voucher_date ?? null
  const generatedOn = format(parseISO(getCurrentDateInAppTimeZone()), "dd MMM yyyy")
  const operationalStats: DashboardOperationalStat[] = [
    {
      key: "total-vouchers",
      label: "Total Vouchers",
      value: String(periodVoucherCountResult.count ?? 0),
      helper: periodSelection.label,
    },
    {
      key: "total-accounts",
      label: "Total Accounts",
      value: String(accountHeadCountResult.count ?? 0),
      helper: "Active accounts",
    },
    {
      key: "total-customers",
      label: "Total Customers",
      value: formatDashboardPercent(null, 0),
      helper: "Customer module unavailable",
    },
    {
      key: "total-suppliers",
      label: "Total Suppliers",
      value: formatDashboardPercent(null, 0),
      helper: "Supplier module unavailable",
    },
    {
      key: "account-groups",
      label: "Account Groups",
      value: String(accountGroupCountResult.count ?? 0),
      helper: "Chart hierarchy",
    },
    {
      key: "trial-balance-diff",
      label: "Trial Balance Difference",
      value: formatDashboardCurrency(trialBalanceDifference),
      helper: trialBalanceDifference === 0 ? "Balanced" : "Needs review",
      tone: trialBalanceDifference === 0 ? "positive" : "warning",
    },
    {
      key: "last-updated",
      label: "Last Updated",
      value: generatedOn,
      helper: latestVoucherDate ? `Latest voucher ${latestVoucherDate}` : "Dashboard generated",
      tone: latestVoucherDate ? "positive" : "neutral",
    },
  ]

  const recentActivityAmounts = new Map<string, string>()
  for (const voucher of ((recentVouchersResult.data ?? []) as VoucherRow[])) {
    const entries = entriesByVoucherId.get(voucher.id) ?? []
    const totalDebit = entries.reduce((sum, entry) => sum + Number(entry.debit ?? 0), 0)
    if (totalDebit > 0) {
      recentActivityAmounts.set(voucher.id, formatDashboardCurrency(totalDebit))
    }
  }

  const recentActivities =
    (recentVouchersResult.data ?? []).length > 0
      ? ((recentVouchersResult.data ?? []) as VoucherRow[]).map((voucher) => ({
          title: formatActivityTitle(voucher),
          amount: recentActivityAmounts.get(voucher.id),
          occurredAt: voucher.voucher_date,
          description: `${voucher.voucher_date} · ${voucher.voucher_type}`,
          href: `${clientPath}/vouchers/${voucher.id}`,
          kind: "voucher" as const,
        }))
      : [
          {
            title: "No recent vouchers",
            description: "Create your first posted voucher to start building dashboard history.",
            href: context.primaryActionHref,
            kind: "setup" as const,
          },
          {
            title: "No recent transactions",
            description: "New accounting activity will appear here once vouchers are posted.",
            href: context.dayBookHref,
            kind: "info" as const,
          },
          {
            title: "Getting started",
            description: "Set up your chart of accounts and start recording transactions.",
            href: `${clientPath}/accounts`,
            kind: "setup" as const,
          },
        ]

  const quickActions = [
    {
      label: "Add New Voucher",
      description: canCreateVoucher ? "Create a new voucher" : "Only owners, admins, and accountants can create vouchers",
      href: canCreateVoucher ? context.primaryActionHref : undefined,
      disabled: !canCreateVoucher,
      disabledReason: canCreateVoucher ? undefined : "You do not have permission to create vouchers.",
    },
    {
      label: "Add Account Head",
      description: canCreateAccountHead ? "Create a new account head" : "Only owners and admins can manage account heads",
      href: canCreateAccountHead ? `${clientPath}/accounts` : undefined,
      disabled: !canCreateAccountHead,
      disabledReason: canCreateAccountHead ? undefined : "You do not have permission to manage the chart of accounts.",
    },
    {
      label: "Create Customer",
      description: "Available when the customer module is added",
      disabled: true,
      disabledReason: "A customer module is not available in this workspace yet.",
    },
    {
      label: "Create Supplier",
      description: "Available when the supplier module is added",
      disabled: true,
      disabledReason: "A supplier module is not available in this workspace yet.",
    },
  ]

  return {
    ...baseViewModel,
    selectedPeriod: periodSelection,
    comparison: {
      key: comparisonConfig.key,
      label: comparisonConfig.label,
      options: comparisonConfig.options,
    },
    financialOverview,
    financialSeries,
    financialPosition,
    profitAndTax,
    expenses: {
      totalExpenses: expenseMetric,
      topCategories: buildExpenseCategories(currentFlowRows, totalExpenses),
      expenseRatio: expenseRatioMetric,
      reportHref: context.profitLossHref,
    },
    warnings,
    topAccounts,
    cashFlow: {
      inflow: metricFromValue({
        key: "cash-inflow",
        label: "Cash Inflow",
        value: cashInflow,
        formatter: formatDashboardCurrency,
        periodLabel: periodSelection.periodLabel,
        tooltip: "Total debit movement recorded in cash and bank accounts during the selected period.",
        tone: "positive",
      }),
      outflow: metricFromValue({
        key: "cash-outflow",
        label: "Cash Outflow",
        value: cashOutflow,
        formatter: formatDashboardCurrency,
        periodLabel: periodSelection.periodLabel,
        tooltip: "Total credit movement recorded in cash and bank accounts during the selected period.",
        tone: "danger",
      }),
      net: metricFromValue({
        key: "net-cash-flow",
        label: "Net Cash Flow",
        value: netCashFlow,
        formatter: formatDashboardCurrency,
        periodLabel: periodSelection.periodLabel,
        tooltip: "Cash inflow minus cash outflow for the selected period.",
        tone: netCashFlow >= 0 ? "info" : "warning",
      }),
      points: Array.from(cashFlowPointMap.values()),
      href: context.dayBookHref,
    },
    recentActivities,
    quickActions,
    operationalStats,
    isEmpty:
      (periodVoucherCountResult.count ?? 0) === 0 &&
      !hasNonZeroFinancialData(currentFlowRows) &&
      !hasNonZeroFinancialData(currentAsOfRows),
  }
}
