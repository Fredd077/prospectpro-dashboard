export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: 'pending' | 'active' | 'inactive' | 'admin'
          company: string | null
          onboarding_completed: boolean
          created_at: string
          last_seen_at: string | null
          activated_at: string | null
          activated_by: string | null
          org_role: 'member' | 'manager' | null
          manager_id: string | null
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'pending' | 'active' | 'inactive' | 'admin'
          company?: string | null
          onboarding_completed?: boolean
          created_at?: string
          last_seen_at?: string | null
          activated_at?: string | null
          activated_by?: string | null
          org_role?: 'member' | 'manager' | null
          manager_id?: string | null
        }
        Update: {
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'pending' | 'active' | 'inactive' | 'admin'
          company?: string | null
          onboarding_completed?: boolean
          last_seen_at?: string | null
          activated_at?: string | null
          activated_by?: string | null
          org_role?: 'member' | 'manager' | null
          manager_id?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'OUTBOUND' | 'INBOUND'
          channel: string
          daily_goal: number
          weekly_goal: number
          monthly_goal: number
          weight: number
          status: 'active' | 'inactive'
          sort_order: number
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          type: 'OUTBOUND' | 'INBOUND'
          channel: string
          daily_goal?: number
          weekly_goal?: number
          monthly_goal?: number
          weight?: number
          status?: 'active' | 'inactive'
          sort_order?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'OUTBOUND' | 'INBOUND'
          channel?: string
          daily_goal?: number
          weekly_goal?: number
          monthly_goal?: number
          weight?: number
          status?: 'active' | 'inactive'
          sort_order?: number
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          activity_id: string
          log_date: string
          day_goal: number
          real_executed: number
          notes: string | null
          is_retroactive: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          activity_id: string
          log_date: string
          day_goal?: number
          real_executed?: number
          notes?: string | null
          is_retroactive?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          activity_id?: string
          log_date?: string
          day_goal?: number
          real_executed?: number
          notes?: string | null
          is_retroactive?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_logs_activity_id_fkey'
            columns: ['activity_id']
            isOneToOne: false
            referencedRelation: 'activities'
            referencedColumns: ['id']
          }
        ]
      }
      goals: {
        Row: {
          id: string
          activity_id: string | null
          period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly'
          period_start: string
          period_end: string
          target_value: number
          label: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          activity_id?: string | null
          period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly'
          period_start: string
          period_end: string
          target_value: number
          label?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          activity_id?: string | null
          period_type?: 'daily' | 'weekly' | 'monthly' | 'quarterly'
          period_start?: string
          period_end?: string
          target_value?: number
          label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'goals_activity_id_fkey'
            columns: ['activity_id']
            isOneToOne: false
            referencedRelation: 'activities'
            referencedColumns: ['id']
          }
        ]
      }
      recipe_scenarios: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          is_active: boolean
          monthly_revenue_goal: number
          outbound_pct: number
          inbound_pct: number
          average_ticket: number
          working_days_per_month: number
          funnel_stages: string[]
          outbound_rates: number[]
          inbound_rates: number[]
          activities_needed_monthly: number | null
          activities_needed_weekly: number | null
          activities_needed_daily: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          description?: string | null
          is_active?: boolean
          monthly_revenue_goal: number
          outbound_pct?: number
          average_ticket: number
          working_days_per_month?: number
          funnel_stages?: string[]
          outbound_rates?: number[]
          inbound_rates?: number[]
          activities_needed_monthly?: number | null
          activities_needed_weekly?: number | null
          activities_needed_daily?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          monthly_revenue_goal?: number
          outbound_pct?: number
          average_ticket?: number
          working_days_per_month?: number
          funnel_stages?: string[]
          outbound_rates?: number[]
          inbound_rates?: number[]
          activities_needed_monthly?: number | null
          activities_needed_weekly?: number | null
          activities_needed_daily?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          id: string
          user_id: string
          type: 'daily' | 'weekly' | 'monthly'
          message: string
          context: Json | null
          period_date: string
          user_comment: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          type: 'daily' | 'weekly' | 'monthly'
          message: string
          context?: Json | null
          period_date: string
          user_comment?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          user_comment?: string | null
          is_read?: boolean
        }
        Relationships: []
      }
      pipeline_entries: {
        Row: {
          id: string
          user_id: string
          recipe_scenario_id: string | null
          stage: string
          prospect_type: 'OUTBOUND' | 'INBOUND'
          company_name: string | null
          prospect_name: string | null
          quantity: number
          amount_usd: number | null
          entry_date: string
          notes: string | null
          is_quick_entry: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          recipe_scenario_id?: string | null
          stage: string
          prospect_type?: 'OUTBOUND' | 'INBOUND'
          company_name?: string | null
          prospect_name?: string | null
          quantity?: number
          amount_usd?: number | null
          entry_date?: string
          notes?: string | null
          is_quick_entry?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          stage?: string
          prospect_type?: 'OUTBOUND' | 'INBOUND'
          company_name?: string | null
          prospect_name?: string | null
          quantity?: number
          amount_usd?: number | null
          entry_date?: string
          notes?: string | null
          is_quick_entry?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      recipe_actuals: {
        Row: {
          id: string
          user_id: string
          scenario_id: string
          period_start: string
          period_end: string
          period_type: 'weekly' | 'monthly' | 'quarterly'
          actual_activities: number
          actual_speeches: number
          actual_meetings: number
          actual_proposals: number
          actual_closes: number
          actual_revenue: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          scenario_id: string
          period_start: string
          period_end: string
          period_type: 'weekly' | 'monthly' | 'quarterly'
          actual_activities?: number
          actual_speeches?: number
          actual_meetings?: number
          actual_proposals?: number
          actual_closes?: number
          actual_revenue?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          scenario_id?: string
          period_start?: string
          period_end?: string
          period_type?: 'weekly' | 'monthly' | 'quarterly'
          actual_activities?: number
          actual_speeches?: number
          actual_meetings?: number
          actual_proposals?: number
          actual_closes?: number
          actual_revenue?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_actuals_scenario_id_fkey'
            columns: ['scenario_id']
            isOneToOne: false
            referencedRelation: 'recipe_scenarios'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      vw_daily_compliance: {
        Row: {
          id: string
          log_date: string
          type: 'OUTBOUND' | 'INBOUND'
          channel: string
          activity_id: string
          activity_name: string
          day_goal: number
          real_executed: number
          notes: string | null
          is_retroactive: boolean
          compliance_pct: number | null
          semaphore: 'green' | 'yellow' | 'red' | 'no_goal'
        }
        Relationships: []
      }
    }
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Enums: Record<string, string[]>
  }
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Activity = Database['public']['Tables']['activities']['Row']
export type ActivityInsert = Database['public']['Tables']['activities']['Insert']
export type ActivityUpdate = Database['public']['Tables']['activities']['Update']

export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
export type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert']
export type ActivityLogUpdate = Database['public']['Tables']['activity_logs']['Update']

export type Goal = Database['public']['Tables']['goals']['Row']
export type GoalInsert = Database['public']['Tables']['goals']['Insert']
export type GoalUpdate = Database['public']['Tables']['goals']['Update']

export type RecipeScenario = Database['public']['Tables']['recipe_scenarios']['Row']
export type RecipeScenarioInsert = Database['public']['Tables']['recipe_scenarios']['Insert']
export type RecipeScenarioUpdate = Database['public']['Tables']['recipe_scenarios']['Update']

export type RecipeActual = Database['public']['Tables']['recipe_actuals']['Row']
export type RecipeActualInsert = Database['public']['Tables']['recipe_actuals']['Insert']
export type RecipeActualUpdate = Database['public']['Tables']['recipe_actuals']['Update']

export type DailyCompliance = Database['public']['Views']['vw_daily_compliance']['Row']

export type CoachMessage = Database['public']['Tables']['coach_messages']['Row']
export type CoachMessageInsert = Database['public']['Tables']['coach_messages']['Insert']

export type PipelineEntry = Database['public']['Tables']['pipeline_entries']['Row']
export type PipelineEntryInsert = Database['public']['Tables']['pipeline_entries']['Insert']
export type PipelineEntryUpdate = Database['public']['Tables']['pipeline_entries']['Update']
