import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  BookOpenText,
  Building2,
  Check,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react"

import { AppLogo } from "@/components/branding/app-logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const modules = [
  {
    title: "Client workspaces",
    description: "Run separate books, fiscal years, payment modes, and reports for every client.",
    icon: Building2,
  },
  {
    title: "Voucher control",
    description: "Post receipts, payments, journals, and reversals with clear audit-friendly records.",
    icon: ReceiptText,
  },
  {
    title: "Books of accounts",
    description: "Keep chart of accounts, ledger, day book, trial balance, and statement flow connected.",
    icon: BookOpenText,
  },
  {
    title: "Financial statements",
    description: "Prepare balance sheet, profit and loss, bank statements, and printable reports faster.",
    icon: Landmark,
  },
  {
    title: "Payroll records",
    description: "Manage payroll runs, accruals, payments, and salary certificates from the same system.",
    icon: Banknote,
  },
  {
    title: "Team access",
    description: "Invite owners, admins, accountants, and viewers with organization-level permissions.",
    icon: Users,
  },
]

const outcomes = [
  "Month-end work stays organized across every client",
  "Reports are generated from the same voucher source of truth",
  "Firm owners can see workload, activity, and team access clearly",
  "Accountants spend less time switching files and rebuilding reports",
]

const workflow = [
  "Create a client and fiscal year",
  "Set chart of accounts and payment modes",
  "Post vouchers and payroll activity",
  "Review ledger, trial balance, P&L, and balance sheet",
]

const plans = [
  {
    name: "Starter",
    price: "For growing firms",
    description: "Launch your first structured accounting workspace.",
    features: ["Client records", "Voucher posting", "Core reports", "Secure sign in"],
  },
  {
    name: "Professional",
    price: "Most popular",
    description: "Operate multi-client accounting with team collaboration.",
    features: ["Unlimited daily workflow", "Payroll module", "Team roles", "Excel exports and print-ready reports"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "For serious scale",
    description: "Standardize accounting operations for larger practices.",
    features: ["Advanced controls", "Release-ready migration path", "Operational checklist", "Priority onboarding"],
  },
]

const faqs = [
  {
    question: "Who is DKLedger built for?",
    answer: "Accounting firms, bookkeeping teams, and business service providers that manage multiple client accounts.",
  },
  {
    question: "Can a team work together?",
    answer: "Yes. DKLedger supports organization members with roles for owners, admins, accountants, and viewers.",
  },
  {
    question: "What reports are included?",
    answer: "Ledger, day book, trial balance, profit and loss, balance sheet, bank statements, payroll, and salary certificates.",
  },
  {
    question: "Is this ready for professional launch?",
    answer: "The landing experience presents the product clearly, while the app keeps protected accounting routes behind secure auth.",
  },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
      {children}
    </p>
  )
}

