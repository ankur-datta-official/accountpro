import { ChartOfAccountsManager } from "@/components/accounts/chart-of-accounts-manager"

export default function ClientAccountsPage({
  params,
}: {
  params: { clientId: string }
}) {
  return <ChartOfAccountsManager clientId={params.clientId} />
}
