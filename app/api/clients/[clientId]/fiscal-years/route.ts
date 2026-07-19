import { parseISO } from "date-fns"
import { NextResponse } from "next/server"
import { z } from "zod"

import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { FiscalYear } from "@/lib/types"

const fiscalYearSchema = z.object({
  label: z.string().min(2),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

function createServiceRoleClient() {
  return supabaseAdmin
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const body = await request.json().catch(() => null)
  const parsed = fiscalYearSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid fiscal year data." },
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
      { error: "You do not have permission to manage fiscal years." },
      { status: 403 }
    )
  }

  const { data: existingYears } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", client.id) as { data: FiscalYear[] | null }

  const nextStart = parseISO(parsed.data.startDate).getTime()
  const nextEnd = parseISO(parsed.data.endDate).getTime()

  const overlaps = (existingYears ?? [] as FiscalYear[]).some((year) => {
    const currentStart = parseISO(year.start_date).getTime()
    const currentEnd = parseISO(year.end_date).getTime()
    return nextStart <= currentEnd && nextEnd >= currentStart
  })

  if (overlaps) {
    return NextResponse.json(
      { error: "This fiscal year overlaps with an existing period." },
      { status: 400 }
    )
  }

  const { error } = await supabase.from("fiscal_years").insert({
    client_id: client.id,
    label: parsed.data.label,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    is_active: false,
    is_closed: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
