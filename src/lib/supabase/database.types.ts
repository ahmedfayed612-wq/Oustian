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
      conversation_members: {
        Row: {
          conversation_id: string;
          joined_at: string;
          last_read_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          joined_at?: string;
          last_read_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          joined_at?: string;
          last_read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          last_message_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
        };
        Relationships: [];
      };
      event_rsvps: {
        Row: {
          created_at: string;
          event_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          created_at: string;
          creator_id: string;
          description: string | null;
          ends_at: string | null;
          id: string;
          location: string | null;
          starts_at: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          creator_id: string;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          location?: string | null;
          starts_at: string;
          title: string;
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          location?: string | null;
          starts_at?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invite_codes: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          label: string | null;
          max_uses: number;
          updated_at: string;
          uses: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          label?: string | null;
          max_uses?: number;
          updated_at?: string;
          uses?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          label?: string | null;
          max_uses?: number;
          updated_at?: string;
          uses?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invite_code_uses: {
        Row: {
          id: string;
          invite_code_id: string;
          used_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          invite_code_id: string;
          used_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          invite_code_id?: string;
          used_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invite_code_uses_invite_code_id_fkey";
            columns: ["invite_code_id"];
            isOneToOne: false;
            referencedRelation: "invite_codes";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          post_id: string | null;
          read_at: string | null;
          recipient_id: string;
          type: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          read_at?: string | null;
          recipient_id: string;
          type: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          post_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          post_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_likes: {
        Row: {
          created_at: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          avatar_path: string | null;
          bio: string | null;
          cover_path: string | null;
          created_at: string;
          faculty: string | null;
          full_name: string;
          graduation_year: number | null;
          id: string;
          invite_code_id: string | null;
          is_private: boolean;
          language: string;
          rejection_reason: string | null;
          role: Database["public"]["Enums"]["account_role"];
          status: Database["public"]["Enums"]["account_status"];
          updated_at: string;
          username: string;
          verification_method: Database["public"]["Enums"]["verification_method"];
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          avatar_path?: string | null;
          bio?: string | null;
          cover_path?: string | null;
          created_at?: string;
          faculty?: string | null;
          full_name: string;
          graduation_year?: number | null;
          id: string;
          invite_code_id?: string | null;
          is_private?: boolean;
          language?: string;
          rejection_reason?: string | null;
          role?: Database["public"]["Enums"]["account_role"];
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
          username: string;
          verification_method?: Database["public"]["Enums"]["verification_method"];
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          avatar_path?: string | null;
          bio?: string | null;
          cover_path?: string | null;
          created_at?: string;
          faculty?: string | null;
          full_name?: string;
          graduation_year?: number | null;
          id?: string;
          invite_code_id?: string | null;
          is_private?: boolean;
          language?: string;
          rejection_reason?: string | null;
          role?: Database["public"]["Enums"]["account_role"];
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
          username?: string;
          verification_method?: Database["public"]["Enums"]["verification_method"];
        };
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_invite_code_id_fkey";
            columns: ["invite_code_id"];
            isOneToOne: false;
            referencedRelation: "invite_codes";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          sender_id: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          sender_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          bucket: string;
          hits: number;
          key: string;
          window_start: string;
        };
        Insert: {
          bucket: string;
          hits?: number;
          key: string;
          window_start: string;
        };
        Update: {
          bucket?: string;
          hits?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      consume_rate_limit: {
        Args: {
          p_bucket: string;
          p_key: string;
          /** Postgres `interval`, e.g. `"10 minutes"`. */
          p_window: string;
          p_max: number;
        };
        Returns: boolean;
      };
      is_admin: {
        Args: { p_user?: string };
        Returns: boolean;
      };
      is_approved_member: {
        Args: { p_user?: string };
        Returns: boolean;
      };
      is_conversation_member: {
        Args: { p_conversation: string };
        Returns: boolean;
      };
      is_invite_code_valid: {
        Args: { p_code: string };
        Returns: boolean;
      };
      list_conversation_previews: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          conversation_id: string;
          last_read_at: string;
          other_id: string | null;
          other_username: string | null;
          other_full_name: string | null;
          other_avatar_path: string | null;
          last_message_body: string | null;
          last_message_at: string;
          last_message_sender: string | null;
          unread_count: number;
        }>;
      };
      start_conversation: {
        Args: { p_other: string };
        Returns: string;
      };
    };
    Enums: {
      account_role: "student" | "admin";
      account_status: "pending" | "approved" | "rejected" | "suspended";
      verification_method:
        | "invite_code"
        | "university_email"
        | "admin_invite"
        | "manual";
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
