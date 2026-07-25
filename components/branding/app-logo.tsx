"use client"

import Image from "next/image"

import { cn } from "@/lib/utils"

type AppLogoProps = {
  className?: string
  contentClassName?: string
  iconClassName?: string
  titleClassName?: string
  subtitleClassName?: string
  subtitle?: string
  showSubtitle?: boolean
  compact?: boolean
}

export function AppLogo({
  className,
  contentClassName,
  iconClassName,
  titleClassName,
  subtitleClassName,
  subtitle = "Accurate accounts. Smarter growth.",
  showSubtitle = true,
  compact = false,
}: AppLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl",
          "bg-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80",
          iconClassName
        )}
        aria-hidden="true"
      >
        <Image
          src="/branding/dkledger_logo.png"
          alt=""
          fill
          sizes="48px"
          className="scale-[1.18] object-contain p-0"
          priority
        />
      </div>

      <div className={cn("min-w-0", compact && "space-y-0.5", contentClassName)}>
        <p
          className={cn(
            "truncate text-lg font-semibold tracking-[-0.03em] text-slate-950",
            titleClassName
          )}
        >
          DKLedger
        </p>
        {showSubtitle ? (
          <p className={cn("truncate text-xs font-medium uppercase tracking-[0.18em] text-slate-500", subtitleClassName)}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  )
}
