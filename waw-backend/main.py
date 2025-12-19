# main.py  (FastAPI app)

from datetime import datetime, timedelta, timezone
from typing import Optional, List
import os
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, Depends, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import func, desc
from sqlalchemy.orm import Session
from jose import jwt, JWTError, ExpiredSignatureError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, field_validator

from db import SessionLocal
from models import User, BlinkEvent


# ---------- Auth / JWT setup ----------
SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "waw_dev_very_long_random_secret_1234567890",
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Default timezone (used for stats windows etc.)
try:
    DEFAULT_TZ = ZoneInfo("Asia/Kolkata")
except ZoneInfoNotFoundError:
    DEFAULT_TZ = timezone.utc


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Hard limit for bcrypt is 72 bytes; reject longer inputs
    if len(plain_password.encode("utf-8")) > 72:
        return False
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(tz=DEFAULT_TZ) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ---------- DB dependency ----------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- Pydantic schemas ----------
class Token(BaseModel):
    access_token: str
    token_type: str


class UserCreate(BaseModel):
    email: EmailStr
    name: str | None = None
    password: str
    consent_given: bool = False
    # New: capture timezone from user during registration
    timezone: str | None = None  # e.g. "Asia/Kolkata", "America/New_York"

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes long")
        return v


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str | None = None
    consent_given: bool
    timezone: str | None = None

    class Config:
        from_attributes = True


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class BlinkEventIn(BaseModel):
    timestamp: datetime  # client sends ISO timestamp
    blink_delta: int = 1
    session_id: str | None = None


class BlinkEventOut(BlinkEventIn):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BlinkBatchIn(BaseModel):
    events: list[BlinkEventIn]


class UserStats(BaseModel):
    total_blinks: int
    today_blinks: int
    week_blinks: int
    month_blinks: int
    total_sessions: int
    avg_blink_rate: float
    peak_hour: Optional[int]
    risk_level: str
    consistency_score: int
    total_blinks_7d_change: Optional[float] = None


class BlinkTrend(BaseModel):
    date: str
    blinks: int
    avg_rate: float


class BlinkTrends(BaseModel):
    period: str
    trend_direction: str
    data: List[BlinkTrend]
    summary: dict


# ---------- Time helpers ----------
def now_for_user(user: User | None) -> datetime:
    """
    Return 'now' in the user's timezone if set, otherwise default timezone.
    This keeps all stats windows local to the user.
    """
    tz_name = getattr(user, "timezone", None) or "Asia/Kolkata"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = DEFAULT_TZ
    return datetime.now(tz=tz)


def parse_client_timestamp(ts: datetime, user: User | None) -> datetime:
    """
    Normalize client-sent timestamp to an aware datetime in the user's timezone.
    - If ts is naive, assume it is already in user's local time and attach tz.
    - If ts is aware, convert to user's timezone.
    """
    tz_name = getattr(user, "timezone", None) or "Asia/Kolkata"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = DEFAULT_TZ

    if ts.tzinfo is None:
        return ts.replace(tzinfo=tz)
    return ts.astimezone(tz)


# ---------- FastAPI app ----------
app = FastAPI(title="Wellness at Work API", version="2.0")


# ----- CORS -----
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # add your deployed web origin later, e.g.:
    # "https://your-vercel-app.vercel.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0"}


# ---------- Current user ----------
def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> User:
    # Expect "Authorization: Bearer <token>"
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or not parts[1]:
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = parts[1].strip()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="No user in token")
        user_id = int(user_id_str)
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Auth routes ----------
@app.post("/auth/register", response_model=UserOut)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # If timezone not provided, default to IST
    tz = payload.timezone or "Asia/Kolkata"

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=get_password_hash(payload.password),
        consent_given=payload.consent_given,
        timezone=tz,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=Token)
