# main.py  (desktop-app)

import sys
import uuid
from PyQt5.QtWidgets import (
    QApplication,
    QWidget,
    QLabel,
    QVBoxLayout,
    QHBoxLayout,
    QLineEdit,
    QPushButton,
    QMessageBox,
    QFrame,
)
from PyQt5.QtCore import Qt, QTimer

from eye_blink_counter import EyeBlinkTracker
from system_monitor import get_system_stats
from api_client import api_login, ApiError, api_submit_blinks


class LoginWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Wellness at Work – Login")
        self.resize(420, 260)

        card = QFrame()
        card.setStyleSheet("""
            QFrame {
                background-color: #181818;
                border-radius: 10px;
                border: 1px solid #2a2a2a;
            }
        """)

        title = QLabel("Wellness at Work")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("font-size: 18px; font-weight: 600; color: white;")

        subtitle = QLabel("Sign in to start blink tracking")
        subtitle.setAlignment(Qt.AlignCenter)
        subtitle.setStyleSheet("font-size: 12px; color: #BBBBBB;")

        self.email_input = QLineEdit()
        self.email_input.setPlaceholderText("Email")

        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Password")
        self.password_input.setEchoMode(QLineEdit.Password)

        for inp in (self.email_input, self.password_input):
            inp.setStyleSheet(
                "padding: 8px; border-radius: 4px; "
                "border: 1px solid #444444; background-color: #1E1E1E; color: white;"
            )

        self.login_button = QPushButton("Login")
        self.login_button.clicked.connect(self.handle_login)
        self.login_button.setStyleSheet(
            "padding: 8px; border-radius: 4px; "
            "background-color: #FFFFFF; color: black; font-weight: 500;"
        )

        inner = QVBoxLayout()
        inner.addWidget(title)
        inner.addWidget(subtitle)
        inner.addSpacing(10)
        inner.addWidget(self.email_input)
        inner.addWidget(self.password_input)
        inner.addSpacing(10)
        inner.addWidget(self.login_button)
        card.setLayout(inner)

        outer = QVBoxLayout()
        outer.addStretch()
        outer.addWidget(card)
        outer.addStretch()
        outer.setContentsMargins(40, 20, 40, 20)
        self.setLayout(outer)

        self.setStyleSheet("QWidget { background-color: #101010; }")
        self.main_window = None

    def handle_login(self):
        email = self.email_input.text().strip()
        password = self.password_input.text().strip()

        if not email or not password:
            QMessageBox.warning(self, "Error", "Email and password are required.")
            return

        try:
            token = api_login(email, password)
        except ApiError as e:
            QMessageBox.critical(self, "Login failed", str(e))
            return

        self.open_main_window(token, email)

    def open_main_window(self, token, email):
        self.main_window = MainWindow(token, email)
        self.main_window.show()
        self.close()


