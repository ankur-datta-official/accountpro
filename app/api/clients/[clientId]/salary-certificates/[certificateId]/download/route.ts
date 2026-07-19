import { NextResponse } from "next/server"

import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import { getSalaryCertificatePdf } from "@/lib/salary-certificates/service"

export async function GET(
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

  try {
    const result = await getSalaryCertificatePdf(supabase, {
      clientId: client.id,
      certificateId,
    })

    return new NextResponse(result.pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.snapshot.employee.name.replace(/\s+/g, "-").toLowerCase()}-${result.certificate.certificate_no}.pdf"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate certificate PDF." },
      { status: 500 }
    )
  }
}
