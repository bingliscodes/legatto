from sqlalchemy.orm import Mapped, mapped_column
from datetime import date

from app.database import Base


class DailyActiveUser(Base):
    __tablename__ = "daily_active_users"

    date: Mapped[date] = mapped_column(primary_key=True)
    count: Mapped[int]
