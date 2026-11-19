from collections.abc import Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{settings.data_dir / 'app.db'}",
    connect_args={"check_same_thread": False, "timeout": 30},
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")  # API requests and worker threads write concurrently
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db


def init_db() -> None:
    from . import models  # noqa: F401  (register tables)

    Base.metadata.create_all(engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """`create_all` never alters an existing table, so new columns are added by hand."""
    with engine.begin() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(meetings)"))}
        if "owner_id" not in columns:
            conn.execute(text("ALTER TABLE meetings ADD COLUMN owner_id VARCHAR(64)"))
            conn.execute(text("CREATE INDEX ix_meetings_owner_id ON meetings (owner_id)"))
        if "meeting_at" not in columns:
            conn.execute(text("ALTER TABLE meetings ADD COLUMN meeting_at DATETIME"))
            conn.execute(text("UPDATE meetings SET meeting_at = created_at WHERE meeting_at IS NULL"))


def assign_legacy_meetings(old_id: str, owned_meeting_id: str) -> int:
    from sqlalchemy import update

    from .models import Meeting

    with SessionLocal.begin() as db:
        target = db.get(Meeting, owned_meeting_id)
        if target is None or not target.owner_id:
            raise ValueError("Choose a meeting created in the intended owner's browser after the upgrade.")
        stmt = update(Meeting).where(Meeting.owner_id.is_(None))
        if old_id != "all":
            stmt = stmt.where(Meeting.id == old_id)
        return db.execute(stmt.values(owner_id=target.owner_id)).rowcount
