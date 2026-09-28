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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          reaction: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          reaction: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          reaction?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_code_uses: {
        Row: {
          id: string
          invite_code_id: string
          used_at: string
          user_id: string
        }
        Insert: {
          id?: string
          invite_code_id: string
          used_at?: string
          user_id: string
        }
        Update: {
          id?: string
          invite_code_id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_uses_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          max_uses: number
          updated_at: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number
          updated_at?: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number
          updated_at?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          group_id: string | null
          id: string
          post_id: string | null
          reaction_count: number
          read_at: string | null
          recipient_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          post_id?: string | null
          reaction_count?: number
          read_at?: string | null
          recipient_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          post_id?: string | null
          reaction_count?: number
          read_at?: string | null
          recipient_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "presentation_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          alt_text: string | null
          created_at: string
          created_by: string
          display_order: number
          file_size: number
          height: number
          id: string
          mime_type: string
          post_id: string
          storage_key: string
          width: number
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          created_by: string
          display_order?: number
          file_size: number
          height: number
          id?: string
          mime_type: string
          post_id: string
          storage_key: string
          width: number
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          created_by?: string
          display_order?: number
          file_size?: number
          height?: number
          id?: string
          mime_type?: string
          post_id?: string
          storage_key?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          post_id: string
          reaction: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          reaction: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          reaction?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_path: string | null
          bio: string | null
          cover_path: string | null
          created_at: string
          faculty: string | null
          full_name: string
          graduation_year: number | null
          id: string
          invite_code_id: string | null
          is_private: boolean
          language: string
          rejection_reason: string | null
          role: Database["public"]["Enums"]["account_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          username: string
          verification_method: Database["public"]["Enums"]["verification_method"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_path?: string | null
          bio?: string | null
          cover_path?: string | null
          created_at?: string
          faculty?: string | null
          full_name: string
          graduation_year?: number | null
          id: string
          invite_code_id?: string | null
          is_private?: boolean
          language?: string
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username: string
          verification_method?: Database["public"]["Enums"]["verification_method"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_path?: string | null
          bio?: string | null
          cover_path?: string | null
          created_at?: string
          faculty?: string | null
          full_name?: string
          graduation_year?: number | null
          id?: string
          invite_code_id?: string | null
          is_private?: boolean
          language?: string
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string
          verification_method?: Database["public"]["Enums"]["verification_method"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          author_id: string
          created_at: string
          deleted_at: string | null
          expires_at: string
          id: string
          status: string
          visibility: string
        }
        Insert: {
          author_id: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          status?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          status?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_media: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
          display_order: number
          file_size: number
          height: number
          id: string
          mime_type: string
          storage_key: string
          story_id: string
          width: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
          display_order?: number
          file_size: number
          height: number
          id?: string
          mime_type: string
          storage_key: string
          story_id: string
          width: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
          display_order?: number
          file_size?: number
          height?: number
          id?: string
          mime_type?: string
          storage_key?: string
          story_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "story_media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_media_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
        }
        Relationships: []
      }
      university_subjects: {
        Row: {
          code: string
          created_at: string
          faculty: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          university_id: string
        }
        Insert: {
          code: string
          created_at?: string
          faculty: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          university_id: string
        }
        Update: {
          code?: string
          created_at?: string
          faculty?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_subjects_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string | null
          status: "active" | "archived"
          subject_id: string
          university_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name?: string | null
          status?: "active" | "archived"
          subject_id: string
          university_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string | null
          status?: "active" | "archived"
          subject_id?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_groups_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "university_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_groups_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: "owner" | "member"
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: "owner" | "member"
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: "owner" | "member"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "presentation_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_group_invitations: {
        Row: {
          created_at: string
          group_id: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: "pending" | "accepted" | "declined" | "cancelled"
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: "pending" | "accepted" | "declined" | "cancelled"
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: "pending" | "accepted" | "declined" | "cancelled"
        }
        Relationships: [
          {
            foreignKeyName: "presentation_group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "presentation_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_group_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_group_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      university_roles: {
        Row: {
          category: "teaching" | "administrative" | "leadership" | "support" | "other"
          created_at: string
          description: string | null
          display_priority: number
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          university_id: string
        }
        Insert: {
          category: "teaching" | "administrative" | "leadership" | "support" | "other"
          created_at?: string
          description?: string | null
          display_priority?: number
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          university_id: string
        }
        Update: {
          category?: "teaching" | "administrative" | "leadership" | "support" | "other"
          created_at?: string
          description?: string | null
          display_priority?: number
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_roles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_university_roles: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          university_role_id: string
          updated_at: string
          user_id: string
          verification_status: "pending" | "verified" | "rejected" | "revoked" | "expired"
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          university_role_id: string
          updated_at?: string
          user_id: string
          verification_status?: "pending" | "verified" | "rejected" | "revoked" | "expired"
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          university_role_id?: string
          updated_at?: string
          user_id?: string
          verification_status?: "pending" | "verified" | "rejected" | "revoked" | "expired"
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_university_roles_university_role_id_fkey"
            columns: ["university_role_id"]
            isOneToOne: false
            referencedRelation: "university_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_university_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_university_roles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_audit_logs: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          new_status: string
          previous_status: string | null
          reason: string | null
          user_id: string
          user_role_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          new_status: string
          previous_status?: string | null
          reason?: string | null
          user_id: string
          user_role_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          new_status?: string
          previous_status?: string | null
          reason?: string | null
          user_id?: string
          user_role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_audit_logs_user_role_id_fkey"
            columns: ["user_role_id"]
            isOneToOne: false
            referencedRelation: "user_university_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_connected: { Args: { p_a: string; p_b: string }; Returns: boolean }
      can_view_story: { Args: { p_story: string }; Returns: boolean }
      can_view_story_object: { Args: { p_name: string }; Returns: boolean }
      consume_rate_limit: {
        Args: {
          p_bucket: string
          p_key: string
          p_max: number
          p_window: string
        }
        Returns: boolean
      }
      create_post: {
        Args: {
          p_body: string
          p_media_alt?: string
          p_media_height?: number
          p_media_key?: string
          p_media_mime?: string
          p_media_size?: number
          p_media_width?: number
        }
        Returns: string
      }
      create_story: {
        Args: {
          p_caption?: string
          p_media_height: number
          p_media_key: string
          p_media_mime: string
          p_media_size: number
          p_media_width: number
        }
        Returns: string
      }
      create_presentation_group: {
        Args: {
          p_description?: string
          p_initial_invitees?: string[]
          p_name?: string
          p_subject_id: string
        }
        Returns: string
      }
      delete_story: { Args: { p_story: string }; Returns: boolean }
      is_admin: { Args: { p_user?: string }; Returns: boolean }
      is_approved_member: { Args: { p_user?: string }; Returns: boolean }
      is_conversation_member: {
        Args: { p_conversation: string }
        Returns: boolean
      }
      invite_to_presentation_group: {
        Args: {
          p_group_id: string
          p_invitee_id: string
        }
        Returns: string
      }
      leave_presentation_group: {
        Args: {
          p_group_id: string
          p_target_user_id?: string
        }
        Returns: string
      }
      is_invite_code_valid: { Args: { p_code: string }; Returns: boolean }
      list_conversation_previews: {
        Args: never
        Returns: {
          conversation_id: string
          last_message_at: string
          last_message_body: string
          last_message_sender: string
          last_read_at: string
          other_avatar_path: string
          other_full_name: string
          other_id: string
          other_username: string
          unread_count: number
        }[]
      }
      maintain_reaction_notification: {
        Args: {
          p_actor: string
          p_post: string
          p_recipient: string
          p_table: string
          p_target: string
          p_type: string
        }
        Returns: undefined
      }
      owns_story: { Args: { p_story: string }; Returns: boolean }
      purge_expired_stories: {
        Args: { p_older_than?: string }
        Returns: {
          storage_key: string
        }[]
      }
      react_to_comment: {
        Args: { p_comment: string; p_reaction: string }
        Returns: Json
      }
      react_to_post: {
        Args: { p_post: string; p_reaction: string }
        Returns: Json
      }
      respond_presentation_group_invitation: {
        Args: {
          p_accept: boolean
          p_invitation_id: string
        }
        Returns: boolean
      }
      set_user_role_verification: {
        Args: {
          p_expires_at?: string
          p_new_status: string
          p_reason?: string
          p_user_role_id: string
        }
        Returns: boolean
      }
      set_connection: {
        Args: { p_action: string; p_other: string }
        Returns: string
      }
      start_conversation: { Args: { p_other: string }; Returns: string }
      view_story: { Args: { p_story: string }; Returns: number }
    }
    Enums: {
      account_role: "student" | "admin"
      account_status: "pending" | "approved" | "rejected" | "suspended"
      verification_method:
        | "invite_code"
        | "university_email"
        | "admin_invite"
        | "manual"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_role: ["student", "admin"],
      account_status: ["pending", "approved", "rejected", "suspended"],
      verification_method: [
        "invite_code",
        "university_email",
        "admin_invite",
        "manual",
      ],
    },
  },
} as const
