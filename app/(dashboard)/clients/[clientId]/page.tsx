import { notFound } from "next/navigation"
import Link from "next/link"
import {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  BadgePercent,
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  Layers3,
  Percent,
  Receipt,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react"
import type { CSSProperties } from "react"
import type { LucideIcon } from "lucide-react"

import { ClientFiscalYearSelect } from "@/components/clients/client-fiscal-year-select"
import { DashboardConfigurationWarning } from "@/components/dashboard/dashboard-configuration-warning"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { getOrganizationDashboard } from "@/lib/dashboard/get-organization-dashboard"
import type {
  DashboardFinancialSeriesPoint,
  DashboardMetric,
  DashboardOperationalStat,
} from "@/lib/dashboard/dashboard-types"

const overviewIcons = {
  sales: Activity,
  "gp-percent": BadgePercent,
  "np-percent": Percent,
  "cash-bank": WalletCards,
  "tax-due": Receipt,
  "vat-due": BriefcaseBusiness,
} as const

const statIcons = [ReceiptText, Layers3, Users, CreditCard, Layers3, Activity, CalendarDays] as const

const metricPalette = {
  sales: {
    accent: "var(--info-fg)",
    iconBg: "rgba(21,112,239,0.1)",
  },
  "gp-percent": {
    accent: "var(--success-fg)",
    iconBg: "rgba(7,148,85,0.1)",
  },
  "np-percent": {
    accent: "var(--accent)",
    iconBg: "rgba(var(--accent-rgb),0.1)",
  },
  "cash-bank": {
    accent: "var(--primary)",
    iconBg: "rgba(var(--primary-rgb),0.08)",
  },
  "tax-due": {
    accent: "var(--danger-fg)",
    iconBg: "rgba(217,45,32,0.08)",
  },
  "vat-due": {
    accent: "var(--warning-fg)",
    iconBg: "rgba(220,104,3,0.08)",
  },
} as const

function findMetric(metrics: DashboardMetric[], key: string) {
  return metrics.find((metric) => metric.key === key)
}

function formatCompactDelta(metric: DashboardMetric) {
  if (metric.comparison?.deltaPercent == null) {
    return "\u2014"
  }

  const prefix = metric.comparison.deltaPercent > 0 ? "+" : ""
  return `${prefix}${metric.comparison.deltaPercent.toFixed(1)}%`
}

function buildPolylinePoints(values: number[], min: number, max: number) {
  if (!values.length) return ""

  const range = max - min || 1

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100
      const y = 100 - ((value - min) / range) * 100
      return `${x},${y}`
    })
    .join(" ")
}

function buildChartCoordinates(values: number[], min: number, max: number) {
  if (!values.length) return []

  const range = max - min || 1

  return values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100
    const y = 100 - ((value - min) / range) * 100
    return { x, y }
  })
}

function getYAxisLabels(values: number[]) {
  const max = Math.max(...values, 0)
  const steps = 4
  const roundedMax = max <= 0 ? 1000 : Math.ceil(max / 1000) * 1000

  return Array.from({ length: steps + 1 }, (_, index) => {
    const value = (roundedMax / steps) * (steps - index)
    if (value >= 1000) return `${Math.round(value / 1000)}K`
    return `${Math.round(value)}`
  })
}

