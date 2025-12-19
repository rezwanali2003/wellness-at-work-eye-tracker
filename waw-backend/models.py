# models.py
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from db import Base

# Default timezone: India (can be overridden per user)
DEFAULT_TZ = ZoneInfo("Asia/Kolkata")


def now_tz():
    """Return current time in the default timezone (IST by default)."""
    return datetime.now(tz=DEFAULT_TZ)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    consent_given = Column(Boolean, default=False)

    # New: store preferred timezone as IANA string, e.g. "Asia/Kolkata"
    timezone = Column(String, nullable=True, default="Asia/Kolkata")

    blink_events = relationship("BlinkEvent", back_populates="user")


class BlinkEvent(Base):
    __tablename__ = "blink_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Store timestamps as timezone-aware datetimes (default IST)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    blink_delta = Column(Integer, default=1)
    session_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_tz)

    user = relationship("User", back_populates="blink_events")
