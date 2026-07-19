import { NextResponse } from "next/server"
import { z } from "zod"

import { canManageClient, getAuthorizedClient } from "@/lib/api-auth"
import { replicateClientWorkspace } from "@/lib/accounting/client-replication"
import { supabaseAdmin } from "@/lib/supabase/admin"

const replicateClientSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = replicateClientSchema.safeParse(await request.json().catch(() => ({})))

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid replication request." },
      { status: 400 }
    )
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const { user, membership, client } = await getAuthorizedClient(accessToken, clientId, supabaseAdmin)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  if (!canManageClient(membership)) {
    return NextResponse.json(
      { error: "Only owners and admins can replicate clients." },
      { status: 403 }
    )
  }

  try {
    const result = await replicateClientWorkspace({
      sourceClientId: clientId,
      targetClientName: parsed.data.name,
      accessToken,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to replicate client."
    const status =
      message === "Unauthorized."
        ? 401
        : message === "Client not found."
          ? 404
          : message === "No active organization found."
            ? 403
            : 400

    return NextResponse.json({ error: message }, { status })
  }
}
