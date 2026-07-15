from sqlalchemy.orm import Mapped
from datetime import datetime

from app.database import Base


class DailyActiveUser(Base):
    __tablename__ = "daily_active_users"

    date: Mapped[datetime]
    count: int
