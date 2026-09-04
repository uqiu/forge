"""The built-in plans are only as good as their exercise names.

adopt_plan() looks each name up in the seed catalog and skips the ones it
can't find (`if name in seed_by_name`), so a typo doesn't raise — it quietly
produces a template with a missing exercise. These tests are the contract that
every catalogued name resolves.
"""
from backend.plans_catalog import PLANS
from backend.seed import CATALOG

SEED_NAMES = {name for name, _group, _equipment, _meta in CATALOG}


def test_every_plan_exercise_exists_in_the_seed_catalog():
    unknown = [
        (plan["key"], routine["name"], name)
        for plan in PLANS
        for routine in plan["routines"]
        for name, _sets, _rest in routine["exercises"]
        if name not in SEED_NAMES
    ]
    assert unknown == [], f"plan exercises missing from seed catalog: {unknown}"


def test_plan_keys_are_unique_and_url_safe():
    keys = [plan["key"] for plan in PLANS]
    assert len(keys) == len(set(keys))
    # The key is a path segment in /plans/{key}/adopt
    assert all(k and k == k.strip() and " " not in k and "/" not in k for k in keys)


def test_plans_carry_a_name_a_description_and_at_least_one_routine():
    for plan in PLANS:
        assert plan["name"].strip()
        assert plan["description"].strip()
        assert plan["routines"]
        for routine in plan["routines"]:
            assert routine["name"].strip()
            assert routine["exercises"]


def test_set_counts_and_rest_are_sane():
    for plan in PLANS:
        for routine in plan["routines"]:
            for name, sets, rest in routine["exercises"]:
                assert 1 <= sets <= 20, f"{plan['key']}/{name}: {sets} sets"
                # 0 is a legal "no timer"; the picker offers up to 300
                assert 0 <= rest <= 600, f"{plan['key']}/{name}: {rest}s rest"


def test_the_w_plans_are_present_with_their_full_exercise_lists():
    by_key = {plan["key"]: plan for plan in PLANS}

    a = by_key["w-a"]
    assert a["name"] == "w-a计划"
    assert [name for name, _s, _r in a["routines"][0]["exercises"]] == [
        "Goblet Squat",
        "Dumbbell Bench Press",
        "Pull-Up",
        "Dumbbell Romanian Deadlift",
        "Incline Dumbbell Press",
        "Bicep Curl",
    ]

    b = by_key["w-b"]
    assert b["name"] == "w-b计划"
    assert [name for name, _s, _r in b["routines"][0]["exercises"]] == [
        "Seated Dumbbell Press",
        "Dumbbell Row",
        "Bulgarian Split Squat",
        "Rear Delt Fly",
        "Lateral Raise",
        "Tricep Extension",
        "Hanging Knee Raise",
    ]
