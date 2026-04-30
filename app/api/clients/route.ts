import { NextResponse } from "next/server"
import { z } from "zod"

import { buildInitialFiscalYear } from "@/lib/accounting/clients"
import {
  createDefaultChartOfAccounts,
  createDefaultPaymentModes,
} from "@/lib/accounting/defaults"
import { ensureActiveMembershipForUser } from "@/lib/actions/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { ClientInsert } from "@/lib/types"

const createClientSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["company", "individual", "partnership", "ngo"]),
  trade_name: z.string().optional().nullable(),
  tin: z.string().optional().nullable(),
  bin: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  fiscal_year_start: z.number().int().min(1).max(12).default(7),
})

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const body = await request.json().catch(() => null)
  const parsed = createClientSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid client data." },
      { status: 400 }
    )
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken)

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { data: membership } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  let orgId = membership?.org_id ?? null

  if (!orgId) {
    try {
      orgId = await ensureActiveMembershipForUser({
        userId: user.id,
        email: user.email,
        fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
      })
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "No active organization found.",
        },
        { status: 403 }
      )
    }
  }

  if (!orgId) {
    return NextResponse.json({ error: "No active organization found." }, { status: 403 })
  }

  const payload = parsed.data
  const clientValues: ClientInsert = {
    org_id: orgId,
    name: payload.name,
    type: payload.type,
    trade_name: payload.trade_name || null,
    tin: payload.tin || null,
    bin: payload.bin || null,
    address: payload.address || null,
    phone: payload.phone || null,
    email: payload.email || null,
    fiscal_year_start: payload.fiscal_year_start,
    is_active: true,
  }

  const { data: insertedClient, error: clientError } = await supabaseAdmin
    .from("clients")
    .insert(clientValues)
    .select("*")
    .single()

  if (clientError || !insertedClient) {
    return NextResponse.json(
      { error: clientError?.message ?? "Unable to create client." },
      { status: 400 }
    )
  }

  const fiscalYear = buildInitialFiscalYear(payload.fiscal_year_start)
  const { error: fiscalYearError } = await supabaseAdmin.from("fiscal_years").insert({
    client_id: insertedClient.id,
    label: fiscalYear.label,
    start_date: fiscalYear.start_date,
    end_date: fiscalYear.end_date,
    is_active: true,
    is_closed: false,
  })

  if (fiscalYearError) {
    await supabaseAdmin.from("clients").delete().eq("id", insertedClient.id)
    return NextResponse.json(
      { error: fiscalYearError.message ?? "Unable to create fiscal year." },
      { status: 400 }
    )
  }

  const { error: paymentModesError } = await supabaseAdmin
    .from("payment_modes")
    .insert(createDefaultPaymentModes(insertedClient.id))

  if (paymentModesError) {
    await supabaseAdmin.from("fiscal_years").delete().eq("client_id", insertedClient.id)
    await supabaseAdmin.from("clients").delete().eq("id", insertedClient.id)
    return NextResponse.json(
      { error: paymentModesError.message ?? "Unable to create payment modes." },
      { status: 400 }
    )
  }

  try {
    await createDefaultChartOfAccounts(insertedClient.id, supabaseAdmin)
  } catch (error) {
    await supabaseAdmin.from("clients").delete().eq("id", insertedClient.id)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create default chart of accounts.",
      },
      { status: 400 }
    )
  }

  return NextResponse.json({ clientId: insertedClient.id })
}
