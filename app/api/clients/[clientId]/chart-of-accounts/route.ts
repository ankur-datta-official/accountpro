import { NextResponse } from "next/server"
import { z } from "zod"

import { validateParentAssignment } from "@/lib/accounting/account-head-integrity"
import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AccountGroupType, AccountHead } from "@/lib/types"

const createAccountHeadSchema = z.object({
  accountHeadName: z.string().trim().min(2, "Account head name is required."),
  openingBalance: z.coerce.number().default(0),
  balanceType: z.enum(["debit", "credit"]).optional(),
  accountGroupId: z.string().optional(),
  semiSubGroupId: z.string().optional(),
  subGroupId: z.string().optional(),
  parentAccountHeadId: z.string().nullable().optional(),
  nodeType: z.enum(["branch", "posting"]).default("posting"),
  newGroupName: z.string().trim().optional(),
  newGroupType: z.enum(["expense", "income", "asset", "liability"]).optional(),
  newSemiSubGroupName: z.string().trim().optional(),
  newSubGroupName: z.string().trim().optional(),
})

function createServiceRoleClient() {
  return supabaseAdmin
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
}

async function getGroupType(
  clientId: string,
  groupId: string,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const { data: group } = await supabase
    .from("account_groups")
    .select("type")
    .eq("client_id", clientId)
    .eq("id", groupId)
    .maybeSingle()

  return (group?.type ?? null) as AccountGroupType | null
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

  const accessToken = authHeader.replace("Bearer ", "")
  const supabase = createServiceRoleClient()
  const { user, client } = await getAuthorizedClient(accessToken, clientId, supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  const [groupsRes, semiRes, subRes, headsRes] = await Promise.all([
    supabase.from("account_groups").select("*").eq("client_id", client.id).order("sort_order"),
    supabase
      .from("account_semi_sub_groups")
      .select("*")
      .eq("client_id", client.id)
      .order("sort_order"),
    supabase.from("account_sub_groups").select("*").eq("client_id", client.id).order("sort_order"),
    supabase
      .from("account_heads")
      .select("*")
      .eq("client_id", client.id)
      .or("is_active.eq.true,is_active.is.null")
      .order("sort_order"),
  ])

  const error = groupsRes.error ?? semiRes.error ?? subRes.error ?? headsRes.error
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    groups: groupsRes.data ?? [],
    semiSubGroups: semiRes.data ?? [],
    subGroups: subRes.data ?? [],
    accountHeads: (headsRes.data ?? []).map((head: AccountHead) => ({
      ...head,
      is_active: head.is_active ?? true,
    })),
  })
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
  const parsed = createAccountHeadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid account head data." },
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
  let groupId = values.accountGroupId ?? null
  let groupType = values.newGroupType ?? null

  if (!groupId && values.newGroupName && values.newGroupType) {
    const { count } = await supabase
      .from("account_groups")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)

    const { data: newGroup, error } = await supabase
      .from("account_groups")
      .insert({
        client_id: client.id,
        name: values.newGroupName,
        type: values.newGroupType,
        sort_order: count ?? 0,
      })
      .select("*")
      .single()

    if (error || !newGroup) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to create account group." },
        { status: 400 }
      )
    }

    groupId = newGroup.id
    groupType = newGroup.type
  }

  if (!groupId) {
    return NextResponse.json({ error: "Account group is required." }, { status: 400 })
  }

  if (!groupType) {
    groupType = await getGroupType(client.id, groupId, supabase)
  }

  let semiSubGroupId = values.semiSubGroupId ?? null

  if (!semiSubGroupId && values.newSemiSubGroupName) {
    const { count } = await supabase
      .from("account_semi_sub_groups")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("group_id", groupId)

    const { data: newSemiSubGroup, error } = await supabase
      .from("account_semi_sub_groups")
      .insert({
        client_id: client.id,
        group_id: groupId,
        name: values.newSemiSubGroupName,
        sort_order: count ?? 0,
      })
      .select("*")
      .single()

    if (error || !newSemiSubGroup) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to create semi-sub group." },
        { status: 400 }
      )
    }

    semiSubGroupId = newSemiSubGroup.id
  }

  if (!semiSubGroupId) {
    return NextResponse.json({ error: "Semi-sub group is required." }, { status: 400 })
  }

  let subGroupId = values.subGroupId ?? null

  if (!subGroupId && values.newSubGroupName) {
    const { count } = await supabase
      .from("account_sub_groups")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("semi_sub_id", semiSubGroupId)

    const { data: newSubGroup, error } = await supabase
      .from("account_sub_groups")
      .insert({
        client_id: client.id,
        semi_sub_id: semiSubGroupId,
        name: values.newSubGroupName,
        sort_order: count ?? 0,
      })
      .select("*")
      .single()

    if (error || !newSubGroup) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to create sub-group." },
        { status: 400 }
      )
    }

    subGroupId = newSubGroup.id
  }

  if (!subGroupId) {
    return NextResponse.json({ error: "Sub-group is required." }, { status: 400 })
  }

  const { data: siblingHeads, error: siblingHeadError } = await supabase
    .from("account_heads")
    .select("*")
    .eq("client_id", client.id)
    .eq("sub_group_id", subGroupId)

  if (siblingHeadError) {
    return NextResponse.json({ error: siblingHeadError.message }, { status: 400 })
  }

  const parentValidation = validateParentAssignment({
    parentId: values.parentAccountHeadId ?? null,
    clientId: client.id,
    subGroupId,
    heads: (siblingHeads ?? []) as AccountHead[],
  })

  if (!parentValidation.ok) {
    return conflict(parentValidation.message)
  }

  const { data: existingHead } = await supabase
    .from("account_heads")
    .select("id")
    .eq("client_id", client.id)
    .eq("sub_group_id", subGroupId)
    .eq("parent_id", values.parentAccountHeadId ?? null)
    .ilike("name", values.accountHeadName)
    .maybeSingle()

  if (existingHead) {
    return conflict(
      "An account head with this name already exists under the selected sub-group."
    )
  }

  const typedSiblingHeads = (siblingHeads ?? []) as AccountHead[]
  const parentCount = values.parentAccountHeadId
    ? typedSiblingHeads.filter((head) => head.parent_id === values.parentAccountHeadId).length
    : typedSiblingHeads.filter((head) => (head.parent_id ?? null) === null).length

  const { data: newHead, error } = await supabase
    .from("account_heads")
    .insert({
      client_id: client.id,
      sub_group_id: subGroupId,
      parent_id: values.parentAccountHeadId ?? null,
      name: values.accountHeadName,
      type: groupType,
      opening_balance: values.nodeType === "posting" ? values.openingBalance : 0,
      balance_type: values.nodeType === "posting" ? (values.balanceType ?? "debit") : null,
      is_active: true,
      sort_order: parentCount,
    })
    .select("*")
    .single()

  if (error || !newHead) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to create account head." },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, accountHead: newHead })
}
