// ============================================
// StarPitchXd - Centralized API Client
// ============================================

import type {
  UploadRecord,
  UploadResponse,
  AnalysisResults,
} from './types';

const BASE = ''; // Same origin

// ---- Generic response handler ----
async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`API Error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ============================================
// Upload Flow (NEW)
// ============================================

export async function uploadVideo(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type manually — browser adds boundary
  });
  return handle<UploadResponse>(res);
}

export async function getUploadStatus(id: string): Promise<UploadRecord> {
  const res = await fetch(`${BASE}/api/status/${id}`);
  return handle<UploadRecord>(res);
}

export async function getUploadResults(id: string): Promise<AnalysisResults> {
  const res = await fetch(`${BASE}/api/results/${id}`);
  return handle<AnalysisResults>(res);
}

// ============================================
// Polling Helper
// ============================================

export interface PollOptions {
  intervalMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
}

export async function pollUploadStatus(
  id: string,
  onProgress: (status: UploadRecord) => void,
  options: PollOptions = {}
): Promise<AnalysisResults> {
  const intervalMs = options.intervalMs ?? 1000;
  const maxAttempts = options.maxAttempts ?? 60;

  for (let i = 0; i < maxAttempts; i++) {
    if (options.signal?.aborted) {
      throw new Error('Polling aborted');
    }

    const status = await getUploadStatus(id);
    onProgress(status);

    if (status.status === 'completed') {
      return await getUploadResults(id);
    }
    if (status.status === 'failed') {
      throw new Error(status.error || 'Analysis failed');
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('Timeout waiting for analysis');
}

// ============================================
// Legacy Endpoints (for compatibility)
// ============================================

export async function getLiveFrame(matchId: string): Promise<any> {
  const res = await fetch(`${BASE}/api/v1/vision/stream/frame/${matchId}`);
  return handle<any>(res);
}

export async function getTacticalAnalysis(
  matchId: string,
  teamSide: string
): Promise<any> {
  const res = await fetch(
    `${BASE}/api/v1/analysis/${matchId}/tactics?team_side=${teamSide}`
  );
  return handle<any>(res);
}

export async function sendChatMessage(
  matchId: string,
  query: string
): Promise<any> {
  const res = await fetch(`${BASE}/api/v1/genai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ match_id: matchId, query }),
  });
  return handle<any>(res);
}

export async function generateSpeech(
  text: string
): Promise<{ audioBase64?: string; mimeType?: string }> {
  const res = await fetch(`${BASE}/api/v1/genai/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return handle<{ audioBase64?: string; mimeType?: string }>(res);
}

export async function analyzeClip(
  matchId: string,
  clipTitle: string
): Promise<any> {
  const res = await fetch(`${BASE}/api/v1/vision/analyze-clip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ match_id: matchId, clip_title: clipTitle }),
  });
  return handle<any>(res);
}
