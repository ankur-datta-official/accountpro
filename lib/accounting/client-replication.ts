import { randomUUID } from "crypto"

import { getPlanClientLimit } from "@/lib/team"
import type {
  AccountHead,
  AccountHeadInsert,
  Client,
  ClientInsert,
  FiscalYear,
  FiscalYearInsert,
  PaymentMode,
  PaymentModeInsert,
  Voucher,
  VoucherEntry,
  VoucherEntryInsert,
  VoucherInsert,
} from "@/lib/types"
import { supabaseAdmin } from "@/lib/supabase/admin"

type ReplicateClientOptions = {
  sourceClientId: string
  targetClientName?: string | null
  accessToken: string
}

async function insertFiscalYears(rows: FiscalYearInsert[]) {
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200)
    const { error } = await supabaseAdmin.from("fiscal_years").insert(chunk)

    if (error) {
      throw new Error(error.message)
    }
  }
}

async function insertPaymentModes(rows: PaymentModeInsert[]) {
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200)
    const { error } = await supabaseAdmin.from("payment_modes").insert(chunk)

    if (error) {
      throw new Error(error.message)
    }
  }
}

async function insertAccountHeads(rows: AccountHeadInsert[]) {
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200)
    const { error } = await supabaseAdmin.from("account_heads").insert(chunk)

    if (error) {
      throw new Error(error.message)
    }
  }
}

async function insertVouchers(rows: VoucherInsert[]) {
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200)
    const { error } = await supabaseAdmin.from("vouchers").insert(chunk)

    if (error) {
      throw new Error(error.message)
    }
  }
}

async function insertVoucherEntries(rows: VoucherEntryInsert[]) {
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200)
    const { error } = await supabaseAdmin.from("voucher_entries").insert(chunk)

    if (error) {
      throw new Error(error.message)
    }
  }
}

async function insertInChunks(
  table: string,
  rows:
    | FiscalYearInsert[]
    | PaymentModeInsert[]
    | AccountHeadInsert[]
    | VoucherInsert[]
    | VoucherEntryInsert[]
) {
  switch (table) {
    case "fiscal_years":
      await insertFiscalYears(rows as FiscalYearInsert[])
      return
    case "payment_modes":
      await insertPaymentModes(rows as PaymentModeInsert[])
      return
    case "account_heads":
      await insertAccountHeads(rows as AccountHeadInsert[])
      return
    case "vouchers":
      await insertVouchers(rows as VoucherInsert[])
      return
    case "voucher_entries":
      await insertVoucherEntries(rows as VoucherEntryInsert[])
      return
    default:
      throw new Error(`Unsupported replication table: ${table}`)
  }
}

async function buildCopyName(orgId: string, sourceName: string) {
  const baseName = `${sourceName} Copy`
  const { data: existingClients, error } = await supabaseAdmin
    .from("clients")
    .select("name")
    .eq("org_id", orgId)
    .ilike("name", `${baseName}%`)

  if (error) {
    throw new Error(error.message)
  }

  const existingNames = new Set(
    ((existingClients ?? []) as Pick<Client, "name">[]).map((client: Pick<Client, "name">) =>
      client.name.trim().toLowerCase()
    )
  )

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName
  }

  let suffix = 2
  while (existingNames.has(`${baseName} ${suffix}`.toLowerCase())) {
    suffix += 1
  }

  return `${baseName} ${suffix}`
}

