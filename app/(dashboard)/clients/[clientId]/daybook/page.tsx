import { redirect } from "next/navigation"

export default async function ClientDaybookRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const nextSearch = new URLSearchParams()

  for (const [key, value] of Object.entries(resolvedSearchParams ?? {})) {
    if (typeof value === "string") {
      nextSearch.set(key, value)
    }
  }

  const query = nextSearch.toString()
  redirect(`/clients/${resolvedParams.clientId}/day-book${query ? `?${query}` : ""}`)
}
