import Link from "next/link"

import { Card } from "@/components/ui/card"

export function AuthShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-12 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center rounded-[2rem] border border-slate-200/80 bg-white/70 p-8 shadow-sm backdrop-blur md:p-12">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold text-white">
                AP
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-950">AccountPro</p>
                <p className="text-sm text-slate-500">Accounting workspace for modern teams</p>
              </div>
            </div>

            <div className="space-y-5">
              <p className="max-w-lg text-4xl font-semibold tracking-tight text-slate-950">
                Keep every client, voucher, and team workflow in one place.
              </p>
              <p className="max-w-xl text-base leading-7 text-slate-600">
                AccountPro helps accounting firms organize client operations, collaborate with
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
              <Link href="/" className="text-sm font-medium text-slate-500 transition hover:text-slate-900">
                AccountPro
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
