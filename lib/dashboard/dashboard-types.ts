export type DashboardMetricState =
  | "ready"
  | "empty"
  | "unavailable"
  | "configurationRequired"
  | "error"

export type DashboardMetricTone =
  | "neutral"
  | "positive"
  | "warning"
  | "danger"
  | "info"

export type DashboardPeriodKey = "month" | "quarter" | "fiscal-year" | "custom"
export type DashboardCompareKey = "previous-period" | "previous-fiscal-year"

export type DashboardComparison = {
  label: string
  formattedValue: string
  deltaPercent: number | null
  tone: DashboardMetricTone
}

export type DashboardMetric = {
  key: string
  label: string
  formattedValue: string
  rawValue: number | null
  periodLabel: string
  tooltip: string
  tone: DashboardMetricTone
  state: DashboardMetricState
  comparison: DashboardComparison | null
  statusLabel?: string
}

export type DashboardWarning = {
  id: string
  title: string
  description: string
  href?: string
}

export type DashboardExpenseCategory = {
  label: string
  amount: number
  formattedAmount: string
  shareOfExpenses: number | null
  formattedShare: string
}

export type DashboardPeriodSelection = {
  key: DashboardPeriodKey
  label: string
  startDate: string
  endDate: string
  maxDate: string
  periodLabel: string
  asOfLabel: string
  comparison:
    | {
        startDate: string
        endDate: string
        label: string
      }
    | null
  customRange:
    | {
        from: string
        to: string
      }
    | null
  hadValidationIssue: boolean
}

export type DashboardComparisonSelection = {
  key: DashboardCompareKey
  label: string
  options: Array<{
    key: DashboardCompareKey
    label: string
    disabled?: boolean
  }>
}

export type DashboardLinkedValue = {
  label: string
  value: number | null
  formattedValue: string
  href?: string
  meta?: string
}

export type DashboardFinancialSeriesPoint = {
  key: string
  label: string
  income: number
  expense: number
  profit: number
}

export type DashboardCashFlowPoint = {
  label: string
  inflow: number
  outflow: number
  net: number
}

export type DashboardActivityItem = {
  title: string
  description: string
  href?: string
  kind: "voucher" | "info" | "setup"
  amount?: string
  occurredAt?: string
  relativeTime?: string
}

export type DashboardQuickAction = {
  label: string
  description: string
  href?: string
  disabled?: boolean
  disabledReason?: string
}

export type DashboardOperationalStat = {
  key: string
  label: string
  value: string
  helper: string
  tone?: DashboardMetricTone
}

export type OrganizationDashboardViewModel = {
  organization: {
    id: string
    name: string
    typeLabel: string
    tin: string | null
    bin: string | null
    isActive: boolean
  }
  fiscalYear: {
    id: string
    label: string
    startDate: string
    endDate: string
  } | null
  selectedPeriod: DashboardPeriodSelection | null
  comparison: DashboardComparisonSelection
  context: {
    primaryActionHref: string
    manageFiscalYearsHref: string
    dayBookHref: string
    settingsHref: string
    trialBalanceHref: string
    balanceSheetHref: string
    profitLossHref: string
    reportsHref: string
  }
  financialOverview: DashboardMetric[]
  financialSeries: DashboardFinancialSeriesPoint[]
  financialPosition: DashboardMetric[]
  profitAndTax: DashboardMetric[]
  expenses: {
    totalExpenses: DashboardMetric
    topCategories: DashboardExpenseCategory[]
    expenseRatio: DashboardMetric
    reportHref: string
  } | null
  warnings: DashboardWarning[]
  topAccounts: DashboardLinkedValue[]
  cashFlow: {
    inflow: DashboardMetric
    outflow: DashboardMetric
    net: DashboardMetric
    points: DashboardCashFlowPoint[]
    href: string
  }
  recentActivities: DashboardActivityItem[]
  quickActions: DashboardQuickAction[]
  operationalStats: DashboardOperationalStat[]
  isEmpty: boolean
}
