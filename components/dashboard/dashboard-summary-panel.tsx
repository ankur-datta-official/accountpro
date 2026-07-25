import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardExpenseCategory, DashboardMetric } from "@/lib/dashboard/dashboard-types"

function metricToneClass(metric: DashboardMetric) {
  switch (metric.tone) {
    case "positive":
      return "text-success-fg"
    case "warning":
      return "text-warning-fg"
    case "danger":
      return "text-danger-fg"
    case "info":
      return "text-info-fg"
    default:
      return "text-text-primary"
  }
}

export function DashboardSummaryPanel({
  title,
  subtitle,
  metrics,
  footer,
  linkHref,
  linkLabel,
}: {
  title: string
  subtitle?: string
  metrics: DashboardMetric[]
  footer?: React.ReactNode
  linkHref?: string
  linkLabel?: string
}) {
  return (
    <Card className="h-full overflow-hidden rounded-[1.75rem] border-border bg-card shadow-surface">
      <div className="h-1.5 bg-[linear-gradient(90deg,rgba(32,54,80,0.95),rgba(32,54,80,0.25),transparent)]" />
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="type-section-title text-text-primary">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-text-secondary">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className="flex items-start justify-between gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-page"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-secondary">{metric.label}</p>
              <p className="mt-1 text-xs text-text-muted">{metric.periodLabel}</p>
            </div>
            <div className="text-right">
              <p className={cn("financial-number text-sm font-semibold", metricToneClass(metric))}>
                {metric.formattedValue}
              </p>
              {metric.state !== "ready" ? (
                <p className="mt-1 text-xs text-text-muted">
                  {metric.state === "configurationRequired" ? "Configuration required" : "Unavailable"}
                </p>
              ) : null}
            </div>
          </div>
        ))}
        {footer}
        {linkHref && linkLabel ? (
          <Link
            href={linkHref}
            className="inline-flex items-center gap-2 pt-2 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            {linkLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function ExpensesSummaryPanel({
  title,
  subtitle,
  totalExpenses,
  categories,
  expenseRatio,
  reportHref,
}: {
  title: string
  subtitle?: string
  totalExpenses: DashboardMetric
  categories: DashboardExpenseCategory[]
  expenseRatio: DashboardMetric
  reportHref: string
}) {
  return (
    <Card className="h-full overflow-hidden rounded-[1.75rem] border-border bg-card shadow-surface">
      <div className="h-1.5 bg-[linear-gradient(90deg,rgba(20,139,121,0.95),rgba(20,139,121,0.25),transparent)]" />
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="type-section-title text-text-primary">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-text-secondary">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-2xl bg-surface-page px-4 py-4">
          <div>
            <p className="text-sm font-medium text-text-secondary">{totalExpenses.label}</p>
            <p className="mt-1 text-xs text-text-muted">{totalExpenses.periodLabel}</p>
          </div>
          <p className="financial-number text-sm font-semibold text-warning-fg">{totalExpenses.formattedValue}</p>
        </div>

        <div className="space-y-3">
          {categories.length ? (
            categories.map((category) => (
              <div key={category.label} className="flex items-start justify-between gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-page">
                <p className="min-w-0 text-sm text-text-primary">{category.label}</p>
                <div className="text-right">
                  <p className="financial-number text-sm font-semibold text-text-primary">{category.formattedAmount}</p>
                  <p className="text-xs text-text-muted">{category.formattedShare}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-muted">No posted expense categories are available for the selected period.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface-page p-4">
          <p className="text-sm font-medium text-text-secondary">{expenseRatio.label}</p>
          <p className="mt-2 type-financial-metric financial-number text-info-fg">{expenseRatio.formattedValue}</p>
          <p className="mt-1 text-xs text-text-muted">of Sales / Turnover</p>
        </div>

        <Link
          href={reportHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          View full Profit &amp; Loss
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
