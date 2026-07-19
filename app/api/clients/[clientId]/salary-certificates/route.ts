import { NextResponse } from "next/server"
import { z } from "zod"

import { canWriteClientData } from "@/lib/api-auth"
import { getCurrentOrganizationContext, createClient } from "@/lib/supabase/server"
import {
  buildSalaryCertificatePreview,
  generateSalaryCertificateDraft,
  listSalaryCertificates,
} from "@/lib/salary-certificates/service"

const querySchema = z.object({
  fiscalYearId: z.string().optional(),
  employeeId: z.string().optional(),
  preview: z.enum(["true", "false"]).optional(),
})

const generateSchema = z.object({
  employeeId: z.string().min(1, "Employee is required."),
  fiscalYearId: z.string().min(1, "Fiscal year is required."),
})

async function getAuthorizedClient(clientId: string) {
  const supabase = await createClient()
  const { membership, user } = await getCurrentOrganizationContext()

  if (!user) {
    return { supabase, user: null, membership: null, client: null }
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("org_id", membership?.org_id ?? "")
    .maybeSingle()

  return { supabase, user, membership, client }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid filters." }, { status: 400 })
  }

  const { supabase, user, client } = await getAuthorizedClient(clientId)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  try {
    if (parsed.data.preview === "true") {
      if (!parsed.data.employeeId || !parsed.data.fiscalYearId) {
        return NextResponse.json({ error: "Employee and fiscal year are required for preview." }, { status: 400 })
      }

      const result = await buildSalaryCertificatePreview(supabase, {
        clientId: client.id,
        employeeId: parsed.data.employeeId,
        fiscalYearId: parsed.data.fiscalYearId,
      })

      if (!result.ok) {
        return NextResponse.json({ error: result.error, missingMonths: result.missingMonths ?? [] }, { status: 400 })
      }

      return NextResponse.json({ snapshot: result.snapshot })
    }

    const history = await listSalaryCertificates(
      supabase,
      client.id,
      parsed.data.fiscalYearId,
      parsed.data.employeeId
    )

    return NextResponse.json({ history })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load salary certificates." },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const body = await request.json().catch(() => null)
  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 })
  }

  const { supabase, user, membership, client } = await getAuthorizedClient(clientId)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }
  if (!canWriteClientData(membership)) {
    return NextResponse.json({ error: "You do not have permission to generate salary certificates." }, { status: 403 })
  }

  try {
    const result = await generateSalaryCertificateDraft(supabase, {
      clientId: client.id,
      employeeId: parsed.data.employeeId,
      fiscalYearId: parsed.data.fiscalYearId,
      generatedBy: user.id,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      certificate: {
        id: result.certificate.id,
        certificateNo: result.certificate.certificate_no,
        status: result.certificate.status,
      },
      snapshot: result.snapshot,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate salary certificate." },
      { status: 500 }
    )
  }
}
