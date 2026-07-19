import { NextResponse } from "next/server"

import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AccountHead } from "@/lib/types"

type HierarchyLevel = "group" | "category" | "sub-category"

function createServiceRoleClient() {
  return supabaseAdmin
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
}

function isHierarchyLevel(value: string): value is HierarchyLevel {
  return value === "group" || value === "category" || value === "sub-category"
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string; level: string; itemId: string }> }
) {
  const { clientId, level, itemId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!isHierarchyLevel(level)) {
    return NextResponse.json({ error: "Invalid hierarchy level." }, { status: 400 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
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

  if (level === "group") {
    const { data: group } = await supabase
      .from("account_groups")
      .select("id, name")
      .eq("id", itemId)
      .eq("client_id", client.id)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: "Account group not found." }, { status: 404 })
    }

    const { count: categoryCount, error: categoryError } = await supabase
      .from("account_semi_sub_groups")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("group_id", itemId)

    if (categoryError) {
      return NextResponse.json({ error: categoryError.message }, { status: 400 })
    }

    if ((categoryCount ?? 0) > 0) {
      return conflict("This account group still has categories inside it. Remove those first.")
    }

    const { error: deleteError } = await supabase
      .from("account_groups")
      .delete()
      .eq("id", itemId)
      .eq("client_id", client.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }

  if (level === "category") {
    const { data: category } = await supabase
      .from("account_semi_sub_groups")
      .select("id, name")
      .eq("id", itemId)
      .eq("client_id", client.id)
      .maybeSingle()

    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 })
    }

    const { count: subCategoryCount, error: subCategoryError } = await supabase
      .from("account_sub_groups")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("semi_sub_id", itemId)

    if (subCategoryError) {
      return NextResponse.json({ error: subCategoryError.message }, { status: 400 })
    }

    if ((subCategoryCount ?? 0) > 0) {
      return conflict("This category still has sub-categories inside it. Remove those first.")
    }

    const { error: deleteError } = await supabase
      .from("account_semi_sub_groups")
      .delete()
      .eq("id", itemId)
      .eq("client_id", client.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }

  const { data: subCategory } = await supabase
    .from("account_sub_groups")
    .select("id, name")
    .eq("id", itemId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!subCategory) {
    return NextResponse.json({ error: "Sub-category not found." }, { status: 404 })
  }

  const { data: heads, error: headError } = await supabase
    .from("account_heads")
    .select("id, is_active")
    .eq("client_id", client.id)
    .eq("sub_group_id", itemId)

  if (headError) {
    return NextResponse.json({ error: headError.message }, { status: 400 })
  }

  const subgroupHeads = (heads ?? []) as Pick<AccountHead, "id" | "is_active">[]

  const activeHeadIds = subgroupHeads
    .filter((head) => head.is_active ?? true)
    .map((head) => head.id)

  if (activeHeadIds.length > 0) {
    return conflict("This sub-category still has account heads inside it. Remove those first.")
  }

  const archivedHeadIds = subgroupHeads
    .filter((head) => head.is_active === false)
    .map((head) => head.id)

  if (archivedHeadIds.length > 0) {
    const [{ count: voucherUsageCount, error: voucherUsageError }, { count: mappingUsageCount, error: mappingUsageError }] =
      await Promise.all([
        supabase
          .from("voucher_entries")
          .select("id", { count: "exact", head: true })
          .in("account_head_id", archivedHeadIds),
        supabase
          .from("payroll_account_mappings")
          .select("id", { count: "exact", head: true })
          .eq("client_id", client.id)
          .in("account_head_id", archivedHeadIds),
      ])

    const usageError = voucherUsageError ?? mappingUsageError
    if (usageError) {
      return NextResponse.json({ error: usageError.message }, { status: 400 })
    }

    if ((voucherUsageCount ?? 0) > 0 || (mappingUsageCount ?? 0) > 0) {
      return conflict(
        "This sub-category only has archived account heads left, but they are still linked to vouchers or payroll mappings."
      )
    }

    const { error: cleanupError } = await supabase
      .from("account_heads")
      .delete()
      .eq("client_id", client.id)
      .eq("sub_group_id", itemId)
      .eq("is_active", false)

    if (cleanupError) {
      return NextResponse.json({ error: cleanupError.message }, { status: 400 })
    }
  }

  const { error: deleteError } = await supabase
    .from("account_sub_groups")
    .delete()
    .eq("id", itemId)
    .eq("client_id", client.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
