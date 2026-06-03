import type { LucideIcon } from "lucide-react"
import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description: string
  eyebrow?: string
  badge?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  eyebrow,
  badge,
  icon: Icon,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5",
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {Icon ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">
                <Icon className="h-4 w-4" />
              </div>
            ) : null}
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h1>
            {badge ? (
              <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                {badge}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}

type MetricCardProps = {
  label: string
  value: React.ReactNode
  detail?: string
  tone?: "default" | "success" | "warning" | "danger" | "info"
  icon?: LucideIcon
}

const toneClass = {
  default: "bg-slate-50 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
}

export function MetricCard({ label, value, detail, tone = "default", icon: Icon }: MetricCardProps) {
  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <div className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950">
              {value}
            </div>
          </div>
          {Icon ? (
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneClass[tone])}>
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
        </div>
        {detail ? <p className="mt-2 text-sm leading-5 text-slate-500">{detail}</p> : null}
      </CardContent>
    </Card>
  )
}

export function FilterPanel({
  title = "Filters",
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("rounded-xl border-slate-200 bg-white shadow-sm", className)}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export function ActionBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {children}
    </div>
  )
}
