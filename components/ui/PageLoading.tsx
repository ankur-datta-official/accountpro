import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PageLoading() {
  return (
    <div className="space-y-6">
      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </CardContent>
      </Card>
    </div>
  )
}
