"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SelectedVouchersPrintActions({
  backHref,
  autoPrint = false,
}: {
  backHref: string
  autoPrint?: boolean
}) {
  const hasAutoPrintedRef = useRef(false)

  useEffect(() => {
    if (!autoPrint || hasAutoPrintedRef.current) {
      return
    }

    hasAutoPrintedRef.current = true
    const timer = window.setTimeout(() => {
      window.print()
    }, 300)

    return () => window.clearTimeout(timer)
  }, [autoPrint])

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button asChild variant="outline" className="rounded-xl border-slate-200">
        <Link href={backHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Register
        </Link>
      </Button>
      <Button type="button" className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Print Page
      </Button>
    </div>
  )
}
