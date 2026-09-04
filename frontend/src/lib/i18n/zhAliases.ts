/** Alternate names people actually type, keyed by the canonical English name.
 *
 *  Chinese lifting vocabulary is not standardised — a goblet squat is 高脚杯深蹲,
 *  前抱深蹲 or 抱式深蹲 depending on who taught you — so the display name in
 *  `zhCatalog.ts` can only ever be one of several right answers. These are the
 *  others, plus the English abbreviations that get typed instead of the full
 *  name (RDL, OHP).
 *
 *  Search-only: nothing here is ever rendered, so an alias never has to be the
 *  "best" name, only a plausible thing to type. Keys must exist in the seed
 *  catalog — `npm run check:aliases` fails on a typo. */
export const ZH_ALIASES: Record<string, string[]> = {
  // ── Squats ───────────────────────────────────────────────────────────────
  'Back Squat': ['深蹲', '后蹲', '背蹲'],
  'Front Squat': ['前架深蹲', '颈前深蹲'],
  'Goblet Squat': ['前抱深蹲', '抱式深蹲', '哑铃深蹲'],
  'Zercher Squat': ['泽奇抱蹲'],
  'Box Squat': ['箱蹲'],
  'Hack Squat': ['哈克机深蹲'],
  'Pistol Squat': ['手枪蹲', '单腿深蹲'],
  'Bulgarian Split Squat': ['保加利亚剪蹲', '保加利亚深蹲', '后脚抬高分腿蹲'],
  'Barbell Bulgarian Split Squat': ['杠铃保加利亚剪蹲'],
  'Leg Press': ['倒蹬', '腿推', '倒蹬机'],
  'Smith Machine Squat': ['史密斯深蹲'],

  // ── Hinges & deadlifts ───────────────────────────────────────────────────
  Deadlift: ['传统硬拉', '屈腿硬拉'],
  'Romanian Deadlift': ['RDL', '罗马硬拉'],
  'Dumbbell Romanian Deadlift': ['哑铃RDL'],
  'Stiff-Leg Deadlift': ['直膝硬拉'],
  'Sumo Deadlift': ['宽站距硬拉'],
  'Trap Bar Deadlift': ['六角杠铃硬拉'],
  'Rack Pull': ['架上硬拉'],
  'Good Morning': ['早安式'],
  'Back Extension': ['罗马椅挺身', '背屈伸'],
  'Hip Thrust': ['杠铃臀推', '臀冲'],
  'Glute Bridge': ['臀桥挺髋'],

  // ── Horizontal press ─────────────────────────────────────────────────────
  'Bench Press': ['平板卧推', '杠铃卧推'],
  'Incline Bench Press': ['上斜杠铃卧推'],
  'Decline Bench Press': ['下斜杠铃卧推'],
  'Close-Grip Bench Press': ['窄握卧推'],
  'Dumbbell Bench Press': ['哑铃平板卧推'],
  'Incline Dumbbell Press': ['上斜哑铃卧推'],
  'Decline Dumbbell Press': ['下斜哑铃卧推'],
  'Machine Chest Press': ['坐姿器械推胸', '器械推胸'],
  'Push-Up': ['伏地挺身'],
  Dip: ['双杠撑', '臂屈伸'],

  // ── Chest fly ────────────────────────────────────────────────────────────
  'Chest Fly': ['哑铃平板飞鸟'],
  'Incline Chest Fly': ['上斜哑铃飞鸟'],
  'Cable Fly': ['龙门夹胸', '绳索飞鸟'],
  'Pec Deck': ['蝴蝶机', '器械夹胸'],

  // ── Vertical press ───────────────────────────────────────────────────────
  'Overhead Press': ['OHP', '肩上推举', '过头推举', '军推', '站姿肩推'],
  'Seated Barbell Press': ['坐姿杠铃肩推'],
  'Seated Dumbbell Press': ['坐姿哑铃肩推', '哑铃肩推'],
  'Push Press': ['借力肩推'],
  'Machine Shoulder Press': ['器械肩上推举'],
  'Smith Machine Shoulder Press': ['史密斯肩推'],

  // ── Pull ─────────────────────────────────────────────────────────────────
  'Pull-Up': ['正握引体', '引体'],
  'Chin-Up': ['反手引体', '窄距引体'],
  'Weighted Pull-Up': ['负重引体'],
  'Assisted Pull-Up': ['辅助引体'],
  'Lat Pulldown': ['背阔肌下拉', '下拉'],
  'Machine Lat Pulldown': ['器械下拉'],
  'Straight-Arm Pulldown': ['直臂下压'],
  'Barbell Row': ['俯身杠铃划船', '俯身划船'],
  'Dumbbell Row': ['哑铃单臂划船', '单臂哑铃划船'],
  'Chest-Supported Dumbbell Row': ['俯卧哑铃划船'],
  'Seated Cable Row': ['坐姿划船', '坐姿拉划船'],
  'T-Bar Row': ['T杠划船'],
  'Chest Supported Row': ['器械胸靠划船'],
  'Inverted Row': ['仰卧划船', '反向引体'],
  Pullover: ['哑铃上拉'],

  // ── Shoulders (raises & rear delt) ───────────────────────────────────────
  'Lateral Raise': ['侧平举', '哑铃侧举'],
  'Cable Lateral Raise': ['绳索侧举'],
  'Front Raise': ['前平举'],
  'Rear Delt Fly': ['俯卧反向飞鸟', '反向飞鸟', '俯身飞鸟', '后束飞鸟'],
  'Cable Reverse Fly': ['绳索后束飞鸟'],
  'Reverse Pec Deck': ['反向蝴蝶机夹胸', '器械反向飞鸟', '器械后束飞鸟'],
  'Face Pull': ['绳索面拉'],
  'Upright Row': ['直立上拉', '窄距上拉'],
  'Barbell Shrug': ['杠铃提肩'],
  'Dumbbell Shrug': ['哑铃提肩'],

  // ── Biceps ───────────────────────────────────────────────────────────────
  'Bicep Curl': ['弯举', '哑铃二头弯举'],
  'Barbell Curl': ['杠铃二头弯举'],
  'EZ Bar Curl': ['曲杠二头弯举'],
  'Hammer Curl': ['哑铃锤式弯举', '中立握弯举'],
  'Preacher Curl': ['神父椅弯举', '牧师椅弯举'],
  'Concentration Curl': ['坐姿集中弯举'],
  'Incline Dumbbell Curl': ['上斜弯举'],
  'Cable Curl': ['绳索二头弯举'],
  'Reverse Curl': ['反握弯举'],

  // ── Triceps ──────────────────────────────────────────────────────────────
  'Skull Crusher': ['碎颅者', '仰卧曲杠臂屈伸'],
  'Tricep Extension': ['仰卧哑铃臂屈伸', '哑铃三头屈伸'],
  'Overhead Tricep Extension': ['颈后臂屈伸', '过头臂屈伸'],
  'Overhead Cable Extension': ['绳索过头臂屈伸'],
  'Tricep Pushdown': ['绳索下压', '高位下压', '三头肌下压'],
  'Bench Dip': ['凳上反屈伸'],

  // ── Legs (machines & calves) ─────────────────────────────────────────────
  'Leg Extension': ['坐姿腿屈伸', '股四头肌屈伸'],
  'Leg Curl': ['俯卧腿弯举', '腘绳肌弯举'],
  'Seated Leg Curl': ['坐姿腘绳肌弯举'],
  'Glute Ham Raise': ['GHR', '臀腿举'],
  'Nordic Hamstring Curl': ['北欧挺'],
  'Hip Abduction': ['坐姿髋外展', '外展机'],
  'Hip Adduction': ['坐姿髋内收', '内收机'],
  'Calf Raise': ['小腿提踵'],
  'Standing Calf Raise': ['站姿小腿提踵'],
  'Seated Calf Raise': ['坐姿小腿提踵'],
  'Walking Lunge': ['行走弓步', '走步箭步蹲'],
  'Reverse Lunge': ['后撤弓步'],
  'Static Lunge': ['原地弓步'],
  'Step-Up': ['上台阶', '踏箱'],
  'Cable Kickback': ['绳索后蹬'],

  // ── Core ─────────────────────────────────────────────────────────────────
  Plank: ['平板'],
  'Side Plank': ['侧平板'],
  'Hanging Leg Raise': ['悬垂直腿举腿', '悬垂抬腿'],
  'Hanging Knee Raise': ['悬垂屈膝举腿', '悬垂举膝', '悬垂提膝举腿'],
  'Cable Crunch': ['跪姿绳索卷腹'],
  'Machine Crunch': ['器械腹肌'],
  'Ab Wheel Rollout': ['腹肌轮', '健腹轮卷腹'],
  'Russian Twist': ['俄式转体'],
  'Cable Woodchop': ['绳索砍柴'],
  'Weighted Sit-Up': ['负重卷腹'],
  'Decline Sit-Up': ['下斜卷腹'],

  // ── Olympic / full body ──────────────────────────────────────────────────
  'Clean and Jerk': ['翻站挺'],
  'Power Clean': ['力量翻', '悬垂高翻'],
  Thruster: ['推举深蹲', '借力推蹲'],
  'Kettlebell Swing': ['壶铃摇摆', '壶铃甩摆'],
  "Farmer's Walk": ['农夫走', '负重行走'],
}
