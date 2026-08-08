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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          document_id: string
          embedding: string
          id: string
          position: number
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          embedding: string
          id?: string
          position?: number
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          content: string
          created_at: string
          domain: string
          fetched_at: string
          id: string
          is_official: boolean
          language: string | null
          published_date: string | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          content?: string
          created_at?: string
          domain?: string
          fetched_at?: string
          id?: string
          is_official?: boolean
          language?: string | null
          published_date?: string | null
          title?: string
          updated_at?: string
          url: string
        }
        Update: {
          content?: string
          created_at?: string
          domain?: string
          fetched_at?: string
          id?: string
          is_official?: boolean
          language?: string | null
          published_date?: string | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      need_knowledge: {
        Row: {
          chunk_id: string
          created_at: string
          id: string
          need_id: string
          reused: boolean
          similarity: number | null
          user_id: string
        }
        Insert: {
          chunk_id: string
          created_at?: string
          id?: string
          need_id: string
          reused?: boolean
          similarity?: number | null
          user_id: string
        }
        Update: {
          chunk_id?: string
          created_at?: string
          id?: string
          need_id?: string
          reused?: boolean
          similarity?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "need_knowledge_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_knowledge_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
        ]
      }
      need_options: {
        Row: {
          best_for: string | null
          cons: string[]
          cost: string | null
          created_at: string
          effort: string | null
          id: string
          name: string
          need_id: string
          position: number
          pros: string[]
          recommended: boolean
          risk: string | null
          source_urls: string[]
          summary: string | null
          time_required: string | null
          user_id: string
        }
        Insert: {
          best_for?: string | null
          cons?: string[]
          cost?: string | null
          created_at?: string
          effort?: string | null
          id?: string
          name: string
          need_id: string
          position?: number
          pros?: string[]
          recommended?: boolean
          risk?: string | null
          source_urls?: string[]
          summary?: string | null
          time_required?: string | null
          user_id: string
        }
        Update: {
          best_for?: string | null
          cons?: string[]
          cost?: string | null
          created_at?: string
          effort?: string | null
          id?: string
          name?: string
          need_id?: string
          position?: number
          pros?: string[]
          recommended?: boolean
          risk?: string | null
          source_urls?: string[]
          summary?: string | null
          time_required?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "need_options_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
        ]
      }
      need_sources: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          is_official: boolean
          need_id: string
          position: number
          published_date: string | null
          snippet: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          is_official?: boolean
          need_id: string
          position?: number
          published_date?: string | null
          snippet?: string | null
          title: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          is_official?: boolean
          need_id?: string
          position?: number
          published_date?: string | null
          snippet?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "need_sources_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
        ]
      }
      need_steps: {
        Row: {
          created_at: string
          detail: string | null
          done: boolean
          id: string
          link_label: string | null
          link_url: string | null
          need_id: string
          position: number
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          done?: boolean
          id?: string
          link_label?: string | null
          link_url?: string | null
          need_id: string
          position?: number
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          done?: boolean
          id?: string
          link_label?: string | null
          link_url?: string | null
          need_id?: string
          position?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "need_steps_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
        ]
      }
      needs: {
        Row: {
          assumptions: string[]
          clarifying_answers: Json
          clarifying_questions: Json
          created_at: string
          error_message: string | null
          freshness_days: number | null
          id: string
          intent_domain: string | null
          intent_locale: string | null
          needs_live_data: boolean
          raw_input: string
          recommendation: string | null
          restated_problem: string | null
          status: string
          title: string | null
          updated_at: string
          used_live_search: boolean
          user_id: string
        }
        Insert: {
          assumptions?: string[]
          clarifying_answers?: Json
          clarifying_questions?: Json
          created_at?: string
          error_message?: string | null
          freshness_days?: number | null
          id?: string
          intent_domain?: string | null
          intent_locale?: string | null
          needs_live_data?: boolean
          raw_input: string
          recommendation?: string | null
          restated_problem?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          used_live_search?: boolean
          user_id: string
        }
        Update: {
          assumptions?: string[]
          clarifying_answers?: Json
          clarifying_questions?: Json
          created_at?: string
          error_message?: string | null
          freshness_days?: number | null
          id?: string
          intent_domain?: string | null
          intent_locale?: string | null
          needs_live_data?: boolean
          raw_input?: string
          recommendation?: string | null
          restated_problem?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          used_live_search?: boolean
          user_id?: string
        }
        Relationships: []
      }
      research_runs: {
        Row: {
          created_at: string
          id: string
          need_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          need_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          need_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_runs_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_knowledge_chunks: {
        Args: {
          match_count?: number
          max_age_days?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          domain: string
          fetched_at: string
          is_official: boolean
          published_date: string
          similarity: number
          title: string
          url: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
