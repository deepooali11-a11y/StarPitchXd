# services/vision_service/tracker.py
import time
import threading
import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO
from sklearn.cluster import KMeans
from typing import Dict, List, Any, Optional
from homography import PitchHomographyTransformer


class LowLatencyStreamReader:
    """
    قارئ بث مباشر غير متزامن (Zero-Buffer RTMP/HLS Reader)
    يحتفظ دائماً بآخر إطار وصل من الشبكة فقط لضمان زمن استجابة أقل من ثانية.
    """
    def __init__(self, stream_url: str):
        self.stream_url = stream_url
        self.cap = cv2.VideoCapture(stream_url)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.latest_frame: Optional[np.ndarray] = None
        self.running = False
        self.lock = threading.Lock()

    def start(self):
        self.running = True
        thread = threading.Thread(target=self._update, daemon=True)
        thread.start()
        return self

    def _update(self):
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.01)
                continue
            with self.lock:
                self.latest_frame = frame

    def read(self) -> Optional[np.ndarray]:
        with self.lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None

    def stop(self):
        self.running = False
        if self.cap.isOpened():
            self.cap.release()


class SportsVisionPipeline:
    """
    خط أنابيب الرؤية الحاسوبية الرئيسي:
    1. كشف اللاعبين والحكام والكرة عبر YOLOv8.
    2. تتبع الهويات عبر الإطارات بواسطة ByteTrack (Supervision).
    3. تصنيف اللاعبين إلى (HOME / AWAY) عبر K-Means Clustering لألوان القمصان.
    4. حساب السرعة اللحظية (km/h) والضغط المكاني ومؤشرات الأحداث.
    """
    PERSON_CLASS_ID = 0
    SPORTS_BALL_CLASS_ID = 32

    def __init__(self, model_weights: str = "yolov8n.pt", fps: int = 25):
        self.fps = fps
        self.model = YOLO(model_weights)
        self.byte_tracker = sv.ByteTrack(
            track_activation_threshold=0.25,
            lost_track_buffer=30,
            minimum_matching_threshold=0.8,
            frame_rate=fps
        )
        self.homography = PitchHomographyTransformer()
        self.team_kmeans: Optional[KMeans] = None
        self.previous_positions: Dict[int, np.ndarray] = {}
        self.ellipse_annotator = sv.EllipseAnnotator(thickness=2)

    def _extract_jersey_color(self, frame: np.ndarray, bbox: np.ndarray) -> np.ndarray:
        """استخراج متوسط لون منطقة الصدر للقميص لتجنب لون عشب الملعب."""
        x1, y1, x2, y2 = map(int, bbox)
        h, w = y2 - y1, x2 - x1
        crop = frame[
            max(0, y1 + int(h * 0.15)):max(1, y1 + int(h * 0.55)),
            max(0, x1 + int(w * 0.20)):max(1, x2 - int(w * 0.20))
        ]
        if crop.size == 0:
            return np.array([128.0, 128.0, 128.0])
        hsv_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        return hsv_crop.reshape(-1, 3).mean(axis=0)

    def _classify_teams(self, frame: np.ndarray, bboxes: np.ndarray) -> List[str]:
        """تصنيف اللاعبين إلى فريق مضيف (HOME) وفريق ضيف (AWAY) باستخدام K-Means."""
        if len(bboxes) < 2:
            return ["HOME" for _ in range(len(bboxes))]

        features = np.array([self._extract_jersey_color(frame, box) for box in bboxes])
        if self.team_kmeans is None and len(features) >= 4:
            self.team_kmeans = KMeans(n_clusters=2, n_init=5, random_state=42)
            self.team_kmeans.fit(features)

        if self.team_kmeans is not None:
            labels = self.team_kmeans.predict(features)
            return ["HOME" if lbl == 0 else "AWAY" for lbl in labels]
        return ["HOME" if i % 2 == 0 else "AWAY" for i in range(len(bboxes))]

    def process_frame(self, frame: np.ndarray, frame_index: int) -> Dict[str, Any]:
        """معالجة إطار واحد وإرجاع القياسات المكانية والسرعات والأحداث المكتشفة."""
        t_start = time.perf_counter()

        # تشغيل نموذج YOLO مع تصفية فئات الأشخاص والكرة فقط
        results = self.model(
            frame,
            classes=[self.PERSON_CLASS_ID, self.SPORTS_BALL_CLASS_ID],
            conf=0.25,
            verbose=False
        )[0]
        detections = sv.Detections.from_ultralytics(results)

        # فصل الكرة عن اللاعبين
        ball_detections = detections[detections.class_id == self.SPORTS_BALL_CLASS_ID]
        player_detections = detections[detections.class_id == self.PERSON_CLASS_ID]

        # تحديث ByteTrack للاعبين
        tracked_players = self.byte_tracker.update_with_detections(player_detections)

        # حساب نقاط ارتكاز أقدام اللاعبين (Bottom Center) وتحويلها لإحداثيات الملعب (105x68)
        if len(tracked_players) > 0:
            player_anchors_px = tracked_players.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            player_pitch_coords = self.homography.transform_points(player_anchors_px)
            teams = self._classify_teams(frame, tracked_players.xyxy)
        else:
            player_pitch_coords = np.empty((0, 2))
            teams = []

        # تحديد موقع الكرة في الملعب
        ball_coord = np.array([52.5, 34.0])  # افتراضياً منتصف الملعب في حال اختفاء الكرة لحظياً
        if len(ball_detections) > 0:
            ball_anchor_px = ball_detections.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            ball_coord = self.homography.transform_points(ball_anchor_px)[0]

        players_telemetry = []
        dt = 1.0 / self.fps

        for idx, track_id in enumerate(tracked_players.tracker_id):
            tid = int(track_id)
            pos = player_pitch_coords[idx]
            team_side = teams[idx]

            # حساب السرعة اللحظية بالكيلومتر/ساعة مع تنعيم القيم الشاذة
            speed_kmh = 0.0
            if tid in self.previous_positions:
                dist_m = float(np.linalg.norm(pos - self.previous_positions[tid]))
                raw_speed_kmh = (dist_m / dt) * 3.6
                speed_kmh = round(min(raw_speed_kmh, 38.5), 2)
            self.previous_positions[tid] = pos

            players_telemetry.append({
                "track_id": tid,
                "jersey": (tid % 22) + 1,
                "team": team_side,
                "x": float(pos[0]),
                "y": float(pos[1]),
                "speed_kmh": speed_kmh
            })

        # حساب مؤشر الضغط اللحظي حول الكرة (عدد لاعبي الخصم ضمن دائرة نصف قطرها 8 أمتار)
        ball_distances = [
            np.linalg.norm(np.array([p["x"], p["y"]]) - ball_coord)
            for p in players_telemetry
        ]
        pressing_players_count = sum(1 for d in ball_distances if d <= 8.0)
        pressure_index = round(min(1.0, pressing_players_count / 4.0), 2)

        latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)

        return {
            "frame_number": frame_index,
            "timestamp_ms": int((frame_index / self.fps) * 1000),
            "video_timestamp_sec": round(frame_index / self.fps, 2),
            "latency_ms": latency_ms,
            "ball": {"x": float(ball_coord[0]), "y": float(ball_coord[1])},
            "pressure_index": pressure_index,
            "players": players_telemetry
        }
