import type { VoucherType } from "@/lib/types"

export const AUTO_BALANCE_ENTRY_PREFIX = "Auto-balancing entry for "

export function isAutoBalanceEntry(description: string | null | undefined) {
  return Boolean(description?.startsWith(AUTO_BALANCE_ENTRY_PREFIX))
}

export function getVoucherTypeLabel(type: VoucherType) {
  switch (type) {
    case "payment":
      return "Payment"
    case "received":
      return "Received"
    case "journal":
      return "Journal"
    case "contra":
      return "Contra"
    case "bf":
      return "B/F"
    case "bp":
      return "B/P"
    case "br":
      return "B/R"
    default:
      return type
  }
}

export function getVoucherTypeBadgeClass(type: VoucherType) {
  switch (type) {
    case "payment":
      return "bg-red-100 text-red-700 hover:bg-red-100"
    case "received":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
    case "journal":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100"
    case "contra":
      return "bg-violet-100 text-violet-700 hover:bg-violet-100"
    case "bf":
      return "bg-slate-100 text-slate-600 hover:bg-slate-100"
    case "bp":
      return "bg-amber-100 text-amber-700 hover:bg-amber-100"
    case "br":
      return "bg-cyan-100 text-cyan-700 hover:bg-cyan-100"
    default:
      return "bg-slate-100 text-slate-600 hover:bg-slate-100"
  }
}
