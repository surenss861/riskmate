export interface JobData {
  id: string;
  client_name: string;
  client_type: string;
  job_type: string;
  location: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  risk_score: number | null;
  risk_level: string | null;
  created_at: string;
}

export interface RiskScoreData {
  overall_score: number;
  risk_level: string;
  factors: Array<{
    code: string;
    name: string;
    severity: string;
    weight: number;
  }>;
}

export interface MitigationItem {
  id: string;
  title: string;
  description: string;
  done: boolean;
  is_completed?: boolean;
  completed_at?: string | null;
  created_at?: string | null;
}

export interface OrganizationData {
  id: string;
  name: string;
  subscription_tier?: string | null;
  logo_url?: string | null;
  accent_color?: string | null;
}

export interface JobDocumentAsset {
  id?: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
  file_path?: string;
  buffer: Buffer;
  category?: 'before' | 'during' | 'after';
}

export interface AuditLogEntry {
  id: string;
  event_name: string;
  target_type: string;
  target_id: string;
  actor_id: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

