import { NextResponse } from "next/server"
import { z } from "zod"

import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import {
  normalizePaymentModeName,
  syncPaymentModeAccountLink,
  validateExplicitPaymentModeAccountHead,
} from "@/lib/accounting/payment-modes"
import { createPaymentModeAccountHeadForClient } from "@/lib/accounting/defaults"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { PaymentMode } from "@/lib/types"

const paymentModeSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["bank", "cash", "mobile_banking", "other"]),
  account_no: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  account_head_id: z.string().uuid().optional().nullable(),
})

function createServiceRoleClient() {
  return supabaseAdmin
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string; paymentModeId: string }> }
) {
  const { clientId, paymentModeId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const body = await request.json().catch(() => null)
  const parsed = paymentModeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payment mode data." },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()
  const { user, membership, client } = await getAuthorizedClient(accessToken, clientId, supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  if (!canWriteClientData(membership)) {
    return NextResponse.json(
      { error: "You do not have permission to manage payment modes." },
      { status: 403 }
    )
  }

  const { data: existingMode } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("id", paymentModeId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!existingMode) {
    return NextResponse.json({ error: "Payment mode not found." }, { status: 404 })
  }

  const normalizedName = normalizePaymentModeName(parsed.data.name)
  const explicitAccountHead = parsed.data.account_head_id
    ? await validateExplicitPaymentModeAccountHead(supabase, {
        clientId: client.id,
        accountHeadId: parsed.data.account_head_id,
      })
    : null

  if (explicitAccountHead && !explicitAccountHead.success) {
    return NextResponse.json({ error: explicitAccountHead.error }, { status: 400 })
  }

  const { data: existingModes } = await supabase
    .from("payment_modes")
    .select("id, name")
    .eq("client_id", client.id)
    .eq("type", parsed.data.type) as { data: Pick<PaymentMode, "id" | "name">[] | null }

  const duplicateMode = (existingModes ?? [] as Pick<PaymentMode, "id" | "name">[]).find(
    (mode) =>
      mode.id !== existingMode.id &&
      normalizePaymentModeName(mode.name).toLowerCase() === normalizedName.toLowerCase()
  )

  if (duplicateMode) {
    return NextResponse.json({ error: "A payment mode with this name already exists." }, { status: 400 })
  }

  const { data: updatedMode, error } = await supabase
    .from("payment_modes")
    .update({
      name: normalizedName,
      type: parsed.data.type,
      account_no: parsed.data.account_no || null,
      is_active: parsed.data.is_active,
      account_head_id:
        parsed.data.account_head_id === null
          ? null
          : explicitAccountHead?.success
            ? explicitAccountHead.accountHead.id
            : existingMode.account_head_id,
    })
    .eq("id", paymentModeId)
    .eq("client_id", client.id)
    .select("*")
    .single()

  if (error || !updatedMode) {
    return NextResponse.json({ error: error?.message ?? "Unable to update payment mode." }, { status: 400 })
  }

  if (!updatedMode.account_head_id) {
    await createPaymentModeAccountHeadForClient(client.id, normalizedName, supabase)

    const linkedMode = await syncPaymentModeAccountLink({
      supabase,
      clientId: client.id,
      paymentMode: updatedMode,
    })

    if (!linkedMode.success) {
      return NextResponse.json({ error: linkedMode.error }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}
