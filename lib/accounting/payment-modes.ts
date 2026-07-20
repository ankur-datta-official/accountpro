import { createClient } from "@supabase/supabase-js"

import { createPaymentModeAccountHeadForClient } from "@/lib/accounting/defaults"
import type { Database, PaymentModeType } from "@/lib/types"

type SupabaseClient = ReturnType<typeof createClient<Database>>

export const BANGLADESH_MOBILE_BANKING_OPTIONS = [
  "bKash",
  "Nagad",
  "Rocket",
  "Upay",
  "mCash",
  "SureCash",
] as const

export const BANGLADESH_BANK_OPTIONS = [
  "AB Bank PLC",
  "Agrani Bank PLC",
  "Al-Arafah Islami Bank PLC",
  "BASIC Bank Ltd.",
  "Bangladesh Commerce Bank Ltd.",
  "Bangladesh Development Bank PLC",
  "Bangladesh Krishi Bank",
  "Bank Al-Falah",
  "Bank Asia PLC",
  "Bengal Commercial Bank PLC",
  "BRAC Bank",
  "Citizen Bank PLC",
  "Citibank N.A.",
  "City Bank PLC",
  "Commercial Bank of Ceylon Ltd.",
  "Community Bank Bangladesh PLC",
  "Dhaka Bank PLC",
  "Dutch-Bangla Bank PLC",
  "Eastern Bank PLC",
  "EXIM Bank PLC",
  "First Security Islami Bank PLC",
  "Global Islami Bank PLC",
  "Habib Bank Ltd.",
  "HSBC Bangladesh",
  "ICB Islamic Bank Ltd.",
  "IFIC Bank PLC",
  "Islami Bank Bangladesh PLC",
  "Jamuna Bank PLC",
  "Janata Bank PLC",
  "Meghna Bank PLC",
  "Mercantile Bank PLC",
  "Midland Bank PLC",
  "Modhumoti Bank PLC",
  "Mutual Trust Bank PLC",
  "National Bank Ltd.",
  "National Bank of Pakistan",
  "National Credit and Commerce Bank PLC",
  "NRB Bank PLC",
  "NRB Commercial Bank PLC",
  "NRBC Bank PLC",
  "One Bank PLC",
  "Padma Bank PLC",
  "Premier Bank PLC",
  "Prime Bank PLC",
  "Probashi Kallyan Bank",
  "Pubali Bank PLC",
  "Rajshahi Krishi Unnayan Bank",
  "Rupali Bank PLC",
  "SBAC Bank PLC",
  "Shahjalal Islami Bank PLC",
  "Shimanto Bank PLC",
  "Social Islami Bank PLC",
  "Sonali Bank PLC",
  "Southeast Bank PLC",
  "Standard Bank PLC",
  "Standard Chartered Bangladesh",
  "State Bank of India",
  "The Hong Kong and Shanghai Banking Corporation Ltd. (HSBC)",
  "Trust Bank PLC",
  "UBL",
  "Union Bank PLC",
  "United Commercial Bank PLC",
  "Uttara Bank PLC",
  "Woori Bank",
] as const

export const PAYMENT_MODE_GROUPS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_banking", label: "Mobile Banking" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Others" },
] as const

export function normalizePaymentModeName(name: string) {
  return name.trim().replace(/\s+/g, " ")
}

export type PaymentModeAccountHead = Pick<
  Database["public"]["Tables"]["account_heads"]["Row"],
  "id" | "client_id" | "name" | "is_active" | "type" | "sub_group_id"
>

export type PaymentModeRecord = Pick<
  Database["public"]["Tables"]["payment_modes"]["Row"],
  "id" | "client_id" | "name" | "type" | "is_active" | "account_head_id"
>

async function inferAccountHeadGroupType(
  supabase: SupabaseClient,
  {
    clientId,
    subGroupId,
  }: {
    clientId: string
    subGroupId: string | null
  }
) {
  if (!subGroupId) {
    return null
  }

  const { data: subGroup } = await supabase
    .from("account_sub_groups")
    .select("semi_sub_id")
    .eq("client_id", clientId)
    .eq("id", subGroupId)
    .maybeSingle()

  if (!subGroup?.semi_sub_id) {
    return null
  }

  const { data: semiSubGroup } = await supabase
    .from("account_semi_sub_groups")
    .select("group_id")
    .eq("client_id", clientId)
    .eq("id", subGroup.semi_sub_id)
    .maybeSingle()

  if (!semiSubGroup?.group_id) {
    return null
  }

  const { data: group } = await supabase
    .from("account_groups")
    .select("type")
    .eq("client_id", clientId)
    .eq("id", semiSubGroup.group_id)
    .maybeSingle()

  return group?.type ?? null
}

