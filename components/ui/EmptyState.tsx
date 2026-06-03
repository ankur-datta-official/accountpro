import Link from "next/link"
import { ArrowRight, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  secondaryActionLabel?: string
  secondaryActionHref?: string
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  secondaryActionLabel,
  secondaryActionHref,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-white shadow-sm">
        <Icon className="h-6 w-6 text-slate-500" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {actionLabel && actionHref ? (
        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button asChild className="rounded-lg">
            <Link href={actionHref}>
              {actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          {secondaryActionLabel && secondaryActionHref ? (
            <Button asChild variant="outline" className="rounded-lg border-slate-200">
              <Link href={secondaryActionHref}>{secondaryActionLabel}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
