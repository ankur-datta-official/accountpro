export type SSLCommerzInitResponse = {
  status?: string
  failedreason?: string
  sessionkey?: string
  GatewayPageURL?: string
  redirectGatewayURL?: string
  directPaymentURL?: string
  desc?: string
  [key: string]: unknown
}

export type SSLCommerzValidationResponse = {
  status?: string
  tran_id?: string
  val_id?: string
  amount?: string
  currency?: string
  bank_tran_id?: string
  card_type?: string
  card_no?: string
  risk_level?: string
  risk_title?: string
  value_a?: string
  value_b?: string
  value_c?: string
  value_d?: string
  validated_on?: string
  [key: string]: unknown
}

function getBaseUrl(mode: "sandbox" | "live") {
  return mode === "live" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com"
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | null
  if (!response.ok || !payload) {
    throw new Error("SSLCommerz request failed.")
  }

  return payload
}

export async function createSSLCommerzSession(input: {
  mode: "sandbox" | "live"
  storeId: string
  storePassword: string
  payload: Record<string, string>
}) {
  const body = new URLSearchParams({
    store_id: input.storeId,
    store_passwd: input.storePassword,
    ...input.payload,
  })

  const response = await fetch(`${getBaseUrl(input.mode)}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  })

  return parseJsonResponse<SSLCommerzInitResponse>(response)
}

export async function validateSSLCommerzOrder(input: {
  mode: "sandbox" | "live"
  storeId: string
  storePassword: string
  valId: string
}) {
  const endpoint = new URL(`${getBaseUrl(input.mode)}/validator/api/validationserverAPI.php`)
  endpoint.searchParams.set("val_id", input.valId)
  endpoint.searchParams.set("store_id", input.storeId)
  endpoint.searchParams.set("store_passwd", input.storePassword)
  endpoint.searchParams.set("format", "json")

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    cache: "no-store",
  })

  return parseJsonResponse<SSLCommerzValidationResponse>(response)
}
