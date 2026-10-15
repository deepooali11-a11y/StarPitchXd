# services/vision_service/homography.py
import cv2
import numpy as np
from typing import Tuple

class PitchHomographyTransformer:
    """
    يحول إحداثيات الكاميرا ثنائية الأبعاد (Pixels) إلى إحداثيات ملعب كرة القدم القياسي (105x68 متر)
    باستخدام مصفوفة التحويل المنظوري (Homography Matrix).
    """
    PITCH_LENGTH = 105.0
    PITCH_WIDTH = 68.0

    def __init__(self, source_keypoints: np.ndarray = None, target_keypoints: np.ndarray = None):
        # نقاط افتراضية لمعايرة كاميرا البث التلفزيوني الرئيسية (Main Broadcast Camera)
        if source_keypoints is None:
            self.source_keypoints = np.array([
                [180.0, 140.0],   # الزاوية اليسرى العلوية لمنطقة الرؤية
                [1740.0, 140.0],  # الزاوية اليمنى العلوية لمنطقة الرؤية
                [1900.0, 980.0],  # الزاوية اليمنى السفلية
                [20.0, 980.0]     # الزاوية اليسرى السفلية
            ], dtype=np.float32)
        else:
            self.source_keypoints = source_keypoints.astype(np.float32)

        if target_keypoints is None:
            self.target_keypoints = np.array([
                [0.0, 0.0],
                [self.PITCH_LENGTH, 0.0],
                [self.PITCH_LENGTH, self.PITCH_WIDTH],
                [0.0, self.PITCH_WIDTH]
            ], dtype=np.float32)
        else:
            self.target_keypoints = target_keypoints.astype(np.float32)

        self.homography_matrix, _ = cv2.findHomography(
            self.source_keypoints,
            self.target_keypoints,
            method=cv2.RANSAC,
            ransacReprojThreshold=5.0
        )

    def update_calibration(self, detected_pixel_points: np.ndarray, pitch_model_points: np.ndarray) -> None:
        """تحديث مصفوفة التحويل ديناميكياً عند حركة الكاميرا."""
        if len(detected_pixel_points) >= 4:
            matrix, _ = cv2.findHomography(detected_pixel_points, pitch_model_points, cv2.RANSAC)
            if matrix is not None:
                self.homography_matrix = matrix

    def transform_points(self, points_xy: np.ndarray) -> np.ndarray:
        """
        تحويل مصفوفة من النقاط (N, 2) بالبكسل إلى إحداثيات الملعب بالمتر (N, 2).
        يتم تنفيذ العملية بشكل متجهي (Vectorized) لضمان سرعة فائقة.
        """
        if points_xy.size == 0:
            return np.empty((0, 2), dtype=np.float32)

        reshaped_points = points_xy.reshape(-1, 1, 2).astype(np.float32)
        transformed = cv2.perspectiveTransform(reshaped_points, self.homography_matrix)
        transformed_2d = transformed.reshape(-1, 2)

        # تقييد الإحداثيات داخل حدود الملعب القانونية (105x68)
        transformed_2d[:, 0] = np.clip(transformed_2d[:, 0], 0.0, self.PITCH_LENGTH)
        transformed_2d[:, 1] = np.clip(transformed_2d[:, 1], 0.0, self.PITCH_WIDTH)
        return np.round(transformed_2d, 2)
