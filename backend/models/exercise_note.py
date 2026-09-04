from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.database import Base


class ExerciseNote(Base):
    """What one user has personalised about an exercise: the pinned note (form
    cues, seat settings, grip width) and how they load it.

    Seed exercises are shared rows with no owner, and seed_exercises() re-syncs
    their catalog metadata on every startup — so a per-user opinion about a
    seed exercise can't live on the exercise itself. It lives here, keyed by
    (user, exercise), which is also why this table already existed."""

    __tablename__ = "exercise_notes"
    __table_args__ = (UniqueConstraint("user_id", "exercise_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercises.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text, default="")
    # Overrides Exercise.load_mode for this user; NULL = follow the catalog.
    load_mode: Mapped[str | None] = mapped_column(String(8), nullable=True)
