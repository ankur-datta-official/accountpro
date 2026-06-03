import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PageLoading({
  title = "Loading workspace",
  description = "Preparing the latest information for this page.",
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  )
}
