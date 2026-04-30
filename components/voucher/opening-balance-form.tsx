"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  saveOpeningBalancesAction,
  type SaveOpeningBalancesInput,
} from "@/lib/actions/vouchers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type OpeningBalanceLine = {
  accountHeadId: string
  accountHeadName: string
  accountsGroup: "asset" | "liability"
  section: "cash-bank" | "asset" | "liability"
  debitAmount: number
  creditAmount: number
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function OpeningBalanceTable({
  title,
  lines,
  onChange,
}: {
  title: string
  lines: OpeningBalanceLine[]
  onChange: (accountHeadId: string, field: "debitAmount" | "creditAmount", value: number) => void
}) {
  return (
    <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl text-slate-950">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-3 pr-4 font-medium">Account Head Name</th>
              <th className="py-3 pr-4 font-medium text-right">Dr Amount</th>
              <th className="py-3 font-medium text-right">Cr Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.accountHeadId} className="border-b border-slate-100 last:border-b-0">
                <td className="py-3 pr-4 font-medium text-slate-900">{line.accountHeadName}</td>
                <td className="py-3 pr-4">
                  <Input
                    type="number"
                    step="0.01"
                    className="h-10 rounded-xl border-slate-200 text-right"
                    value={line.debitAmount}
                    onChange={(event) =>
                      onChange(line.accountHeadId, "debitAmount", Number(event.target.value || 0))
                    }
                  />
                </td>
                <td className="py-3">
                  <Input
                    type="number"
                    step="0.01"
                    className="h-10 rounded-xl border-slate-200 text-right"
                    value={line.creditAmount}
                    onChange={(event) =>
                      onChange(line.accountHeadId, "creditAmount", Number(event.target.value || 0))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

export function OpeningBalanceForm({
  clientId,
  fiscalYearId,
  fiscalYearLabel,
  hasExistingOpeningBalances,
  initialLines,
}: {
  clientId: string
  fiscalYearId: string
  fiscalYearLabel: string
  hasExistingOpeningBalances: boolean
  initialLines: OpeningBalanceLine[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [lines, setLines] = useState(initialLines)

  const cashBankLines = useMemo(
    () => lines.filter((line) => line.section === "cash-bank"),
    [lines]
  )
  const assetLines = useMemo(
    () => lines.filter((line) => line.section === "asset"),
    [lines]
  )
  const liabilityLines = useMemo(
    () => lines.filter((line) => line.section === "liability"),
    [lines]
  )

  const totalDebit = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0),
    [lines]
  )
  const totalCredit = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0),
    [lines]
  )
  const difference = Number((totalDebit - totalCredit).toFixed(2))
  const isBalanced = difference === 0

  const handleChange = (
    accountHeadId: string,
    field: "debitAmount" | "creditAmount",
    value: number
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.accountHeadId === accountHeadId
          ? {
              ...line,
              [field]: Number.isFinite(value) ? value : 0,
            }
          : line
      )
    )
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const payload: SaveOpeningBalancesInput = {
        clientId,
        fiscalYearId,
        lines: lines.map((line) => ({
          accountHeadId: line.accountHeadId,
          accountsGroup: line.accountsGroup,
          debitAmount: Number(line.debitAmount || 0),
          creditAmount: Number(line.creditAmount || 0),
        })),
      }

      const result = await saveOpeningBalancesAction(payload)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`Opening balances saved in voucher #${result.voucherNo}.`)
      router.push(`/clients/${clientId}/vouchers/${result.voucherId}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
            Opening Balance Entry — {fiscalYearLabel}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            Enter the brought-forward balances that will start this fiscal year.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl border-slate-200">
          <Link href={`/clients/${clientId}/vouchers`}>Back to vouchers</Link>
        </Button>
      </div>

      {hasExistingOpeningBalances ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Opening balances have already been entered. Saving now will update the existing B/F entries.
        </div>
      ) : null}

      {cashBankLines.length ? (
        <OpeningBalanceTable title="Cash & Bank" lines={cashBankLines} onChange={handleChange} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <OpeningBalanceTable title="Assets" lines={assetLines} onChange={handleChange} />
        <OpeningBalanceTable title="Liabilities + Equity" lines={liabilityLines} onChange={handleChange} />
      </div>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">Balance Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Total Dr</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{formatAmount(totalDebit)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Total Cr</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{formatAmount(totalCredit)}</p>
          </div>
          <div
            className={`rounded-2xl p-4 ${
              isBalanced ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            <p className="text-sm font-medium">{isBalanced ? "Balanced" : "Unbalanced"}</p>
            <p className="mt-2 text-xl font-semibold">{formatAmount(Math.abs(difference))}</p>
          </div>
          <div className="flex items-center justify-end">
            <Button
              type="button"
              className="h-11 rounded-xl px-6"
              disabled={!isBalanced || isPending}
              onClick={handleSubmit}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Opening Balances
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
