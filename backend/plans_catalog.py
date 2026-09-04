"""Built-in training plans — adopted into a user's own templates on demand.
Exercise names must match the global seed catalogue exactly.

Each exercise entry: (seed exercise name, set count, rest seconds).
"""

PLANS = [
    {
        "key": "stronglifts-5x5",
        "name": "StrongLifts 5×5",
        "description": (
            "The classic barbell beginner program. Alternate Workout A and B three "
            "days a week, adding a little weight every session."
        ),
        "routines": [
            {
                "name": "5×5 — Workout A",
                "exercises": [
                    ("Back Squat", 5, 180),
                    ("Bench Press", 5, 180),
                    ("Barbell Row", 5, 180),
                ],
            },
            {
                "name": "5×5 — Workout B",
                "exercises": [
                    ("Back Squat", 5, 180),
                    ("Overhead Press", 5, 180),
                    ("Deadlift", 1, 240),
                ],
            },
        ],
    },
    {
        "key": "ppl",
        "name": "Push / Pull / Legs",
        "description": (
            "The classic hypertrophy split. Run it three days a week, or six by "
            "repeating the cycle."
        ),
        "routines": [
            {
                "name": "Push Day",
                "exercises": [
                    ("Bench Press", 4, 150),
                    ("Overhead Press", 3, 120),
                    ("Incline Dumbbell Press", 3, 90),
                    ("Lateral Raise", 3, 60),
                    ("Tricep Pushdown", 3, 60),
                ],
            },
            {
                "name": "Pull Day",
                "exercises": [
                    ("Deadlift", 3, 180),
                    ("Pull-Up", 3, 120),
                    ("Barbell Row", 3, 120),
                    ("Face Pull", 3, 60),
                    ("Bicep Curl", 3, 60),
                ],
            },
            {
                "name": "Leg Day",
                "exercises": [
                    ("Back Squat", 4, 180),
                    ("Romanian Deadlift", 3, 120),
                    ("Leg Press", 3, 90),
                    ("Leg Curl", 3, 60),
                    ("Calf Raise", 4, 60),
                ],
            },
        ],
    },
    {
        "key": "upper-lower",
        "name": "Upper / Lower",
        "description": (
            "Four days a week, two upper and two lower sessions. A great middle "
            "ground between full body and a full split."
        ),
        "routines": [
            {
                "name": "Upper Body",
                "exercises": [
                    ("Bench Press", 4, 150),
                    ("Barbell Row", 4, 150),
                    ("Overhead Press", 3, 120),
                    ("Lat Pulldown", 3, 90),
                    ("Bicep Curl", 2, 60),
                    ("Tricep Pushdown", 2, 60),
                ],
            },
            {
                "name": "Lower Body",
                "exercises": [
                    ("Back Squat", 4, 180),
                    ("Romanian Deadlift", 3, 150),
                    ("Leg Press", 3, 90),
                    ("Leg Curl", 3, 60),
                    ("Calf Raise", 3, 60),
                    ("Hanging Leg Raise", 3, 60),
                ],
            },
        ],
    },
    {
        "key": "w-a",
        "name": "w-a计划",
        "description": (
            "哑铃为主的 A 日：下肢 + 水平推 + 垂直拉。与 w-b计划 交替进行。"
        ),
        "routines": [
            {
                "name": "w-a计划",
                "exercises": [
                    ("Goblet Squat", 4, 120),
                    ("Dumbbell Bench Press", 4, 120),
                    ("Pull-Up", 3, 120),
                    ("Dumbbell Romanian Deadlift", 3, 120),
                    ("Incline Dumbbell Press", 3, 90),
                    ("Bicep Curl", 3, 60),
                ],
            },
        ],
    },
    {
        "key": "w-b",
        "name": "w-b计划",
        "description": (
            "哑铃为主的 B 日：垂直推 + 水平拉 + 单腿，收尾练三角肌后束、"
            "三头与核心。与 w-a计划 交替进行。"
        ),
        "routines": [
            {
                "name": "w-b计划",
                "exercises": [
                    ("Seated Dumbbell Press", 4, 120),
                    ("Dumbbell Row", 4, 90),
                    ("Bulgarian Split Squat", 3, 120),
                    ("Rear Delt Fly", 3, 60),
                    ("Lateral Raise", 3, 60),
                    ("Tricep Extension", 3, 60),
                    ("Hanging Knee Raise", 3, 60),
                ],
            },
        ],
    },
    {
        "key": "full-body",
        "name": "Full Body 3×",
        "description": (
            "One template, three times a week. The simplest way to train the whole "
            "body with the big lifts."
        ),
        "routines": [
            {
                "name": "Full Body",
                "exercises": [
                    ("Back Squat", 3, 180),
                    ("Bench Press", 3, 150),
                    ("Barbell Row", 3, 150),
                    ("Overhead Press", 2, 120),
                    ("Bicep Curl", 2, 60),
                ],
            },
        ],
    },
]
