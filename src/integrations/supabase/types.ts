export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          changes: Json | null;
          created_at: string;
          id: string;
          record_id: string | null;
          table_name: string;
          user_id: string | null;
          username: string;
        };
        Insert: {
          action: string;
          changes?: Json | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name: string;
          user_id?: string | null;
          username: string;
        };
        Update: {
          action?: string;
          changes?: Json | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name?: string;
          user_id?: string | null;
          username?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          address: string | null;
          created_at: string | null;
          customer_name: string;
          customer_status: string;
          email: string | null;
          facebook_id: string | null;
          id: string;
          idkh: string;
          info_status: Database["public"]["Enums"]["customer_info_status_enum"];
          notes: string | null;
          phone: string | null;
          total_orders: number;
          total_spent: number;
          updated_at: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string | null;
          customer_name: string;
          customer_status?: string;
          email?: string | null;
          facebook_id?: string | null;
          id?: string;
          idkh?: string;
          info_status?: Database["public"]["Enums"]["customer_info_status_enum"];
          notes?: string | null;
          phone?: string | null;
          total_orders?: number;
          total_spent?: number;
          updated_at?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string | null;
          customer_name?: string;
          customer_status?: string;
          email?: string | null;
          facebook_id?: string | null;
          id?: string;
          idkh?: string;
          info_status?: Database["public"]["Enums"]["customer_info_status_enum"];
          notes?: string | null;
          phone?: string | null;
          total_orders?: number;
          total_spent?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      facebook_pages: {
        Row: {
          created_at: string | null;
          crm_team_id: string | null;
          crm_team_name: string | null;
          id: string;
          is_active: boolean | null;
          page_id: string;
          page_name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          crm_team_id?: string | null;
          crm_team_name?: string | null;
          id?: string;
          is_active?: boolean | null;
          page_id: string;
          page_name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          crm_team_id?: string | null;
          crm_team_name?: string | null;
          id?: string;
          is_active?: boolean | null;
          page_id?: string;
          page_name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      facebook_pending_orders: {
        Row: {
          code: string | null;
          comment: string | null;
          created_at: string;
          created_time: string;
          facebook_comment_id: string | null;
          facebook_post_id: string | null;
          facebook_user_id: string | null;
          id: string;
          name: string;
          order_count: number;
          phone: string | null;
          session_index: string | null;
          tpos_order_id: string | null;
          updated_at: string;
        };
        Insert: {
          code?: string | null;
          comment?: string | null;
          created_at?: string;
          created_time?: string;
          facebook_comment_id?: string | null;
          facebook_post_id?: string | null;
          facebook_user_id?: string | null;
          id?: string;
          name: string;
          order_count?: number;
          phone?: string | null;
          session_index?: string | null;
          tpos_order_id?: string | null;
          updated_at?: string;
        };
        Update: {
          code?: string | null;
          comment?: string | null;
          created_at?: string;
          created_time?: string;
          facebook_comment_id?: string | null;
          facebook_post_id?: string | null;
          facebook_user_id?: string | null;
          id?: string;
          name?: string;
          order_count?: number;
          phone?: string | null;
          session_index?: string | null;
          tpos_order_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      goods_receiving: {
        Row: {
          created_at: string | null;
          has_discrepancy: boolean | null;
          id: string;
          notes: string | null;
          purchase_order_id: string;
          received_by_user_id: string;
          received_by_username: string;
          receiving_date: string;
          total_items_expected: number;
          total_items_received: number;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          has_discrepancy?: boolean | null;
          id?: string;
          notes?: string | null;
          purchase_order_id: string;
          received_by_user_id: string;
          received_by_username: string;
          receiving_date?: string;
          total_items_expected?: number;
          total_items_received?: number;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          has_discrepancy?: boolean | null;
          id?: string;
          notes?: string | null;
          purchase_order_id?: string;
          received_by_user_id?: string;
          received_by_username?: string;
          receiving_date?: string;
          total_items_expected?: number;
          total_items_received?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "goods_receiving_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receiving_received_by_user_id_fkey";
            columns: ["received_by_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      goods_receiving_items: {
        Row: {
          created_at: string | null;
          discrepancy_quantity: number | null;
          discrepancy_type: string | null;
          expected_quantity: number;
          goods_receiving_id: string;
          id: string;
          item_notes: string | null;
          product_code: string | null;
          product_condition: string | null;
          product_name: string;
          purchase_order_item_id: string;
          received_quantity: number;
          variant: string | null;
        };
        Insert: {
          created_at?: string | null;
          discrepancy_quantity?: number | null;
          discrepancy_type?: string | null;
          expected_quantity: number;
          goods_receiving_id: string;
          id?: string;
          item_notes?: string | null;
          product_code?: string | null;
          product_condition?: string | null;
          product_name: string;
          purchase_order_item_id: string;
          received_quantity?: number;
          variant?: string | null;
        };
        Update: {
          created_at?: string | null;
          discrepancy_quantity?: number | null;
          discrepancy_type?: string | null;
          expected_quantity?: number;
          goods_receiving_id?: string;
          id?: string;
          item_notes?: string | null;
          product_code?: string | null;
          product_condition?: string | null;
          product_name: string;
          purchase_order_item_id: string;
          received_quantity?: number;
          variant?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "goods_receiving_items_goods_receiving_id_fkey";
            columns: ["goods_receiving_id"];
            isOneToOne: false;
            referencedRelation: "goods_receiving";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receiving_items_purchase_order_item_id_fkey";
            columns: ["purchase_order_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      live_orders: {
        Row: {
          code_tpos_order_id: string | null;
          created_at: string;
          customer_status: string | null;
          facebook_comment_id: string | null;
          id: string;
          is_oversell: boolean | null;
          live_phase_id: string | null;
          live_product_id: string;
          live_session_id: string;
          note: string | null;
          order_code: string;
          order_date: string;
          quantity: number;
          tpos_order_id: string | null;
          upload_status: string | null;
          uploaded_at: string | null;
        };
        Insert: {
          code_tpos_order_id?: string | null;
          created_at?: string;
          customer_status?: string | null;
          facebook_comment_id?: string | null;
          id?: string;
          is_oversell?: boolean | null;
          live_phase_id?: string | null;
          live_product_id: string;
          live_session_id: string;
          note?: string | null;
          order_code: string;
          order_date?: string;
          quantity?: number;
          tpos_order_id?: string | null;
          upload_status?: string | null;
          uploaded_at?: string | null;
        };
        Update: {
          code_tpos_order_id?: string | null;
          created_at?: string;
          customer_status?: string | null;
          facebook_comment_id?: string | null;
          id?: string;
          is_oversell?: boolean | null;
          live_phase_id?: string | null;
          live_product_id?: string;
          live_session_id?: string;
          note?: string | null;
          order_code?: string;
          order_date?: string;
          quantity?: number;
          tpos_order_id?: string | null;
          upload_status?: string | null;
          uploaded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "live_orders_live_product_id_fkey";
            columns: ["live_product_id"];
            isOneToOne: false;
            referencedRelation: "live_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_orders_live_session_id_fkey";
            columns: ["live_session_id"];
            isOneToOne: false;
            referencedRelation: "live_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      live_phases: {
        Row: {
          created_at: string;
          id: string;
          live_session_id: string;
          phase_date: string;
          phase_type: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          live_session_id: string;
          phase_date: string;
          phase_type: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          live_session_id?: string;
          phase_date?: string;
          phase_type?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      live_products: {
        Row: {
          base_product_code: string | null;
          created_at: string;
          id: string;
          image_url: string | null;
          live_phase_id: string | null;
          live_session_id: string;
          note: string | null;
          prepared_quantity: number;
          product_code: string;
          product_name: string;
          product_type: Database["public"]["Enums"]["product_type_enum"];
          sold_quantity: number;
          updated_at: string;
          variant: string | null;
        };
        Insert: {
          base_product_code?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          live_phase_id?: string | null;
          live_session_id: string;
          note?: string | null;
          prepared_quantity?: number;
          product_code: string;
          product_name: string;
          product_type?: Database["public"]["Enums"]["product_type_enum"];
          sold_quantity?: number;
          updated_at?: string;
          variant?: string | null;
        };
        Update: {
          base_product_code?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          live_phase_id?: string | null;
          live_session_id?: string;
          note?: string | null;
          prepared_quantity?: number;
          product_code?: string;
          product_name?: string;
          product_type?: Database["public"]["Enums"]["product_type_enum"];
          sold_quantity?: number;
          updated_at?: string;
          variant?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "live_products_live_session_id_fkey";
            columns: ["live_session_id"];
            isOneToOne: false;
            referencedRelation: "live_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      live_sessions: {
        Row: {
          created_at: string;
          end_date: string | null;
          id: string;
          notes: string | null;
          session_date: string;
          session_name: string | null;
          start_date: string | null;
          status: string;
          supplier_name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          notes?: string | null;
          session_date?: string;
          session_name?: string | null;
          start_date?: string | null;
          status?: string;
          supplier_name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          notes?: string | null;
          session_date?: string;
          session_name?: string | null;
          start_date?: string | null;
          status?: string;
          supplier_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      livestream_reports: {
        Row: {
          created_at: string;
          evening_ad_cost: number | null;
          evening_duration: string | null;
          evening_live_orders: number | null;
          id: string;
          morning_ad_cost: number | null;
          morning_duration: string | null;
          morning_live_orders: number | null;
          report_date: string;
          total_inbox_orders: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          evening_ad_cost?: number | null;
          evening_duration?: string | null;
          evening_live_orders?: number | null;
          id?: string;
          morning_ad_cost?: number | null;
          morning_duration?: string | null;
          morning_live_orders?: number | null;
          report_date: string;
          total_inbox_orders?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          evening_ad_cost?: number | null;
          evening_duration?: string | null;
          evening_live_orders?: number | null;
          id?: string;
          morning_ad_cost?: number | null;
          morning_duration?: string | null;
          morning_live_orders?: number | null;
          report_date?: string;
          total_inbox_orders?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      printer_settings: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          printer_ip: string;
          printer_name: string;
          printer_port: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          printer_ip: string;
          printer_name: string;
          printer_port?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          printer_ip?: string;
          printer_name?: string;
          printer_port?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          barcode: string | null;
          base_product_code: string | null;
          category: string | null;
          created_at: string;
          id: string;
          price_images: string[] | null;
          product_code: string;
          product_images: string[] | null;
          product_name: string;
          productid_bienthe: number | null;
          purchase_price: number | null;
          selling_price: number | null;
          stock_quantity: number | null;
          supplier_name: string | null;
          tpos_image_url: string | null;
          tpos_product_id: number | null;
          unit: string | null;
          updated_at: string;
          variant: string | null;
        };
        Insert: {
          barcode?: string | null;
          base_product_code?: string | null;
          category?: string | null;
          created_at?: string;
          id?: string;
          price_images?: string[] | null;
          product_code: string;
          product_images?: string[] | null;
          product_name: string;
          productid_bienthe?: number | null;
          purchase_price?: number | null;
          selling_price?: number | null;
          stock_quantity?: number | null;
          supplier_name?: string | null;
          tpos_image_url?: string | null;
          tpos_product_id?: number | null;
          unit?: string | null;
          updated_at?: string;
          variant?: string | null;
        };
        Update: {
          barcode?: string | null;
          base_product_code?: string | null;
          category?: string | null;
          created_at?: string;
          id?: string;
          price_images?: string[] | null;
          product_code?: string;
          product_images?: string[] | null;
          product_name?: string;
          productid_bienthe?: number | null;
          purchase_price?: number | null;
          selling_price?: number | null;
          stock_quantity?: number | null;
          supplier_name?: string | null;
          tpos_image_url?: string | null;
          tpos_product_id?: number | null;
          unit?: string | null;
          updated_at?: string;
          variant?: string | null;
        };
        Relationships: [];
      };
      products_cleanup_backup: {
        Row: {
          deleted_at: string | null;
          id: string;
          price_images: string[] | null;
          product_code: string;
          product_images: string[] | null;
          product_name: string;
          purchase_price: number | null;
          reason: string | null;
          selling_price: number | null;
          stock_quantity: number | null;
          supplier_name: string | null;
          tpos_product_id: number | null;
          variant: string | null;
        };
        Insert: {
          deleted_at?: string | null;
          id: string;
          price_images?: string[] | null;
          product_code: string;
          product_images?: string[] | null;
          product_name: string;
          purchase_price?: number | null;
          reason?: string | null;
          selling_price?: number | null;
          stock_quantity?: number | null;
          supplier_name?: string | null;
          tpos_product_id?: number | null;
          variant?: string | null;
        };
        Update: {
          deleted_at?: string | null;
          id?: string;
          price_images?: string[] | null;
          product_code?: string;
          product_images?: string[] | null;
          product_name?: string;
          purchase_price?: number | null;
          reason?: string | null;
          selling_price?: number | null;
          stock_quantity?: number | null;
          supplier_name?: string | null;
          tpos_product_id?: number | null;
          variant?: string | null;
        };
        Relationships: [];
      };
      products_duplicate_cleanup: {
        Row: {
          barcode: string | null;
          base_product_code: string | null;
          category: string | null;
          created_at: string | null;
          id: string | null;
          price_images: string[] | null;
          product_code: string | null;
          product_images: string[] | null;
          product_name: string | null;
          productid_bienthe: number | null;
          purchase_price: number | null;
          selling_price: number | null;
          stock_quantity: number | null;
          supplier_name: string | null;
          tpos_image_url: string | null;
          tpos_product_id: number | null;
          unit: string | null;
          updated_at: string | null;
          variant: string | null;
        };
        Insert: {
          barcode?: string | null;
          base_product_code?: string | null;
          category?: string | null;
          created_at?: string | null;
          id?: string | null;
          price_images?: string[] | null;
          product_code?: string | null;
          product_images?: string[] | null;
          product_name?: string | null;
          productid_bienthe?: number | null;
          purchase_price?: number | null;
          selling_price?: number | null;
          stock_quantity?: number | null;
          supplier_name?: string | null;
          tpos_image_url?: string | null;
          tpos_product_id?: number | null;
          unit?: string | null;
          updated_at?: string | null;
          variant?: string | null;
        };
        Update: {
          barcode?: string | null;
          base_product_code?: string | null;
          category?: string | null;
          created_at?: string | null;
          id?: string | null;
          price_images?: string[] | null;
          product_code?: string | null;
          product_images?: string[] | null;
          product_name?: string | null;
          productid_bienthe?: number | null;
          purchase_price?: number | null;
          selling_price?: number | null;
          stock_quantity: number | null;
          supplier_name?: string | null;
          tpos_image_url?: string | null;
          tpos_product_id?: number | null;
          unit?: string | null;
          updated_at?: string | null;
          variant?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
          user_id: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
          user_id: string;
          username: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
          user_id?: string;
          username?: string;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          position: number;
          product_code_snapshot: string | null;
          product_id: string | null;
          product_images_snapshot: string[] | null;
          product_name_snapshot: string | null;
          price_images_snapshot: string[] | null;
          purchase_order_id: string;
          purchase_price_snapshot: number | null;
          quantity: number;
          selling_price_snapshot: number | null;
          tpos_deleted: boolean | null;
          tpos_deleted_at: string | null;
          tpos_product_id: number | null;
          variant_snapshot: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          position?: number;
          product_code_snapshot?: string | null;
          product_id?: string | null;
          product_images_snapshot?: string[] | null;
          product_name_snapshot?: string | null;
          price_images_snapshot?: string[] | null;
          purchase_order_id: string;
          purchase_price_snapshot?: number | null;
          quantity?: number;
          selling_price_snapshot?: number | null;
          tpos_deleted?: boolean | null;
          tpos_deleted_at?: string | null;
          tpos_product_id?: number | null;
          variant_snapshot?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          position?: number;
          product_code_snapshot?: string | null;
          product_id?: string | null;
          product_images_snapshot?: string[] | null;
          product_name_snapshot?: string | null;
          price_images_snapshot?: string[] | null;
          purchase_order_id?: string;
          purchase_price_snapshot?: number | null;
          quantity?: number;
          selling_price_snapshot?: number | null;
          tpos_deleted?: boolean | null;
          tpos_deleted_at?: string | null;
          tpos_product_id?: number | null;
          variant_snapshot?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          created_at: string;
          discount_amount: number | null;
          final_amount: number | null;
          id: string;
          invoice_date: string | null;
          invoice_images: string[] | null;
          invoice_number: string | null;
          notes: string | null;
          order_date: string;
          shipping_fee: number | null;
          status: string;
          supplier_id: string | null;
          supplier_name: string | null;
          total_amount: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          discount_amount?: number | null;
          final_amount?: number | null;
          id?: string;
          invoice_date?: string | null;
          invoice_images?: string[] | null;
          invoice_number?: string | null;
          notes?: string | null;
          order_date?: string;
          shipping_fee?: number | null;
          status?: string;
          supplier_id?: string | null;
          supplier_name?: string | null;
          total_amount?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          discount_amount?: number | null;
          final_amount?: number | null;
          id?: string;
          invoice_date?: string | null;
          invoice_images?: string[] | null;
          invoice_number?: string | null;
          notes?: string | null;
          order_date?: string;
          shipping_fee?: number | null;
          status?: string;
          supplier_id?: string | null;
          supplier_name?: string | null;
          total_amount?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          address: string | null;
          contact_person: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tpos_config: {
        Row: {
          bearer_token: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          bearer_token: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          bearer_token?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_live_phases: {
        Args: { session_id: string; start_date: string };
        Returns: undefined;
      };
      extract_supplier_from_name: {
        Args: { product_name: string };
        Returns: string;
      };
      get_product_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_supplier_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avg_stock: number;
          low_stock_count: number;
          out_of_stock_count: number;
          supplier_name: string;
          total_inventory_value: number;
          total_products: number;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      search_products_unaccent: {
        Args: { search_text: string };
        Returns: {
          barcode: string | null;
          base_product_code: string | null;
          category: string | null;
          created_at: string;
          id: string;
          price_images: string[] | null;
          product_code: string;
          product_images: string[] | null;
          product_name: string;
          productid_bienthe: number | null;
          purchase_price: number | null;
          selling_price: number | null;
          stock_quantity: number | null;
          supplier_name: string | null;
          tpos_image_url: string | null;
          tpos_product_id: number | null;
          unit: string | null;
          updated_at: string;
          variant: string | null;
        }[];
      };
      unaccent: {
        Args: { "": string };
        Returns: string;
      };
      unaccent_init: {
        Args: { "": unknown };
        Returns: unknown;
      };
      update_missing_suppliers: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      upsert_customers_deduped: {
        Args: { payload: Json };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      customer_info_status_enum: "incomplete" | "complete" | "synced_tpos";
      product_type_enum: "hang_dat" | "hang_le" | "hang_so_luong";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      customer_info_status_enum: ["incomplete", "complete", "synced_tpos"],
      product_type_enum: ["hang_dat", "hang_le", "hang_so_luong"],
    },
  },
} as const;
