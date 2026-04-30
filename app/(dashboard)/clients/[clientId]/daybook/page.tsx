import { redirect } from "next/navigation"

export default function ClientDaybookRedirectPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const nextSearch = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string") {
      nextSearch.set(key, value)
    }
  }

  const query = nextSearch.toString()
  redirect(`/clients/${params.clientId}/day-book${query ? `?${query}` : ""}`)
}
