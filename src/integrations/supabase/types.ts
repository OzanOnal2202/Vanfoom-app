export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_promotion_logs: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          success: boolean
          target_user_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          success: boolean
          target_user_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_call_history: {
        Row: {
          bike_id: string
          called_at: string
          called_by: string
          id: string
          notes: string | null
        }
        Insert: {
          bike_id: string
          called_at?: string
          called_by: string
          id?: string
          notes?: string | null
        }
        Update: {
          bike_id?: string
          called_at?: string
          called_by?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bike_call_history_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_call_history_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_call_history_called_by_fkey"
            columns: ["called_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_call_history_called_by_fkey"
            columns: ["called_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_checklist_completions: {
        Row: {
          bike_id: string
          checklist_item_id: string
          completed_at: string
          completed_by: string | null
          id: string
        }
        Insert: {
          bike_id: string
          checklist_item_id: string
          completed_at?: string
          completed_by?: string | null
          id?: string
        }
        Update: {
          bike_id?: string
          checklist_item_id?: string
          completed_at?: string
          completed_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_checklist_completions_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_checklist_completions_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_checklist_completions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "completion_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_checklist_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_checklist_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_comments: {
        Row: {
          author_id: string | null
          bike_id: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          bike_id: string
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          bike_id?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_comments_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_comments_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bikes: {
        Row: {
          call_status_id: string | null
          created_at: string
          current_mechanic_id: string | null
          customer_phone: string | null
          diagnosed_at: string | null
          diagnosed_by: string | null
          frame_number: string
          id: string
          is_sales_bike: boolean
          model: Database["public"]["Enums"]["vanmoof_model"]
          status: Database["public"]["Enums"]["repair_status"]
          table_number: string | null
          updated_at: string
          workflow_status: Database["public"]["Enums"]["bike_workflow_status"]
        }
        Insert: {
          call_status_id?: string | null
          created_at?: string
          current_mechanic_id?: string | null
          customer_phone?: string | null
          diagnosed_at?: string | null
          diagnosed_by?: string | null
          frame_number: string
          id?: string
          is_sales_bike?: boolean
          model: Database["public"]["Enums"]["vanmoof_model"]
          status?: Database["public"]["Enums"]["repair_status"]
          table_number?: string | null
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["bike_workflow_status"]
        }
        Update: {
          call_status_id?: string | null
          created_at?: string
          current_mechanic_id?: string | null
          customer_phone?: string | null
          diagnosed_at?: string | null
          diagnosed_by?: string | null
          frame_number?: string
          id?: string
          is_sales_bike?: boolean
          model?: Database["public"]["Enums"]["vanmoof_model"]
          status?: Database["public"]["Enums"]["repair_status"]
          table_number?: string | null
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["bike_workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bikes_call_status_id_fkey"
            columns: ["call_status_id"]
            isOneToOne: false
            referencedRelation: "table_call_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_current_mechanic_id_fkey"
            columns: ["current_mechanic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_current_mechanic_id_fkey"
            columns: ["current_mechanic_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_diagnosed_by_fkey"
            columns: ["diagnosed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_diagnosed_by_fkey"
            columns: ["diagnosed_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_checklist_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      foh_tasks: {
        Row: {
          assigned_to: string | null
          bike_id: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          notes: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          task_number: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bike_id?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          task_number?: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bike_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          task_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foh_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foh_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foh_tasks_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foh_tasks_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foh_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foh_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          min_stock_level: number
          purchase_price: number | null
          quantity: number
          repair_type_id: string
          unlimited_stock: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          min_stock_level?: number
          purchase_price?: number | null
          quantity?: number
          repair_type_id: string
          unlimited_stock?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          min_stock_level?: number
          purchase_price?: number | null
          quantity?: number
          repair_type_id?: string
          unlimited_stock?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "inventory_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: true
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_groups: {
        Row: {
          created_at: string
          id: string
          min_stock_level: number
          name: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          min_stock_level?: number
          name: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          min_stock_level?: number
          name?: string
          quantity?: number
        }
        Relationships: []
      }
      login_logs: {
        Row: {
          id: string
          ip_address: string | null
          logged_in_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanic_availability: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date: string
          end_time: string
          id: string
          notes: string | null
          start_time: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date: string
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mechanic_availability_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mechanic_availability_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mechanic_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mechanic_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          contract: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_approved: boolean
          job_function: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contract?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          is_approved?: boolean
          job_function?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contract?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_approved?: boolean
          job_function?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_attempts: {
        Row: {
          attempts: number
          created_at: string
          id: string
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      repair_type_models: {
        Row: {
          created_at: string
          id: string
          model: string
          repair_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          repair_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          repair_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_type_models_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: false
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          points: number
          price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          points?: number
          price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          points?: number
          price?: number
        }
        Relationships: []
      }
      table_call_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_en: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_en: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string
          sort_order?: number
        }
        Relationships: []
      }
      tv_announcements: {
        Row: {
          background_color: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_fullscreen: boolean
          message: string
          text_color: string | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_fullscreen?: boolean
          message: string
          text_color?: string | null
        }
        Update: {
          background_color?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_fullscreen?: boolean
          message?: string
          text_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_registrations: {
        Row: {
          bike_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          last_modified_at: string | null
          last_modified_by: string | null
          mechanic_id: string | null
          repair_type_id: string
        }
        Insert: {
          bike_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          last_modified_at?: string | null
          last_modified_by?: string | null
          mechanic_id?: string | null
          repair_type_id: string
        }
        Update: {
          bike_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          last_modified_at?: string | null
          last_modified_by?: string | null
          mechanic_id?: string | null
          repair_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_registrations_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_registrations_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_registrations_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: false
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bikes_safe: {
        Row: {
          call_status_id: string | null
          created_at: string | null
          current_mechanic_id: string | null
          customer_phone: string | null
          frame_number: string | null
          id: string | null
          model: Database["public"]["Enums"]["vanmoof_model"] | null
          status: Database["public"]["Enums"]["repair_status"] | null
          table_number: string | null
          updated_at: string | null
          workflow_status:
            | Database["public"]["Enums"]["bike_workflow_status"]
            | null
        }
        Insert: {
          call_status_id?: string | null
          created_at?: string | null
          current_mechanic_id?: string | null
          customer_phone?: never
          frame_number?: string | null
          id?: string | null
          model?: Database["public"]["Enums"]["vanmoof_model"] | null
          status?: Database["public"]["Enums"]["repair_status"] | null
          table_number?: string | null
          updated_at?: string | null
          workflow_status?:
            | Database["public"]["Enums"]["bike_workflow_status"]
            | null
        }
        Update: {
          call_status_id?: string | null
          created_at?: string | null
          current_mechanic_id?: string | null
          customer_phone?: never
          frame_number?: string | null
          id?: string | null
          model?: Database["public"]["Enums"]["vanmoof_model"] | null
          status?: Database["public"]["Enums"]["repair_status"] | null
          table_number?: string | null
          updated_at?: string | null
          workflow_status?:
            | Database["public"]["Enums"]["bike_workflow_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "bikes_call_status_id_fkey"
            columns: ["call_status_id"]
            isOneToOne: false
            referencedRelation: "table_call_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_current_mechanic_id_fkey"
            columns: ["current_mechanic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_current_mechanic_id_fkey"
            columns: ["current_mechanic_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_limited: {
        Row: {
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          is_approved: boolean | null
          job_function: string | null
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          is_approved?: boolean | null
          job_function?: string | null
        }
        Update: {
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          is_approved?: boolean | null
          job_function?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_todays_birthdays: {
        Args: never
        Returns: {
          full_name: string
          id: string
        }[]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "monteur" | "admin" | "foh"
      availability_status: "pending" | "approved" | "rejected"
      bike_workflow_status:
        | "diagnose_nodig"
        | "diagnose_bezig"
        | "wacht_op_akkoord"
        | "wacht_op_onderdelen"
        | "klaar_voor_reparatie"
        | "in_reparatie"
        | "afgerond"
      repair_status: "open" | "in_behandeling" | "afgerond"
      vanmoof_model:
        | "S1"
        | "S2"
        | "S3"
        | "S5"
        | "S6"
        | "X1"
        | "X2"
        | "X3"
        | "X5"
        | "A5"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["monteur", "admin", "foh"],
      availability_status: ["pending", "approved", "rejected"],
      bike_workflow_status: [
        "diagnose_nodig",
        "diagnose_bezig",
        "wacht_op_akkoord",
        "wacht_op_onderdelen",
        "klaar_voor_reparatie",
        "in_reparatie",
        "afgerond",
      ],
      repair_status: ["open", "in_behandeling", "afgerond"],
      vanmoof_model: [
        "S1",
        "S2",
        "S3",
        "S5",
        "S6",
        "X1",
        "X2",
        "X3",
        "X5",
        "A5",
      ],
    },
  },
} as const
