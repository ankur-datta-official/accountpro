"use client"

import { useEffect, useRef } from "react"
import { Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"

import {
  VoucherPrintView,
  type VoucherPrintLine,
} from "@/components/voucher/VoucherPrintView"
import { Button } from "@/components/ui/button"

export function VoucherPrintActions({
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
  autoPrint = false,
  className,
}: {
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
  autoPrint?: boolean
  className?: string
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const hasAutoPrintedRef = useRef(false)
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `${companyName}-voucher-${voucherNo}`,
  })

  useEffect(() => {
    if (!autoPrint || hasAutoPrintedRef.current) {
      return
    }

    hasAutoPrintedRef.current = true
    const timer = window.setTimeout(() => {
      void handlePrint()
    }, 300)

    return () => window.clearTimeout(timer)
  }, [autoPrint, handlePrint])

  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={() => void handlePrint()}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
      <div className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0">
        <VoucherPrintView
          ref={contentRef}
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
        />
      </div>
    </>
  )
}
