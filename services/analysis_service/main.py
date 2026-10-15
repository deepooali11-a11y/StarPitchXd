# services/analysis_service/main.py
import os
import json
import numpy as np
from typing import Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis
from tactical_engine import TacticalAnalyticsEngine

app = FastAPI(title="VideoAnalyst X - Tactical Analysis Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
redis_client: Optional[aioredis.Redis] = None
engine = TacticalAnalyticsEngine()


@app.on_event("startup")
async def startup_event():
    global redis_client
    try:
        redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    except Exception:
        redis_client = None


async def _fetch_match_telemetry(match_id: str) -> list:
    if redis_client:
        try:
            raw_items = await redis_client.lrange(f"history:{match_id}", 0, -1)
            if raw_items:
                return [json.loads(item) for item in raw_items]
        except Exception:
            pass

    # بيانات محاكاة تكتيكية متقدمة
    synthetic_frames = []
    for f in range(150):
        t = f / 25.0
        players = []
        for i in range(1, 23):
            team = "HOME" if i <= 11 else "AWAY"
            bx = 42.0 if team == "HOME" else 65.0
            by = ((i % 11) + 1) * 5.4
            players.append({
                "track_id": i,
                "jersey": i if i <= 11 else i - 11,
                "team": team,
                "x": float(np.clip(bx + 14 * np.sin(t + i), 2, 103)),
                "y": float(np.clip(by + 8 * np.cos(t + i), 2, 66)),
                "speed_kmh": float(12.0 + (i % 15))
            })
        synthetic_frames.append({
            "frame_number": f,
            "ball": {"x": float(52.5 + 20 * np.sin(t)), "y": float(34.0 + 15 * np.cos(t))},
            "players": players
        })
    return synthetic_frames


@app.get("/api/v1/analysis/{match_id}/tactics")
async def get_tactical_analytics(
    match_id: str,
    team_side: str = Query("HOME", pattern="^(HOME|AWAY)$"),
    player_track_id: Optional[int] = Query(None)
):
    """استخراج الخريطة الحرارية، شبكة التمرير، وخريطة الضغط في استدعاء واحد عالي الأداء."""
    frames = await _fetch_match_telemetry(match_id)
    defending_side = "AWAY" if team_side == "HOME" else "HOME"

    heatmap = engine.generate_heatmap(frames, team_side=team_side, player_track_id=player_track_id)
    passing_network = engine.build_passing_network(frames, team_side=team_side)
    pressure_map = engine.compute_pressure_map(frames, defending_team=defending_side)

    return {
        "match_id": match_id,
        "team_side": team_side,
        "analyzed_frames_count": len(frames),
        "heatmap_grid": heatmap,
        "passing_network": passing_network,
        "pressure_map": pressure_map
    }
