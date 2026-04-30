"use client"

import { forwardRef } from "react"
import { format } from "date-fns"

import { signedBalanceToLabel } from "@/lib/accounting/ledger"
import type { AccountGroupType } from "@/lib/types"

export type PrintableLedgerSection = {
  accountHeadId: string
  accountName: string
  groupName: string
  groupType: AccountGroupType
  periodLabel: string
  openingBalanceLabel: string
  totalDebit: number
  totalCredit: number
  closingBalance: number
  rows: Array<{
    id: string
    date: string
    voucherNo: number
    voucherType: string
    paymentMode: string | null
    description: string | null
    debit: number
    credit: number
    runningBalance: number
  }>
}

function amount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const LedgerPrint = forwardRef<
  HTMLDivElement,
  {
    companyName: string
    fiscalYearLabel: string
    sections: PrintableLedgerSection[]
  }
>(function LedgerPrint({ companyName, fiscalYearLabel, sections }, ref) {
  return (
    <div ref={ref} className="bg-white p-6 text-black">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          .ledger-print-page {
            page-break-after: always;
          }

          .ledger-print-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>

      {sections.map((section) => (
        <section key={section.accountHeadId} className="ledger-print-page mb-8">
          <div className="mb-5 border-b border-slate-300 pb-3">
            <h1 className="text-2xl font-semibold">{companyName}</h1>
            <p className="text-sm text-slate-600">Ledger Book</p>
            <p className="text-sm text-slate-600">Fiscal Year: {fiscalYearLabel}</p>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-1 text-sm">
            <p>
              <span className="font-semibold">Account:</span> {section.accountName}
            </p>
            <p>
              <span className="font-semibold">Group:</span> {section.groupName}
            </p>
            <p>
              <span className="font-semibold">Period:</span> {section.periodLabel}
            </p>
            <p>
              <span className="font-semibold">Opening Balance:</span> {section.openingBalanceLabel}
            </p>
          </div>

          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-slate-400 bg-slate-100">
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Voucher No</th>
                <th className="px-2 py-2 text-left">Voucher Type</th>
                <th className="px-2 py-2 text-left">Payment Mode</th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Debit</th>
                <th className="px-2 py-2 text-right">Credit</th>
                <th className="px-2 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-200">
                  <td className="px-2 py-1.5">{format(new Date(row.date), "dd MMM yyyy")}</td>
                  <td className="px-2 py-1.5">{row.voucherNo}</td>
                  <td className="px-2 py-1.5 uppercase">{row.voucherType}</td>
                  <td className="px-2 py-1.5">{row.paymentMode ?? "—"}</td>
                  <td className="px-2 py-1.5">{row.description ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{amount(row.debit)}</td>
                  <td className="px-2 py-1.5 text-right">{amount(row.credit)}</td>
                  <td className="px-2 py-1.5 text-right">
                    {signedBalanceToLabel(row.runningBalance, section.groupType)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-500 bg-slate-100 font-semibold">
                <td colSpan={5} className="px-2 py-2 text-right">
                  Total
                </td>
                <td className="px-2 py-2 text-right">{amount(section.totalDebit)}</td>
                <td className="px-2 py-2 text-right">{amount(section.totalCredit)}</td>
                <td className="px-2 py-2 text-right">
                  {signedBalanceToLabel(section.closingBalance, section.groupType)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      ))}
    </div>
  )
})
