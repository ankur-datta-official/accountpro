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

  return { success: true, paymentMode: insertedMode }
}
