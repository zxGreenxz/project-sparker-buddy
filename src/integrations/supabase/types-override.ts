// Temporary types override for database xneoovjmwhzzphwlwojc
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          id: string
          record_id: string | null
          table_name: string | null
          action: string
          user_id: string | null
          username: string | null
          created_at: string | null
          details: Json | null
        }
        Insert: {
          id?: string
          record_id?: string | null
          table_name?: string | null
          action: string
          user_id?: string | null
          username?: string | null
          created_at?: string | null
          details?: Json | null
        }
        Update: {
          id?: string
          record_id?: string | null
          table_name?: string | null
          action?: string
          user_id?: string | null
          username?: string | null
          created_at?: string | null
          details?: Json | null
        }
      }
      crm_teams: {
        Row: {
          id: string
          team_id: string
          team_name: string
          created_at: string | null
        }
        Insert: {
          id?: string
          team_id: string
          team_name: string
          created_at?: string | null
        }
        Update: {
          id?: string
          team_id?: string
          team_name?: string
          created_at?: string | null
        }
      }
      customers: {
        Row: {
          id: string
          idkh: string | null
          customer_name: string
          phone: string | null
          email: string | null
          address: string | null
          facebook_id: string | null
          customer_status: string | null
          info_status: string | null
          crm_team_id: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          idkh?: string | null
          customer_name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          facebook_id?: string | null
          customer_status?: string | null
          info_status?: string | null
          crm_team_id?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          idkh?: string | null
          customer_name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          facebook_id?: string | null
          customer_status?: string | null
          info_status?: string | null
          crm_team_id?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      facebook_comments: {
        Row: {
          id: string
          facebook_comment_id: string
          facebook_post_id: string | null
          facebook_user_id: string | null
          customer_name: string | null
          comment_text: string | null
          comment_type: string | null
          created_time: string | null
          processed: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          facebook_comment_id: string
          facebook_post_id?: string | null
          facebook_user_id?: string | null
          customer_name?: string | null
          comment_text?: string | null
          comment_type?: string | null
          created_time?: string | null
          processed?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          facebook_comment_id?: string
          facebook_post_id?: string | null
          facebook_user_id?: string | null
          customer_name?: string | null
          comment_text?: string | null
          comment_type?: string | null
          created_time?: string | null
          processed?: boolean | null
          created_at?: string | null
        }
      }
      facebook_pages: {
        Row: {
          id: string
          page_id: string
          page_name: string
          access_token: string | null
          page_access_token: string | null
          crm_team_id: string | null
          crm_team_name: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          page_id: string
          page_name: string
          access_token?: string | null
          page_access_token?: string | null
          crm_team_id?: string | null
          crm_team_name?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          page_id?: string
          page_name?: string
          access_token?: string | null
          page_access_token?: string | null
          crm_team_id?: string | null
          crm_team_name?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      facebook_pending_orders: {
        Row: {
          id: string
          facebook_comment_id: string
          facebook_post_id: string | null
          customer_name: string | null
          name: string | null
          phone: string | null
          code: string | null
          comment: string | null
          comment_text: string | null
          session_index: string | null
          order_count: number | null
          tpos_order_id: string | null
          created_time: string
          processed: boolean | null
          comment_type: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          facebook_comment_id: string
          facebook_post_id?: string | null
          customer_name?: string | null
          name?: string | null
          phone?: string | null
          code?: string | null
          comment?: string | null
          comment_text?: string | null
          session_index?: string | null
          order_count?: number | null
          tpos_order_id?: string | null
          created_time: string
          processed?: boolean | null
          comment_type?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          facebook_comment_id?: string
          facebook_post_id?: string | null
          customer_name?: string | null
          name?: string | null
          phone?: string | null
          code?: string | null
          comment?: string | null
          comment_text?: string | null
          session_index?: string | null
          order_count?: number | null
          tpos_order_id?: string | null
          created_time?: string
          processed?: boolean | null
          comment_type?: string | null
          created_at?: string | null
        }
      }
      goods_receiving: {
        Row: {
          id: string
          receiving_code: string
          purchase_order_id: string | null
          supplier_name: string | null
          receiving_date: string
          status: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          receiving_code: string
          purchase_order_id?: string | null
          supplier_name?: string | null
          receiving_date: string
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          receiving_code?: string
          purchase_order_id?: string | null
          supplier_name?: string | null
          receiving_date?: string
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      goods_receiving_items: {
        Row: {
          id: string
          goods_receiving_id: string | null
          product_id: string | null
          product_code: string | null
          product_name: string | null
          quantity: number
          unit_price: number | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          goods_receiving_id?: string | null
          product_id?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity: number
          unit_price?: number | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          goods_receiving_id?: string | null
          product_id?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number
          unit_price?: number | null
          notes?: string | null
          created_at?: string | null
        }
      }
      live_orders: {
        Row: {
          id: string
          live_session_id: string | null
          live_phase_id: string | null
          live_product_id: string | null
          order_code: string | null
          customer_name: string | null
          facebook_comment_id: string | null
          quantity: number | null
          is_oversell: boolean | null
          code_tpos_order_id: string | null
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          live_session_id?: string | null
          live_phase_id?: string | null
          live_product_id?: string | null
          order_code?: string | null
          customer_name?: string | null
          facebook_comment_id?: string | null
          quantity?: number | null
          is_oversell?: boolean | null
          code_tpos_order_id?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          live_session_id?: string | null
          live_phase_id?: string | null
          live_product_id?: string | null
          order_code?: string | null
          customer_name?: string | null
          facebook_comment_id?: string | null
          quantity?: number | null
          is_oversell?: boolean | null
          code_tpos_order_id?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      live_phases: {
        Row: {
          id: string
          live_session_id: string | null
          phase_date: string
          phase_type: string
          start_time: string
          end_time: string
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          live_session_id?: string | null
          phase_date: string
          phase_type: string
          start_time: string
          end_time: string
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          live_session_id?: string | null
          phase_date?: string
          phase_type?: string
          start_time?: string
          end_time?: string
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      live_products: {
        Row: {
          id: string
          live_phase_id: string | null
          product_id: string | null
          product_code: string | null
          product_name: string
          product_images: string[] | null
          quantity: number
          sold_quantity: number | null
          price: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          live_phase_id?: string | null
          product_id?: string | null
          product_code?: string | null
          product_name: string
          product_images?: string[] | null
          quantity: number
          sold_quantity?: number | null
          price?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          live_phase_id?: string | null
          product_id?: string | null
          product_code?: string | null
          product_name?: string
          product_images?: string[] | null
          quantity?: number
          sold_quantity?: number | null
          price?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      live_sessions: {
        Row: {
          id: string
          session_date: string
          supplier_name: string | null
          facebook_post_id: string | null
          notes: string | null
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          session_date: string
          supplier_name?: string | null
          facebook_post_id?: string | null
          notes?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          session_date?: string
          supplier_name?: string | null
          facebook_post_id?: string | null
          notes?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      livestream_reports: {
        Row: {
          id: string
          live_session_id: string | null
          report_date: string
          total_orders: number | null
          total_revenue: number | null
          total_viewers: number | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          live_session_id?: string | null
          report_date: string
          total_orders?: number | null
          total_revenue?: number | null
          total_viewers?: number | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          live_session_id?: string | null
          report_date?: string
          total_orders?: number | null
          total_revenue?: number | null
          total_viewers?: number | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      products: {
        Row: {
          id: string
          product_code: string
          product_name: string
          unit: string | null
          purchase_price: number | null
          selling_price: number | null
          stock_quantity: number | null
          supplier_name: string | null
          tpos_product_id: string | null
          tpos_image_url: string | null
          product_images: string[] | null
          barcode: string | null
          variant: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          product_code: string
          product_name: string
          unit?: string | null
          purchase_price?: number | null
          selling_price?: number | null
          stock_quantity?: number | null
          supplier_name?: string | null
          tpos_product_id?: string | null
          tpos_image_url?: string | null
          product_images?: string[] | null
          barcode?: string | null
          variant?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          product_code?: string
          product_name?: string
          unit?: string | null
          purchase_price?: number | null
          selling_price?: number | null
          stock_quantity?: number | null
          supplier_name?: string | null
          tpos_product_id?: string | null
          tpos_image_url?: string | null
          product_images?: string[] | null
          barcode?: string | null
          variant?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string | null
          product_id: string | null
          product_code: string | null
          product_name: string | null
          quantity: number
          unit_price: number | null
          total_price: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          purchase_order_id?: string | null
          product_id?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity: number
          unit_price?: number | null
          total_price?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          purchase_order_id?: string | null
          product_id?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number
          unit_price?: number | null
          total_price?: number | null
          created_at?: string | null
        }
      }
      purchase_orders: {
        Row: {
          id: string
          order_code: string
          supplier_name: string | null
          order_date: string
          total_amount: number | null
          status: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          order_code: string
          supplier_name?: string | null
          order_date: string
          total_amount?: number | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          order_code?: string
          supplier_name?: string | null
          order_date?: string
          total_amount?: number | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      suppliers: {
        Row: {
          id: string
          supplier_name: string
          contact_person: string | null
          phone: string | null
          email: string | null
          address: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          supplier_name: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          supplier_name?: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tpos_credentials: {
        Row: {
          id: string
          store_name: string | null
          api_key: string | null
          access_token: string | null
          refresh_token: string | null
          bearer_token: string | null
          token_type: string | null
          expires_at: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_name?: string | null
          api_key?: string | null
          access_token?: string | null
          refresh_token?: string | null
          bearer_token?: string | null
          token_type?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_name?: string | null
          api_key?: string | null
          access_token?: string | null
          refresh_token?: string | null
          bearer_token?: string | null
          token_type?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_permissions: {
        Row: {
          id: string
          user_id: string
          page_id: string
          permissions: Json
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          page_id: string
          permissions?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          page_id?: string
          permissions?: Json
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'manager' | 'staff' | 'viewer'
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: 'admin' | 'manager' | 'staff' | 'viewer'
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'admin' | 'manager' | 'staff' | 'viewer'
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: { page_id: string; permissions: Json }[]
      }
      has_permission: {
        Args: { _user_id: string; _page_id: string; _permission_type: string }
        Returns: boolean
      }
      has_role: {
        Args: { _user_id: string; _role: 'admin' | 'manager' | 'staff' | 'viewer' }
        Returns: boolean
      }
    }
    Enums: {
      app_role: 'admin' | 'manager' | 'staff' | 'viewer'
    }
  }
}
