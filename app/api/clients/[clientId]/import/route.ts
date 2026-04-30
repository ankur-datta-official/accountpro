import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"

import { createPaymentModeAccountHeadForClient } from "@/lib/accounting/defaults"
import type { Database, VoucherType } from "@/lib/types"

const importSchema = z.object({
  fiscalYearId: z.string().uuid(),
  vouchers: z.array(
    z.object({
      rowNumber: z.number(),
      voucherNo: z.number(),
      date: z.string(),
      accountsGroup: z.string(),
      accountHead: z.string(),
      voucherType: z.enum(["payment", "received", "journal", "contra", "bf", "bp", "br"]).nullable(),
      paymentMode: z.string(),
      receipts: z.number(),
      payments: z.number(),
      description: z.string(),
      valid: z.boolean(),
      errors: z.array(z.string()),
    })
  ),
})

function createServiceRoleClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function normalizeType(value: string): VoucherType {
  if (value === "payment" || value === "received" || value === "journal" || value === "contra" || value === "bf" || value === "bp" || value === "br") {
    return value
  }
  return "journal"
}

export async function POST(request: Request, { params }: { params: { clientId: string } }) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = importSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid import payload." }, { status: 400 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const supabase = createServiceRoleClient()
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  const { data: client } = membership?.org_id
    ? await supabase.from("clients").select("*").eq("id", params.clientId).eq("org_id", membership.org_id).maybeSingle()
    : { data: null }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  const validRows = parsed.data.vouchers.filter((row) => row.valid && row.voucherType)
  const skippedRows = parsed.data.vouchers.filter((row) => !row.valid || !row.voucherType)
  const errors: Array<{ rowNumber: number; reason: string }> = skippedRows.map((row) => ({
    rowNumber: row.rowNumber,
    reason: row.errors.join(", ") || "Invalid row",
  }))

  const { data: accountHeads } = await supabase.from("account_heads").select("*").eq("client_id", client.id)
  const accountHeadMap = new Map((accountHeads ?? []).map((head) => [head.name.toLowerCase(), head.id]))

  const { data: paymentModes } = await supabase.from("payment_modes").select("*").eq("client_id", client.id)
  const paymentModeMap = new Map((paymentModes ?? []).map((mode) => [mode.name.toLowerCase(), mode.id]))

  let imported = 0
  for (const row of validRows) {
    try {
      let accountHeadId = accountHeadMap.get(row.accountHead.toLowerCase())
      if (!accountHeadId) {
        const { data: subGroups } = await supabase.from("account_sub_groups").select("*").eq("client_id", client.id).limit(1)
        const firstSubGroup = subGroups?.[0]
        if (!firstSubGroup) {
          errors.push({ rowNumber: row.rowNumber, reason: "No account subgroup found to create missing account head." })
          continue
        }
        const { data: newHead, error: headError } = await supabase
          .from("account_heads")
          .insert({
            client_id: client.id,
            sub_group_id: firstSubGroup.id,
            name: row.accountHead,
            opening_balance: 0,
            balance_type: "debit",
            is_active: true,
            sort_order: 0,
          })
          .select("*")
          .single()
        if (headError || !newHead) {
          errors.push({ rowNumber: row.rowNumber, reason: headError?.message ?? "Failed to create account head." })
          continue
        }
        accountHeadId = newHead.id
        accountHeadMap.set(row.accountHead.toLowerCase(), newHead.id)
      }

      let paymentModeId = paymentModeMap.get(row.paymentMode.toLowerCase()) ?? null
      if (!paymentModeId && row.paymentMode) {
        const { data: mode, error: modeError } = await supabase
          .from("payment_modes")
          .insert({ client_id: client.id, name: row.paymentMode, type: "other", is_active: true })
          .select("*")
          .single()
        if (!modeError && mode) {
          paymentModeId = mode.id
          paymentModeMap.set(row.paymentMode.toLowerCase(), mode.id)
          await createPaymentModeAccountHeadForClient(client.id, mode.name, supabase)
        }
      }

      const { data: existingVoucher } = await supabase
        .from("vouchers")
        .select("id")
        .eq("client_id", client.id)
        .eq("fiscal_year_id", parsed.data.fiscalYearId)
        .eq("voucher_no", row.voucherNo)
        .maybeSingle()

      let voucherId = existingVoucher?.id
      if (!voucherId) {
        const { data: voucher, error: voucherError } = await supabase
          .from("vouchers")
          .insert({
            client_id: client.id,
            fiscal_year_id: parsed.data.fiscalYearId,
            voucher_no: row.voucherNo,
            voucher_date: row.date,
            voucher_type: normalizeType(row.voucherType ?? "journal"),
            payment_mode_id: paymentModeId,
            description: row.description || null,
            month_label: row.date?.slice(0, 7) ?? null,
            is_posted: true,
            created_by: user.id,
          })
          .select("*")
          .single()
        if (voucherError || !voucher) {
          errors.push({ rowNumber: row.rowNumber, reason: voucherError?.message ?? "Failed to create voucher." })
          continue
        }
        voucherId = voucher.id
      }

      const { error: entryError } = await supabase.from("voucher_entries").insert({
        voucher_id: voucherId,
        account_head_id: accountHeadId,
        accounts_group: row.accountsGroup || null,
        debit: row.receipts || 0,
        credit: row.payments || 0,
        description: row.description || null,
      })

      if (entryError) {
        errors.push({ rowNumber: row.rowNumber, reason: entryError.message })
        continue
      }

      imported += 1
    } catch (error) {
      errors.push({
        rowNumber: row.rowNumber,
        reason: error instanceof Error ? error.message : "Unexpected import error.",
      })
    }
  }

  return NextResponse.json({
    imported,
    skipped: parsed.data.vouchers.length - imported,
    errors,
  })
}
