import { NextResponse } from "next/server"

import { canWriteClientData } from "@/lib/api-auth"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import { issueSalaryCertificate } from "@/lib/salary-certificates/service"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ clientId: string; certificateId: string }> }
) {
  const { clientId, certificateId } = await params
  const supabase = await createClient()
  const { membership, user } = await getCurrentOrganizationContext()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("org_id", membership?.org_id ?? "")
    .maybeSingle()

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  if (!canWriteClientData(membership)) {
    return NextResponse.json({ error: "You do not have permission to issue salary certificates." }, { status: 403 })
  }

  try {
    const result = await issueSalaryCertificate(supabase, {
      clientId: client.id,
      certificateId,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      certificate: {
        id: result.certificate.id,
        status: result.certificate.status,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to issue salary certificate." },
      { status: 500 }
    )
  }
}
