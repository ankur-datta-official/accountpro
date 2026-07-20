import { format } from "date-fns"
import { NextResponse } from "next/server"

import { getVoucherTypeLabel, isAutoBalanceEntry } from "@/lib/accounting/vouchers"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { getAuthorizedClient } from "@/lib/api-auth"
import type { VoucherEntry, PaymentMode, VoucherAttachment, AccountHead } from "@/lib/types"

function createServiceRoleClient() {
  return supabaseAdmin
}

function normalizeWhatsappPhone(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "")

  if (!digits) {
    return ""
  }

  if (digits.startsWith("00")) {
    return digits.slice(2)
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `88${digits}`
  }

  return digits
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string; voucherId: string }> }
) {
  const { clientId, voucherId } = await params
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

  const { data: voucher } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", voucherId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!voucher) {
    return NextResponse.json({ error: "Voucher not found." }, { status: 404 })
  }

  const entriesPromise = supabase.from("voucher_entries").select("*").eq("voucher_id", voucher.id) as Promise<{ data: VoucherEntry[] | null }>;
  const paymentModePromise = voucher.payment_mode_id
    ? supabase.from("payment_modes").select("*").eq("id", voucher.payment_mode_id).maybeSingle() as Promise<{ data: PaymentMode | null }>
    : Promise.resolve({ data: null });
  const attachmentsPromise = supabase.from("voucher_attachments").select("*").eq("voucher_id", voucher.id).order("created_at") as Promise<{ data: VoucherAttachment[] | null }>;
  const [entriesResult, paymentModeResult, attachmentsResult] = await Promise.all([
    entriesPromise,
    paymentModePromise,
    attachmentsPromise,
  ]);
  const entries = entriesResult.data;
  const paymentMode = paymentModeResult.data;
  const attachments = attachmentsResult.data;

  const visibleEntries = (entries ?? []).filter((entry) => !isAutoBalanceEntry(entry.description))
  const printableEntries = visibleEntries.length ? visibleEntries : (entries ?? [])
  const accountHeadIds = Array.from(
    new Set(printableEntries.map((entry) => entry.account_head_id).filter(Boolean) as string[])
  )
  const accountHeadsResult: { data: AccountHeadNameRow[] | null } = accountHeadIds.length
    ? await (supabase
        .from("account_heads")
        .select("id,name")
        .in("id", accountHeadIds) as Promise<{ data: AccountHeadNameRow[] | null }>)
    : { data: [] }
  const accountHeads = accountHeadsResult.data;
  const accountHeadMap = new Map(
    ((accountHeads ?? []) as AccountHeadNameRow[]).map((head: AccountHeadNameRow) => [head.id, head.name])
  )
  const accountHeadNames = Array.from(
    new Set(
      printableEntries
        .map((entry) => accountHeadMap.get(entry.account_head_id ?? ""))
        .filter(Boolean) as string[]
    )
  )
  const totalDebit = (entries ?? []).reduce((sum: number, entry) => sum + Number(entry.debit ?? 0), 0)
  const totalCredit = (entries ?? []).reduce((sum: number, entry) => sum + Number(entry.credit ?? 0), 0)
  const amount = Math.max(totalDebit, totalCredit)

  const documents = await Promise.all(
    (attachments ?? []).map(async (attachment) => {
      const { data } = await supabase.storage
        .from("voucher-documents")
        .createSignedUrl(attachment.file_path, 60 * 60 * 24 * 7)

      return {
        fileName: attachment.file_name,
        signedUrl: data?.signedUrl ?? null,
      }
    })
  )

  const documentLines = documents.length
    ? documents.map((document) => `- ${document.fileName}\n  ${document.signedUrl ?? "Link unavailable"}`)
    : ["- No supporting documents attached."]

  const subject = `${client.name} - Voucher #${voucher.voucher_no}`
  const message = [
    `Dear ${client.name},`,
    "",
    `Please find the voucher details below.`,
    "",
    `Voucher No: #${voucher.voucher_no}`,
    `Voucher Date: ${format(new Date(voucher.voucher_date), "dd MMM yyyy")}`,
    `Voucher Type: ${getVoucherTypeLabel(voucher.voucher_type)}`,
    `Payment Mode: ${paymentMode?.name ?? "-"}`,
    `Account Head${accountHeadNames.length > 1 ? "s" : ""}: ${accountHeadNames.join(", ") || "-"}`,
    `Amount: BDT ${amount.toFixed(2)}`,
    `Description: ${voucher.description || "-"}`,
    "",
    "Supporting documents:",
    ...documentLines,
    "",
    "Regards,",
    "DKLedger",
  ].join("\n")

  return NextResponse.json({
    subject,
    message,
    clientEmail: client.email,
    clientPhone: client.phone,
    whatsappPhone: normalizeWhatsappPhone(client.phone),
    documentCount: documents.length,
  })
}
type AccountHeadNameRow = Pick<AccountHead, "id" | "name">
