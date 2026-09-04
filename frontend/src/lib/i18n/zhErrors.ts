/** Backend `detail` strings, translated on the way to a toast.
 *
 *  The API answers in English regardless of who is asking, so the mapping
 *  lives here rather than behind an Accept-Language header — it keeps working
 *  for responses replayed from the offline outbox, and an unknown detail still
 *  reaches the user in the server's own words. */
export const ZH_ERRORS: Record<string, string> = {
  // Auth & accounts
  'Not authenticated': '尚未登录',
  'Invalid username or password': '用户名或密码不正确',
  'Invalid token': '登录凭证无效',
  'Account disabled': '账号已停用',
  'Admin only': '仅管理员可操作',
  'Username already taken': '用户名已被占用',
  'User not found': '找不到该用户',
  'Cannot delete your own account': '不能删除自己的账号',
  'Setup already completed': '初始化已完成',
  'This token is read-only': '该令牌为只读',
  'Token not found': '找不到该令牌',

  // Workouts & sets
  'A workout is already in progress': '已有一场训练正在进行',
  'Workout not found': '找不到该训练',
  'Workout already finished': '该训练已结束',
  'Workout is not finished': '该训练尚未结束',
  'Workout is in progress — finish it in the app first': '训练正在进行中 —— 请先在 App 里结束它',
  'Complete at least one set before finishing': '至少完成一组才能结束训练',
  'Finish the workout first — this only corrects the recorded end time':
    '请先结束训练 —— 这里只用于修正已记录的结束时间',
  'End time must be after the start': '结束时间必须晚于开始时间',
  'finished_at must be after started_at': '结束时间必须晚于开始时间',
  'Set not found': '找不到该组',
  'Exercise not in workout': '该动作不在这场训练里',
  'Order must contain each exercise exactly once': '排序必须且只能包含每个动作一次',

  // Exercises
  'Exercise not found': '找不到该动作',
  'Custom exercise not found': '找不到该自建动作',
  'An exercise with that name already exists': '已存在同名动作',
  'Each exercise needs exercise_id or name': '每个动作都需要 exercise_id 或名称',
  'Pick at least one modifier': '至少选择一个变式',

  // Routines, plans & programs
  'Routine not found': '找不到该模板',
  'Plan not found': '找不到该计划',
  'Program not found': '找不到该周期方案',
  'Program lift not found': '找不到该周期动作',
  'Program has no lifts': '该周期方案没有任何动作',
  'A program needs at least one lift': '周期方案至少需要一个动作',
  'A new lift needs exercise_id and training_max': '新增动作需要 exercise_id 和训练最大重量',
  'At most 10 lifts per program': '每个周期方案最多 10 个动作',
  'Pointer beyond the lift list': '进度指针超出了动作列表范围',
  'Unknown scheme': '未知的周期模型',
  "Week beyond the scheme's cycle": '周数超出了该周期模型的长度',

  // Measurements & settings
  'Measurement not found': '找不到该测量记录',
  'Unknown measurement kind': '未知的测量类型',
  'Unit must be kg or lb': '单位只能是 kg 或 lb',
  'Webhook URL must be http(s)': 'Webhook 地址必须以 http(s) 开头',

  // Import / export
  'File too large (max 10 MB)': '文件过大（最大 10 MB）',
  'File is not UTF-8 text': '文件不是 UTF-8 文本',
  'Not a Strong export (no Date column)': '不是 Strong 的导出文件（缺少 Date 列）',
  'Not a Hevy export (missing start_time/exercise_title)':
    '不是 Hevy 的导出文件（缺少 start_time/exercise_title）',
  'Expected data.metrics[]': '数据格式错误：缺少 data.metrics[]',

  'Not found': '未找到',
}

/** Details the backend builds with an f-string — matched by shape. */
export const ZH_ERROR_PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [
    /^Exercise appears in (\d+) logged workout\(s\) — history would be lost$/,
    (m) => `该动作已出现在 ${m[1]} 场训练记录中 —— 删除会丢失历史`,
  ],
  [/^Token limit reached \((\d+)\)$/, (m) => `已达到令牌数量上限（${m[1]}）`],
  [/^Too many attempts — try again in (\d+)s$/, (m) => `尝试次数过多 —— 请 ${m[1]} 秒后重试`],
]
