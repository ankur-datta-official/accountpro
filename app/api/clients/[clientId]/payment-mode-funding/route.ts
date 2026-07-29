import { NextResponse } from "next/server"
import { z } from "zod"

import { getAuthorizedClient } from "@/lib/api-auth"
import { getPaymentModeFundingSnapshot } from "@/lib/accounting/payment-mode-funding"
import { supabaseAdmin } from "@/lib/supabase/admin"

const fundingQuerySchema = z.object({
  voucherDate: z.string().min(1),
  paymentModeIds: z.string().min(1),
  excludeVoucherId: z.string().optional(),
})

function createServiceRoleClient() {
  return supabaseAdmin
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = fundingQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid funding request." },
      { status: 400 }
    )
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const supabase = createServiceRoleClient()
  const { user, client } = await getAuthorizedClient(accessToken, clientId, supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  try {
    const items = await getPaymentModeFundingSnapshot({
      supabase,
      clientId: client.id,
      voucherDate: parsed.data.voucherDate,
      paymentModeIds: parsed.data.paymentModeIds.split(",").map((value) => value.trim()).filter(Boolean),
      excludeVoucherId: parsed.data.excludeVoucherId,
    })

    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load payment mode funding.",
      },
      { status: 400 }
    )
  }
}