async function repairLegacyPaymentModeAccountHeadType(
  supabase: SupabaseClient,
  {
    clientId,
    accountHead,
  }: {
    clientId: string
    accountHead: PaymentModeAccountHead | null
  }
) {
  if (!accountHead || accountHead.type) {
    return accountHead
  }

  const inferredType = await inferAccountHeadGroupType(supabase, {
    clientId,
    subGroupId: accountHead.sub_group_id ?? null,
  })

  if (!inferredType) {
    return accountHead
  }

  const { data: updatedHead } = await supabase
    .from("account_heads")
    .update({ type: inferredType })
    .eq("id", accountHead.id)
    .eq("client_id", clientId)
    .select("id, client_id, name, is_active, type, sub_group_id")
    .single()

  return (updatedHead as PaymentModeAccountHead | null) ?? {
    ...accountHead,
    type: inferredType,
  }
}

export function validatePaymentModeAccountMapping({
  clientId,
  accountHead,
}: {
  clientId: string
  accountHead: PaymentModeAccountHead | null
}) {
  if (!accountHead) {
    return {
      ok: false as const,
      error: "The selected payment mode must be linked to an active same-client cash or bank asset account.",
    }
  }

  if (accountHead.client_id !== clientId || accountHead.is_active === false || accountHead.type !== "asset") {
    return {
      ok: false as const,
      error: "The selected payment mode must be linked to an active same-client cash or bank asset account.",
    }
  }

  return { ok: true as const }
}

export function buildPaymentModeAccountBackfill({
  paymentModes,
  accountHeads,
}: {
  paymentModes: PaymentModeRecord[]
  accountHeads: PaymentModeAccountHead[]
}) {
  const updates: Array<{ paymentModeId: string; accountHeadId: string }> = []
  const unmapped: Array<{ paymentModeId: string; paymentModeName: string; reason: string }> = []

  for (const paymentMode of paymentModes) {
    if (paymentMode.account_head_id) {
      continue
    }

    const normalizedModeName = normalizePaymentModeName(paymentMode.name).toLowerCase()
    const matches = accountHeads.filter(
      (accountHead) =>
        accountHead.client_id === paymentMode.client_id &&
        accountHead.is_active !== false &&
        accountHead.type === "asset" &&
        normalizePaymentModeName(accountHead.name).toLowerCase() === normalizedModeName
    )

    if (matches.length === 1) {
      updates.push({
        paymentModeId: paymentMode.id,
        accountHeadId: matches[0].id,
      })
      continue
    }

    unmapped.push({
      paymentModeId: paymentMode.id,
      paymentModeName: paymentMode.name,
      reason: matches.length > 1 ? "ambiguous_name_match" : "no_active_asset_match",
    })
  }

  return {
    updates,
    unmapped,
  }
}

export function resolveMappedPaymentModeAccount({
  clientId,
  paymentMode,
  accountHeads,
}: {
  clientId: string
  paymentMode: PaymentModeRecord
  accountHeads: PaymentModeAccountHead[]
}) {
  if (!paymentMode.account_head_id) {
    return {
      ok: false as const,
      error: "The selected payment mode is not mapped to an account head.",
    }
  }

  const linkedAccountHead = accountHeads.find((accountHead) => accountHead.id === paymentMode.account_head_id) ?? null
  const validation = validatePaymentModeAccountMapping({
    clientId,
    accountHead: linkedAccountHead,
  })

  if (!validation.ok) {
    return {
      ok: false as const,
      error: validation.error,
    }
  }

  return {
    ok: true as const,
    accountHead: linkedAccountHead!,
  }
}

export async function syncPaymentModeAccountLink({
  supabase,
  clientId,
  paymentMode,
}: {
  supabase: SupabaseClient
  clientId: string
  paymentMode: Database["public"]["Tables"]["payment_modes"]["Row"]
}) {
  const { data: accountHeads, error } = await supabase
    .from("account_heads")
    .select("id, client_id, name, is_active, type, sub_group_id")
    .eq("client_id", clientId)

  if (error) {
    return {
      success: false as const,
      error: error.message ?? "Unable to resolve the payment-mode account mapping.",
    }
  }

  const backfill = buildPaymentModeAccountBackfill({
    paymentModes: [
      {
        id: paymentMode.id,
        client_id: paymentMode.client_id,
        name: paymentMode.name,
        type: paymentMode.type,
        is_active: paymentMode.is_active,
        account_head_id: paymentMode.account_head_id,
      },
    ],
    accountHeads: (accountHeads ?? []) as PaymentModeAccountHead[],
  })

  if (!backfill.updates.length) {
    return {
      success: false as const,
      error: "The selected payment mode is not linked to an active same-client cash or bank asset account.",
    }
  }

  const accountHeadId = backfill.updates[0].accountHeadId
  const { data: updatedMode, error: updateError } = await supabase
    .from("payment_modes")
    .update({ account_head_id: accountHeadId })
    .eq("id", paymentMode.id)
    .eq("client_id", clientId)
    .select("*")
    .single()

  if (updateError || !updatedMode) {
    return {
      success: false as const,
      error: updateError?.message ?? "Unable to save the payment-mode account mapping.",
    }
  }

  return {
    success: true as const,
    paymentMode: updatedMode,
  }
}

