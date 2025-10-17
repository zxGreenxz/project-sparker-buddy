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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      crm_teams: {
        Row: {
          created_at: string | null
          id: string
          team_id: string
          team_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          team_id: string
          team_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          team_id?: string
          team_name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          crm_team_id: string | null
          customer_name: string
          customer_status: string | null
          email: string | null
          facebook_id: string | null
          id: string
          idkh: string | null
          info_status: string | null
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          crm_team_id?: string | null
          customer_name: string
          customer_status?: string | null
          email?: string | null
          facebook_id?: string | null
          id?: string
          idkh?: string | null
          info_status?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          crm_team_id?: string | null
          customer_name?: string
          customer_status?: string | null
          email?: string | null
          facebook_id?: string | null
          id?: string
          idkh?: string | null
          info_status?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      facebook_comments: {
        Row: {
          comment_text: string | null
          comment_type: string | null
          created_at: string | null
          created_time: string | null
          customer_name: string | null
          facebook_comment_id: string
          facebook_post_id: string | null
          facebook_user_id: string | null
          id: string
          processed: boolean | null
        }
        Insert: {
          comment_text?: string | null
          comment_type?: string | null
          created_at?: string | null
          created_time?: string | null
          customer_name?: string | null
          facebook_comment_id: string
          facebook_post_id?: string | null
          facebook_user_id?: string | null
          id?: string
          processed?: boolean | null
        }
        Update: {
          comment_text?: string | null
          comment_type?: string | null
          created_at?: string | null
          created_time?: string | null
          customer_name?: string | null
          facebook_comment_id?: string
          facebook_post_id?: string | null
          facebook_user_id?: string | null
          id?: string
          processed?: boolean | null
        }
        Relationships: []
      }
      facebook_pages: {
        Row: {
          access_token: string | null
          created_at: string | null
          crm_team_id: string | null
          crm_team_name: string | null
          id: string
          is_active: boolean | null
          page_access_token: string | null
          page_id: string
          page_name: string
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          crm_team_id?: string | null
          crm_team_name?: string | null
          id?: string
          is_active?: boolean | null
          page_access_token?: string | null
          page_id: string
          page_name: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          crm_team_id?: string | null
          crm_team_name?: string | null
          id?: string
          is_active?: boolean | null
          page_access_token?: string | null
          page_id?: string
          page_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      facebook_pending_orders: {
        Row: {
          code: string | null
          comment: string | null
          comment_text: string | null
          comment_type: string | null
          created_at: string | null
          created_time: string
          customer_name: string | null
          facebook_comment_id: string
          facebook_post_id: string | null
          id: string
          name: string | null
          order_count: number | null
          phone: string | null
          processed: boolean | null
          session_index: string | null
          tpos_order_id: string | null
        }
        Insert: {
          code?: string | null
          comment?: string | null
          comment_text?: string | null
          comment_type?: string | null
          created_at?: string | null
          created_time: string
          customer_name?: string | null
          facebook_comment_id: string
          facebook_post_id?: string | null
          id?: string
          name?: string | null
          order_count?: number | null
          phone?: string | null
          processed?: boolean | null
          session_index?: string | null
          tpos_order_id?: string | null
        }
        Update: {
          code?: string | null
          comment?: string | null
          comment_text?: string | null
          comment_type?: string | null
          created_at?: string | null
          created_time?: string
          customer_name?: string | null
          facebook_comment_id?: string
          facebook_post_id?: string | null
          id?: string
          name?: string | null
          order_count?: number | null
          phone?: string | null
          processed?: boolean | null
          session_index?: string | null
          tpos_order_id?: string | null
        }
        Relationships: []
      }
      goods_receiving: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          purchase_order_id: string | null
          receiving_code: string
          receiving_date: string
          status: string | null
          supplier_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receiving_code: string
          receiving_date: string
          status?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receiving_code?: string
          receiving_date?: string
          status?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receiving_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receiving_items: {
        Row: {
          created_at: string | null
          goods_receiving_id: string | null
          id: string
          notes: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          quantity: number
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          goods_receiving_id?: string | null
          id?: string
          notes?: string | null
          product_code?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity: number
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          goods_receiving_id?: string | null
          id?: string
          notes?: string | null
          product_code?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receiving_items_goods_receiving_id_fkey"
            columns: ["goods_receiving_id"]
            isOneToOne: false
            referencedRelation: "goods_receiving"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receiving_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      live_orders: {
        Row: {
          code_tpos_order_id: string | null
          created_at: string | null
          customer_name: string | null
          facebook_comment_id: string | null
          id: string
          is_oversell: boolean | null
          live_phase_id: string | null
          live_product_id: string | null
          live_session_id: string | null
          note: string | null
          order_code: string | null
          quantity: number | null
          updated_at: string | null
        }
        Insert: {
          code_tpos_order_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          facebook_comment_id?: string | null
          id?: string
          is_oversell?: boolean | null
          live_phase_id?: string | null
          live_product_id?: string | null
          live_session_id?: string | null
          note?: string | null
          order_code?: string | null
          quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          code_tpos_order_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          facebook_comment_id?: string | null
          id?: string
          is_oversell?: boolean | null
          live_phase_id?: string | null
          live_product_id?: string | null
          live_session_id?: string | null
          note?: string | null
          order_code?: string | null
          quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_orders_live_phase_id_fkey"
            columns: ["live_phase_id"]
            isOneToOne: false
            referencedRelation: "live_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_orders_live_product_id_fkey"
            columns: ["live_product_id"]
            isOneToOne: false
            referencedRelation: "live_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_orders_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_phases: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          live_session_id: string | null
          phase_date: string
          phase_type: string
          start_time: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string
          id?: string
          live_session_id?: string | null
          phase_date: string
          phase_type: string
          start_time?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          live_session_id?: string | null
          phase_date?: string
          phase_type?: string
          start_time?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_phases_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_products: {
        Row: {
          created_at: string | null
          id: string
          live_phase_id: string | null
          price: number | null
          product_code: string | null
          product_id: string | null
          product_images: string[] | null
          product_name: string
          quantity: number
          sold_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          live_phase_id?: string | null
          price?: number | null
          product_code?: string | null
          product_id?: string | null
          product_images?: string[] | null
          product_name: string
          quantity?: number
          sold_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          live_phase_id?: string | null
          price?: number | null
          product_code?: string | null
          product_id?: string | null
          product_images?: string[] | null
          product_name?: string
          quantity?: number
          sold_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_products_live_phase_id_fkey"
            columns: ["live_phase_id"]
            isOneToOne: false
            referencedRelation: "live_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          created_at: string | null
          facebook_post_id: string | null
          id: string
          notes: string | null
          session_date: string
          status: string | null
          supplier_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          facebook_post_id?: string | null
          id?: string
          notes?: string | null
          session_date: string
          status?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          facebook_post_id?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          status?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      livestream_reports: {
        Row: {
          created_at: string | null
          id: string
          live_session_id: string | null
          notes: string | null
          report_date: string
          total_orders: number | null
          total_revenue: number | null
          total_viewers: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          live_session_id?: string | null
          notes?: string | null
          report_date: string
          total_orders?: number | null
          total_revenue?: number | null
          total_viewers?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          live_session_id?: string | null
          notes?: string | null
          report_date?: string
          total_orders?: number | null
          total_revenue?: number | null
          total_viewers?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livestream_reports_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          created_at: string | null
          id: string
          product_code: string
          product_images: string[] | null
          product_name: string
          purchase_price: number | null
          selling_price: number | null
          stock_quantity: number | null
          supplier_name: string | null
          tpos_image_url: string | null
          tpos_product_id: string | null
          unit: string | null
          updated_at: string | null
          variant: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string | null
          id?: string
          product_code: string
          product_images?: string[] | null
          product_name: string
          purchase_price?: number | null
          selling_price?: number | null
          stock_quantity?: number | null
          supplier_name?: string | null
          tpos_image_url?: string | null
          tpos_product_id?: string | null
          unit?: string | null
          updated_at?: string | null
          variant?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string | null
          id?: string
          product_code?: string
          product_images?: string[] | null
          product_name?: string
          purchase_price?: number | null
          selling_price?: number | null
          stock_quantity?: number | null
          supplier_name?: string | null
          tpos_image_url?: string | null
          tpos_product_id?: string | null
          unit?: string | null
          updated_at?: string | null
          variant?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          product_code: string | null
          product_id: string | null
          product_name: string | null
          purchase_order_id: string | null
          quantity: number
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_code?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_order_id?: string | null
          quantity: number
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_code?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_order_id?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_code: string
          order_date: string
          status: string | null
          supplier_name: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_code: string
          order_date: string
          status?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_code?: string
          order_date?: string
          status?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          supplier_name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          supplier_name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          supplier_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tpos_credentials: {
        Row: {
          access_token: string | null
          api_key: string | null
          bearer_token: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          refresh_token: string | null
          store_name: string | null
          token_type: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          api_key?: string | null
          bearer_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          refresh_token?: string | null
          store_name?: string | null
          token_type?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          api_key?: string | null
          bearer_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          refresh_token?: string | null
          store_name?: string | null
          token_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          page_id: string
          permissions: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_id: string
          permissions?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          page_id?: string
          permissions?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_live_phases: {
        Args: { session_id: string; start_date: string }
        Returns: undefined
      }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          page_id: string
          permissions: Json
        }[]
      }
      has_permission: {
        Args: { _page_id: string; _permission_type: string; _user_id: string }
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
      app_role: "admin" | "manager" | "staff" | "viewer" | "moderator"
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
      app_role: ["admin", "manager", "staff", "viewer", "moderator"],
    },
  },
} as const
