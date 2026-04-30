"use client"

import { forwardRef } from "react"

import type { TrialBalanceRow } from "@/lib/accounting/trial-balance"

function amount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const TrialBalancePrint = forwardRef<
  HTMLDivElement,
  {
    companyName: string
    fiscalYearLabel: string
    periodLabel: string
    rows: TrialBalanceRow[]
    totalDebit: number
    totalCredit: number
    isBalanced: boolean
    difference: number
  }
>(function TrialBalancePrint(
  {
    companyName,
    fiscalYearLabel,
    periodLabel,
    rows,
    totalDebit,
    totalCredit,
    isBalanced,
    difference,
  },
  ref
) {
  const grouped = rows.reduce<Record<string, TrialBalanceRow[]>>((acc, row) => {
    if (!acc[row.semiSubGroupName]) {
      acc[row.semiSubGroupName] = []
    }

    acc[row.semiSubGroupName].push(row)
    return acc
  }, {})

  const groupedEntries = Object.entries(grouped)

  return (
    <div ref={ref} className="bg-white p-6 text-slate-950">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
      `}</style>

      <div className="mx-auto max-w-[190mm]">
        <div className="mb-4 border-b border-slate-300 pb-3">
          <h1 className="text-2xl font-semibold">{companyName}</h1>
          <p className="text-sm font-medium">Trial Balance</p>
          <p className="text-xs text-slate-600">Fiscal Year: {fiscalYearLabel}</p>
          <p className="text-xs text-slate-600">Period: {periodLabel}</p>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-100">
              <th className="px-2 py-2 text-left">Semi-Sub Accounts Group</th>
              <th className="px-2 py-2 text-left">Account Head</th>
              <th className="px-2 py-2 text-right">Debit</th>
              <th className="px-2 py-2 text-right">Credit</th>
              <th className="px-2 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {groupedEntries.map(([groupName, groupRows]) => {
              const groupDebit = groupRows.reduce((sum, row) => sum + row.debit, 0)
              const groupCredit = groupRows.reduce((sum, row) => sum + row.credit, 0)

              return (
                <>
                  <tr key={`${groupName}-header`} className="bg-slate-100 font-semibold">
                    <td className="px-2 py-2">{groupName}</td>
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2 text-right" />
                    <td className="px-2 py-2 text-right" />
                    <td className="px-2 py-2 text-right" />
                  </tr>
                  {groupRows.map((row) => (
                    <tr key={row.accountHeadId} className="border-b border-slate-200">
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5">{row.accountHeadName}</td>
                      <td className="px-2 py-1.5 text-right">{amount(row.debit)}</td>
                      <td className="px-2 py-1.5 text-right">{amount(row.credit)}</td>
                      <td className="px-2 py-1.5 text-right">{row.balanceLabel}</td>
                    </tr>
                  ))}
                  <tr key={`${groupName}-subtotal`} className="border-b border-slate-300 bg-slate-50 font-semibold">
                    <td className="px-2 py-1.5" />
                    <td className="px-2 py-1.5">Subtotal</td>
                    <td className="px-2 py-1.5 text-right">{amount(groupDebit)}</td>
                    <td className="px-2 py-1.5 text-right">{amount(groupCredit)}</td>
                    <td className="px-2 py-1.5 text-right" />
                  </tr>
                </>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-500 bg-slate-100 font-semibold">
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right">Grand Total</td>
              <td className="px-2 py-2 text-right">{amount(totalDebit)}</td>
              <td className="px-2 py-2 text-right">{amount(totalCredit)}</td>
              <td className="px-2 py-2 text-right">—</td>
            </tr>
          </tfoot>
        </table>

        <p className={`mt-3 text-xs font-medium ${isBalanced ? "text-emerald-700" : "text-red-600"}`}>
          {isBalanced ? "Balanced" : `Unbalanced (Difference: ${amount(difference)})`}
        </p>

        <div className="mt-14 grid grid-cols-3 gap-8 text-center text-sm">
          {["Prepared by", "Checked by", "Approved by"].map((label) => (
            <div key={label} className="border-t border-slate-400 pt-2">
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
