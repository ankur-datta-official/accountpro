"use client"

import Link from "next/link"

import { DeleteVoucherButton } from "@/components/voucher/delete-voucher-button"
import type { VoucherPrintAttachment, VoucherPrintLine } from "@/components/voucher/VoucherPrintView"
import { VoucherPrintActions } from "@/components/voucher/voucher-print-actions"
import { VoucherShareActions } from "@/components/voucher/voucher-share-actions"
import { Button } from "@/components/ui/button"

export function VoucherDetailActions({
  clientId,
  voucherId,
  voucherNo,
  companyName,
  voucherType,
  voucherDate,
  paymentModeName,
  description,
  accountHeadName,
  lines,
  totalDebit,
  totalCredit,
  showDescription = true,
  showSupportingDocuments = true,
  attachments = [],
  autoPrint = false,
}: {
  clientId: string
  voucherId: string
  voucherNo: number
  companyName: string
  voucherType: string
  voucherDate: string
  paymentModeName: string | null
  description: string | null
  accountHeadName: string
  lines: VoucherPrintLine[]
  totalDebit: number
  totalCredit: number
  showDescription?: boolean
  showSupportingDocuments?: boolean
  attachments?: VoucherPrintAttachment[]
  autoPrint?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <Button asChild variant="outline" className="rounded-xl border-slate-200">
        <Link href={`/clients/${clientId}/vouchers/${voucherId}/edit`}>Edit</Link>
      </Button>
      <VoucherPrintActions
        companyName={companyName}
        voucherType={voucherType}
        voucherNo={voucherNo}
        voucherDate={voucherDate}
        paymentModeName={paymentModeName}
        description={description}
        accountHeadName={accountHeadName}
        lines={lines}
        totalDebit={totalDebit}
        totalCredit={totalCredit}
        showDescription={showDescription}
        showSupportingDocuments={showSupportingDocuments}
        attachments={attachments}
        autoPrint={autoPrint}
        className="rounded-xl border-slate-200"
      />
      <VoucherShareActions clientId={clientId} voucherId={voucherId} />
      <DeleteVoucherButton
        clientId={clientId}
        voucherId={voucherId}
        voucherNo={voucherNo}
        variant="outline"
        className="rounded-xl border-slate-200 text-destructive hover:text-destructive"
      />
    </div>
  )
}
