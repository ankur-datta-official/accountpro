import { createClient } from "@supabase/supabase-js"

import type {
  AccountGroupType,
  Database,
  PaymentModeInsert,
  PaymentModeType,
} from "@/lib/types"

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>

type HeadDefinition = string

type SubGroupDefinition = {
  name: string
  heads?: HeadDefinition[]
}

type SemiSubGroupDefinition = {
  name: string
  subGroups: SubGroupDefinition[]
}

type GroupDefinition = {
  name: string
  type: AccountGroupType
  semiSubGroups: SemiSubGroupDefinition[]
}

const defaultPaymentModes: Array<{
  name: string
  type: PaymentModeType
  account_no?: string | null
  is_active: boolean
}> = [
  { name: "Cash", type: "cash", is_active: true },
  { name: "Mutual Bank", type: "bank", is_active: true },
  { name: "Islami Bank", type: "bank", is_active: true },
  { name: "Dhaka Bank", type: "bank", is_active: true },
  { name: "ICB Islamic Bank", type: "bank", is_active: true },
]

const chartOfAccounts: GroupDefinition[] = [
  {
    name: "General & Administrative Expenses",
    type: "expense",
    semiSubGroups: [
      {
        name: "Salary & Benefits",
        subGroups: [
          {
            name: "Salary & Benefits",
            heads: ["Salary & Benefits", "Remuneration"],
          },
        ],
      },
      {
        name: "Office Expenses",
        subGroups: [
          {
            name: "Office Expenses",
            heads: [
              "Printing & Stationary",
              "Office Supplies",
              "Office Maintenance",
              "Utilities Bill",
              "Office Rent",
            ],
          },
        ],
      },
      {
        name: "Communication",
        subGroups: [
          {
            name: "Communication",
            heads: [
              "Postage, Telephone, Mobile & Internet Bill",
              "Advertisement",
            ],
          },
        ],
      },
      {
        name: "Travel & Entertainment",
        subGroups: [
          {
            name: "Travel & Entertainment",
            heads: [
              "Traveling & Daily Allowance",
              "Entertainment",
              "Fuel & Oil",
            ],
          },
        ],
      },
      {
        name: "Legal & Compliance",
        subGroups: [
          {
            name: "Legal & Compliance",
            heads: [
              "Vat, Tax & Legal Expenses",
              "License & Renewal Fee",
              "Audit Fee Expenses",
              "Consultancy Fee",
            ],
          },
        ],
      },
      {
        name: "Others (G&A)",
        subGroups: [
          {
            name: "Others (G&A)",
            heads: [
              "Bank Charge & Commission",
              "Tender Expenses",
              "Marketing Expenses",
              "Govt. Liaison",
              "AGM & EC Meeting Expenses",
              "Depreciation",
              "Misc. Expenses",
              "Papers & Periodicals",
              "Vehicle Repair & Maintenance",
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Revenue Expenses",
    type: "expense",
    semiSubGroups: [
      {
        name: "Cost of Goods",
        subGroups: [
          {
            name: "Cost of Goods",
            heads: [
              "Purchases",
              "Import",
              "Port Damage",
              "Carriage Charges",
              "Labour Charges",
              "C & F Charges",
              "Repair & Maintenance",
              "Insurance on LC",
            ],
          },
        ],
      },
      {
        name: "Distribution",
        subGroups: [
          {
            name: "Distribution",
            heads: [
              "Transportation",
              "Sales Commission",
              "Sales Return & Allowance",
              "Marketing Expenses",
              "Godown Rent",
            ],
          },
        ],
      },
      {
        name: "Finance Cost",
        subGroups: [
          {
            name: "Finance Cost",
            heads: [
              "Bank Loan Interest",
              "Others Interest Payments",
              "Internet & Hosting Expenses",
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Revenue Income",
    type: "income",
    semiSubGroups: [
      {
        name: "Revenue Income",
        subGroups: [
          {
            name: "Revenue Income",
            heads: [
              "Sales",
              "Export",
              "Purchases Return",
              "Local Donation",
              "Miscellaneous Income",
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Non Operation Income",
    type: "income",
    semiSubGroups: [
      {
        name: "Non Operation Income",
        subGroups: [
          {
            name: "Non Operation Income",
            heads: ["FDR Interest", "Bank Interest"],
          },
        ],
      },
    ],
  },
  {
    name: "Property & Assets",
    type: "asset",
    semiSubGroups: [
      {
        name: "Fixed assets",
        subGroups: [
          {
            name: "Fixed assets",
            heads: [
              "Land",
              "Building & Construction",
              "Furniture & Fixtures",
              "Office Equipment",
              "Motor Vehicles",
              "Construction Equipment",
              "Machinery",
              "Electronic Equipment",
              "By-cycle",
            ],
          },
        ],
      },
      {
        name: "Un-allocated Revenue expenses",
        subGroups: [
          {
            name: "Un-allocated Revenue expenses",
            heads: ["Un-allocated Revenue expenses"],
          },
        ],
      },
      {
        name: "Work in Progress",
        subGroups: [
          {
            name: "Work in Progress",
            heads: ["Work in Progress"],
          },
        ],
      },
      {
        name: "Preliminary Expenses",
        subGroups: [
          {
            name: "Preliminary Expenses",
            heads: ["Preliminary Expenses"],
          },
        ],
      },
    ],
  },
  {
    name: "Current Assets",
    type: "asset",
    semiSubGroups: [
      {
        name: "Cash & Bank Balance",
        subGroups: [
          {
            name: "Cash & Bank Balance",
            heads: ["Cash", "Opening Cash & Bank Balance"],
          },
        ],
      },
      {
        name: "Stock",
        subGroups: [{ name: "Stock", heads: ["Stock"] }],
      },
      {
        name: "Advance Income Tax",
        subGroups: [
          { name: "Advance Income Tax", heads: ["Advance Income Tax"] },
        ],
      },
      {
        name: "Security Money",
        subGroups: [{ name: "Security Money", heads: ["Security Money"] }],
      },
      {
        name: "Advance Deposit & Prepayments",
        subGroups: [{ name: "Advance Deposit & Prepayments", heads: [] }],
      },
      {
        name: "Bill Receivable",
        subGroups: [{ name: "Bill Receivable", heads: ["Bill Receivable"] }],
      },
    ],
  },
  {
    name: "Current Liabilities",
    type: "liability",
    semiSubGroups: [
      {
        name: "Loan Received",
        subGroups: [{ name: "Loan Received", heads: [] }],
      },
      {
        name: "Short term Bank Loan",
        subGroups: [
          { name: "Short term Bank Loan", heads: ["Short term Bank Loan"] },
        ],
      },
      {
        name: "Provision for Income Tax",
        subGroups: [
          { name: "Provision for Income Tax", heads: ["Provision for Income Tax"] },
        ],
      },
      {
        name: "Bill Payable",
        subGroups: [
          {
            name: "Bill Payable",
            heads: ["Audit Fee Payable", "Accounts Payable"],
          },
        ],
      },
    ],
  },
  {
    name: "Equity and Liabilities",
    type: "liability",
    semiSubGroups: [
      {
        name: "Share Capital",
        subGroups: [{ name: "Share Capital", heads: [] }],
      },
      {
        name: "Retained Earnings",
        subGroups: [
          { name: "Retained Earnings", heads: ["Retained Earnings"] },
        ],
      },
    ],
  },
]

export function createDefaultPaymentModes(clientId: string): PaymentModeInsert[] {
  return defaultPaymentModes.map((mode) => ({
    client_id: clientId,
    name: mode.name,
    type: mode.type,
    account_no: mode.account_no ?? null,
    is_active: mode.is_active,
  }))
}

async function createPaymentModeAccountHead(
  supabase: SupabaseAdminClient,
  clientId: string,
  paymentModeName: string
) {
  const { data: cashGroup } = await supabase
    .from("account_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", "Current Assets")
    .maybeSingle()

  if (!cashGroup?.id) {
    return
  }

  const { data: cashSemiSubGroup } = await supabase
    .from("account_semi_sub_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("group_id", cashGroup.id)
    .eq("name", "Cash & Bank Balance")
    .maybeSingle()

  if (!cashSemiSubGroup?.id) {
    return
  }

  const { data: cashSubGroup } = await supabase
    .from("account_sub_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("semi_sub_id", cashSemiSubGroup.id)
    .eq("name", "Cash & Bank Balance")
    .maybeSingle()

  if (!cashSubGroup?.id) {
    return
  }

  const { data: existingHead } = await supabase
    .from("account_heads")
    .select("id")
    .eq("client_id", clientId)
    .eq("sub_group_id", cashSubGroup.id)
    .eq("name", paymentModeName)
    .maybeSingle()

  if (existingHead) {
    return
  }

  const { count } = await supabase
    .from("account_heads")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("sub_group_id", cashSubGroup.id)

  await supabase.from("account_heads").insert({
    client_id: clientId,
    sub_group_id: cashSubGroup.id,
    name: paymentModeName,
    opening_balance: 0,
    balance_type: "debit",
    is_active: true,
    sort_order: count ?? 0,
  })
}

export async function createDefaultChartOfAccounts(
  clientId: string,
  supabase: SupabaseAdminClient
) {
  let groupSort = 0
  let semiSort = 0
  let subSort = 0
  let headSort = 0

  for (const group of chartOfAccounts) {
    const { data: insertedGroup, error: groupError } = await supabase
      .from("account_groups")
      .insert({
        client_id: clientId,
        name: group.name,
        type: group.type,
        sort_order: groupSort,
      })
      .select("id")
      .single()

    if (groupError || !insertedGroup) {
      throw new Error(groupError?.message ?? `Unable to create group ${group.name}.`)
    }

    groupSort += 1

    for (const semiSubGroup of group.semiSubGroups) {
      const { data: insertedSemiSubGroup, error: semiError } = await supabase
        .from("account_semi_sub_groups")
        .insert({
          client_id: clientId,
          group_id: insertedGroup.id,
          name: semiSubGroup.name,
          sort_order: semiSort,
        })
        .select("id")
        .single()

      if (semiError || !insertedSemiSubGroup) {
        throw new Error(
          semiError?.message ?? `Unable to create semi-sub-group ${semiSubGroup.name}.`
        )
      }

      semiSort += 1

      for (const subGroup of semiSubGroup.subGroups) {
        const { data: insertedSubGroup, error: subError } = await supabase
          .from("account_sub_groups")
          .insert({
            client_id: clientId,
            semi_sub_id: insertedSemiSubGroup.id,
            name: subGroup.name,
            sort_order: subSort,
          })
          .select("id")
          .single()

        if (subError || !insertedSubGroup) {
          throw new Error(subError?.message ?? `Unable to create sub-group ${subGroup.name}.`)
        }

        subSort += 1

        for (const head of subGroup.heads ?? []) {
          const { error: headError } = await supabase.from("account_heads").insert({
            client_id: clientId,
            sub_group_id: insertedSubGroup.id,
            name: head,
            opening_balance: 0,
            balance_type: "debit",
            is_active: true,
            sort_order: headSort,
          })

          if (headError) {
            throw new Error(headError.message ?? `Unable to create account head ${head}.`)
          }

          headSort += 1
        }
      }
    }
  }

  for (const paymentMode of defaultPaymentModes) {
    await createPaymentModeAccountHead(supabase, clientId, paymentMode.name)
  }
}

export async function createPaymentModeAccountHeadForClient(
  clientId: string,
  paymentModeName: string,
  supabase: SupabaseAdminClient
) {
  await createPaymentModeAccountHead(supabase, clientId, paymentModeName)
}
