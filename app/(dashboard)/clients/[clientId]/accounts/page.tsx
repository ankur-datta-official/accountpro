import { ChartOfAccountsManager } from "@/components/accounts/chart-of-accounts-manager"

export default async function ClientAccountsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  return <ChartOfAccountsManager clientId={clientId} />
}
