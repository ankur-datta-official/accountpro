"use client"

import { useState } from "react"
import { Loader2, Mail, MessageCircle } from "lucide-react"
import { toast } from "sonner"

import { fetchWithAccessToken } from "@/lib/query"
import { Button } from "@/components/ui/button"

type SharePayload = {
  subject: string
  message: string
  clientEmail: string | null
  clientPhone: string | null
  whatsappPhone: string
  documentCount: number
}

function openMailComposer(payload: SharePayload) {
  if (!payload.clientEmail) {
    toast.error("Client email is not available. Add it from Client Settings first.")
    return
  }

  window.location.href = `mailto:${encodeURIComponent(payload.clientEmail)}?subject=${encodeURIComponent(
    payload.subject
  )}&body=${encodeURIComponent(payload.message)}`
}

function openWhatsappComposer(payload: SharePayload) {
  if (!payload.whatsappPhone) {
    toast.error("Client WhatsApp phone is not available. Add it from Client Settings first.")
    return
  }

  window.open(`https://wa.me/${payload.whatsappPhone}?text=${encodeURIComponent(payload.message)}`, "_blank", "noopener,noreferrer")
}

export function VoucherShareActions({
  clientId,
  voucherId,
  compact = false,
  renderAsItems = false,
}: {
  clientId: string
  voucherId: string
  compact?: boolean
  renderAsItems?: boolean
}) {
  const [pendingChannel, setPendingChannel] = useState<"email" | "whatsapp" | null>(null)

  const shareVoucher = async (channel: "email" | "whatsapp") => {
    setPendingChannel(channel)

    try {
      const payload = await fetchWithAccessToken<SharePayload>(
        `/api/clients/${clientId}/vouchers/${voucherId}/share`
      )

      if (channel === "email") {
        openMailComposer(payload)
      } else {
        openWhatsappComposer(payload)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to prepare voucher share.")
    } finally {
      setPendingChannel(null)
    }
  }

  const buttonClassName = compact ? "h-8 px-2" : "rounded-xl border-slate-200"

  if (renderAsItems) {
    return (
      <>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
          onClick={() => void shareVoucher("email")}
          disabled={Boolean(pendingChannel)}
        >
          {pendingChannel === "email" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Share by Email
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
          onClick={() => void shareVoucher("whatsapp")}
          disabled={Boolean(pendingChannel)}
        >
          {pendingChannel === "whatsapp" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          Share by WhatsApp
        </button>
      </>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={buttonClassName}
        onClick={() => void shareVoucher("email")}
        disabled={Boolean(pendingChannel)}
      >
        {pendingChannel === "email" ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Mail className="mr-1 h-3.5 w-3.5" />
        )}
        Email
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={buttonClassName}
        onClick={() => void shareVoucher("whatsapp")}
        disabled={Boolean(pendingChannel)}
      >
        {pendingChannel === "whatsapp" ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <MessageCircle className="mr-1 h-3.5 w-3.5" />
        )}
        WhatsApp
      </Button>
    </>
  )
}
