import Link from "next/link"
import { Building2, CalendarDays, FilePlus2, FolderClock, ReceiptText, Settings2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ClientFiscalYearSelect } from "@/components/clients/client-fiscal-year-select"
import type { OrganizationDashboardViewModel } from "@/lib/dashboard/dashboard-types"

export function OrganizationContextBar({
  dashboard,
}: {
  dashboard: OrganizationDashboardViewModel
}) {
  const fiscalYear = dashboard.fiscalYear

  return (
    <Card className="rounded-[1.75rem] border-border bg-card shadow-surface">
      <CardContent className="flex flex-col gap-6 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-info-bg text-info-fg">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="type-page-title truncate text-text-primary" title={dashboard.organization.name}>
                  {dashboard.organization.name}
                </h1>
                <Badge
                  className={
                    dashboard.organization.isActive
                      ? "rounded-full border border-success-border bg-success-bg px-3 py-1 text-success-fg hover:bg-success-bg"
                      : "rounded-full border border-border bg-surface-subtle px-3 py-1 text-text-secondary hover:bg-surface-subtle"
                  }
                >
                  {dashboard.organization.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-text-secondary">{dashboard.organization.typeLabel}</p>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border-subtle bg-transparent px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">TIN</dt>
              <dd className="mt-1 text-sm font-medium text-text-primary">
                {dashboard.organization.tin || "Not configured"}
              </dd>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-transparent px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">BIN</dt>
              <dd className="mt-1 text-sm font-medium text-text-primary">
                {dashboard.organization.bin || "Not configured"}
              </dd>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-transparent px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Fiscal Year</dt>
              <dd className="mt-1 text-sm font-medium text-text-primary">
                {fiscalYear?.label ?? "No fiscal year selected"}
              </dd>
              <p className="mt-1 text-xs text-text-muted">
                {fiscalYear ? `${fiscalYear.startDate} - ${fiscalYear.endDate}` : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-transparent px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Selected Period</dt>
              <dd className="mt-1 text-sm font-medium text-text-primary">
                {dashboard.selectedPeriod?.periodLabel ?? "No period selected"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="w-full max-w-xl space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-2xl border border-border-subtle bg-surface-page p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Active fiscal year
              </div>
              <div className="mt-3">
                <ClientFiscalYearSelect className="w-full rounded-xl border-border bg-card" />
              </div>
              <p className="mt-3 text-sm text-text-primary">{fiscalYear?.label ?? "No fiscal year selected"}</p>
              <p className="mt-1 text-xs text-text-muted">
                {fiscalYear ? `${fiscalYear.startDate} to ${fiscalYear.endDate}` : "Create a fiscal year to continue."}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Button asChild className="h-11 rounded-xl">
                <Link href={dashboard.context.primaryActionHref}>
                  <FilePlus2 className="h-4 w-4" />
                  New Voucher
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-border">
                <Link href={dashboard.context.manageFiscalYearsHref}>
                  <FolderClock className="h-4 w-4" />
                  Manage Fiscal Years
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-border">
                <Link href={dashboard.context.dayBookHref}>
                  <ReceiptText className="h-4 w-4" />
                  View Day Book
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-border">
                <Link href={dashboard.context.settingsHref}>
                  <Settings2 className="h-4 w-4" />
                  Organization Settings
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
