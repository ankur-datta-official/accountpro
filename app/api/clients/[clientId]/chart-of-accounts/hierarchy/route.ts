import { NextResponse } from "next/server"
import { z } from "zod"

import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AccountGroupType } from "@/lib/types"

const createHierarchyItemSchema = z
  .object({
    level: z.enum(["group", "category", "sub-category"]),
    name: z.string().trim().min(2, "Name is required."),
    groupType: z.enum(["expense", "income", "asset", "liability"]).optional(),
    groupId: z.string().optional(),
    semiSubGroupId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.level === "group" && !value.groupType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Account type is required for a new account group.",
        path: ["groupType"],
      })
    }

    if (value.level === "category" && !value.groupId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Account group is required for a new category.",
        path: ["groupId"],
      })
    }

    if (value.level === "sub-category" && !value.semiSubGroupId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category is required for a new sub-category.",
        path: ["semiSubGroupId"],
      })
    }
  })

function createServiceRoleClient() {
  return supabaseAdmin
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
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
  const parsed = createHierarchyItemSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid hierarchy item data." },
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
      { error: "You do not have permission to modify the chart of accounts." },
      { status: 403 }
    )
  }

  const values = parsed.data

  if (values.level === "group") {
    const groupType = values.groupType as AccountGroupType
    const { data: existingGroup } = await supabase
      .from("account_groups")
      .select("id")
      .eq("client_id", client.id)
      .eq("type", groupType)
      .ilike("name", values.name)
      .maybeSingle()

    if (existingGroup) {
      return conflict("An account group with this name already exists under the selected account type.")
    }

    const { count } = await supabase
      .from("account_groups")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("type", groupType)

    const { data, error } = await supabase
      .from("account_groups")
      .insert({
        client_id: client.id,
        name: values.name,
        type: groupType,
        sort_order: count ?? 0,
      })
      .select("*")
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to create account group." },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, item: data })
  }

  if (values.level === "category") {
    const { data: existingCategory } = await supabase
      .from("account_semi_sub_groups")
      .select("id")
      .eq("client_id", client.id)
      .eq("group_id", values.groupId!)
      .ilike("name", values.name)
      .maybeSingle()

    if (existingCategory) {
      return conflict("A category with this name already exists under the selected account group.")
    }

    const { count } = await supabase
      .from("account_semi_sub_groups")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("group_id", values.groupId!)

    const { data, error } = await supabase
      .from("account_semi_sub_groups")
      .insert({
        client_id: client.id,
        group_id: values.groupId!,
        name: values.name,
        sort_order: count ?? 0,
      })
      .select("*")
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to create category." },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, item: data })
  }

  const { data: existingSubCategory } = await supabase
    .from("account_sub_groups")
    .select("id")
    .eq("client_id", client.id)
    .eq("semi_sub_id", values.semiSubGroupId!)
    .ilike("name", values.name)
    .maybeSingle()

  if (existingSubCategory) {
    return conflict("A sub-category with this name already exists under the selected category.")
  }

  const { count } = await supabase
    .from("account_sub_groups")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .eq("semi_sub_id", values.semiSubGroupId!)

  const { data, error } = await supabase
    .from("account_sub_groups")
    .insert({
      client_id: client.id,
      semi_sub_id: values.semiSubGroupId!,
      name: values.name,
      sort_order: count ?? 0,
    })
    .select("*")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to create sub-category." },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, item: data })
}
