import { NextResponse } from "next/server"
import { z } from "zod"

import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import {
  normalizePaymentModeName,
} from "@/lib/accounting/payment-modes"
import { syncPaymentModeAccountHeadForClient } from "@/lib/accounting/defaults"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { PaymentMode } from "@/lib/types"

const paymentModeSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["bank", "cash", "mobile_banking", "other"]),
  account_no: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
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

  const { error } = await supabase
    .from("payment_modes")
    .update({
      name: normalizedName,
      type: parsed.data.type,
      account_no: parsed.data.account_no || null,
      is_active: parsed.data.is_active,
    })
    .eq("id", paymentModeId)
    .eq("client_id", client.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await syncPaymentModeAccountHeadForClient(
    client.id,
    {
      previousName: existingMode.name,
      nextName: normalizedName,
    },
    supabase
  )

  return NextResponse.json({ success: true })
}
