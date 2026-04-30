"use client"

import { forwardRef } from "react"
import { format } from "date-fns"

import { bangladeshiAmountToWords } from "@/lib/accounting/amount-in-words"
import { getVoucherTypeLabel } from "@/lib/accounting/vouchers"

export type VoucherPrintLine = {
  id: string
  accountHeadName: string
  accountsGroup: string | null
  debit: number
  credit: number
  description: string | null
}

export const VoucherPrintView = forwardRef<
  HTMLDivElement,
  {
    companyName: string
    voucherType: string
    voucherNo: number
    voucherDate: string
    paymentModeName: string | null
    description: string | null
    accountHeadName: string
    lines: VoucherPrintLine[]
    totalDebit: number
    totalCredit: number
  }
>(
  (
    {
      companyName,
      voucherType,
      voucherNo,
      voucherDate,
      paymentModeName,
      description,
      accountHeadName,
      lines,
      totalDebit,
      totalCredit,
    },
    ref
  ) => {
    const amount = Math.max(totalDebit, totalCredit)
    const amountInWords = bangladeshiAmountToWords(amount)

    return (
      <div ref={ref} className="bg-white text-slate-950">
        <style jsx global>{`
          @page {
            size: A5 portrait;
            margin: 10mm;
          }

          @media print {
            html,
            body {
              background: white !important;
            }

            .voucher-print-root {
              box-shadow: none !important;
              border: 0 !important;
              margin: 0 !important;
              width: 100% !important;
            }
          }
        `}</style>

        <div className="voucher-print-root mx-auto w-full max-w-[148mm] border border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{companyName}</h1>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">AccountPro Voucher</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                {getVoucherTypeLabel(voucherType as never)}
              </p>
              <p className="mt-1 text-xl font-bold">VOUCHER</p>
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-300 py-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Accounts Head</p>
              <p className="mt-1 font-semibold">{accountHeadName}</p>
            </div>
            <div className="space-y-2 text-right">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Voucher No</p>
                <p className="mt-1 font-semibold">#{voucherNo}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Voucher Date</p>
                <p className="mt-1 font-semibold">{format(new Date(voucherDate), "dd MMM yyyy")}</p>
              </div>
            </div>
          </div>

          <div className="py-4">
            <div className="grid grid-cols-[1.8fr_0.6fr_0.6fr] border border-slate-300 text-sm">
              <div className="border-r border-slate-300 px-3 py-2 font-semibold uppercase tracking-[0.18em]">
                Particular&apos;s
              </div>
              <div className="border-r border-slate-300 px-3 py-2 text-right font-semibold uppercase tracking-[0.18em]">
                Dr.
              </div>
              <div className="px-3 py-2 text-right font-semibold uppercase tracking-[0.18em]">Cr.</div>

              {lines.map((line) => (
                <div key={line.id} className="contents">
                  <div className="border-r border-t border-slate-300 px-3 py-3">
                    <p className="font-medium">
                      Accounts of: <span className="capitalize">{line.accountsGroup || "General"}</span>
                    </p>
                    <p className="mt-1">{line.accountHeadName}</p>
                    <p className="mt-1 text-xs text-slate-600">{line.description || description || "—"}</p>
                  </div>
                  <div className="border-r border-t border-slate-300 px-3 py-3 text-right font-medium">
                    {line.debit ? line.debit.toFixed(2) : ""}
                  </div>
                  <div className="border-t border-slate-300 px-3 py-3 text-right font-medium">
                    {line.credit ? line.credit.toFixed(2) : ""}
                  </div>
                </div>
              ))}

              <div className="border-r border-t border-slate-300 px-3 py-3 text-sm text-slate-600">
                Supporting Voucher attached herewith
              </div>
              <div className="border-r border-t border-slate-300 px-3 py-3" />
              <div className="border-t border-slate-300 px-3 py-3" />
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-300 pt-4">
            <div className="grid grid-cols-[1.2fr_1fr] items-end gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Payment Mode</p>
                <p className="mt-1 font-semibold">{paymentModeName || "—"}</p>
              </div>
              <div className="border border-slate-300">
                <div className="grid grid-cols-[1fr_0.6fr_0.6fr] text-sm">
                  <div className="border-r border-slate-300 px-3 py-2 font-semibold">Total</div>
                  <div className="border-r border-slate-300 px-3 py-2 text-right font-semibold">
                    {totalDebit.toFixed(2)}
                  </div>
                  <div className="px-3 py-2 text-right font-semibold">{totalCredit.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Inward</p>
              <p className="mt-1 text-sm font-medium">{amountInWords}</p>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8 text-center text-sm">
              {["Prepared by", "Checked by", "Approved by"].map((label) => (
                <div key={label}>
                  <div className="border-t border-slate-400 pt-2">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
)

VoucherPrintView.displayName = "VoucherPrintView"
