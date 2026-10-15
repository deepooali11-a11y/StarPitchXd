# services/analysis_service/tactical_engine.py
import numpy as np
import pandas as pd
from scipy.ndimage import gaussian_filter
from scipy.spatial import ConvexHull
from scipy.spatial.distance import cdist
from typing import List, Dict, Any, Optional


class TacticalAnalyticsEngine:
    """
    محرك الحسابات التكتيكية المتقدم باستخدام NumPy, Pandas, SciPy.
    يعمل على أبعاد الملعب القياسية: الطول 105 متر × العرض 68 متر.
    """
    PITCH_LENGTH = 105
    PITCH_WIDTH = 68

    def generate_heatmap(
        self,
        telemetry_frames: List[Dict[str, Any]],
        team_side: str = "HOME",
        player_track_id: Optional[int] = None,
        sigma: float = 3.2
    ) -> List[List[float]]:
        """
        توليد مصفوفة خريطة حرارية (68x105) منكثفة بواسطة مرشح غاوسي (Gaussian Kernel Smoothing).
        """
        grid = np.zeros((self.PITCH_WIDTH, self.PITCH_LENGTH), dtype=np.float32)

        for frame in telemetry_frames:
            for p in frame.get("players", []):
                if p.get("team") != team_side:
                    continue
                if player_track_id is not None and p.get("track_id") != player_track_id:
                    continue

                x_idx = int(np.clip(round(p["x"]), 0, self.PITCH_LENGTH - 1))
                y_idx = int(np.clip(round(p["y"]), 0, self.PITCH_WIDTH - 1))
                grid[y_idx, x_idx] += 1.0

        smoothed = gaussian_filter(grid, sigma=sigma)
        max_val = float(smoothed.max())
        if max_val > 0:
            smoothed = smoothed / max_val

        return np.round(smoothed, 3).tolist()

    def build_passing_network(
        self,
        telemetry_frames: List[Dict[str, Any]],
        team_side: str = "HOME"
    ) -> Dict[str, Any]:
        """
        بناء شبكة التمرير (Passing Network) وحساب المساحة التكتيكية المحدبة (Convex Hull Area):
        1. استخراج حامل الكرة في كل إطار (أقرب لاعب للكرة ضمن مسافة أقل من 2.8 متر).
        2. رصد انتقال الكرة بين لاعبين من نفس الفريق باعتباره تمريرة ناجحة.
        3. حساب متوسط تمركز كل لاعب باستخدام Pandas DataFrame.
        """
        player_records = []
        possession_sequence = []

        for frame in telemetry_frames:
            ball = frame.get("ball", {"x": 52.5, "y": 34.0})
            ball_vec = np.array([ball["x"], ball["y"]])
            closest_player = None
            min_dist = 999.0

            for p in frame.get("players", []):
                if p.get("team") == team_side:
                    player_records.append({
                        "track_id": p["track_id"],
                        "jersey": p.get("jersey", p["track_id"]),
                        "x": p["x"],
                        "y": p["y"]
                    })

                p_vec = np.array([p["x"], p["y"]])
                dist = float(np.linalg.norm(p_vec - ball_vec))
                if dist < min_dist:
                    min_dist = dist
                    closest_player = p

            if closest_player and min_dist <= 2.8:
                possession_sequence.append((
                    frame["frame_number"],
                    closest_player["track_id"],
                    closest_player["team"]
                ))

        if not player_records:
            return {"nodes": [], "edges": [], "team_convex_hull_area_m2": 0.0}

        df = pd.DataFrame(player_records)
        centroids = df.groupby(["track_id", "jersey"], as_index=False).agg(
            avg_x=("x", "mean"),
            avg_y=("y", "mean"),
            touches=("x", "count")
        )

        edges_counter: Dict[tuple, int] = {}
        prev_holder = None
        prev_team = None

        for _, holder_id, holder_team in possession_sequence:
            if holder_team == team_side:
                if prev_team == team_side and prev_holder is not None and prev_holder != holder_id:
                    pair = (prev_holder, holder_id)
                    edges_counter[pair] = edges_counter.get(pair, 0) + 1
            prev_holder = holder_id
            prev_team = holder_team

        pass_involvement: Dict[int, int] = {}
        edges = []
        for (src, dst), count in edges_counter.items():
            edges.append({"source": int(src), "target": int(dst), "weight": int(count)})
            pass_involvement[src] = pass_involvement.get(src, 0) + count
            pass_involvement[dst] = pass_involvement.get(dst, 0) + count

        nodes = []
        for _, row in centroids.iterrows():
            tid = int(row["track_id"])
            nodes.append({
                "track_id": tid,
                "jersey": int(row["jersey"]),
                "avg_x": round(float(row["avg_x"]), 2),
                "avg_y": round(float(row["avg_y"]), 2),
                "pass_count": pass_involvement.get(tid, max(1, int(row["touches"] // 15)))
            })

        hull_area = 0.0
        if len(nodes) >= 3:
            pts = np.array([[n["avg_x"], n["avg_y"]] for n in nodes])
            try:
                hull = ConvexHull(pts)
                hull_area = round(float(hull.volume), 2)
            except Exception:
                hull_area = 0.0

        return {
            "nodes": nodes,
            "edges": edges,
            "team_convex_hull_area_m2": hull_area
        }

    def compute_pressure_map(
        self,
        telemetry_frames: List[Dict[str, Any]],
        defending_team: str = "AWAY"
    ) -> Dict[str, Any]:
        """
        توليد خريطة الضغط التكتيكي على شبكة 34x52.
        """
        grid_w, grid_l = 34, 52
        x_coords = np.linspace(0, self.PITCH_LENGTH, grid_l)
        y_coords = np.linspace(0, self.PITCH_WIDTH, grid_w)
        xx, yy = np.meshgrid(x_coords, y_coords)
        pitch_cells = np.column_stack([xx.ravel(), yy.ravel()])

        accumulated_pressure = np.zeros(len(pitch_cells), dtype=np.float32)
        sampled_frames = telemetry_frames[-100:] if len(telemetry_frames) > 100 else telemetry_frames

        if not sampled_frames:
            return {"grid": np.zeros((grid_w, grid_l)).tolist(), "high_pressure_zones_count": 0}

        for frame in sampled_frames:
            defenders = [p for p in frame.get("players", []) if p.get("team") == defending_team]
            if not defenders:
                continue

            def_coords = np.array([[d["x"], d["y"]] for d in defenders])
            def_speeds = np.array([1.0 + (d.get("speed_kmh", 0.0) / 30.0) for d in defenders])

            distances = cdist(pitch_cells, def_coords, metric="euclidean")
            influence = np.exp(-(distances ** 2) / (2 * (7.5 ** 2))) * def_speeds
            accumulated_pressure += influence.sum(axis=1)

        accumulated_pressure /= len(sampled_frames)
        max_p = float(accumulated_pressure.max())
        if max_p > 0:
            accumulated_pressure /= max_p

        pressure_grid = np.round(accumulated_pressure.reshape((grid_w, grid_l)), 3)
        high_pressure_zones = int(np.sum(pressure_grid >= 0.70))

        return {
            "grid": pressure_grid.tolist(),
            "high_pressure_zones_count": high_pressure_zones
        }
