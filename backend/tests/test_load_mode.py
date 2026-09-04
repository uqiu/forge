"""One implement or two.

A goblet squat holds one dumbbell; a lateral raise holds one in each hand. The
weight logged is one implement's either way, so load_mode is display-only —
these tests pin down where the value comes from and that a personal override
survives the things that would otherwise wipe it.
"""

import pytest

from backend.api.exercises import LoadModeIn, NoteIn, put_load_mode, put_note
from backend.models import Exercise, ExerciseNote
from backend.seed import CATALOG, seed_exercises


@pytest.fixture()
def seeded(db):
    seed_exercises(db)
    return db


def _get(db, name):
    return db.query(Exercise).filter(Exercise.name == name, Exercise.owner_id.is_(None)).one()


class TestSeededDefaults:
    def test_single_and_pair_come_from_the_catalog(self, seeded):
        assert _get(seeded, "Goblet Squat").load_mode == "single"
        assert _get(seeded, "Dumbbell Row").load_mode == "single"
        assert _get(seeded, "Lateral Raise").load_mode == "pair"
        assert _get(seeded, "Dumbbell Bench Press").load_mode == "pair"

    def test_movements_with_no_implement_count_stay_null(self, seeded):
        # A barbell is one bar, a stack is one stack, bodyweight is neither
        for name in ("Bench Press", "Lat Pulldown", "Leg Press", "Pull-Up", "Plank"):
            assert _get(seeded, name).load_mode is None, name

    def test_only_hand_held_free_weights_carry_a_mode(self):
        wrong = [
            (name, equipment, meta["load"])
            for name, _group, equipment, meta in CATALOG
            if "load" in meta and equipment not in ("Dumbbell", "Kettlebell")
        ]
        assert wrong == []

    def test_every_mode_is_single_or_pair(self):
        modes = {meta["load"] for _n, _g, _e, meta in CATALOG if "load" in meta}
        assert modes == {"single", "pair"}

    def test_the_resync_repairs_a_row_seeded_before_the_column_existed(self, seeded):
        goblet = _get(seeded, "Goblet Squat")
        goblet.load_mode = None
        seeded.commit()

        seed_exercises(seeded)
        assert _get(seeded, "Goblet Squat").load_mode == "single"


class TestPersonalOverride:
    def test_override_is_stored_per_user_and_reports_the_effective_value(self, seeded, user):
        split = _get(seeded, "Bulgarian Split Squat")
        assert split.load_mode == "pair"  # the common default

        result = put_load_mode(split.id, LoadModeIn(load_mode="single"), user=user, db=seeded)

        assert result == {"load_mode": "single"}
        # The shared catalog row is untouched — other users still see 'pair'
        assert _get(seeded, "Bulgarian Split Squat").load_mode == "pair"

    def test_clearing_the_override_falls_back_to_the_catalog(self, seeded, user):
        split = _get(seeded, "Bulgarian Split Squat")
        put_load_mode(split.id, LoadModeIn(load_mode="single"), user=user, db=seeded)

        result = put_load_mode(split.id, LoadModeIn(load_mode=None), user=user, db=seeded)

        assert result == {"load_mode": "pair"}
        assert seeded.query(ExerciseNote).count() == 0  # nothing left to keep

    def test_an_override_survives_the_resync(self, seeded, user):
        split = _get(seeded, "Bulgarian Split Squat")
        put_load_mode(split.id, LoadModeIn(load_mode="single"), user=user, db=seeded)

        seed_exercises(seeded)

        note = seeded.query(ExerciseNote).one()
        assert note.load_mode == "single"

    def test_clearing_the_note_keeps_the_override(self, seeded, user):
        """The note and the override share a row; emptying one must not drop
        the other."""
        split = _get(seeded, "Bulgarian Split Squat")
        put_note(split.id, NoteIn(text="front foot on the 20cm box"), user=user, db=seeded)
        put_load_mode(split.id, LoadModeIn(load_mode="single"), user=user, db=seeded)

        put_note(split.id, NoteIn(text=""), user=user, db=seeded)

        note = seeded.query(ExerciseNote).one()
        assert note.text == ""
        assert note.load_mode == "single"

    def test_clearing_the_override_keeps_the_note(self, seeded, user):
        split = _get(seeded, "Bulgarian Split Squat")
        put_note(split.id, NoteIn(text="front foot on the 20cm box"), user=user, db=seeded)
        put_load_mode(split.id, LoadModeIn(load_mode="single"), user=user, db=seeded)

        put_load_mode(split.id, LoadModeIn(load_mode=None), user=user, db=seeded)

        note = seeded.query(ExerciseNote).one()
        assert note.text == "front foot on the 20cm box"
        assert note.load_mode is None

    def test_a_note_alone_leaves_the_catalog_default_in_force(self, seeded, user):
        raise_ = _get(seeded, "Lateral Raise")
        put_note(raise_.id, NoteIn(text="pinkies up"), user=user, db=seeded)

        assert seeded.query(ExerciseNote).one().load_mode is None
        assert _get(seeded, "Lateral Raise").load_mode == "pair"


class TestVolumeIsUnaffected:
    def test_load_mode_never_reaches_the_volume_formula(self, seeded, user):
        """load_mode is a label. Two exercises loaded differently but logged
        identically must produce identical volume — changing that would rewrite
        every historical number."""
        from backend.serializers import workout_totals
        from backend.tests.conftest import log_workout

        goblet = _get(seeded, "Goblet Squat")  # single
        raise_ = _get(seeded, "Lateral Raise")  # pair

        w = log_workout(seeded, user, 1, [(goblet, [(20, 10)]), (raise_, [(20, 10)])])

        totals = workout_totals(w)
        assert totals["total_volume"] == pytest.approx(400.0)
        assert totals["total_sets"] == 2
