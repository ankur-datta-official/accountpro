import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { ClientFiscalYearSelect } from "@/components/clients/client-fiscal-year-select"
import { FiscalYearProvider } from "@/components/clients/fiscal-year-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"

export default async function ClientLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: { clientId: string }
}>) {
  const { client, fiscalYears } = await getClientRouteContext({ clientId: params.clientId })

  if (!client) {
    notFound()
  }

  const initialFiscalYearId =
    fiscalYears.find((year) => year.is_active)?.id ?? fiscalYears[0]?.id ?? null

  return (
    <FiscalYearProvider
      clientId={client.id}
      fiscalYears={fiscalYears.map((year) => ({ id: year.id, label: year.label }))}
      initialFiscalYearId={initialFiscalYearId}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm print:hidden sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Button asChild variant="ghost" className="mb-2 h-8 px-2 text-slate-500 hover:text-slate-900">
                <Link href="/clients">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to clients
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950">
                  {client.name}
                </h1>
                <Badge
                  className={
                    client.is_active
                      ? "rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      : "rounded-full bg-slate-100 text-slate-500"
                  }
                >
                  {client.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Use the side panel for vouchers, accounts, ledger, reports, and settings.
              </p>
            </div>
            <div className="w-full max-w-[240px]">
              <p className="mb-2 text-sm font-medium text-slate-500">Fiscal Year</p>
              <ClientFiscalYearSelect className="w-full rounded-xl border-slate-200" />
            </div>
          </div>
        </div>

        {children}
      </div>
    </FiscalYearProvider>
  )
}
