import Link from "next/link"
import { notFound } from "next/navigation"
import {
  BookMarked,
  ArrowLeft,
  BarChart3,
  BookOpenText,
  FileSpreadsheet,
  Landmark,
  LineChart,
  WalletCards,
  ReceiptText,
  ScrollText,
  Settings2,
} from "lucide-react"

import { ClientFiscalYearSelect } from "@/components/clients/client-fiscal-year-select"
import { FiscalYearProvider } from "@/components/clients/fiscal-year-context"
import { Button } from "@/components/ui/button"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "", label: "Dashboard", icon: BarChart3 },
  { href: "vouchers", label: "Vouchers", icon: ReceiptText },
  { href: "vouchers/new", label: "New Voucher", icon: ReceiptText },
  { href: "accounts", label: "Accounts", icon: BookMarked },
  { href: "ledger", label: "Ledger", icon: BookOpenText },
  { href: "daybook", label: "Day Book", icon: ScrollText },
  { href: "trial-balance", label: "Trial Balance", icon: FileSpreadsheet },
  { href: "balance-sheet", label: "Balance Sheet", icon: Landmark },
  { href: "profit-loss", label: "Profit & Loss", icon: LineChart },
  { href: "bank-statements", label: "Bank Statements", icon: WalletCards },
  { href: "import", label: "Import from Excel", icon: BarChart3 },
  { href: "settings", label: "Settings", icon: Settings2 },
] as const

export default async function ClientLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: { clientId: string }
}>) {
  const supabase = createClient()
  const { membership } = await getCurrentOrganizationContext()

  const { data: client } = membership?.org_id
    ? await supabase
        .from("clients")
        .select("*")
        .eq("id", params.clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()
    : { data: null }

  if (!client) {
    notFound()
  }

  const { data: fiscalYears } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", client.id)
    .order("start_date", { ascending: false })

  const initialFiscalYearId =
    fiscalYears?.find((year) => year.is_active)?.id ?? fiscalYears?.[0]?.id ?? null

  return (
    <FiscalYearProvider
      clientId={client.id}
      fiscalYears={(fiscalYears ?? []).map((year) => ({ id: year.id, label: year.label }))}
      initialFiscalYearId={initialFiscalYearId}
    >
      <div className="space-y-6">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm print:hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Button asChild variant="ghost" className="mb-3 h-9 px-2 text-slate-500 hover:text-slate-900">
                <Link href="/clients">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to clients
                </Link>
              </Button>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{client.name}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Client workspace dashboard and accounting overview
              </p>
            </div>
            <div className="w-full max-w-[240px]">
              <p className="mb-2 text-sm font-medium text-slate-500">Fiscal Year</p>
              <ClientFiscalYearSelect className="w-full rounded-xl border-slate-200" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const href = tab.href ? `/clients/${client.id}/${tab.href}` : `/clients/${client.id}`
              const Icon = tab.icon

              return (
                <Link
                  key={tab.label}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/clients/${client.id}`}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Client Dashboard
            </Link>
            <Link
              href={`/clients/${client.id}/vouchers/opening-balance?fiscalYear=${initialFiscalYearId ?? ""}`}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Opening Balances
            </Link>
            <Link
              href={`/clients/${client.id}/settings`}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Client Settings
            </Link>
            <Link
              href={`/clients/${client.id}/settings/fiscal-years`}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Fiscal Years
            </Link>
            <Link
              href={`/clients/${client.id}/settings/payment-modes`}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Payment Modes
            </Link>
            <Link
              href={`/clients/${client.id}/import`}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Excel Import
            </Link>
          </div>
        </div>

        {children}
      </div>
    </FiscalYearProvider>
  )
}
