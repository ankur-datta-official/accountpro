export type OrganizationPlan = "starter" | "professional" | "enterprise"
export type OrganizationMemberRole = "owner" | "admin" | "accountant" | "viewer"
export type ClientType =
  | "limited_company_commercial"
  | "limited_company_manufacture"
  | "limited_company_commercial_manufacture"
  | "limited_company_development_construction"
  | "ngo_micro_credit"
  | "ngo_donor_fund"
  | "partnership"
  | "proprietorship"
  | "company"
  | "individual"
export type AccountGroupType = "expense" | "income" | "asset" | "liability"
export type AccountHeadBalanceType = "debit" | "credit"
export type PaymentModeType = "bank" | "cash" | "mobile_banking" | "other"
export type VoucherType =
  | "payment"
  | "received"
  | "journal"
  | "contra"
  | "bf"
  | "bp"
  | "br"
export type PayrollRunStatus = "draft" | "reviewed" | "posted" | "paid" | "cancelled"
export type PayrollRunSource = "manual" | "import"
export type PayrollComponentKind = "earning" | "employer_contribution" | "deduction"

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          plan: OrganizationPlan | null
          max_clients: number | null
          is_active: boolean | null
          logo_url: string | null
          address: string | null
          phone: string | null
          email: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan?: OrganizationPlan | null
          max_clients?: number | null
          is_active?: boolean | null
          logo_url?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          plan?: OrganizationPlan | null
          max_clients?: number | null
          is_active?: boolean | null
          logo_url?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          org_id: string | null
          user_id: string | null
          invited_email: string | null
          invitation_message: string | null
          role: OrganizationMemberRole
          is_active: boolean | null
          invited_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          org_id?: string | null
          user_id?: string | null
          invited_email?: string | null
          invitation_message?: string | null
          role?: OrganizationMemberRole
          is_active?: boolean | null
          invited_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string | null
          user_id?: string | null
          invited_email?: string | null
          invitation_message?: string | null
          role?: OrganizationMemberRole
          is_active?: boolean | null
          invited_by?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          org_id: string | null
          name: string
          type: ClientType | null
          trade_name: string | null
          bin: string | null
          tin: string | null
          address: string | null
          phone: string | null
          email: string | null
          fiscal_year_start: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id?: string | null
          name: string
          type?: ClientType | null
          trade_name?: string | null
          bin?: string | null
          tin?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          fiscal_year_start?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string | null
          name?: string
          type?: ClientType | null
          trade_name?: string | null
          bin?: string | null
          tin?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          fiscal_year_start?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fiscal_years: {
        Row: {
          id: string
          client_id: string | null
          label: string
          start_date: string
          end_date: string
          is_active: boolean | null
          is_closed: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          label: string
          start_date: string
          end_date: string
          is_active?: boolean | null
          is_closed?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          label?: string
          start_date?: string
          end_date?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      account_groups: {
        Row: {
          id: string
          client_id: string | null
          name: string
          type: AccountGroupType
          sort_order: number | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          name: string
          type: AccountGroupType
          sort_order?: number | null
        }
        Update: {
          id?: string
          client_id?: string | null
          name?: string
          type?: AccountGroupType
          sort_order?: number | null
        }
        Relationships: []
      }
      account_semi_sub_groups: {
        Row: {
          id: string
          client_id: string | null
          group_id: string | null
          name: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          group_id?: string | null
          name: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          client_id?: string | null
          group_id?: string | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      account_sub_groups: {
        Row: {
          id: string
          client_id: string | null
          semi_sub_id: string | null
          name: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          semi_sub_id?: string | null
          name: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          client_id?: string | null
          semi_sub_id?: string | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      account_heads: {
        Row: {
          id: string
          client_id: string | null
          sub_group_id: string | null
          name: string
          opening_balance: number | null
          balance_type: AccountHeadBalanceType | null
          is_active: boolean | null
          sort_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          sub_group_id?: string | null
          name: string
          opening_balance?: number | null
          balance_type?: AccountHeadBalanceType | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          sub_group_id?: string | null
          name?: string
          opening_balance?: number | null
          balance_type?: AccountHeadBalanceType | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      payment_modes: {
        Row: {
          id: string
          client_id: string | null
          name: string
          type: PaymentModeType | null
          account_no: string | null
          is_active: boolean | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          name: string
          type?: PaymentModeType | null
          account_no?: string | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          client_id?: string | null
          name?: string
          type?: PaymentModeType | null
          account_no?: string | null
          is_active?: boolean | null
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          id: string
          client_id: string | null
          fiscal_year_id: string | null
          voucher_no: number
          voucher_date: string
          voucher_type: VoucherType
          payment_mode_id: string | null
          show_description: boolean | null
          description: string | null
          show_supporting_documents: boolean | null
          month_label: string | null
          is_posted: boolean | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          fiscal_year_id?: string | null
          voucher_no: number
          voucher_date: string
          voucher_type: VoucherType
          payment_mode_id?: string | null
          show_description?: boolean | null
          description?: string | null
          show_supporting_documents?: boolean | null
          month_label?: string | null
          is_posted?: boolean | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          fiscal_year_id?: string | null
          voucher_no?: number
          voucher_date?: string
          voucher_type?: VoucherType
          payment_mode_id?: string | null
          show_description?: boolean | null
          description?: string | null
          show_supporting_documents?: boolean | null
          month_label?: string | null
          is_posted?: boolean | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      voucher_entries: {
        Row: {
          id: string
          voucher_id: string | null
          account_head_id: string | null
          accounts_group: string | null
          debit: number | null
          credit: number | null
          description: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          voucher_id?: string | null
          account_head_id?: string | null
          accounts_group?: string | null
          debit?: number | null
          credit?: number | null
          description?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          voucher_id?: string | null
          account_head_id?: string | null
          accounts_group?: string | null
          debit?: number | null
          credit?: number | null
          description?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      voucher_attachments: {
        Row: {
          id: string
          voucher_id: string
          client_id: string
          file_name: string
          file_path: string
          file_size: number
          mime_type: string | null
          uploaded_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          voucher_id: string
          client_id: string
          file_name: string
          file_path: string
          file_size: number
          mime_type?: string | null
          uploaded_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          voucher_id?: string
          client_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          mime_type?: string | null
          uploaded_by?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      payroll_employees: {
        Row: {
          id: string
          client_id: string
          employee_code: string | null
          name: string
          designation: string | null
          grade: string | null
          phone: string | null
          email: string | null
          tin: string | null
          joining_date: string | null
          leaving_date: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          employee_code?: string | null
          name: string
          designation?: string | null
          grade?: string | null
          phone?: string | null
          email?: string | null
          tin?: string | null
          joining_date?: string | null
          leaving_date?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          employee_code?: string | null
          name?: string
          designation?: string | null
          grade?: string | null
          phone?: string | null
          email?: string | null
          tin?: string | null
          joining_date?: string | null
          leaving_date?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payroll_salary_structures: {
        Row: {
          id: string
          client_id: string
          employee_id: string
          basic: number | null
          housing: number | null
          medical: number | null
          conveyance: number | null
          employer_pf: number | null
          staff_pf: number | null
          tax: number | null
          effective_from: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          employee_id: string
          basic?: number | null
          housing?: number | null
          medical?: number | null
          conveyance?: number | null
          employer_pf?: number | null
          staff_pf?: number | null
          tax?: number | null
          effective_from?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          employee_id?: string
          basic?: number | null
          housing?: number | null
          medical?: number | null
          conveyance?: number | null
          employer_pf?: number | null
          staff_pf?: number | null
          tax?: number | null
          effective_from?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payroll_runs: {
        Row: {
          id: string
          client_id: string
          fiscal_year_id: string
          period_label: string
          period_start: string
          period_end: string
          status: PayrollRunStatus
          source: PayrollRunSource
          notes: string | null
          accrual_voucher_id: string | null
          payment_voucher_id: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          fiscal_year_id: string
          period_label: string
          period_start: string
          period_end: string
          status?: PayrollRunStatus
          source?: PayrollRunSource
          notes?: string | null
          accrual_voucher_id?: string | null
          payment_voucher_id?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          fiscal_year_id?: string
          period_label?: string
          period_start?: string
          period_end?: string
          status?: PayrollRunStatus
          source?: PayrollRunSource
          notes?: string | null
          accrual_voucher_id?: string | null
          payment_voucher_id?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payroll_run_items: {
        Row: {
          id: string
          payroll_run_id: string
          employee_id: string | null
          employee_name: string
          designation: string | null
          grade: string | null
          gross_salary: number | null
          total_additions: number | null
          total_deductions: number | null
          net_payable: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          payroll_run_id: string
          employee_id?: string | null
          employee_name: string
          designation?: string | null
          grade?: string | null
          gross_salary?: number | null
          total_additions?: number | null
          total_deductions?: number | null
          net_payable?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          payroll_run_id?: string
          employee_id?: string | null
          employee_name?: string
          designation?: string | null
          grade?: string | null
          gross_salary?: number | null
          total_additions?: number | null
          total_deductions?: number | null
          net_payable?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      payroll_run_components: {
        Row: {
          id: string
          run_item_id: string
          code: string
          label: string
          kind: PayrollComponentKind
          amount: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          run_item_id: string
          code: string
          label: string
          kind: PayrollComponentKind
          amount?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          run_item_id?: string
          code?: string
          label?: string
          kind?: PayrollComponentKind
          amount?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      payroll_account_mappings: {
        Row: {
          id: string
          client_id: string
          component_code: string
          account_head_id: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          component_code: string
          account_head_id: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          component_code?: string
          account_head_id?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
