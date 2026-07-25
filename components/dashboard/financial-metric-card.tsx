import { Info, TrendingDown, TrendingUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardMetric } from "@/lib/dashboard/dashboard-types"

const toneStyles = {
  neutral: {
    badge: "bg-surface-subtle text-text-secondary",
    value: "text-text-primary",
  },
  positive: {
    badge: "bg-success-bg text-success-fg",
    value: "text-success-fg",
  },
  warning: {
    badge: "bg-warning-bg text-warning-fg",
    value: "text-warning-fg",
  },
  danger: {
    badge: "bg-danger-bg text-danger-fg",
    value: "text-danger-fg",
  },
  info: {
    badge: "bg-info-bg text-info-fg",
    value: "text-info-fg",
  },
} as const

export function FinancialMetricCard({
  metric,
  icon: Icon,
}: {
  metric: DashboardMetric
  icon: LucideIcon
}) {
  const comparisonTone = metric.comparison ? toneStyles[metric.comparison.tone] : toneStyles.neutral
  const valueTone = toneStyles[metric.tone]

  return (
    <Card className="h-full rounded-[1.5rem] border-border bg-card shadow-surface">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", valueTone.badge)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
                  aria-label={`${metric.label}: ${metric.tooltip}`}
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-72 text-xs leading-5">{metric.tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-text-secondary">{metric.label}</p>
          <p className={cn("type-financial-metric financial-number break-words", valueTone.value)}>
            {metric.formattedValue}
          </p>
          <p className="text-xs text-text-muted">{metric.periodLabel}</p>
        </div>

        <div className="mt-auto min-h-10">
          {metric.comparison ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-page px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  {metric.comparison.label}
                </p>
                <p className="financial-number text-sm text-text-primary">{metric.comparison.formattedValue}</p>
              </div>
              {metric.comparison.deltaPercent != null ? (
                <div className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", comparisonTone.badge)}>
                  {metric.comparison.deltaPercent >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {Math.abs(metric.comparison.deltaPercent).toFixed(1)}%
                </div>
              ) : (
                <span className="text-xs text-text-muted">No trend</span>
              )}
            </div>
          ) : metric.state !== "ready" ? (
            <p className="text-xs leading-5 text-text-muted">
              {metric.state === "configurationRequired"
                ? "Account mapping required before this metric can be calculated."
                : metric.state === "unavailable"
                  ? "This metric is unavailable for the selected period."
                  : "No data is available for this metric yet."}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
