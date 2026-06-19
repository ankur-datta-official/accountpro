import type { Database } from "./database"

export type { Database } from "./database"
export type {
  AccountGroupType,
  AccountHeadBalanceType,
  ClientType,
  OrganizationMemberRole,
  OrganizationPlan,
  PaymentModeType,
  PayrollComponentKind,
  PayrollRunSource,
  PayrollRunStatus,
  VoucherType,
} from "./database"

export type Organization = Database["public"]["Tables"]["organizations"]["Row"]
export type OrganizationInsert = Database["public"]["Tables"]["organizations"]["Insert"]
export type OrganizationUpdate = Database["public"]["Tables"]["organizations"]["Update"]

export type OrganizationMember = Database["public"]["Tables"]["organization_members"]["Row"]
export type OrganizationMemberInsert = Database["public"]["Tables"]["organization_members"]["Insert"]
export type OrganizationMemberUpdate = Database["public"]["Tables"]["organization_members"]["Update"]

export type Client = Database["public"]["Tables"]["clients"]["Row"]
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"]
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"]

export type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"]
export type FiscalYearInsert = Database["public"]["Tables"]["fiscal_years"]["Insert"]
export type FiscalYearUpdate = Database["public"]["Tables"]["fiscal_years"]["Update"]

export type AccountGroup = Database["public"]["Tables"]["account_groups"]["Row"]
export type AccountGroupInsert = Database["public"]["Tables"]["account_groups"]["Insert"]
export type AccountGroupUpdate = Database["public"]["Tables"]["account_groups"]["Update"]

export type AccountSemiSubGroup = Database["public"]["Tables"]["account_semi_sub_groups"]["Row"]
export type AccountSemiSubGroupInsert = Database["public"]["Tables"]["account_semi_sub_groups"]["Insert"]
export type AccountSemiSubGroupUpdate = Database["public"]["Tables"]["account_semi_sub_groups"]["Update"]

export type AccountSubGroup = Database["public"]["Tables"]["account_sub_groups"]["Row"]
export type AccountSubGroupInsert = Database["public"]["Tables"]["account_sub_groups"]["Insert"]
export type AccountSubGroupUpdate = Database["public"]["Tables"]["account_sub_groups"]["Update"]

export type AccountHead = Database["public"]["Tables"]["account_heads"]["Row"]
export type AccountHeadInsert = Database["public"]["Tables"]["account_heads"]["Insert"]
export type AccountHeadUpdate = Database["public"]["Tables"]["account_heads"]["Update"]

export type PaymentMode = Database["public"]["Tables"]["payment_modes"]["Row"]
export type PaymentModeInsert = Database["public"]["Tables"]["payment_modes"]["Insert"]
export type PaymentModeUpdate = Database["public"]["Tables"]["payment_modes"]["Update"]

export type Voucher = Database["public"]["Tables"]["vouchers"]["Row"]
export type VoucherInsert = Database["public"]["Tables"]["vouchers"]["Insert"]
export type VoucherUpdate = Database["public"]["Tables"]["vouchers"]["Update"]

export type VoucherEntry = Database["public"]["Tables"]["voucher_entries"]["Row"]
export type VoucherEntryInsert = Database["public"]["Tables"]["voucher_entries"]["Insert"]
export type VoucherEntryUpdate = Database["public"]["Tables"]["voucher_entries"]["Update"]

export type VoucherAttachment = Database["public"]["Tables"]["voucher_attachments"]["Row"]
export type VoucherAttachmentInsert = Database["public"]["Tables"]["voucher_attachments"]["Insert"]
export type VoucherAttachmentUpdate = Database["public"]["Tables"]["voucher_attachments"]["Update"]

export type PayrollEmployee = Database["public"]["Tables"]["payroll_employees"]["Row"]
export type PayrollEmployeeInsert = Database["public"]["Tables"]["payroll_employees"]["Insert"]
export type PayrollEmployeeUpdate = Database["public"]["Tables"]["payroll_employees"]["Update"]

export type PayrollSalaryStructure = Database["public"]["Tables"]["payroll_salary_structures"]["Row"]
export type PayrollSalaryStructureInsert = Database["public"]["Tables"]["payroll_salary_structures"]["Insert"]
export type PayrollSalaryStructureUpdate = Database["public"]["Tables"]["payroll_salary_structures"]["Update"]

export type PayrollRun = Database["public"]["Tables"]["payroll_runs"]["Row"]
export type PayrollRunInsert = Database["public"]["Tables"]["payroll_runs"]["Insert"]
export type PayrollRunUpdate = Database["public"]["Tables"]["payroll_runs"]["Update"]

export type PayrollRunItem = Database["public"]["Tables"]["payroll_run_items"]["Row"]
export type PayrollRunItemInsert = Database["public"]["Tables"]["payroll_run_items"]["Insert"]
export type PayrollRunItemUpdate = Database["public"]["Tables"]["payroll_run_items"]["Update"]

export type PayrollRunComponent = Database["public"]["Tables"]["payroll_run_components"]["Row"]
export type PayrollRunComponentInsert = Database["public"]["Tables"]["payroll_run_components"]["Insert"]
export type PayrollRunComponentUpdate = Database["public"]["Tables"]["payroll_run_components"]["Update"]

export type PayrollAccountMapping = Database["public"]["Tables"]["payroll_account_mappings"]["Row"]
export type PayrollAccountMappingInsert = Database["public"]["Tables"]["payroll_account_mappings"]["Insert"]
export type PayrollAccountMappingUpdate = Database["public"]["Tables"]["payroll_account_mappings"]["Update"]
