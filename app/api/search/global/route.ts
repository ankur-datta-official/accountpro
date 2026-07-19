import { NextResponse } from "next/server"

import { buildClientPath, buildClientRouteSegment } from "@/lib/routing/clients"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AccountHead, Client, OrganizationMember, Voucher, VoucherEntry } from "@/lib/types"

function createServiceRoleClient() {
  return supabaseAdmin
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim().toLowerCase()

  if (!q) {
    return NextResponse.json({
      clients: [],
      vouchers: [],
      accountHeads: [],
    })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const supabase = createServiceRoleClient()
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!membership?.org_id) {
    return NextResponse.json({ error: "No active organization found." }, { status: 403 })
  }

  const typedMembership = membership as OrganizationMember
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("org_id", typedMembership.org_id)

  const clientRows = (clients ?? []) as Client[]
  const clientMap = new Map(clientRows.map((client: Client) => [client.id, client.name]))
  const clientRouteMap = new Map(
    clientRows.map((client: Client) => [client.id, buildClientRouteSegment(client)])
  )
  const clientIds = clientRows.map((client: Client) => client.id)

  const filteredClients = clientRows
    .filter((client: Client) =>
      [client.name, client.tin, client.bin]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    )
    .slice(0, 8)
    .map((client: Client) => ({
      id: client.id,
      title: client.name,
      subtitle: [client.tin ? `TIN: ${client.tin}` : null, client.bin ? `BIN: ${client.bin}` : null]
        .filter(Boolean)
        .join(" | "),
      href: buildClientPath(client),
    }))

  const { data: vouchers } = clientIds.length
    ? await supabase
        .from("vouchers")
        .select("*")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false })
        .limit(250)
    : { data: [] }

  const voucherRows = (vouchers ?? []) as Voucher[]
  const voucherIds = voucherRows.map((voucher: Voucher) => voucher.id)
  const { data: voucherEntries } = voucherIds.length
    ? await supabase.from("voucher_entries").select("*").in("voucher_id", voucherIds)
    : { data: [] }

  const voucherAmountMap = new Map<string, number>()
  for (const entry of (voucherEntries ?? []) as VoucherEntry[]) {
    const amount = Math.max(Number(entry.debit ?? 0), Number(entry.credit ?? 0))
    voucherAmountMap.set(entry.voucher_id ?? "", (voucherAmountMap.get(entry.voucher_id ?? "") ?? 0) + amount)
  }

  const filteredVouchers = voucherRows
    .filter((voucher: Voucher) => {
      const amount = voucherAmountMap.get(voucher.id) ?? 0
      return [voucher.description, String(voucher.voucher_no), String(amount)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    })
    .slice(0, 10)
    .map((voucher: Voucher) => ({
      id: voucher.id,
      title: `Voucher #${voucher.voucher_no}`,
      subtitle: `${clientMap.get(voucher.client_id ?? "") ?? "Client"} | ${voucher.voucher_type} | BDT ${(
        voucherAmountMap.get(voucher.id) ?? 0
      ).toFixed(2)}`,
      href: buildClientPath(
        {
          id: voucher.client_id ?? "",
          name: clientMap.get(voucher.client_id ?? "") ?? "Client",
          routeSegment: clientRouteMap.get(voucher.client_id ?? ""),
        },
        `/vouchers/${voucher.id}`
      ),
    }))

  const { data: accountHeads } = clientIds.length
    ? await supabase.from("account_heads").select("*").in("client_id", clientIds).limit(600)
    : { data: [] }

  const accountHeadRows = (accountHeads ?? []) as AccountHead[]
  const filteredHeads = accountHeadRows
    .filter((head: AccountHead) => head.name.toLowerCase().includes(q))
    .slice(0, 10)
    .map((head: AccountHead) => ({
      id: head.id,
      title: head.name,
      subtitle: clientMap.get(head.client_id ?? "") ?? "Client",
      href: buildClientPath(
        {
          id: head.client_id ?? "",
          name: clientMap.get(head.client_id ?? "") ?? "Client",
          routeSegment: clientRouteMap.get(head.client_id ?? ""),
        },
        "/accounts"
      ),
    }))

  return NextResponse.json({
    clients: filteredClients,
    vouchers: filteredVouchers,
    accountHeads: filteredHeads,
  })
}
