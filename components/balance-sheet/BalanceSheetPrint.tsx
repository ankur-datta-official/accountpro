"use client"

import { forwardRef } from "react"
import { format } from "date-fns"

import type { BalanceSheetPeriod } from "@/lib/accounting/balance-sheet"

function amount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function SectionTable({
  title,
  lines,
  total,
}: {
  title: string
  lines: Array<{ label: string; amount: number }>
  total: number
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 font-semibold">{title}</p>
      <table className="w-full border-collapse text-xs">
        <tbody>
          {lines.map((line) => (
            <tr key={line.label}>
              <td className="px-2 py-1">{line.label}</td>
              <td className="px-2 py-1 text-right">{amount(line.amount)}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-400 font-semibold">
            <td className="px-2 py-1.5">Total</td>
            <td className="px-2 py-1.5 text-right">{amount(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export const BalanceSheetPrint = forwardRef<
  HTMLDivElement,
  {
    companyName: string
    fiscalYearLabel: string
    current: BalanceSheetPeriod
    previous: BalanceSheetPeriod | null
    isBalanced: boolean
    difference: number
  }
>(function BalanceSheetPrint({ companyName, fiscalYearLabel, current, previous, isBalanced, difference }, ref) {
  const endDate = format(new Date(current.endDate), "dd MMM yyyy")

  return (
    <div ref={ref} className="bg-white p-6 text-slate-950">
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
      `}</style>

      <h1 className="text-2xl font-semibold">{companyName}</h1>
      <p className="text-sm font-medium">Balance Sheet as at {endDate}</p>
      <p className="mb-4 text-xs text-slate-600">Fiscal Year: {fiscalYearLabel}</p>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold">ASSETS</h2>
          <SectionTable
            title={current.assets.nonCurrentAssets.title}
            lines={current.assets.nonCurrentAssets.lines}
            total={current.assets.nonCurrentAssets.total}
          />
          <SectionTable
            title={current.assets.currentAssets.title}
            lines={current.assets.currentAssets.lines}
            total={current.assets.currentAssets.total}
          />
          <SectionTable
            title={current.assets.preliminaryExpenses.title}
            lines={current.assets.preliminaryExpenses.lines}
            total={current.assets.preliminaryExpenses.total}
          />
          <p className="mt-2 border-t border-slate-500 pt-2 text-sm font-semibold">
            TOTAL ASSETS: {amount(current.assets.totalAssets)}
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold">LIABILITIES & EQUITY</h2>
          <SectionTable
            title={current.liabilitiesEquity.equity.title}
            lines={current.liabilitiesEquity.equity.lines}
            total={current.liabilitiesEquity.equity.total}
          />
          <SectionTable
            title={current.liabilitiesEquity.nonCurrentLiabilities.title}
            lines={current.liabilitiesEquity.nonCurrentLiabilities.lines}
            total={current.liabilitiesEquity.nonCurrentLiabilities.total}
          />
          <SectionTable
            title={current.liabilitiesEquity.currentLiabilities.title}
            lines={current.liabilitiesEquity.currentLiabilities.lines}
            total={current.liabilitiesEquity.currentLiabilities.total}
          />
          <p className="mt-2 border-t border-slate-500 pt-2 text-sm font-semibold">
            TOTAL LIABILITIES & EQUITY: {amount(current.liabilitiesEquity.totalLiabilitiesEquity)}
          </p>
        </div>
      </div>

      {previous ? (
        <p className="mt-4 text-xs text-slate-600">
          Previous year ({previous.fiscalYearLabel}) included in on-screen comparative view.
        </p>
      ) : null}

      <p className={`mt-3 text-xs font-medium ${isBalanced ? "text-emerald-700" : "text-red-600"}`}>
        {isBalanced ? "Balanced statement confirmed." : `Unbalanced by ${amount(difference)}`}
      </p>

      <div className="mt-14 grid grid-cols-3 gap-8 text-center text-sm">
        {["Prepared by", "Checked by", "Approved by"].map((label) => (
          <div key={label} className="border-t border-slate-400 pt-2">
            {label}
          </div>
        ))}
      </div>
    </div>
  )
})
