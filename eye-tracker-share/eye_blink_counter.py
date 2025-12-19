# eye_blink_counter.py
import os
import warnings
from datetime import datetime, timedelta

import cv2
import mediapipe as mp
import numpy as np
from PyQt5.QtCore import QThread, pyqtSignal

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"  # hide TF INFO/WARNING logs

warnings.filterwarnings(
    "ignore",
    message="SymbolDatabase.GetPrototype() is deprecated",
    category=UserWarning,
    module="google.protobuf.symbol_database",
)

mp_face_mesh = mp.solutions.face_mesh
LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]


def euclidean_dist(pt1, pt2):
    return np.linalg.norm(np.array(pt1) - np.array(pt2))


def eye_aspect_ratio(eye_landmarks):
    A = euclidean_dist(eye_landmarks[1], eye_landmarks[5])
    B = euclidean_dist(eye_landmarks[2], eye_landmarks[4])
    C = euclidean_dist(eye_landmarks[0], eye_landmarks[3])
    if C == 0:
        return 0.0
    return (A + B) / (2.0 * C)


class EyeBlinkTracker(QThread):
    blink_updated = pyqtSignal(int)    # cumulative count
    error_occurred = pyqtSignal(str)
    blink_event = pyqtSignal(dict)     # per-blink event for backend

    def __init__(self, parent=None):
        super().__init__(parent)
        self._running = True
        self.EAR_THRESH = 0.21
        self.CONSEC_FRAMES = 2
        self._is_eyes_closed = False

        # Refractory window to avoid double-counting the same blink
        self._last_blink_time = None
        self.REFRACTORY_MS = 200  # ignore new blink within 200 ms

    def stop(self):
        self._running = False

    def run(self):
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            self.error_occurred.emit("Unable to open camera.")
            return

        blink_count = 0
        closed_frames = 0

        try:
            with mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            ) as face_mesh:
                while self._running:
                    ret, frame = cap.read()
                    if not ret:
                        self.error_occurred.emit("Failed to read from camera.")
                        break

                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = face_mesh.process(rgb)

                    if results.multi_face_landmarks:
                        h, w, _ = frame.shape
                        for face_landmarks in results.multi_face_landmarks:
                            left_eye = [
                                (
                                    int(face_landmarks.landmark[i].x * w),
                                    int(face_landmarks.landmark[i].y * h),
                                )
                                for i in LEFT_EYE
                            ]
                            right_eye = [
                                (
                                    int(face_landmarks.landmark[i].x * w),
                                    int(face_landmarks.landmark[i].y * h),
                                )
                                for i in RIGHT_EYE
                            ]

                            left_ear = eye_aspect_ratio(left_eye)
                            right_ear = eye_aspect_ratio(right_eye)
                            ear = (left_ear + right_ear) / 2.0

                            if ear < self.EAR_THRESH:
                                closed_frames += 1
                                if closed_frames >= self.CONSEC_FRAMES:
                                    self._is_eyes_closed = True
                            else:
                                if self._is_eyes_closed:
                                    now = datetime.utcnow()
                                    if (
                                        self._last_blink_time is None
                                        or now - self._last_blink_time
                                        >= timedelta(milliseconds=self.REFRACTORY_MS)
                                    ):
                                        blink_count += 1
                                        self._last_blink_time = now
                                        self.blink_updated.emit(blink_count)
                                        self.blink_event.emit(
                                            {
                                                "timestamp": now.isoformat() + "Z",
                                                "blink_delta": 1,
                                            }
                                        )
                                self._is_eyes_closed = False
                                closed_frames = 0
                    else:
                        self._is_eyes_closed = False
                        closed_frames = 0
        finally:
            cap.release()
            cv2.destroyAllWindows()