function OverviewMetricCard({
  metric,
  icon: Icon,
}: {
  metric: DashboardMetric
  icon: LucideIcon
}) {
  const palette = metricPalette[metric.key as keyof typeof metricPalette]

  return (
    <Card className="h-full rounded-[1.35rem] border-border bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <CardContent className="flex h-full min-h-[112px] flex-col justify-between p-3.5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={
              palette
                ? ({
                    color: palette.accent,
                    backgroundColor: palette.iconBg,
                  } satisfies CSSProperties)
                : undefined
            }
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
            <p className="truncate pt-1 text-sm font-medium leading-none text-text-secondary">{metric.label}</p>
            <p className="financial-number mt-4 text-[1.25rem] font-semibold tracking-[-0.03em] text-text-primary xl:text-[1.4rem]">
              {metric.formattedValue}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PeriodControlCard({
  primaryActionHref,
}: {
  primaryActionHref: string
}) {
  return (
    <Card className="h-full rounded-[1.35rem] border-border bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <CardContent className="flex h-full min-h-[112px] items-center p-3">
        <div className="grid w-full gap-2">
          <Button
            asChild
            className="h-8 w-full justify-center rounded-lg bg-primary px-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Link href={primaryActionHref}>+ Add New Voucher</Link>
          </Button>
          <div className="rounded-lg border border-border bg-surface-page px-2 py-1">
            <ClientFiscalYearSelect className="w-full border-0 bg-transparent p-0 shadow-none" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FinancialOverviewPanel({
  points,
  incomeMetric,
  expenseMetric,
  profitMetric,
}: {
  points: DashboardFinancialSeriesPoint[]
  incomeMetric?: DashboardMetric
  expenseMetric?: DashboardMetric
  profitMetric?: DashboardMetric
}) {
  const chartPoints = points.slice(-12)
  const incomeValues = chartPoints.map((point) => point.income)
  const expenseValues = chartPoints.map((point) => point.expense)
  const profitValues = chartPoints.map((point) => point.profit)
  const allSeriesValues = [...incomeValues, ...expenseValues, ...profitValues]
  const chartMax = Math.max(...allSeriesValues, 0)
  const yLabels = getYAxisLabels(allSeriesValues)
  const incomeCoords = buildChartCoordinates(incomeValues, 0, chartMax)
  const expenseCoords = buildChartCoordinates(expenseValues, 0, chartMax)
  const profitCoords = buildChartCoordinates(profitValues, 0, chartMax)

  return (
    <Card className="flex h-full w-full flex-col overflow-hidden rounded-[1.55rem] border border-border-subtle bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <CardHeader className="px-5 pb-2 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-[0.82rem] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Financial Overview
            </CardTitle>
            <div className="rounded-full border border-border-subtle bg-surface-page px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
              This Fiscal Year
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-text-secondary">
            <Legend color="var(--success-fg)" label="Income" />
            <Legend color="var(--danger-fg)" label="Expense" />
            <Legend color="var(--info-fg)" label="Profit" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] px-5 pb-4 pt-1">
        <div className="grid min-h-0 w-full grid-cols-[28px_minmax(0,1fr)] gap-3 xl:grid-cols-[32px_minmax(0,1fr)]">
          <div className="flex flex-col justify-between pb-6 text-right text-[10px] text-text-muted">
            {yLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="min-h-0">
            <div className="relative h-[180px] xl:h-[200px]">
              <div className="absolute inset-0 flex flex-col justify-between">
                {yLabels.map((label) => (
                  <div key={`grid-${label}`} className="border-t border-dashed border-border-subtle" />
                ))}
              </div>

              {chartPoints.length ? (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="relative z-[1] h-full w-full">
                  <polyline
                    fill="none"
                    stroke="var(--success-fg)"
                    strokeWidth="1.1"
                    points={buildPolylinePoints(incomeValues, 0, chartMax)}
                  />
                  <polyline
                    fill="none"
                    stroke="var(--danger-fg)"
                    strokeWidth="1.1"
                    points={buildPolylinePoints(expenseValues, 0, chartMax)}
                  />
                  <polyline
                    fill="none"
                    stroke="var(--info-fg)"
                    strokeWidth="1.1"
                    points={buildPolylinePoints(profitValues, 0, chartMax)}
                  />
                  {incomeCoords.map((point, index) => (
                    <circle key={`income-${index}`} cx={point.x} cy={point.y} r="1.15" fill="var(--success-fg)" />
                  ))}
                  {expenseCoords.map((point, index) => (
                    <circle key={`expense-${index}`} cx={point.x} cy={point.y} r="1.15" fill="var(--danger-fg)" />
                  ))}
                  {profitCoords.map((point, index) => (
                    <circle key={`profit-${index}`} cx={point.x} cy={point.y} r="1.15" fill="var(--info-fg)" />
                  ))}
                </svg>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-surface-page text-sm text-text-muted">
                  No financial chart data is available yet.
                </div>
              )}
            </div>

            <div
              className="mt-2 grid gap-1 overflow-hidden text-center text-[11px] text-text-secondary"
              style={{ gridTemplateColumns: `repeat(${Math.max(chartPoints.length, 1)}, minmax(0, 1fr))` }}
            >
              {chartPoints.map((point) => (
                <span key={point.key} className="truncate">
                  {point.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-0 overflow-hidden rounded-[1.15rem] border border-border-subtle bg-surface-page/40 sm:grid-cols-3">
          <SummaryNumber label="Income" metric={incomeMetric} toneClass="text-success-fg" />
          <SummaryNumber label="Expense" metric={expenseMetric} toneClass="text-danger-fg" />
          <SummaryNumber label="Profit" metric={profitMetric} toneClass="text-info-fg" />
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryNumber({
  label,
  metric,
  toneClass,
}: {
  label: string
  metric?: DashboardMetric
  toneClass: string
}) {
  return (
    <div className="min-w-0">
      <div className="px-5 py-3.5 sm:border-r sm:border-border-subtle last:sm:border-r-0">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", toneClass === "text-success-fg" ? "bg-success-fg" : toneClass === "text-danger-fg" ? "bg-danger-fg" : "bg-info-fg")} />
          <p className="truncate text-sm text-text-secondary">{label}</p>
        </div>
        <p className={cn("financial-number mt-1.5 truncate text-[1.05rem] font-semibold text-text-primary xl:text-[1.12rem]", toneClass)}>
          {metric?.formattedValue ?? "\u2014"}
        </p>
      </div>
    </div>
  )
}

function CashFlowSummaryPanel({
  inflow,
  outflow,
  net,
}: {
  inflow: DashboardMetric
  outflow: DashboardMetric
  net: DashboardMetric
}) {
  const inflowValue = Math.max(0, inflow.rawValue ?? 0)
  const outflowValue = Math.max(0, outflow.rawValue ?? 0)
  const total = inflowValue + outflowValue
  const inflowShare = total > 0 ? (inflowValue / total) * 100 : 0
  const outflowShare = total > 0 ? (outflowValue / total) * 100 : 0
  const inflowAngle = total > 0 ? (inflowValue / total) * 360 : 180
  const neutralChart = total === 0
  const inflowCount = inflowValue > 0 ? 2 : 0
  const outflowCount = outflowValue > 0 ? 1 : 0

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-[1.55rem] border border-border-subtle bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <CardHeader className="px-5 pb-2 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-[0.82rem] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Cash Flow Summary
            </CardTitle>
            <div className="rounded-full border border-border-subtle bg-surface-page px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
              This Fiscal Year
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CashActionButton icon={ArrowDownRight} />
            <CashActionButton icon={ArrowUpRight} />
            <CashActionButton icon={ReceiptText} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid min-h-0 flex-1 items-center gap-4 px-5 pb-5 pt-1 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:border-r xl:border-border-subtle xl:pr-5">
          <div className="space-y-1.5">
            <p className="text-[0.82rem] font-medium text-text-secondary">Net Cash Flow</p>
            <div className="flex items-center gap-3">
              <p className="financial-number text-[1.05rem] font-semibold text-text-primary">{net.formattedValue}</p>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success-bg text-success-fg shadow-[0_8px_18px_rgba(7,148,85,0.12)]">
                <ArrowDownRight className="h-4.5 w-4.5" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <CashFlowTextMetric
              title={`Inflow (${inflowCount})`}
              value={inflow.formattedValue}
              toneClass="text-success-fg"
            />
            <CashFlowTextMetric
              title={`Outflow (${outflowCount})`}
              value={outflow.formattedValue}
              toneClass="text-danger-fg"
            />
          </div>
        </div>

        <div className="min-w-0 flex flex-col items-center justify-center xl:border-r xl:border-border-subtle xl:px-5">
          <div
            className="relative flex h-[11.2rem] w-[11.2rem] items-center justify-center rounded-full xl:h-[12.2rem] xl:w-[12.2rem]"
            style={
              {
                background: neutralChart
                  ? "conic-gradient(rgba(148,163,184,0.35) 0deg 360deg)"
                  : `conic-gradient(var(--success-fg) 0deg ${inflowAngle}deg, #ff3b30 ${inflowAngle}deg 360deg)`,
              } satisfies CSSProperties
            }
          >
            <div className="flex h-[7.8rem] w-[7.8rem] xl:h-[8.7rem] xl:w-[8.7rem] flex-col items-center justify-center rounded-full bg-white px-3 text-center shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)]">
              <p className="text-[0.82rem] text-text-secondary">Net Cash Flow</p>
              <p className="financial-number mt-1.5 max-w-full text-[1.05rem] font-semibold text-text-primary">{net.formattedValue}</p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 content-center gap-4 xl:pl-1">
          <CashFlowSidePill
            icon={ArrowDownRight}
            title={`Inflow (${inflowCount})`}
            value={inflow.formattedValue}
            share={neutralChart ? "0%" : `${inflowShare.toFixed(0)}%`}
            tone="success"
          />
          <CashFlowSidePill
            icon={ArrowUpRight}
            title={`Outflow (${outflowCount})`}
            value={outflow.formattedValue}
            share={neutralChart ? "0%" : `${outflowShare.toFixed(0)}%`}
            tone="danger"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function CashActionButton({
  icon: Icon,
}: {
  icon: LucideIcon
}) {
  return (
    <button
      type="button"
      className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-border-subtle bg-white text-text-primary shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition-colors hover:bg-surface-page"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function CashFlowTextMetric({
  title,
  value,
  toneClass,
}: {
  title: string
  value: string
  toneClass: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", toneClass === "text-success-fg" ? "bg-success-fg" : "bg-danger-fg")} />
        <p className={cn("truncate text-[0.92rem] font-medium", toneClass)}>{title}</p>
      </div>
      <p className="financial-number mt-1.5 pl-[1.15rem] text-[1rem] font-semibold text-text-primary">{value}</p>
    </div>
  )
}

function CashFlowSidePill({
  icon: Icon,
  title,
  value,
  share,
  tone,
}: {
  icon: LucideIcon
  title: string
  value: string
  share: string
  tone: "success" | "danger"
}) {
  const toneClasses =
    tone === "success"
      ? {
          chip: "bg-success-bg text-success-fg",
          title: "text-success-fg",
        }
      : {
          chip: "bg-danger-bg text-danger-fg",
          title: "text-danger-fg",
        }

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[1.15rem] border border-border-subtle bg-white px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", toneClasses.chip)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className={cn("truncate text-[0.92rem] font-medium", toneClasses.title)}>{title}</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <p className="financial-number text-[1rem] font-semibold text-text-primary">{value}</p>
          <p className="text-[0.82rem] text-text-secondary">({share})</p>
        </div>
      </div>
    </div>
  )
}

function OperationalStatsStrip({
  stats,
}: {
  stats: DashboardOperationalStat[]
}) {
  return (
    <Card className="overflow-hidden rounded-[1.45rem] border-border bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      <CardContent className="grid gap-1.5 p-2.5 md:grid-cols-2 xl:grid-cols-7 xl:gap-0 xl:p-0">
        {stats.map((stat, index) => {
          const Icon = statIcons[index] ?? Activity
          return (
            <div
              key={stat.key}
              className={cn(
                "flex min-w-0 items-start gap-2 rounded-2xl px-3 py-2.5 xl:min-h-[90px] xl:rounded-none xl:px-3",
                index !== stats.length - 1 && "xl:border-r xl:border-border-subtle"
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-page text-primary">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className={cn("financial-number truncate text-base font-semibold", stat.tone === "positive" ? "text-success-fg" : stat.tone === "warning" ? "text-warning-fg" : "text-text-primary")}>
                  {stat.value}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-4 text-text-primary">{stat.label}</p>
                <p className={cn("mt-0.5 line-clamp-2 text-[11px] leading-4", stat.tone === "positive" ? "text-success-fg" : "text-text-secondary")}>
                  {stat.helper}
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function Legend({
  color,
  label,
}: {
  color: string
  label: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate leading-none">{label}</span>
    </div>
  )
}

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

  const incomeMetric = findMetric(dashboard.profitAndTax, "summary-sales")
  const expenseMetric = dashboard.expenses?.totalExpenses
  const profitMetric = findMetric(dashboard.profitAndTax, "summary-net-profit")
  const overviewMetrics = dashboard.financialOverview.filter((metric) => metric.key !== "vat-due")

  return (
    <div className="flex flex-col gap-3 xl:h-[calc(100vh-6.35rem)] xl:min-h-0 xl:overflow-hidden">
      <DashboardConfigurationWarning warnings={dashboard.warnings} />

      {dashboard.isEmpty ? <DashboardEmptyState actionHref={dashboard.context.primaryActionHref} /> : null}

      {!dashboard.isEmpty ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:min-h-[112px] xl:grid-cols-6">
            {overviewMetrics.map((metric) => {
              const Icon = overviewIcons[metric.key as keyof typeof overviewIcons] ?? Activity
              return <OverviewMetricCard key={metric.key} metric={metric} icon={Icon} />
            })}
            {dashboard.selectedPeriod ? (
              <PeriodControlCard
                primaryActionHref={dashboard.context.primaryActionHref}
              />
            ) : null}
          </section>

          <div className="grid min-h-0 flex-1 items-stretch gap-3 xl:h-[300px] xl:grid-cols-2">
            <div className="min-h-0 xl:h-full">
              <FinancialOverviewPanel
                points={dashboard.financialSeries}
                incomeMetric={incomeMetric}
                expenseMetric={expenseMetric}
                profitMetric={profitMetric}
              />
            </div>

            <div className="min-h-0 xl:h-full">
              <CashFlowSummaryPanel
                inflow={dashboard.cashFlow.inflow}
                outflow={dashboard.cashFlow.outflow}
                net={dashboard.cashFlow.net}
              />
            </div>
          </div>

          <div className="min-h-0 xl:h-[90px]">
            <OperationalStatsStrip stats={dashboard.operationalStats} />
          </div>
        </>
      ) : null}
    </div>
  )
}
