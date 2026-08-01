import Link from "next/link"
import { BadgeCheck, BookOpenText, Building2, ReceiptText, ShieldCheck, Users } from "lucide-react"

import { AppLogo } from "@/components/branding/app-logo"
import { Card } from "@/components/ui/card"

const authHighlights = [
  {
    title: "Client accounting",
    description: "Separate books, fiscal years, and reports for every organization.",
    icon: Building2,
    accent: "from-sky-500 to-cyan-400",
    surface: "from-sky-50 to-cyan-50",
    border: "border-sky-100",
    dot: "bg-sky-500",
  },
  {
    title: "Voucher discipline",
    description: "Receipts, payments, journals, reversals, and posting activity stay controlled.",
    icon: ReceiptText,
    accent: "from-violet-500 to-fuchsia-500",
    surface: "from-violet-50 to-fuchsia-50",
    border: "border-violet-100",
    dot: "bg-violet-500",
  },
  {
    title: "Team workflow",
    description: "Invite owners, admins, accountants, and viewers with safer access.",
    icon: Users,
    accent: "from-emerald-500 to-teal-400",
    surface: "from-emerald-50 to-teal-50",
    border: "border-emerald-100",
    dot: "bg-emerald-500",
  },
]

export function AuthShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7faf9_0%,#eef7f4_48%,#fff7ed_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center rounded-lg border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur md:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <Link href="/">
                <AppLogo
                  iconClassName="h-12 w-12 rounded-lg"
                  titleClassName="text-xl"
                  subtitle="Professional accounting workspace"
                  subtitleClassName="tracking-normal"
                />
              </Link>
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 sm:inline-flex">
                Launch ready
              </span>
            </div>

            <div className="space-y-5">
              <p className="max-w-xl text-3xl font-semibold leading-tight tracking-normal text-slate-950 xl:text-4xl">
                Sign in to a complete accounting operating system.
              </p>
              <p className="max-w-xl text-base leading-7 text-slate-600">
                DKLedger gives firms one polished workspace for client books, vouchers,
                payroll, reports, team access, and owner visibility.
              </p>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {authHighlights.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className={`group relative min-h-[172px] overflow-hidden rounded-lg border ${item.border} bg-gradient-to-br ${item.surface} p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${item.accent}`} />
                    <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-white/60 blur-2xl" />

                    <div className="relative">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.accent} text-white shadow-lg shadow-slate-300/50 ring-4 ring-white/70`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold leading-5 text-slate-950">
                          {item.title}
                          <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                        </p>
                        <p className="mt-2 text-sm leading-5 text-slate-600">{item.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Protected access", icon: ShieldCheck },
                { label: "Books and reports", icon: BookOpenText },
                { label: "Integrity checks", icon: BadgeCheck },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Icon className="h-4 w-4 text-emerald-700" />
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <Card className="rounded-lg border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-200/60 md:p-8">
            <div className="mb-8 flex items-center justify-between">
              <Link href="/" className="transition">
                <AppLogo
                  iconClassName="h-9 w-9 rounded-lg"
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
