"""Genre aggregation in the music stats + per-variant family series.

Songs here carry their genre directly (apple_id=None), so enrich_genres has
no pending lookups and never touches the network.
"""
from datetime import datetime, timedelta
from types import SimpleNamespace

from backend.api.exercises import exercise_stats
from backend.api.stats import music_stats
from backend.api.workouts import _stalled
from backend.models import Exercise, WorkoutSong
from backend.serializers import visible_songs

from .conftest import log_workout, make_exercise


def add_song(db, workout, title, genre, start_min, end_min, artist="A"):
    db.add(
        WorkoutSong(
            workout_id=workout.id,
            title=title,
            artist=artist,
            genre=genre,
            apple_id=None,
            started_at=workout.started_at + timedelta(minutes=start_min),
            ended_at=workout.started_at + timedelta(minutes=end_min),
        )
    )
    db.commit()


class TestMusicGenres:
    def test_genre_share_results_and_weekdays(self, db, user):
        ex = make_exercise(db)
        # 14 sets, one every 2 min starting at +2 — first 12 inside the Metal
        # windows (one of them a PR), the last 2 inside Pop's
        sets = [{"weight": 100, "reps": 5, "rpe": 8.0} for _ in range(14)]
        sets[3]["is_pr"] = True
        sets[13]["is_pr"] = True
        w = log_workout(db, user, days_ago=2, entries=[(ex, sets)])

        add_song(db, w, "Song One", "Metal", 0, 13)
        add_song(db, w, "Song Two", "Metal", 13.1, 25)
        add_song(db, w, "Song Three", "Pop", 25.5, 40)

        out = music_stats(user=user, db=db)

        assert [g["genre"] for g in out["genres"]] == ["Metal", "Pop"]
        assert out["genres"][0]["plays"] == 2

        # Only Metal clears the 10-set gate; 12 sets, 1 PR inside its windows
        assert [r["genre"] for r in out["genre_results"]] == ["Metal"]
        metal = out["genre_results"][0]
        assert metal["sets"] == 12
        assert metal["prs"] == 1
        assert metal["pr_per_100"] == round(1 / 12 * 100, 1)
        assert metal["avg_rpe"] == 8.0

        # 3 plays on one weekday → that weekday ranks its top genre
        assert len(out["weekday_genres"]) == 1
        day = out["weekday_genres"][0]
        assert day["weekday"] == w.started_at.weekday()
        assert day["genre"] == "Metal"
        assert day["plays"] == 2 and day["total"] == 3

    def test_no_genres_yet_is_gated_not_broken(self, db, user):
        ex = make_exercise(db)
        w = log_workout(db, user, days_ago=1, entries=[(ex, [(100, 5)])])
        add_song(db, w, "Unknown", None, 0, 10)
        out = music_stats(user=user, db=db)
        assert out["songs"] == 1
        assert out["genres"] == []
        assert out["genre_results"] == []
        assert out["weekday_genres"] == []


class TestSkipSurfFilter:
    def _song(self, title, offset_s):
        return SimpleNamespace(
            title=title, started_at=datetime(2026, 8, 17, 20, 0, 0) + timedelta(seconds=offset_s)
        )

    def test_surfed_tracks_drop_settled_track_survives(self):
        songs = [
            self._song("keeper", 0),        # 214 s until the next — real listen
            self._song("skip1", 214),       # 5 s → surfed
            self._song("skip2", 219),       # 9 s → surfed
            self._song("settled", 228),     # last of the cluster — survives
        ]
        assert [s.title for s in visible_songs(songs)] == ["keeper", "settled"]

    def test_last_song_always_counts(self):
        assert [s.title for s in visible_songs([self._song("only", 0)])] == ["only"]

    def test_stats_ignore_surfed_plays(self, db, user):
        ex = make_exercise(db)
        w = log_workout(db, user, days_ago=1, entries=[(ex, [(100, 5)] * 4)])
        add_song(db, w, "Real", "Metal", 0, 4)          # 4 min before next
        add_song(db, w, "Surfed", "Pop", 4, 4.1)        # next starts 6 s later
        add_song(db, w, "Settled", "Metal", 4.1, 12)
        out = music_stats(user=user, db=db)
        assert out["songs"] == 2
        assert [g["genre"] for g in out["genres"]] == ["Metal"]


class TestStallRule:
    def test_rep_progress_inside_range_cancels_deload(self):
        sessions = [  # most recent first: totals 35, 34, 34 — still climbing
            [(30.0, 12), (30.0, 12), (30.0, 11)],
            [(30.0, 12), (30.0, 11), (30.0, 11)],
            [(30.0, 12), (30.0, 11), (30.0, 11)],
        ]
        assert _stalled(sessions, 12) is None

    def test_flat_reps_at_same_weight_still_deloads(self):
        sessions = [[(30.0, 10), (30.0, 10), (30.0, 10)]] * 3
        assert _stalled(sessions, 12) == 30.0

    def test_declining_reps_deloads(self):
        sessions = [  # most recent first: totals 28, 30, 31 — going backwards
            [(30.0, 10), (30.0, 9), (30.0, 9)],
            [(30.0, 10), (30.0, 10), (30.0, 10)],
            [(30.0, 11), (30.0, 10), (30.0, 10)],
        ]
        assert _stalled(sessions, 12) == 30.0


class TestFamilySeries:
    def _family(self, db):
        heavy = make_exercise(db, name="Incline Press")
        volume = Exercise(
            name="Incline Press (Volume)",
            muscle_group="Chest",
            equipment="Barbell",
            variant_of_id=heavy.id,
        )
        db.add(volume)
        db.commit()
        return heavy, volume

    def test_one_series_per_variant(self, db, user):
        heavy, volume = self._family(db)
        log_workout(db, user, days_ago=7, entries=[(heavy, [(80, 5)]), (volume, [(50, 12)])])
        log_workout(db, user, days_ago=3, entries=[(heavy, [(85, 5)])])

        out = exercise_stats(heavy.id, family=True, user=user, db=db)
        series = out["series"]
        assert [s["name"] for s in series] == ["Incline Press", "Incline Press (Volume)"]
        assert len(series[0]["points"]) == 2
        assert len(series[1]["points"]) == 1
        assert series[1]["points"][0]["best_weight"] == 50
        # Combined chart still merges the family per workout
        assert len(out["chart"]) == 2

    def test_no_series_without_family_flag(self, db, user):
        heavy, volume = self._family(db)
        log_workout(db, user, days_ago=3, entries=[(heavy, [(80, 5)]), (volume, [(50, 12)])])
        out = exercise_stats(heavy.id, family=False, user=user, db=db)
        assert out["series"] == []
