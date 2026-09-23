/**
 * Placeholder database types.
 *
 * Hand-written to cover the tables created by the first migrations
 * (M1: `profiles`, `invite_codes`). Once the Supabase project is linked,
 * regenerate the whole file from the live schema:
 *
 *   npm run db:types
 *
 * Never edit this file by hand after that point.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      invite_codes: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          faculty: string | null;
          full_name: string;
          id: string;
          is_approved: boolean;
          is_private: boolean;
          language: Database["public"]["Enums"]["app_language"];
          message_permission: Database["public"]["Enums"]["message_permission"];
          role: Database["public"]["Enums"]["account_role"];
          study_year: number | null;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          faculty?: string | null;
          full_name: string;
          id: string;
          is_approved?: boolean;
          is_private?: boolean;
          language?: Database["public"]["Enums"]["app_language"];
          message_permission?: Database["public"]["Enums"]["message_permission"];
          role?: Database["public"]["Enums"]["account_role"];
          study_year?: number | null;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          faculty?: string | null;
          full_name?: string;
          id?: string;
          is_approved?: boolean;
          is_private?: boolean;
          language?: Database["public"]["Enums"]["app_language"];
          message_permission?: Database["public"]["Enums"]["message_permission"];
          role?: Database["public"]["Enums"]["account_role"];
          study_year?: number | null;
          username?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      account_role: "student" | "staff" | "admin";
      app_language: "ar" | "en";
      connection_status: "pending" | "accepted" | "declined";
      conversation_status: "active" | "request";
      message_permission: "connections" | "everyone";
      notification_type:
        | "connection_request"
        | "connection_accepted"
        | "like"
        | "comment"
        | "event_rsvp"
        | "message_request";
      post_audience: "everyone" | "connections";
      post_type: "text" | "photo" | "poll";
      report_status: "open" | "reviewed" | "dismissed";
      rsvp_status: "going" | "maybe";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
