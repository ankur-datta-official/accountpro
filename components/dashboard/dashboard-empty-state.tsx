import { FileBarChart2 } from "lucide-react"

import { EmptyState } from "@/components/ui/EmptyState"

export function DashboardEmptyState({
  actionHref,
}: {
  actionHref: string
}) {
  return (
    <EmptyState
      icon={FileBarChart2}
      title="No posted accounting entries are available for this period."
      description="Create and post a voucher to populate the financial overview and summary panels."
      actionLabel="Create Voucher"
      actionHref={actionHref}
    />
  )
}
