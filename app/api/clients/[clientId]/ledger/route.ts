import { NextResponse } from "next/server"
import { z } from "zod"

import { getAuthorizedClient } from "@/lib/api-auth"
import { buildLedgerDataset } from "@/lib/accounting/ledger-dataset"
import { supabaseAdmin } from "@/lib/supabase/admin"

const querySchema = z.object({
  fiscalYearId: z.string().min(1, "Fiscal year is required."),
  from: z.string().optional(),
  to: z.string().optional(),
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

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid ledger filters." },
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
    const dataset = await buildLedgerDataset(supabase, {
      clientId: client.id,
      fiscalYearId: parsed.data.fiscalYearId,
      from: parsed.data.from,
      to: parsed.data.to,
    })

    return NextResponse.json(dataset)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load ledger dataset.",
      },
      { status: 500 }
    )
  }
}
