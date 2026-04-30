import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"

import type { Database } from "@/lib/types"

const createAccountHeadSchema = z.object({
  accountHeadName: z.string().min(2),
  openingBalance: z.number().default(0),
  balanceType: z.enum(["debit", "credit"]),
  accountGroupId: z.string().optional(),
  semiSubGroupId: z.string().optional(),
  subGroupId: z.string().optional(),
  newGroupName: z.string().optional(),
  newGroupType: z.enum(["expense", "income", "asset", "liability"]).optional(),
  newSemiSubGroupName: z.string().optional(),
  newSubGroupName: z.string().optional(),
})

function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

async function getAuthorizedClient(
  accessToken: string,
  clientId: string,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken)

  if (!user) {
    return { user: null, client: null }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  const { data: client } = membership?.org_id
    ? await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()
    : { data: null }

  return { user, client }
}

export async function GET(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const supabase = createServiceRoleClient()
  const { user, client } = await getAuthorizedClient(accessToken, params.clientId, supabase)

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
    supabase.from("account_heads").select("*").eq("client_id", client.id).order("sort_order"),
  ])

  return NextResponse.json({
    groups: groupsRes.data ?? [],
    semiSubGroups: semiRes.data ?? [],
    subGroups: subRes.data ?? [],
    accountHeads: headsRes.data ?? [],
  })
}

export async function POST(
  request: Request,
  { params }: { params: { clientId: string } }
) {
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
  const { user, client } = await getAuthorizedClient(accessToken, params.clientId, supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
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
    const { data: group } = await supabase
      .from("account_groups")
      .select("*")
      .eq("id", groupId)
      .eq("client_id", client.id)
      .maybeSingle()

    groupType = group?.type ?? null
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

  const { count } = await supabase
    .from("account_heads")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .eq("sub_group_id", subGroupId)

  const { error } = await supabase.from("account_heads").insert({
    client_id: client.id,
    sub_group_id: subGroupId,
    name: values.accountHeadName,
    opening_balance: values.openingBalance,
    balance_type: values.balanceType,
    is_active: true,
    sort_order: count ?? 0,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, groupType })
}
