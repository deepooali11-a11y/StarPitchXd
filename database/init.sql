-- VideoAnalyst X — PostgreSQL Database Schema
-- Provides relational match metadata & high-frequency spatio-temporal tracking

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. جدول الفرق (Teams)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    short_code VARCHAR(10) NOT NULL,
    primary_color_hex VARCHAR(7) NOT NULL DEFAULT '#EF4444',
    secondary_color_hex VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول اللاعبين (Players)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    jersey_number INT NOT NULL CHECK (jersey_number BETWEEN 1 AND 99),
    position VARCHAR(20) NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
    max_speed_kmh NUMERIC(5,2) DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, jersey_number)
);

-- 3. جدول المباريات (Matches)
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    home_team_id UUID REFERENCES teams(id),
    away_team_id UUID REFERENCES teams(id),
    stream_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'LIVE' CHECK (status IN ('SCHEDULED', 'LIVE', 'COMPLETED', 'CLIP_ANALYSIS')),
    pitch_length_m NUMERIC(5,2) NOT NULL DEFAULT 105.00,
    pitch_width_m NUMERIC(5,2) NOT NULL DEFAULT 68.00,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- 4. جدول الإحداثيات اللحظية للإطارات (Tracking Frames - High Frequency Telemetry)
CREATE TABLE IF NOT EXISTS tracking_frames (
    id BIGSERIAL PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    frame_number INT NOT NULL,
    timestamp_ms BIGINT NOT NULL,
    period INT NOT NULL DEFAULT 1 CHECK (period IN (1, 2, 3, 4)),
    ball_x NUMERIC(6,2),
    ball_y NUMERIC(6,2),
    ball_speed_kmh NUMERIC(6,2),
    players_telemetry JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_match_time ON tracking_frames(match_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_tracking_telemetry_gin ON tracking_frames USING GIN (players_telemetry);

-- 5. جدول أحداث المباراة التكتيكية (Match Events)
CREATE TABLE IF NOT EXISTS match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('PASS', 'SHOT', 'GOAL', 'HIGH_PRESSURE', 'TURNOVER', 'KEY_MOMENT')),
    period INT NOT NULL DEFAULT 1,
    timestamp_ms BIGINT NOT NULL,
    video_timestamp_sec NUMERIC(8,2) NOT NULL,
    team_side VARCHAR(10) NOT NULL CHECK (team_side IN ('HOME', 'AWAY')),
    actor_track_id INT,
    receiver_track_id INT,
    start_x NUMERIC(6,2) NOT NULL,
    start_y NUMERIC(6,2) NOT NULL,
    end_x NUMERIC(6,2),
    end_y NUMERIC(6,2),
    xg_value NUMERIC(4,3) DEFAULT 0.000,
    impact_score NUMERIC(4,2) DEFAULT 0.00,
    description_ar TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_match_type ON match_events(match_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_impact ON match_events(match_id, impact_score DESC);

-- 6. جدول اللقطات الإحصائية التكتيكية المجمعة (Tactical Snapshots)
CREATE TABLE IF NOT EXISTS tactical_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_side VARCHAR(10) NOT NULL CHECK (team_side IN ('HOME', 'AWAY')),
    snapshot_type VARCHAR(40) NOT NULL CHECK (snapshot_type IN ('HEATMAP', 'PASSING_NETWORK', 'PRESSURE_MAP')),
    matrix_data JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. جدول محادثات المساعد الذكي والتقارير (AI Chat Logs & Reports)
CREATE TABLE IF NOT EXISTS ai_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_query TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    referenced_moments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
