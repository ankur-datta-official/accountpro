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

export type VoucherPrintAttachment = {
  id: string
  fileName: string
  fileSize: number
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function uniqueAccountHeads(lines: VoucherPrintLine[], fallback: string) {
  const names = lines.map((line) => line.accountHeadName.trim()).filter(Boolean)
  const uniqueNames = Array.from(new Set(names))

  return uniqueNames.length ? uniqueNames.join(", ") : fallback
}

export const VoucherPrintView = forwardRef<
  HTMLDivElement,
  {
    companyName: string
    voucherType: string
    voucherNo: number
    voucherDate: string
    paymentModeName: string | null
    showDescription?: boolean
    description: string | null
    accountHeadName: string
    lines: VoucherPrintLine[]
    totalDebit: number
    totalCredit: number
    showSupportingDocuments?: boolean
    attachments?: VoucherPrintAttachment[]
  }
>(
  (
    {
      companyName,
      voucherType,
      voucherNo,
      voucherDate,
      paymentModeName,
      showDescription = true,
      description,
      accountHeadName,
      lines,
      totalDebit,
      totalCredit,
      showSupportingDocuments = true,
      attachments = [],
    },
    ref
  ) => {
    const amount = Math.max(totalDebit, totalCredit)
    const amountInWords = bangladeshiAmountToWords(amount)
    const voucherTypeLabel = getVoucherTypeLabel(voucherType as never)
    const hasAttachments = attachments.length > 0
    const accountHeadSummary = uniqueAccountHeads(lines, accountHeadName)

    return (
      <div ref={ref} className="bg-white text-slate-950">
        <style jsx global>{`
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          @media print {
            html,
            body {
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .voucher-print-root {
              box-shadow: none !important;
              margin: 0 auto !important;
              min-height: auto !important;
              width: 100% !important;
              max-width: 186mm !important;
              padding: 0 !important;
            }

            .voucher-print-avoid-break,
            .voucher-print-row {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .voucher-print-table {
              page-break-after: auto;
            }

            .voucher-print-table thead {
              display: table-header-group;
            }

            .voucher-print-table tfoot {
              display: table-row-group;
            }
          }
        `}</style>

        <div className="voucher-print-root mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white p-[14mm] shadow-sm">
          <header className="voucher-print-avoid-break mb-5 overflow-hidden rounded-sm border border-slate-900">
            <div className="flex items-stretch justify-between">
              <div className="flex-1 px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                  DKLedger
                </p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{companyName}</h1>
                <div className="mt-4 h-1 w-28 rounded-full bg-slate-900" />
              </div>
              <div className="flex min-w-56 flex-col justify-center bg-slate-950 px-6 py-5 text-right text-white">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-300">
                  {voucherTypeLabel}
                </p>
                <p className="mt-2 text-3xl font-extrabold uppercase tracking-wide">Voucher</p>
              </div>
            </div>
          </header>

          <section className="voucher-print-avoid-break mb-4 rounded-sm border border-slate-300 bg-slate-50 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <p className="min-w-0 flex-1">
                <span className="font-bold text-slate-700">Accounts head:</span>{" "}
                <span className="font-semibold text-slate-950">{accountHeadSummary}</span>
              </p>
              <p className="shrink-0">
                <span className="font-bold text-slate-700">Voucher No:</span>{" "}
                <span className="font-semibold text-slate-950">#{voucherNo}</span>
              </p>
              <p className="shrink-0">
                <span className="font-bold text-slate-700">Voucher Date:</span>{" "}
                <span className="font-semibold text-slate-950">
                  {format(new Date(voucherDate), "dd MMM yyyy")}
                </span>
              </p>
            </div>
          </section>

          <table className="voucher-print-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-950">
                <th className="w-12 border border-slate-900 px-3 py-2 text-center text-[11px] uppercase tracking-[0.14em]">
                  Sl
                </th>
                <th className="border border-slate-900 px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em]">
                  Particulars
                </th>
                <th className="w-32 border border-slate-900 px-3 py-2 text-right text-[11px] uppercase tracking-[0.14em]">
                  Debit
                </th>
                <th className="w-32 border border-slate-900 px-3 py-2 text-right text-[11px] uppercase tracking-[0.14em]">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id} className="voucher-print-row align-top">
                  <td className="border border-slate-300 px-3 py-2 text-center">{index + 1}</td>
                  <td className="border border-slate-300 px-3 py-2">
                    <p className="font-semibold text-slate-950">{line.accountHeadName}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-700">
                      {line.description || (showDescription ? description : "") || "-"}
                    </p>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    {line.debit ? formatMoney(line.debit) : ""}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    {line.credit ? formatMoney(line.credit) : ""}
                  </td>
                </tr>
              ))}

              {showSupportingDocuments && (
                <tr className="voucher-print-row align-top">
                  <td className="border border-slate-300 px-3 py-2 text-center">{lines.length + 1}</td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950">Supporting documents</p>
                        <p className="mt-1 text-xs leading-5 text-slate-700">
                          {hasAttachments
                            ? `${attachments.length} document${attachments.length > 1 ? "s" : ""} attached with this voucher.`
                            : "No supporting document attached with this voucher."}
                        </p>
                        {hasAttachments ? (
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {attachments
                              .slice(0, 3)
                              .map((attachment) => `${attachment.fileName} (${formatFileSize(attachment.fileSize)})`)
                              .join(", ")}
                            {attachments.length > 3 ? `, +${attachments.length - 3} more` : ""}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded border border-slate-400 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">
                        {hasAttachments ? "Attached" : "Not attached"}
                      </span>
                    </div>
                  </td>
                  <td className="border border-slate-300 px-3 py-2" />
                  <td className="border border-slate-300 px-3 py-2" />
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="voucher-print-row bg-slate-100">
                <td className="border border-slate-900 px-3 py-3" />
                <td className="border border-slate-900 px-3 py-3 text-right font-bold uppercase tracking-[0.12em]">
                  Total
                </td>
                <td className="border border-slate-900 px-3 py-3 text-right font-bold">
                  {formatMoney(totalDebit)}
                </td>
                <td className="border border-slate-900 px-3 py-3 text-right font-bold">
                  {formatMoney(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>

          <section className="voucher-print-avoid-break mt-5 rounded-sm border border-slate-900 text-sm">
            <div className="grid grid-cols-[1fr_2fr] border-b border-slate-900">
              <div className="border-r border-slate-900 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Payment Mode
                </p>
                <p className="mt-1 font-semibold text-slate-950">{paymentModeName || "-"}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Amount In Words
                </p>
                <p className="mt-1 font-semibold text-slate-950">{amountInWords}</p>
              </div>
            </div>

            {showDescription && (
              <div className="border-b border-slate-900 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Narration</p>
                <p className="mt-1 min-h-8 text-slate-950">{description || "-"}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-10 px-6 pb-6 pt-14 text-center">
              {["Prepared by", "Checked by", "Approved by"].map((label) => (
                <div key={label}>
                  <div className="border-t border-slate-700 pt-2 font-medium">{label}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }
)

VoucherPrintView.displayName = "VoucherPrintView"