class MainWindow(QWidget):
    def __init__(self, token, email):
        super().__init__()
        self.token = token
        self.email = email

        # Session and offline queue for blink events
        self.session_id = str(uuid.uuid4())
        self.pending_events = []

        self.setWindowTitle("Wellness at Work")
        self.resize(700, 360)

        # Top bar
        title = QLabel("Wellness at Work")
        title.setStyleSheet("font-size: 18px; font-weight: 600; color: white;")

        user = QLabel(email)
        user.setStyleSheet("font-size: 12px; color: #BBBBBB;")

        top_bar = QHBoxLayout()
        top_bar.addWidget(title)
        top_bar.addStretch()
        top_bar.addWidget(user)

        # Blink card
        blink_card = QFrame()
        blink_card.setStyleSheet("""
            QFrame {
                background-color: #181818;
                border-radius: 10px;
                border: 1px solid #2a2a2a;
            }
        """)
        blink_layout = QVBoxLayout()
        blink_title = QLabel("Blink counter")
        blink_title.setAlignment(Qt.AlignCenter)
        blink_title.setStyleSheet("font-size: 12px; color: #AAAAAA;")

        self.blink_label = QLabel("0")
        self.blink_label.setAlignment(Qt.AlignCenter)
        self.blink_label.setStyleSheet(
            "font-size: 42px; font-weight: 700; color: white;"
        )

        blink_layout.addWidget(blink_title)
        blink_layout.addWidget(self.blink_label)
        blink_card.setLayout(blink_layout)

        # System card
        system_card = QFrame()
        system_card.setStyleSheet("""
            QFrame {
                background-color: #181818;
                border-radius: 10px;
                border: 1px solid #2a2a2a;
            }
        """)
        sys_layout = QVBoxLayout()

        self.cpu_label = QLabel("CPU: - %")
        self.mem_label = QLabel("Memory: - MB")
        self.power_label = QLabel("Energy: -")
        self.status_label = QLabel("System load: -")

        for lbl in (self.cpu_label, self.mem_label, self.power_label, self.status_label):
            lbl.setAlignment(Qt.AlignLeft)
            lbl.setStyleSheet("font-size: 12px; color: #DDDDDD;")

        sys_layout.addWidget(self.cpu_label)
        sys_layout.addWidget(self.mem_label)
        sys_layout.addWidget(self.power_label)
        sys_layout.addSpacing(4)
        sys_layout.addWidget(self.status_label)
        system_card.setLayout(sys_layout)

        center = QHBoxLayout()
        center.addWidget(blink_card, 1)
        center.addSpacing(12)
        center.addWidget(system_card, 1)

        main = QVBoxLayout()
        main.addLayout(top_bar)
        main.addSpacing(16)
        main.addLayout(center)
        main.addStretch()
        main.setContentsMargins(16, 12, 16, 12)
        self.setLayout(main)

        self.setStyleSheet("QWidget { background-color: #101010; }")

        # Tracker
        self.tracker = EyeBlinkTracker()
        self.tracker.blink_updated.connect(self.on_blink_updated)
        self.tracker.blink_event.connect(self.on_blink_event)
        self.tracker.error_occurred.connect(self.on_error)
        self.tracker.start()

        # System stats timer
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_stats)
        self.timer.start(1000)
        self.cpu_samples = []

        # Sync timer: every 15 seconds try to push pending events
        self.sync_timer = QTimer(self)
        self.sync_timer.timeout.connect(self.sync_blinks)
        self.sync_timer.start(15000)

    def on_blink_updated(self, count):
        self.blink_label.setText(str(count))

    def on_blink_event(self, ev: dict):
        ev["session_id"] = self.session_id
        self.pending_events.append(ev)

    def on_error(self, message):
        QMessageBox.critical(self, "Tracker Error", message)

    def update_stats(self):
        cpu, mem, power = get_system_stats()

        self.cpu_samples.append(cpu)
        if len(self.cpu_samples) > 300:
            self.cpu_samples.pop(0)
        avg_cpu = sum(self.cpu_samples) / len(self.cpu_samples)

        self.cpu_label.setText(f"CPU: {cpu:.1f} % (avg {avg_cpu:.1f} %)")
        self.mem_label.setText(f"Memory: {mem:.0f} MB")
        self.power_label.setText(f"Energy: {power}")

        if cpu < 40:
            load = "Low – tracking should be smooth"
        elif cpu < 75:
            load = "Medium – okay for tracking"
        else:
            load = "High – close heavy apps if tracking lags"

        self.status_label.setText(f"System load: {load}")

    def sync_blinks(self):
        if not self.pending_events:
            return

        batch = list(self.pending_events)
        try:
            api_submit_blinks(self.token, batch)
        except ApiError as e:
            print("Blink sync failed:", e)
            return

        self.pending_events.clear()

    def closeEvent(self, event):
        self.timer.stop()
        self.sync_timer.stop()
        self.tracker.stop()
        self.tracker.wait()
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    login = LoginWindow()
    login.show()
    sys.exit(app.exec_())
