import Link from "next/link"
import { BarChart3, BookOpenText, FileSpreadsheet, Landmark, LineChart, ScrollText, WalletCards } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-shell"

const reports = [
  {
    title: "Day Book",
    description: "Review daily voucher movement by date and payment mode.",
    href: "day-book",
    icon: ScrollText,
  },
  {
    title: "Ledger",
    description: "Inspect account-wise running balances and voucher history.",
    href: "ledger",
    icon: BookOpenText,
  },
  {
    title: "Trial Balance",
    description: "Check debit and credit balance before closing a period.",
    href: "trial-balance",
    icon: FileSpreadsheet,
  },
  {
    title: "Balance Sheet",
    description: "View assets, liabilities, and equity for the active period.",
    href: "balance-sheet",
    icon: Landmark,
  },
  {
    title: "Profit & Loss",
    description: "Summarize income, expenses, and net result.",
    href: "profit-loss",
    icon: LineChart,
  },
  {
    title: "Bank Statements",
    description: "Review bank and cash-book movement by payment mode.",
    href: "bank-statements",
    icon: WalletCards,
  },
] as const

export default function ClientReportsPage({
  params,
}: {
  params: { clientId: string }
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Report Hub"
        description="Choose the report you need. Each report keeps the same print and export controls you already use in the accounting workspace."
        icon={BarChart3}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon

          return (
            <Card key={report.href} className="rounded-xl border-slate-200 bg-white shadow-sm">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-950">{report.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{report.description}</p>
                <Button asChild className="mt-5 rounded-lg">
                  <Link href={`/clients/${params.clientId}/${report.href}`}>Open Report</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
