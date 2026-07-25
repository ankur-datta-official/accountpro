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
      return "bg-rose-100 text-rose-700 hover:bg-rose-100"
    case "received":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
    case "journal":
      return "bg-rose-100 text-rose-700 hover:bg-rose-100"
    case "contra":
      return "bg-sky-100 text-sky-700 hover:bg-sky-100"
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

export function getVoucherShortCode(type: VoucherType) {
  switch (type) {
    case "payment":
      return "PV"
    case "received":
      return "RV"
    case "journal":
      return "JV"
    case "contra":
      return "CV"
    case "bf":
      return "BF"
    case "bp":
      return "BP"
    case "br":
      return "BR"
    default:
      return "VN"
  }
}

export function formatVoucherRegisterNumber(voucherNo: number, type: VoucherType) {
  return `${getVoucherShortCode(type)}-${voucherNo}`
}

export type VoucherSerialSource = {
  id: string
  client_id?: string | null
  fiscal_year_id?: string | null
  voucher_type: VoucherType
  voucher_date: string
  voucher_no: number
  created_at?: string | null
}

export function buildVoucherTypeSerialMap(vouchers: VoucherSerialSource[]) {
  const serialById = new Map<string, number>()
  const grouped = new Map<string, VoucherSerialSource[]>()

  for (const voucher of vouchers) {
    const groupKey = `${voucher.client_id ?? ""}:${voucher.fiscal_year_id ?? ""}:${voucher.voucher_type}`
    const group = grouped.get(groupKey) ?? []
    group.push(voucher)
    grouped.set(groupKey, group)
  }

  for (const group of grouped.values()) {
    const sorted = [...group].sort((left, right) => {
      const leftDate = new Date(left.voucher_date).getTime()
      const rightDate = new Date(right.voucher_date).getTime()

      if (leftDate !== rightDate) {
        return leftDate - rightDate
      }

      const leftCreated = new Date(left.created_at ?? left.voucher_date).getTime()
      const rightCreated = new Date(right.created_at ?? right.voucher_date).getTime()

      if (leftCreated !== rightCreated) {
        return leftCreated - rightCreated
      }

      if (left.voucher_no !== right.voucher_no) {
        return left.voucher_no - right.voucher_no
      }

      return left.id.localeCompare(right.id)
    })

    sorted.forEach((voucher, index) => {
      serialById.set(voucher.id, index + 1)
    })
  }

  return serialById
}

export function formatVoucherDisplayNumber(type: VoucherType, serial: number) {
  return formatVoucherRegisterNumber(serial, type)
}

export function getVoucherDisplayNumber(type: VoucherType, serial: number | null | undefined, fallbackVoucherNo: number) {
  return formatVoucherDisplayNumber(type, serial ?? fallbackVoucherNo)
}

export function getVoucherRegisterRowClass(type: VoucherType) {
  switch (type) {
    case "payment":
      return "bg-slate-50/80 hover:bg-slate-100/80"
    case "received":
      return "bg-emerald-50/70 hover:bg-emerald-100/70"
    case "journal":
      return "bg-rose-50/70 hover:bg-rose-100/70"
    case "contra":
      return "bg-sky-50/80 hover:bg-sky-100/80"
    case "bf":
      return "bg-slate-50/80 hover:bg-slate-100/80"
    case "bp":
      return "bg-amber-50/70 hover:bg-amber-100/70"
    case "br":
      return "bg-cyan-50/70 hover:bg-cyan-100/70"
    default:
      return "bg-slate-50/80 hover:bg-slate-100/80"
  }
}
