export type OrganizationPlan = "starter" | "professional" | "enterprise"
export type OrganizationMemberRole = "owner" | "admin" | "accountant" | "viewer"
export type ClientType = "company" | "individual" | "partnership" | "ngo"
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
          description: string | null
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
          description?: string | null
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
          description?: string | null
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
