// ============================================
// StarPitchXd - Shared Type Definitions
// ============================================

// ---- Upload Flow Types ----
export type UploadStatusValue = 'processing' | 'completed' | 'failed';

export interface UploadRecord {
  id: string;
  status: UploadStatusValue;
  progress: number;
  uploadedAt: string;
  filename: string;
  error?: string;
}

export interface UploadResponse {
  id: string;
  status: string;
  message: string;
}

// ---- Results Types ----
export interface MatchEvent {
  event_type: string;
  period: number;
  video_timestamp_sec: number;
  team_side: 'HOME' | 'AWAY';
  xg_value?: number;
  impact_score?: number;
  description_ar: string;
}

export interface AnalysisStats {
  event_count: number;
  frame_count: number;
  average_pressure_index: number;
  source_file: string;
}

export interface PlayerFrame {
  track_id: number;
  jersey: number;
  team: 'HOME' | 'AWAY';
  x: number;
  y: number;
  speed_kmh: number;
}

export interface AnalysisFrame {
  players: PlayerFrame[];
  ball: { x: number; y: number };
  video_timestamp_sec: number;
  pressure_index: number;
}

export interface AnalysisResults {
  id: string;
  events: MatchEvent[];
  stats: AnalysisStats;
  frames: AnalysisFrame[];
}

// ---- Re-export from components ----
export type { PlayerNode, PassingNetworkData } from '../components/LivePitchCanvas';
export type { TelemetryPoint } from '../components/TacticalCharts';
