import { Info, TrendingDown, TrendingUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { CSSProperties } from "react"

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

const metricPalette = {
  sales: {
    surface: "var(--primary-soft)",
    border: "var(--primary-border)",
    accent: "var(--primary)",
    accentSoft: "rgba(var(--primary-rgb), 0.08)",
    accentText: "var(--primary)",
  },
  "gp-percent": {
    surface: "var(--success-bg)",
    border: "var(--success-border)",
    accent: "var(--success-icon)",
    accentSoft: "rgba(7, 148, 85, 0.12)",
    accentText: "var(--success-fg)",
  },
  "np-percent": {
    surface: "var(--info-bg)",
    border: "var(--info-border)",
    accent: "var(--info-icon)",
    accentSoft: "rgba(21, 112, 239, 0.12)",
    accentText: "var(--info-fg)",
  },
  "tax-due": {
    surface: "var(--warning-bg)",
    border: "var(--warning-border)",
    accent: "var(--warning-icon)",
    accentSoft: "rgba(220, 104, 3, 0.12)",
    accentText: "var(--warning-fg)",
  },
  "vat-due": {
    surface: "var(--accent-soft)",
    border: "rgba(var(--accent-rgb), 0.2)",
    accent: "var(--accent)",
    accentSoft: "rgba(var(--accent-rgb), 0.1)",
    accentText: "var(--accent)",
  },
  "cash-bank": {
    surface: "rgba(var(--primary-rgb), 0.06)",
    border: "rgba(var(--primary-rgb), 0.18)",
    accent: "var(--primary)",
    accentSoft: "rgba(var(--primary-rgb), 0.1)",
    accentText: "var(--primary)",
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
  const palette = metricPalette[metric.key as keyof typeof metricPalette]
  const cardStyle = palette
    ? ({
        backgroundColor: palette.surface,
        borderColor: palette.border,
      } satisfies CSSProperties)
    : undefined
  const iconStyle = palette
    ? ({
        backgroundColor: palette.accentSoft,
        color: palette.accentText,
      } satisfies CSSProperties)
    : undefined
  const valueStyle = palette
    ? ({
        color: palette.accentText,
      } satisfies CSSProperties)
    : undefined

  return (
    <Card className="relative h-full overflow-hidden rounded-[1.5rem] border shadow-surface" style={cardStyle}>
      {palette ? <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: palette.accent }} aria-hidden="true" /> : null}
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", !palette && valueTone.badge)}
            style={iconStyle}
          >
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
          <p
            className={cn("financial-number break-words text-[2rem] font-semibold leading-none tracking-[-0.04em] md:text-[2.15rem]", !palette && valueTone.value)}
            style={valueStyle}
          >
            {metric.formattedValue}
          </p>
        </div>

        <div className={cn(metric.comparison || metric.state !== "ready" ? "mt-auto" : "mt-0")}>
          {metric.comparison ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-white/70 px-3 py-2 backdrop-blur-[2px]">
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
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