async function findPreferredPaymentModeAccountHead({
  supabase,
  clientId,
  paymentModeName,
}: {
  supabase: SupabaseClient
  clientId: string
  paymentModeName: string
}) {
  const { data: assetGroup } = await supabase
    .from("account_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", "Current Assets")
    .maybeSingle()

  if (!assetGroup?.id) {
    return null
  }

  const { data: semiSubGroup } = await supabase
    .from("account_semi_sub_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("group_id", assetGroup.id)
    .eq("name", "Cash & Bank Balance")
    .maybeSingle()

  if (!semiSubGroup?.id) {
    return null
  }

  const { data: subGroup } = await supabase
    .from("account_sub_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("semi_sub_id", semiSubGroup.id)
    .eq("name", "Cash & Bank Balance")
    .maybeSingle()

  if (!subGroup?.id) {
    return null
  }

  const { data: accountHead } = await supabase
    .from("account_heads")
    .select("id, client_id, name, is_active, type, sub_group_id")
    .eq("client_id", clientId)
    .eq("sub_group_id", subGroup.id)
    .eq("name", paymentModeName)
    .maybeSingle()

  return repairLegacyPaymentModeAccountHeadType(supabase, {
    clientId,
    accountHead: (accountHead as PaymentModeAccountHead | null) ?? null,
  })
}

async function repairPaymentModeAccountLink({
  supabase,
  clientId,
  paymentMode,
}: {
  supabase: SupabaseClient
  clientId: string
  paymentMode: Database["public"]["Tables"]["payment_modes"]["Row"]
}) {
  await createPaymentModeAccountHeadForClient(clientId, paymentMode.name, supabase)

  const preferredAccountHead = await findPreferredPaymentModeAccountHead({
    supabase,
    clientId,
    paymentModeName: paymentMode.name,
  })

  const validation = validatePaymentModeAccountMapping({
    clientId,
    accountHead: preferredAccountHead,
  })

  if (!validation.ok || !preferredAccountHead) {
    return {
      success: false as const,
      error: "The selected payment mode is not linked to an active same-client cash or bank asset account.",
    }
  }

  const { data: updatedMode, error } = await supabase
    .from("payment_modes")
    .update({ account_head_id: preferredAccountHead.id })
    .eq("id", paymentMode.id)
    .eq("client_id", clientId)
    .select("*")
    .single()

  if (error || !updatedMode) {
    return {
      success: false as const,
      error: error?.message ?? "Unable to save the payment-mode account mapping.",
    }
  }

  return {
    success: true as const,
    paymentMode: updatedMode,
  }
}

export async function resolvePaymentModeAccountHead(
  supabase: SupabaseClient,
  {
    clientId,
    paymentMode,
  }: {
    clientId: string
    paymentMode: Database["public"]["Tables"]["payment_modes"]["Row"]
  }
) {
  if (!paymentMode.account_head_id) {
    const repairedMode = await repairPaymentModeAccountLink({
      supabase,
      clientId,
      paymentMode,
    })

    if (!repairedMode.success) {
      return {
        success: false as const,
        error: repairedMode.error,
      }
    }

    paymentMode = repairedMode.paymentMode
  }

  const { data: accountHead, error } = await supabase
    .from("account_heads")
    .select("id, client_id, name, is_active, type, sub_group_id")
    .eq("id", paymentMode.account_head_id)
    .maybeSingle()

  if (error) {
    return {
      success: false as const,
      error: error.message ?? "Unable to load the mapped payment account.",
    }
  }

  const normalizedAccountHead = await repairLegacyPaymentModeAccountHeadType(supabase, {
    clientId,
    accountHead: (accountHead as PaymentModeAccountHead | null) ?? null,
  })

  const resolved = resolveMappedPaymentModeAccount({
    clientId,
    paymentMode: {
      id: paymentMode.id,
      client_id: paymentMode.client_id,
      name: paymentMode.name,
      type: paymentMode.type,
      is_active: paymentMode.is_active,
      account_head_id: paymentMode.account_head_id,
    },
    accountHeads: normalizedAccountHead ? [normalizedAccountHead] : [],
  })

  if (!resolved.ok) {
    const repairedMode = await repairPaymentModeAccountLink({
      supabase,
      clientId,
      paymentMode,
    })

    if (repairedMode.success && repairedMode.paymentMode.account_head_id !== paymentMode.account_head_id) {
      return resolvePaymentModeAccountHead(supabase, {
        clientId,
        paymentMode: repairedMode.paymentMode,
      })
    }

    return {
      success: false as const,
      error: resolved.error,
    }
  }

  return {
    success: true as const,
    accountHead: resolved.accountHead,
  }
}

export async function validateExplicitPaymentModeAccountHead(
  supabase: SupabaseClient,
  {
    clientId,
    accountHeadId,
  }: {
    clientId: string
    accountHeadId: string
  }
) {
  const { data: accountHead, error } = await supabase
    .from("account_heads")
    .select("id, client_id, name, is_active, type, sub_group_id")
    .eq("id", accountHeadId)
    .maybeSingle()

  if (error) {
    return {
      success: false as const,
      error: error.message ?? "Unable to validate the selected account head.",
    }
  }

  const validation = validatePaymentModeAccountMapping({
    clientId,
    accountHead: await repairLegacyPaymentModeAccountHeadType(supabase, {
      clientId,
      accountHead: (accountHead as PaymentModeAccountHead | null) ?? null,
    }),
  })

  if (!validation.ok) {
    return {
      success: false as const,
      error: validation.error,
    }
  }

  return {
    success: true as const,
    accountHead: (await repairLegacyPaymentModeAccountHeadType(supabase, {
      clientId,
      accountHead: (accountHead as PaymentModeAccountHead | null) ?? null,
    })) as PaymentModeAccountHead,
  }
}

export function getPaymentModeLabel(type: string | null) {
  switch (type) {
    case "cash":
      return "Cash"
    case "mobile_banking":
      return "Mobile Banking"
    case "bank":
      return "Bank"
    default:
      return "Others"
  }
}

export async function resolveOrCreatePaymentMode(
  supabase: SupabaseClient,
  {
    clientId,
    paymentModeId,
    paymentModeName,
    paymentModeType,
  }: {
    clientId: string
    paymentModeId?: string
    paymentModeName?: string
    paymentModeType?: PaymentModeType
  }
): Promise<
  | {
      success: true
      paymentMode: Database["public"]["Tables"]["payment_modes"]["Row"]
    }
  | { success: false; error: string }
> {
  if (paymentModeId) {
    const { data: paymentMode } = await supabase
      .from("payment_modes")
      .select("*")
      .eq("id", paymentModeId)
      .eq("client_id", clientId)
      .maybeSingle()

    if (!paymentMode) {
      return { success: false, error: "Selected payment mode could not be resolved." }
    }

    if (!paymentMode.account_head_id) {
      const linkedMode = await repairPaymentModeAccountLink({
        supabase,
        clientId,
        paymentMode,
      })

      if (!linkedMode.success) {
        return linkedMode
      }

      return { success: true, paymentMode: linkedMode.paymentMode }
    }

    return { success: true, paymentMode }
  }

  const normalizedName = normalizePaymentModeName(paymentModeName ?? "")

  if (!normalizedName || !paymentModeType) {
    return { success: false, error: "Payment mode selection is incomplete." }
  }

  const { data: existingModes } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("client_id", clientId)
    .eq("type", paymentModeType)

  const matchedMode = (existingModes ?? []).find(
    (mode) => normalizePaymentModeName(mode.name).toLowerCase() === normalizedName.toLowerCase()
  )

  if (matchedMode) {
    if (!matchedMode.account_head_id) {
      const linkedMode = await repairPaymentModeAccountLink({
        supabase,
        clientId,
        paymentMode: matchedMode,
      })

      if (!linkedMode.success) {
        return linkedMode
      }

      return { success: true, paymentMode: linkedMode.paymentMode }
    }

    return { success: true, paymentMode: matchedMode }
  }

  const { data: insertedMode, error } = await supabase
    .from("payment_modes")
    .insert({
      client_id: clientId,
      name: normalizedName,
      type: paymentModeType,
      is_active: true,
    })
    .select("*")
    .single()

  if (error || !insertedMode) {
    return { success: false, error: error?.message ?? "Unable to create payment mode." }
  }

  await createPaymentModeAccountHeadForClient(clientId, insertedMode.name, supabase)

  const linkedMode = await syncPaymentModeAccountLink({
    supabase,
    clientId,
    paymentMode: insertedMode,
  })

  if (!linkedMode.success) {
    return linkedMode
  }

  return { success: true, paymentMode: linkedMode.paymentMode }
}
