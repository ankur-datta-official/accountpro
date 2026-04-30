"use client"

import { format } from "date-fns"
import { Download, LineChart } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingTable } from "@/components/ui/LoadingTable"
import { useProfitLoss } from "@/lib/hooks/useProfitLoss"
import { exportProfitLoss } from "@/lib/utils/export"

function amount(value: number) {
  return new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function ProfitLossManager({
  clientId,
  clientName,
  fiscalYearId,
}: {
  clientId: string
  clientName: string
  fiscalYearId: string
}) {
  const { data, isLoading } = useProfitLoss({ clientId, fiscalYearId })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
            Profit &amp; Loss Statement for the year ended{" "}
            {data ? format(new Date(data.endDate), "dd MMM yyyy") : "-"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{clientName}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-slate-200"
          disabled={!data || isLoading}
          onClick={() => data && exportProfitLoss(clientName, data)}
        >
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">Profit &amp; Loss</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <LoadingTable columns={["Section", "Amount"]} rows={12} />
          ) : !data ? (
            <EmptyState
              icon={LineChart}
              title="No profit and loss statement available"
              description="Post some vouchers in the selected fiscal year to generate this statement."
            />
          ) : (
            <>
              <section className="space-y-2">
                <p className="font-semibold text-slate-900">Revenue Income</p>
                {data.revenueItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <span>{amount(item.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Total Revenue</span>
                  <span>{amount(data.totalRevenue)}</span>
                </div>
              </section>

              <section className="space-y-2">
                <p className="font-semibold text-slate-900">Less: Cost of Goods Sold</p>
                <div className="flex items-center justify-between text-sm">
                  <span>Opening Stock</span>
                  <span>{amount(data.openingStock)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Add: Purchases</span>
                  <span>{amount(data.purchases)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Less: Closing Stock</span>
                  <span>({amount(data.closingStock)})</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Gross Profit</span>
                  <span>{amount(data.grossProfit)}</span>
                </div>
              </section>

              <section className="space-y-2">
                <p className="font-semibold text-slate-900">Other Income</p>
                {data.otherIncomeItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <span>{amount(item.amount)}</span>
                  </div>
                ))}
              </section>

              <section className="space-y-2">
                <p className="font-semibold text-slate-900">General & Administrative Expenses</p>
                {data.adminExpenseItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <span>{amount(item.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Sub-total</span>
                  <span>{amount(data.totalAdminExpenses)}</span>
                </div>
              </section>

              <section className="space-y-2">
                <p className="font-semibold text-slate-900">Revenue Expenses (other than COGS)</p>
                {data.revenueExpenseItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <span>{amount(item.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Sub-total</span>
                  <span>{amount(data.totalRevenueExpenses)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Total Expenses</span>
                  <span>{amount(data.totalExpenses)}</span>
                </div>
              </section>

              <div className="flex items-center justify-between rounded-xl border p-4">
                <span className="text-lg font-semibold">NET PROFIT / (NET LOSS)</span>
                <Badge
                  className={
                    data.netProfit >= 0
                      ? "rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      : "rounded-full bg-red-100 text-red-700 hover:bg-red-100"
                  }
                >
                  {amount(Math.abs(data.netProfit))} {data.netProfit >= 0 ? "Profit" : "Loss"}
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
