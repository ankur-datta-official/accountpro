import { NextResponse } from "next/server"
import { z } from "zod"

import { clientTypeValues } from "@/lib/accounting/clients"
import { canManageClient, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

const updateClientSchema = z.object({
  name: z.string().min(2),
  type: z.enum(clientTypeValues),
  tin: z.string().optional().nullable(),
  bin: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  fiscal_year_start: z.number().int().min(1).max(12),
})

function createServiceRoleClient() {
  return supabaseAdmin
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = updateClientSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid client data." }, { status: 400 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const serviceClient = createServiceRoleClient()
  const { user, membership, client } = await getAuthorizedClient(accessToken, clientId, serviceClient)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  if (!canManageClient(membership)) {
    return NextResponse.json(
      { error: "Only owners and admins can update client settings." },
      { status: 403 }
    )
  }

  const { error } = await serviceClient
    .from("clients")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      tin: parsed.data.tin || null,
      bin: parsed.data.bin || null,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      fiscal_year_start: parsed.data.fiscal_year_start,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
