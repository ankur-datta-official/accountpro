import Link from "next/link"
import {
  ArrowRight,
  BookOpenText,
  Building2,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Landmark,
  Package,
  PlusSquare,
  Settings2,
  TrendingUp,
  Wallet,
} from "lucide-react"
import type { CSSProperties } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  DashboardActivityItem,
  DashboardCashFlowPoint,
  DashboardLinkedValue,
  DashboardMetric,
  DashboardQuickAction,
} from "@/lib/dashboard/dashboard-types"

function SmallMetric({
  metric,
  toneClass,
}: {
  metric: DashboardMetric
  toneClass: string
}) {
  return (
    <div className="rounded-2xl bg-surface-page px-4 py-3">
      <p className="text-xs font-medium text-text-muted">{metric.label}</p>
      <p className={`mt-2 financial-number text-xl font-semibold ${toneClass}`}>{metric.formattedValue}</p>
    </div>
  )
}

export function TopAccountsPanel({
  accounts,
  href,
  asOfLabel,
}: {
  accounts: DashboardLinkedValue[]
  href: string
  asOfLabel?: string
}) {
  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border bg-card shadow-surface">
      <div className="h-1.5 bg-[linear-gradient(90deg,rgba(32,54,80,0.95),rgba(32,54,80,0.25),transparent)]" />
      <CardHeader className="space-y-1 px-5 pb-3 pt-5">
        <CardTitle className="type-section-title text-text-primary">Top Accounts Balance</CardTitle>
        {asOfLabel ? <p className="text-sm text-text-secondary">{asOfLabel}</p> : null}
      </CardHeader>
      <CardContent className="space-y-1 px-5 pb-5">
        {accounts.length ? (
          accounts.map((account) => (
            <Link
              key={account.label}
              href={account.href ?? href}
              className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-surface-page"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-page text-text-secondary">
                  {account.label.includes("Cash") ? (
                    <Wallet className="h-4 w-4" />
                  ) : account.label.includes("Bank") ? (
                    <Landmark className="h-4 w-4" />
                  ) : account.label.includes("Receivable") ? (
                    <FileText className="h-4 w-4" />
                  ) : account.label.includes("Inventory") ? (
                    <Package className="h-4 w-4" />
                  ) : account.label.includes("Payable") ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{account.label}</p>
                  {account.meta ? <p className="mt-0.5 text-xs text-text-muted">{account.meta}</p> : null}
                </div>
              </div>
              <p className="financial-number text-sm font-semibold text-text-primary">{account.formattedValue}</p>
            </Link>
          ))
        ) : (
          <p className="text-sm text-text-muted">No account balances are available yet.</p>
        )}
        <Link href={href} className="inline-flex items-center gap-2 pt-2 text-sm font-semibold text-primary hover:text-primary-hover">
          View Trial Balance
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}

export function CashFlowPanel({
  inflow,
  outflow,
  net,
  points,
  href,
  subtitle,
}: {
  inflow: DashboardMetric
  outflow: DashboardMetric
  net: DashboardMetric
  points: DashboardCashFlowPoint[]
  href: string
  subtitle?: string
}) {
  const maxAbs = Math.max(1, ...points.map((point) => Math.abs(point.net)))

  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border bg-card shadow-surface">
      <div className="h-1.5 bg-[linear-gradient(90deg,rgba(23,92,211,0.95),rgba(23,92,211,0.25),transparent)]" />
      <CardHeader className="space-y-1 px-5 pb-3 pt-5">
        <CardTitle className="type-section-title text-text-primary">Cash Flow Summary</CardTitle>
        {subtitle ? <p className="text-sm text-text-secondary">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="grid gap-2.5 md:grid-cols-3">
          <SmallMetric metric={inflow} toneClass="text-success-fg" />
          <SmallMetric metric={outflow} toneClass="text-danger-fg" />
          <SmallMetric metric={net} toneClass="text-info-fg" />
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-page p-4">
          <div className="flex h-24 items-end gap-2.5">
            {points.length ? (
              points.map((point) => {
                const height = `${Math.max(8, (Math.abs(point.net) / maxAbs) * 100)}%`
                return (
                  <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-full items-end">
                      <div
                        className={`w-3 rounded-full ${point.net >= 0 ? "bg-info-fg" : "bg-warning-icon"}`}
                        style={{ height }}
                        title={`${point.label}: ${point.net}`}
                      />
                    </div>
                    <span className="text-[11px] text-text-muted">{point.label}</span>
                  </div>
                )
              })
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-text-muted">
                No cash flow trend is available yet.
              </div>
            )}
          </div>
        </div>

        <Link href={href} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover">
          View Cash Movement
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}

export function RecentActivitiesPanel({
  items,
}: {
  items: DashboardActivityItem[]
}) {
  const iconByKind = {
    voucher: FileText,
    info: Clock3,
    setup: BookOpenText,
  }

  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border bg-card shadow-surface">
      <div className="h-1.5 bg-[linear-gradient(90deg,rgba(32,54,80,0.95),rgba(32,54,80,0.25),transparent)]" />
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="type-section-title text-text-primary">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => {
          const Icon = iconByKind[item.kind]
          return (
            <Link
              key={`${item.kind}-${item.href ?? "no-href"}-${item.title}-${index}`}
              href={item.href ?? "#"}
              className="flex items-start gap-3 rounded-2xl border border-border-subtle px-4 py-4 transition-colors hover:bg-surface-page"
            >
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-page text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{item.title}</p>
                <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function QuickActionsPanel({
  actions,
}: {
  actions: DashboardQuickAction[]
}) {
  const iconMap: Record<string, typeof PlusSquare> = {
    "Add New Voucher": PlusSquare,
    "Add Account Head": FileSpreadsheet,
    "Receive Payment": HandCoins,
    "Make Payment": CreditCard,
    "Manage Users": BookOpenText,
    "Organization Settings": Settings2,
  }
  const actionPalette: Record<
    string,
    {
      cardStyle: CSSProperties
      iconStyle: CSSProperties
      glowStyle: CSSProperties
      titleClassName: string
    }
  > = {
    "Add New Voucher": {
      cardStyle: {
        background:
          "linear-gradient(135deg, rgba(var(--primary-rgb), 0.11) 0%, rgba(255, 255, 255, 0.98) 72%)",
        borderColor: "rgba(var(--primary-rgb), 0.18)",
      },
      iconStyle: {
        backgroundColor: "rgba(var(--primary-rgb), 0.14)",
        color: "var(--primary)",
      },
      glowStyle: {
        background: "radial-gradient(circle at top left, rgba(var(--primary-rgb), 0.2), transparent 70%)",
      },
      titleClassName: "text-primary",
    },
    "Add Account Head": {
      cardStyle: {
        background:
          "linear-gradient(135deg, rgba(var(--accent-rgb), 0.12) 0%, rgba(255, 255, 255, 0.98) 72%)",
        borderColor: "rgba(var(--accent-rgb), 0.22)",
      },
      iconStyle: {
        backgroundColor: "rgba(var(--accent-rgb), 0.16)",
        color: "var(--accent)",
      },
      glowStyle: {
        background: "radial-gradient(circle at top left, rgba(var(--accent-rgb), 0.22), transparent 70%)",
      },
      titleClassName: "text-accent",
    },
    "Receive Payment": {
      cardStyle: {
        background: "linear-gradient(135deg, rgba(7, 148, 85, 0.12) 0%, rgba(255, 255, 255, 0.98) 72%)",
        borderColor: "rgba(7, 148, 85, 0.2)",
      },
      iconStyle: {
        backgroundColor: "rgba(7, 148, 85, 0.14)",
        color: "var(--success-icon)",
      },
      glowStyle: {
        background: "radial-gradient(circle at top left, rgba(7, 148, 85, 0.22), transparent 70%)",
      },
      titleClassName: "text-success-fg",
    },
    "Make Payment": {
      cardStyle: {
        background: "linear-gradient(135deg, rgba(220, 104, 3, 0.12) 0%, rgba(255, 255, 255, 0.98) 72%)",
        borderColor: "rgba(220, 104, 3, 0.2)",
      },
      iconStyle: {
        backgroundColor: "rgba(220, 104, 3, 0.14)",
        color: "var(--warning-icon)",
      },
      glowStyle: {
        background: "radial-gradient(circle at top left, rgba(220, 104, 3, 0.22), transparent 70%)",
      },
      titleClassName: "text-warning-fg",
    },
    "Manage Users": {
      cardStyle: {
        background: "linear-gradient(135deg, rgba(21, 112, 239, 0.12) 0%, rgba(255, 255, 255, 0.98) 72%)",
        borderColor: "rgba(21, 112, 239, 0.2)",
      },
      iconStyle: {
        backgroundColor: "rgba(21, 112, 239, 0.14)",
        color: "var(--info-icon)",
      },
      glowStyle: {
        background: "radial-gradient(circle at top left, rgba(21, 112, 239, 0.22), transparent 70%)",
      },
      titleClassName: "text-info-fg",
    },
    "Organization Settings": {
      cardStyle: {
        background: "linear-gradient(135deg, rgba(104, 117, 135, 0.13) 0%, rgba(255, 255, 255, 0.98) 72%)",
        borderColor: "rgba(104, 117, 135, 0.2)",
      },
      iconStyle: {
        backgroundColor: "rgba(104, 117, 135, 0.14)",
        color: "var(--text-secondary)",
      },
      glowStyle: {
        background: "radial-gradient(circle at top left, rgba(104, 117, 135, 0.2), transparent 70%)",
      },
      titleClassName: "text-text-primary",
    },
  }

  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border bg-card shadow-surface">
      <div className="h-1.5 bg-[linear-gradient(90deg,rgba(20,139,121,0.95),rgba(20,139,121,0.25),transparent)]" />
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="type-section-title text-text-primary">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const Icon = iconMap[action.label] ?? TrendingUp
          const palette = actionPalette[action.label] ?? {
            cardStyle: {
              background:
                "linear-gradient(135deg, rgba(var(--primary-rgb), 0.08) 0%, rgba(255, 255, 255, 0.98) 72%)",
              borderColor: "rgba(var(--primary-rgb), 0.14)",
            },
            iconStyle: {
              backgroundColor: "rgba(var(--primary-rgb), 0.12)",
              color: "var(--primary)",
            },
            glowStyle: {
              background: "radial-gradient(circle at top left, rgba(var(--primary-rgb), 0.18), transparent 70%)",
            },
            titleClassName: "text-primary",
          }
          return action.href && !action.disabled ? (
            <Link
              key={action.label}
              href={action.href}
              className="group relative overflow-hidden rounded-2xl border px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,24,40,0.12)]"
              style={palette.cardStyle}
            >
              <div className="pointer-events-none absolute inset-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100" style={palette.glowStyle} />
              <div
                className="relative flex h-10 w-10 items-center justify-center rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform duration-200 group-hover:scale-105"
                style={palette.iconStyle}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className={cn("relative mt-4 text-sm font-semibold", palette.titleClassName)}>{action.label}</p>
              <p className="relative mt-1 text-sm text-text-secondary">{action.description}</p>
            </Link>
          ) : (
            <div
              key={action.label}
              className="relative overflow-hidden rounded-2xl border border-dashed px-4 py-4 opacity-80"
              style={palette.cardStyle}
              title={action.disabledReason}
            >
              <div className="pointer-events-none absolute inset-0 opacity-60" style={palette.glowStyle} />
              <div
                className="relative flex h-10 w-10 items-center justify-center rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                style={palette.iconStyle}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className={cn("relative mt-4 text-sm font-semibold", palette.titleClassName)}>{action.label}</p>
              <p className="relative mt-1 text-sm text-text-secondary">{action.description}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