function ProductPreview() {
  const rows = [
    ["Noman Traders", "RV-024", "Receipt", "BDT 48,500"],
    ["Hasan Foods", "PV-017", "Payment", "BDT 22,000"],
    ["Rahman Group", "JV-031", "Journal", "BDT 71,250"],
  ]

  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)]">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">Accounting Workspace</p>
          <p className="text-xs text-slate-500">Live operating view for firm owners</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <BarChart3 className="h-4 w-4" />
        </div>
      </div>

      <div className="grid gap-3 py-4 sm:grid-cols-3">
        {[
          ["Active clients", "32"],
          ["This month", "286 vouchers"],
          ["Open fiscal years", "41"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          <span>Client</span>
          <span>Voucher</span>
          <span>Type</span>
          <span className="text-right">Amount</span>
        </div>
        {rows.map((row) => (
          <div
            key={row[1]}
            className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr] border-t border-slate-100 px-3 py-3 text-sm text-slate-700"
          >
            <span className="truncate font-medium text-slate-950">{row[0]}</span>
            <span>{row[1]}</span>
            <span>{row[2]}</span>
            <span className="text-right font-medium">{row[3]}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-[#fef7ed] p-3 text-sm text-amber-900">
          <p className="font-semibold">Month-end focus</p>
          <p className="mt-1 text-amber-800">Trial balance checks and report review in one place.</p>
        </div>
        <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
          <p className="font-semibold">Owner visibility</p>
          <p className="mt-1 text-sky-800">Client, team, and posting activity stays easy to scan.</p>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f7faf9] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="DKLedger home">
            <AppLogo
              iconClassName="h-10 w-10 rounded-lg"
              titleClassName="text-base"
              subtitleClassName="hidden sm:block tracking-normal"
              subtitle="Accounting workspace"
              compact
            />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-950">Features</a>
            <a href="#workflow" className="hover:text-slate-950">Workflow</a>
            <a href="#security" className="hover:text-slate-950">Security</a>
            <a href="#pricing" className="hover:text-slate-950">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Start now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-[linear-gradient(135deg,#f7faf9_0%,#eef7f4_48%,#fff7ed_100%)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-medium text-emerald-800">
              <ShieldCheck className="h-4 w-4" />
              Enterprise-grade accounting operations
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl">
              DKLedger
            </h1>
            <p className="mt-5 max-w-2xl text-xl font-semibold leading-8 text-slate-800">
              A professional accounting workspace for firms that manage clients, vouchers, ledgers, payroll, and reports.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Replace scattered spreadsheets with a clean operating system for daily bookkeeping, monthly closing, team access, and client-level financial statements.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12">
                <Link href="/register">
                  Create workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 bg-white">
                <Link href="/login">Sign in to existing account</Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              {outcomes.map((item) => (
                <div key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section id="features" className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <SectionLabel>Product modules</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
              Everything a client-focused accounting team needs before month-end pressure starts.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              DKLedger is shaped around real bookkeeping flow: client setup, voucher posting, books of accounts, statements, payroll, and controlled access.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => {
              const Icon = module.icon
              return (
                <div key={module.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">{module.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <SectionLabel>Operating workflow</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
              A cleaner path from setup to final report.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The system guides a firm through the work that matters most, without making every client a separate spreadsheet project.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {workflow.map((step, index) => (
              <div key={step} className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-emerald-700">Step {index + 1}</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            {
              title: "Protected workspace",
              description: "Client, team, settings, and account routes remain behind authenticated access.",
              icon: LockKeyhole,
            },
            {
              title: "Role-aware operations",
              description: "Organization membership and role checks support controlled collaboration.",
              icon: Users,
            },
            {
              title: "Accounting integrity",
              description: "Voucher, reversal, payroll, report, and hierarchy tests protect core accounting behavior.",
              icon: BadgeCheck,
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-6">
                <Icon className="h-6 w-6 text-sky-700" />
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section id="pricing" className="border-y border-slate-200 bg-[#fbfaf7] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <SectionLabel>Plans</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
              Sell a serious accounting system, not just another login screen.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Position DKLedger for firms at different stages, then convert visitors through a clear workspace creation path.
            </p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "rounded-lg border bg-white p-6 shadow-sm",
                  plan.featured ? "border-slate-950 ring-2 ring-slate-950/10" : "border-slate-200"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950">{plan.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-emerald-700">{plan.price}</p>
                  </div>
                  {plan.featured ? (
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</p>
                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold text-slate-950">Ready to launch DKLedger professionally?</h3>
              <p className="mt-2 text-sm text-slate-600">Create a workspace and turn the product story into the first step of onboarding.</p>
            </div>
            <Button asChild size="lg" className="h-12 shrink-0">
              <Link href="/register">
                Start subscription
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionLabel>FAQ</SectionLabel>
          <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {faqs.map((faq) => (
              <div key={faq.question} className="p-5">
                <h3 className="font-semibold text-slate-950">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <AppLogo
            iconClassName="h-10 w-10 rounded-lg"
            titleClassName="text-white"
            subtitleClassName="text-slate-300 tracking-normal"
            subtitle="Professional accounting workspace"
            compact
          />
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <Link href="/login" className="hover:text-white">Login</Link>
            <Link href="/register" className="hover:text-white">Register</Link>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
