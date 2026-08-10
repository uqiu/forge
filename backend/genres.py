"""Genre enrichment for workout soundtracks.

The phone captures title/artist/apple_id but no genre. The iTunes lookup API
resolves an apple_id (playbackStoreID) to its catalog entry — including
primaryGenreName — with no auth and generous batching, so genres backfill
server-side whenever the music stats are read.

Failures are silent: no network, unknown ids, rate limits — the stats simply
render without genres until a later call succeeds. Ids that a lookup already
answered (or that the catalog genuinely doesn't know) are remembered per
process so repeat visits don't re-ask iTunes for the same misses.
"""

from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models.workout import WorkoutSong

LOOKUP_URL = "https://itunes.apple.com/lookup"
BATCH = 100  # documented lookup limit is ~200 ids; stay comfortably under

# apple_ids asked this process lifetime — hits were written to the DB, the
# rest are known misses not worth re-asking until the next restart.
_attempted: set[str] = set()


def enrich_genres(db: Session, user_id: int, timeout: float = 4.0) -> None:
    """Backfill WorkoutSong.genre for this user's songs, best-effort."""
    from .models.workout import Workout  # local import to avoid cycles

    rows = db.execute(
        select(WorkoutSong)
        .join(Workout, WorkoutSong.workout_id == Workout.id)
        .where(
            Workout.owner_id == user_id,
            WorkoutSong.genre.is_(None),
            WorkoutSong.apple_id.is_not(None),
        )
    ).scalars().all()

    pending = [s for s in rows if s.apple_id not in _attempted]
    if not pending:
        return
    ids = list({s.apple_id for s in pending})

    genres: dict[str, str] = {}
    try:
        with httpx.Client(timeout=timeout) as client:
            for i in range(0, len(ids), BATCH):
                chunk = ids[i : i + BATCH]
                resp = client.get(LOOKUP_URL, params={"id": ",".join(chunk)})
                resp.raise_for_status()
                for entry in resp.json().get("results", []):
                    track_id = entry.get("trackId") or entry.get("collectionId")
                    genre = entry.get("primaryGenreName")
                    if track_id is not None and genre:
                        genres[str(track_id)] = genre
                _attempted.update(chunk)
    except Exception:
        return  # offline instance / iTunes hiccup — try again next read

    if not genres:
        return
    for song in pending:
        if song.genre is None and song.apple_id in genres:
            song.genre = genres[song.apple_id]
    db.commit()