export async function replicateClientWorkspace({
  sourceClientId,
  targetClientName,
  accessToken,
}: ReplicateClientOptions) {
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken)

  if (userError || !user) {
    throw new Error("Unauthorized.")
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  if (!membership?.org_id) {
    throw new Error("No active organization found.")
  }

  const [{ data: organization, error: organizationError }, { data: sourceClient, error: sourceClientError }] =
    await Promise.all([
      supabaseAdmin.from("organizations").select("*").eq("id", membership.org_id).maybeSingle(),
      supabaseAdmin
        .from("clients")
        .select("*")
        .eq("id", sourceClientId)
        .eq("org_id", membership.org_id)
        .maybeSingle(),
    ])

  if (organizationError) {
    throw new Error(organizationError.message)
  }

  if (!organization) {
    throw new Error("Organization not found.")
  }

  if (sourceClientError) {
    throw new Error(sourceClientError.message)
  }

  if (!sourceClient) {
    throw new Error("Client not found.")
  }

  const { count: activeClientCount, error: countError } = await supabaseAdmin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.org_id)
    .eq("is_active", true)

  if (countError) {
    throw new Error(countError.message)
  }

  const clientLimit = organization.max_clients ?? getPlanClientLimit(organization.plan)
  if (clientLimit !== null && (activeClientCount ?? 0) >= clientLimit) {
    throw new Error(`Your organization has reached the active client limit of ${clientLimit}.`)
  }

  const copyName = targetClientName?.trim() || (await buildCopyName(membership.org_id, sourceClient.name))

  const [
    { data: fiscalYears, error: fiscalYearsError },
    { data: paymentModes, error: paymentModesError },
    { data: accountHeads, error: accountHeadsError },
    { data: vouchers, error: vouchersError },
  ] = await Promise.all([
    supabaseAdmin.from("fiscal_years").select("*").eq("client_id", sourceClient.id).order("start_date"),
    supabaseAdmin.from("payment_modes").select("*").eq("client_id", sourceClient.id).order("name"),
    supabaseAdmin.from("account_heads").select("*").eq("client_id", sourceClient.id).order("sort_order"),
    supabaseAdmin.from("vouchers").select("*").eq("client_id", sourceClient.id).order("voucher_date"),
  ])

  const dataErrors = [
    fiscalYearsError,
    paymentModesError,
    accountHeadsError,
    vouchersError,
  ].filter(Boolean)

  if (dataErrors.length) {
    throw new Error(dataErrors[0]?.message ?? "Unable to load client data for replication.")
  }

  const voucherIds = ((vouchers ?? []) as Voucher[]).map((voucher: Voucher) => voucher.id)
  const { data: voucherEntries, error: voucherEntriesError } = voucherIds.length
    ? await supabaseAdmin
        .from("voucher_entries")
        .select("*")
        .in("voucher_id", voucherIds)
        .order("created_at")
    : { data: [], error: null }

  if (voucherEntriesError) {
    throw new Error(voucherEntriesError.message)
  }

  const newClientId = randomUUID()
  const fiscalYearIdMap = new Map<string, string>()
  const paymentModeIdMap = new Map<string, string>()
  const accountHeadIdMap = new Map<string, string>()
  const voucherIdMap = new Map<string, string>()

  const clientInsert: ClientInsert = {
    id: newClientId,
    org_id: membership.org_id,
    name: copyName,
    type: sourceClient.type,
    trade_name: sourceClient.trade_name,
    tin: sourceClient.tin,
    bin: sourceClient.bin,
    address: sourceClient.address,
    phone: sourceClient.phone,
    email: sourceClient.email,
    fiscal_year_start: sourceClient.fiscal_year_start,
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  const fiscalYearRows: FiscalYearInsert[] = ((fiscalYears ?? []) as FiscalYear[]).map((row: FiscalYear) => {
    const newId = randomUUID()
    fiscalYearIdMap.set(row.id, newId)

    return {
      id: newId,
      client_id: newClientId,
      label: row.label,
      start_date: row.start_date,
      end_date: row.end_date,
      is_active: row.is_active,
      is_closed: row.is_closed,
      created_at: row.created_at,
    }
  })

  const paymentModeRows: PaymentModeInsert[] = ((paymentModes ?? []) as PaymentMode[]).map((row: PaymentMode) => {
    const newId = randomUUID()
    paymentModeIdMap.set(row.id, newId)

    return {
      id: newId,
      client_id: newClientId,
      name: row.name,
      type: row.type,
      account_no: row.account_no,
      is_active: row.is_active,
    }
  })

  const sourceAccountHeads = (accountHeads ?? []) as AccountHead[]
  for (const row of sourceAccountHeads) {
    accountHeadIdMap.set(row.id, randomUUID())
  }

  const accountHeadRows: AccountHeadInsert[] = sourceAccountHeads.map((row: AccountHead) => ({
    id: accountHeadIdMap.get(row.id) ?? randomUUID(),
    client_id: newClientId,
    parent_id: row.parent_id ? accountHeadIdMap.get(row.parent_id) ?? null : null,
    name: row.name,
    type: row.type,
    opening_balance: row.opening_balance,
    balance_type: row.balance_type,
    is_active: row.is_active,
    sort_order: row.sort_order,
    created_at: row.created_at,
  }))

  const voucherRows: VoucherInsert[] = ((vouchers ?? []) as Voucher[]).map((row: Voucher) => {
    const newId = randomUUID()
    voucherIdMap.set(row.id, newId)

    return {
      id: newId,
      client_id: newClientId,
      fiscal_year_id: row.fiscal_year_id ? fiscalYearIdMap.get(row.fiscal_year_id) ?? null : null,
      voucher_no: row.voucher_no,
      voucher_date: row.voucher_date,
      voucher_type: row.voucher_type,
      payment_mode_id: row.payment_mode_id ? paymentModeIdMap.get(row.payment_mode_id) ?? null : null,
      description: row.description,
      month_label: row.month_label,
      is_posted: row.is_posted,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })

  const voucherEntryRows: VoucherEntryInsert[] = ((voucherEntries ?? []) as VoucherEntry[]).map(
    (row: VoucherEntry) => ({
    id: randomUUID(),
    voucher_id: row.voucher_id ? voucherIdMap.get(row.voucher_id) ?? null : null,
    account_head_id: row.account_head_id ? accountHeadIdMap.get(row.account_head_id) ?? null : null,
    accounts_group: row.accounts_group,
    debit: row.debit,
    credit: row.credit,
    description: row.description,
    created_at: row.created_at,
  }))

  try {
    const { error: clientInsertError } = await supabaseAdmin.from("clients").insert(clientInsert)

    if (clientInsertError) {
      throw new Error(clientInsertError.message)
    }

    await insertInChunks("fiscal_years", fiscalYearRows)
    await insertInChunks("payment_modes", paymentModeRows)
    await insertInChunks("account_heads", accountHeadRows)
    await insertInChunks("vouchers", voucherRows)
    await insertInChunks("voucher_entries", voucherEntryRows)
  } catch (error) {
    await supabaseAdmin.from("clients").delete().eq("id", newClientId)
    throw error
  }

  return {
    clientId: newClientId,
    clientName: copyName,
  }
}
