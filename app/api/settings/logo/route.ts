import { NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase/admin"

const BUCKET_NAME = "organization-logos"

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
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

  if (!membership?.org_id || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "Only owners and admins can upload logos." }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
  const path = `${membership.org_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type || "image/png",
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 })
  }

  const { data: publicData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(path)

  return NextResponse.json({
    success: true,
    logoUrl: publicData.publicUrl,
  })
}
