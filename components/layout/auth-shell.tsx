import Link from "next/link"

import { AppLogo } from "@/components/branding/app-logo"
import { Card } from "@/components/ui/card"

export function AuthShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,139,121,0.08),_transparent_35%),linear-gradient(180deg,_#f3f6f4_0%,_#edf4f1_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-12 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center rounded-[2rem] border border-slate-200/80 bg-white/70 p-8 shadow-sm backdrop-blur md:p-12">
            <AppLogo
              className="mb-10"
              iconClassName="h-14 w-14 rounded-[1.25rem]"
              titleClassName="text-xl"
              subtitle="Accounting workspace for modern teams"
              subtitleClassName="tracking-[0.16em]"
            />

            <div className="space-y-5">
              <p className="max-w-lg text-4xl font-semibold tracking-tight text-slate-950">
                Keep every client, voucher, and team workflow in one place.
              </p>
              <p className="max-w-xl text-base leading-7 text-slate-600">
                DKLedger helps accounting firms organize client operations, collaborate with
                their team, and stay on top of monthly bookkeeping with a clear dashboard-first
                experience.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-medium text-slate-900">Client workspaces</p>
                <p className="mt-2 text-sm text-slate-500">Separate books and fiscal years for each client.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-medium text-slate-900">Voucher tracking</p>
                <p className="mt-2 text-sm text-slate-500">Stay on top of monthly entries and posting activity.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-medium text-slate-900">Team access</p>
                <p className="mt-2 text-sm text-slate-500">Invite admins, accountants, and viewers safely.</p>
              </div>
            </div>
          </div>

          <Card className="border-slate-200/80 bg-white/95 p-6 shadow-xl shadow-slate-200/60 md:p-10">
            <div className="mb-8 flex items-center justify-between">
              <Link href="/" className="transition">
                <AppLogo
                  iconClassName="h-9 w-9 rounded-xl"
                  titleClassName="text-sm"
                  showSubtitle={false}
                  compact
                />
              </Link>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Secure access
              </span>
            </div>
            {children}
          </Card>
        </div>
      </div>
    </div>
  )
}
