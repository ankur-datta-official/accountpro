import { notFound } from "next/navigation"
import {
  Activity,
  BadgePercent,
  BriefcaseBusiness,
  Landmark,
  Percent,
  Receipt,
} from "lucide-react"

import { DashboardComparisonSelector } from "@/components/dashboard/dashboard-comparison-selector"
import { DashboardConfigurationWarning } from "@/components/dashboard/dashboard-configuration-warning"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import { DashboardPeriodSelector } from "@/components/dashboard/dashboard-period-selector"
import {
  CashFlowPanel,
  TopAccountsPanel,
} from "@/components/dashboard/dashboard-support-panels"
import {
  DashboardSummaryPanel,
  ExpensesSummaryPanel,
} from "@/components/dashboard/dashboard-summary-panel"
import { FinancialMetricCard } from "@/components/dashboard/financial-metric-card"
import { OrganizationContextBar } from "@/components/dashboard/organization-context-bar"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { getOrganizationDashboard } from "@/lib/dashboard/get-organization-dashboard"

const overviewIcons = {
  sales: Activity,
  "gp-percent": BadgePercent,
  "np-percent": Percent,
  "tax-due": Receipt,
  "vat-due": BriefcaseBusiness,
  "cash-bank": Landmark,
} as const

export default async function ClientDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{
    fiscalYear?: string
    period?: string
    from?: string
    to?: string
    compare?: string
  }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const { client, routeSegment, selectedFiscalYear, fiscalYears } = await getClientRouteContext({
    clientId: resolvedParams.clientId,
    fiscalYearId: resolvedSearchParams.fiscalYear,
  })

  if (!client || !routeSegment) {
    notFound()
  }

  const dashboard = await getOrganizationDashboard({
    client,
    routeSegment,
    selectedFiscalYear,
    fiscalYears,
    searchParams: resolvedSearchParams,
  })

  return (
    <div className="space-y-6">
      <OrganizationContextBar dashboard={dashboard} />

      <section className="space-y-4">
        <div className="rounded-[1.9rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,249,252,0.92))] p-5 shadow-surface sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="type-section-title text-text-primary">Financial Overview</h2>
                <p className="mt-1 text-sm text-text-secondary">Key financial snapshot for</p>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
                {dashboard.selectedPeriod ? (
                  <DashboardPeriodSelector
                    value={dashboard.selectedPeriod.key}
                    from={dashboard.selectedPeriod.customRange?.from ?? dashboard.selectedPeriod.startDate}
                    to={dashboard.selectedPeriod.customRange?.to ?? dashboard.selectedPeriod.endDate}
                    maxDate={dashboard.selectedPeriod.maxDate}
                  />
                ) : null}
                <DashboardComparisonSelector value={dashboard.comparison.key} options={dashboard.comparison.options} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-6">
            {dashboard.financialOverview.map((metric) => {
              const Icon = overviewIcons[metric.key as keyof typeof overviewIcons] ?? Activity
              return <FinancialMetricCard key={metric.key} metric={metric} icon={Icon} />
            })}
          </div>
        </div>
      </section>

      <DashboardConfigurationWarning warnings={dashboard.warnings} />

      {dashboard.isEmpty ? <DashboardEmptyState actionHref={dashboard.context.primaryActionHref} /> : null}

      <section className="grid gap-6 xl:grid-cols-3">
        <DashboardSummaryPanel
          title="Financial Position Summary"
          subtitle={dashboard.selectedPeriod?.asOfLabel}
          metrics={dashboard.financialPosition}
          linkHref={dashboard.context.balanceSheetHref}
          linkLabel="View Balance Sheet"
        />
        <DashboardSummaryPanel
          title="Profit & Tax Summary"
          subtitle={dashboard.selectedPeriod?.periodLabel}
          metrics={dashboard.profitAndTax}
          linkHref={dashboard.context.profitLossHref}
          linkLabel="View Profit & Loss"
        />
        {dashboard.expenses ? (
          <ExpensesSummaryPanel
            title="Expenses Summary"
            subtitle={dashboard.selectedPeriod?.periodLabel}
            totalExpenses={dashboard.expenses.totalExpenses}
            categories={dashboard.expenses.topCategories}
            expenseRatio={dashboard.expenses.expenseRatio}
            reportHref={dashboard.expenses.reportHref}
          />
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <TopAccountsPanel
          accounts={dashboard.topAccounts}
          href={dashboard.context.trialBalanceHref}
          asOfLabel={dashboard.selectedPeriod?.asOfLabel}
        />
        <CashFlowPanel
          inflow={dashboard.cashFlow.inflow}
          outflow={dashboard.cashFlow.outflow}
          net={dashboard.cashFlow.net}
          points={dashboard.cashFlow.points}
          href={dashboard.cashFlow.href}
          subtitle={dashboard.selectedPeriod?.periodLabel}
        />
      </section>
    </div>
  )
}