def login_user(payload: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


# ---------- Blink ingestion ----------
@app.post("/api/blinks/batch")
def submit_blinks(
    batch: BlinkBatchIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = 0
    for ev in batch.events:
        blink = BlinkEvent(
            user_id=current_user.id,
            timestamp=parse_client_timestamp(ev.timestamp, current_user),
            blink_delta=ev.blink_delta,
            session_id=ev.session_id,
        )
        db.add(blink)
        count += 1
    db.commit()
    return {"status": "ok", "count": count, "user_id": current_user.id}


# ---------- Dashboard stats ----------
@app.get("/api/user/me/stats", response_model=UserStats)
def get_dashboard_stats(
    range_period: str = Query("week", pattern="^(day|week|month|all)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = now_for_user(current_user)
    q = db.query(BlinkEvent).filter(BlinkEvent.user_id == current_user.id)

    total_blinks = q.count()
    today_blinks = q.filter(func.date(BlinkEvent.timestamp) == func.date(now)).count()

    week_start = now - timedelta(days=7)
    week_blinks = q.filter(BlinkEvent.timestamp >= week_start).count()

    month_start = now - timedelta(days=30)
    month_blinks = q.filter(BlinkEvent.timestamp >= month_start).count()

    total_sessions = (
        db.query(func.count(func.distinct(BlinkEvent.session_id)))
        .filter(
            BlinkEvent.user_id == current_user.id,
            BlinkEvent.session_id.isnot(None),
        )
        .scalar()
        or 0
    )

    total_events = total_blinks
    avg_blink_rate = (
        15.0
        if total_events == 0
        else min(25.0, total_events / max(1, total_events / 20))
    )

    peak_hour_row = (
        db.query(
            func.extract("hour", BlinkEvent.timestamp).label("hour"),
            func.count().label("count"),
        )
        .filter(BlinkEvent.user_id == current_user.id)
        .group_by(func.extract("hour", BlinkEvent.timestamp))
        .order_by(desc("count"))
        .first()
    )
    peak_hour = int(peak_hour_row.hour) if peak_hour_row else None

    if avg_blink_rate >= 15:
        risk_level = "healthy"
    elif avg_blink_rate >= 10:
        risk_level = "warning"
    else:
        risk_level = "high_risk"

    week_ago = now - timedelta(days=14)
    prev_week_blinks = (
        q.filter(
            BlinkEvent.timestamp >= week_ago,
            BlinkEvent.timestamp < week_start,
        ).count()
    )

    change_7d = None
    if prev_week_blinks > 0:
        change_7d = ((week_blinks - prev_week_blinks) / prev_week_blinks) * 100.0

    return UserStats(
        total_blinks=total_blinks,
        today_blinks=today_blinks,
        week_blinks=week_blinks,
        month_blinks=month_blinks,
        total_sessions=total_sessions,
        avg_blink_rate=round(avg_blink_rate, 1),
        peak_hour=peak_hour,
        risk_level=risk_level,
        consistency_score=min(95, total_sessions * 5),
        total_blinks_7d_change=round(change_7d, 1) if change_7d is not None else None,
    )


# ---------- Blink history ----------
@app.get("/api/user/me/blinks", response_model=List[BlinkEventOut])
def get_my_blinks(
    range_period: str = Query(None, pattern="^(day|week|month|all)?$"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(BlinkEvent).filter(BlinkEvent.user_id == current_user.id)

    now = now_for_user(current_user)
    if range_period == "day":
        q = q.filter(func.date(BlinkEvent.timestamp) == func.date(now))
    elif range_period == "week":
        q = q.filter(BlinkEvent.timestamp >= now - timedelta(days=7))
    elif range_period == "month":
        q = q.filter(BlinkEvent.timestamp >= now - timedelta(days=30))

    q = q.order_by(desc(BlinkEvent.timestamp)).limit(limit).offset(offset)
    events = q.all()

    return [
        BlinkEventOut(
            id=e.id,
            timestamp=e.timestamp,
            blink_delta=e.blink_delta,
            session_id=e.session_id,
            created_at=e.created_at,
        )
        for e in events
    ]


# ---------- Trends ----------
@app.get("/api/user/me/trends", response_model=BlinkTrends)
def get_blink_trends(
    period: str = Query("week", pattern="^(day|week|month)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = now_for_user(current_user)
    days = 1 if period == "day" else 7 if period == "week" else 30
    from_date = now - timedelta(days=days)

    daily_stats = (
        db.query(
            func.date(BlinkEvent.timestamp).label("date"),
            func.count().label("blinks"),
        )
        .filter(
            BlinkEvent.user_id == current_user.id,
            BlinkEvent.timestamp >= from_date,
        )
        .group_by(func.date(BlinkEvent.timestamp))
        .order_by(func.date(BlinkEvent.timestamp))
        .all()
    )

    blink_counts = [row.blinks for row in daily_stats]
    trend_direction = "stable"
    if len(blink_counts) >= 2:
        recent_avg = sum(blink_counts[-3:]) / min(3, len(blink_counts))
        early_avg = sum(blink_counts[:3]) / min(3, len(blink_counts))
        if recent_avg > early_avg * 1.1:
            trend_direction = "improving"
        elif recent_avg < early_avg * 0.9:
            trend_direction = "declining"

    trend_data = [
        BlinkTrend(
            date=str(row.date),
            blinks=row.blinks,
            avg_rate=15.0,
        )
        for row in daily_stats
    ]

    avg_daily = (
        round(sum(t.blinks for t in trend_data) / len(trend_data))
        if trend_data
        else 0
    )
    best_day = max(trend_data, key=lambda x: x.blinks).date if trend_data else None

    return BlinkTrends(
        period=period,
        trend_direction=trend_direction,
        data=trend_data,
        summary={
            "total_days": len(trend_data),
            "avg_daily_blinks": avg_daily,
            "best_day": best_day,
        },
    )


# ---------- CSV Export ----------
@app.get("/api/user/me/blinks/export")
def export_blinks_csv(
    format_type: str = Query("csv"),
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if format_type != "csv":
        raise HTTPException(status_code=400, detail="Only CSV export supported")

    from_date = now_for_user(current_user) - timedelta(days=days)
    events = (
        db.query(BlinkEvent)
        .filter(
            BlinkEvent.user_id == current_user.id,
            BlinkEvent.timestamp >= from_date,
        )
        .order_by(BlinkEvent.timestamp)
        .all()
    )

    def generate_csv():
        yield "id,timestamp,blink_delta,session_id\n"
        for e in events:
            yield f'{e.id},"{e.timestamp}",{e.blink_delta},"{e.session_id or ""}"\n'

    filename = f"waw-blinks-{days}d-{datetime.now().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
