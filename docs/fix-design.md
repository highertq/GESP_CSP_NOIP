# oj-practice P0 缺陷修复方案 + MVP 补全路线

版本锚定：Next 16.3（App Router/Turbopack）· Prisma 7.10（prisma-client generator，输出 generated/prisma）· PostgreSQL 16 · zod 4 · jose 6 · Tailwind 4
本文件为设计稿，**不含代码改动**。

---

## 一、P0 修复设计

### P0-1 答案泄露（/api/practice 任意题返回 answer）

| 项 | 内容 |
|---|---|
| 改动文件 | `app/api/practice/route.ts` |
| 具体改法 | 1) L40 `findUnique` 后插入归属校验：`const wq = await prisma.wrongQuestion.findUnique({ where: { userId_questionId: { userId: user.id, questionId } } }); if (!wq) return jsonFail("该题不在你的错题本", 404);`<br>2) L106 `answer: q.answer` → `answer: r.correct ? undefined : (wq.wrongCount >= 2 ? q.answer : null)`，并补 `hint: r.correct || wq.wrongCount >= 2 ? null : "再想一次，第二次答错后公布答案"` |
| DB 迁移 | 否 |
| 验收 | 非错题本 questionId → 404；答对时响应体无 `answer` 键 |

设计取舍：不拆独立接口（改动面最小）。攻击者须先做卷产生错题记录才能重练，4432 题批量拖走路径被切断；答对不下发堵住"用正确选项反查"旁路；`wrongCount>=2` 才公布答案既防拖库也符合"先让学生再想一次"的教学法。

**顺带（advisory，非 6 条之一）**：`app/(site)/attempt/[id]/page.tsx` L56 `qMap` 是全字段 Question Map（含 `answer`）且未被使用——死变量，后续任何人误用即泄露。删除它，或给 L51 `findMany` 加 `select` 显式白名单。

### P0-2 账号锁定 DoS（限流 key 用 username，ip 被丢弃）

| 项 | 内容 |
|---|---|
| 改动文件 | `lib/ratelimit.ts`（重写）+ `app/api/auth/login/route.ts`（L28/L37-38） |
| 具体改法 | 重写为滑窗：`check(key, rule): {blocked, retryAfterSec}` / `hit(key, rule)` / `clear(key)`，桶存 `number[]` 时间戳而非计数器。<br>双维度规则：`LOGIN_IP = {windowMs: 10min, max: 30}`（宽，防校园/机房共享出口误伤）、`LOGIN_USER = {windowMs: 10min, max: 8}`（严，防爆破）。<br>login route：`const ip = clientIp(req)` 不再 `void`；失败时 `hit(\`login:ip:${ip}\`)` **且** `hit(\`login:u:${username}\`)`；成功时两个 key 都 `clear`。删除 `isBlocked/onLoginFailure/clearBlock` 旧导出。 |
| DB 迁移 | 否 |

**硬约束（必须写进实现规格）**：
- Nginx 反代后 `x-forwarded-for` 可被客户端伪造追加。仅在 `process.env.TRUST_PROXY === "1"` 时信任 `X-Real-IP`（Nginx 侧须 `proxy_set_header X-Real-IP $remote_addr`）；否则回落 `"unknown"`（IP 维退化为全局桶，MVP 单机可接受）。
- 内存桶在 `next dev` 热重载下丢失，属已知局限；多实例部署须换 Redis——本轮不做。

### P0-3 + P0-4 掌握状态机双入口不一致

新增 `lib/mastery.ts`（唯一真源，纯函数 + 事务执行器）：

```ts
export type MasteryInput = { userId: string; questionId: string; correct: boolean; threshold: number; now: Date };
export function planMastery(prev: { wrongCount: number; masteredAt: Date | null } | null, i: MasteryInput): MasteryPlan;
export async function applyMasteryTransition(tx: Prisma.TransactionClient, i: MasteryInput): Promise<{ mastered: boolean; wrongCount: number }>;
```

| 前置状态 | 本次 | 动作 |
|---|---|---|
| 无记录 | 错 | create `wrongCount=1` |
| 无记录 | 对 | 不动作（不进错题本） |
| 有记录·未掌握 | 错 | `wrongCount+1`，`masteredAt=null` |
| 有记录·**已掌握** | 错 | `wrongCount+1`，`masteredAt=null` ← 修复不可逆 |
| 有记录·未掌握 | 对 | 取最近 `threshold` 条 AnswerLog 全对 → `masteredAt=now` |
| 有记录·已掌握 | 对 | 保持，不重复写 |

调用点收敛：
- `app/api/practice/route.ts`：删除 L63-99 手写分支，L54 事务内改调 `applyMasteryTransition(tx, {...})`。
- `app/api/attempts/route.ts`：删除 L119-125 的 upsert 循环，L99 事务内对 `logRows` 逐条调用；`threshold` 在事务外先取一次传入，避免事务内查 `AdminSetting`。

性能坑：整卷一题一次 round-trip（CSP 卷约 40 题）。先 `createMany(logRows)`，再按 `userId + questionId in [...]` 批量预取现有 WrongQuestion，plan 完批量写。DB 迁移：否。

### P0-5 服务端考试时序 + P0-6 提交去重/频控（合并改）

**Prisma schema（`PaperAttempt`）**：

```prisma
attemptNo   Int       @default(1)   // 该用户该卷第几次
deadlineAt  DateTime?               // 服务端截止 = startedAt + timeLimit*60 + 30s grace
submitToken String?   @unique
@@unique([userId, paperId, attemptNo])
@@index([userId, status])
```

**迁移注意事项（存量 11+ 行，必须手工 append SQL）**：三字段 nullable/有默认值，`ADD COLUMN` 安全；但 `attemptNo` 加唯一索引前**必须回填**，否则同用户同卷多条记录撞键失败。回填 SQL：

```sql
ALTER TABLE "PaperAttempt" ADD COLUMN IF NOT EXISTS "attemptNo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PaperAttempt" ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMPTZ;
ALTER TABLE "PaperAttempt" ADD COLUMN IF NOT EXISTS "submitToken" TEXT;
WITH r AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId","paperId" ORDER BY "startedAt") rn FROM "PaperAttempt")
UPDATE "PaperAttempt" p SET "attemptNo" = r.rn FROM r WHERE p.id = r.id;
CREATE UNIQUE INDEX IF NOT EXISTS "PaperAttempt_userId_paperId_attemptNo_key" ON "PaperAttempt"("userId","paperId","attemptNo");
UPDATE "PaperAttempt" p SET "deadlineAt" = p."startedAt" + (pp."timeLimit" || ' minutes')::interval
  FROM "Paper" pp WHERE pp.id = p."paperId" AND p."deadlineAt" IS NULL;
```

Prisma 7 的 `migrate dev` 不会生成回填逻辑，需把上面 SQL 手动贴进生成的迁移文件，或先 `db push` 再单独执行。

**接口改动**：

| 端点 | 改动 |
|---|---|
| `POST /api/attempts/start`（新增） | body `{paperId}`。事务内 count 已有 attempt 得 `attemptNo`；create `PaperAttempt{status:"STARTED", startedAt:now, deadlineAt: now + timeLimit*60 + 30s, submitToken: randomUUID()}`。同用户同卷两次开考间隔 <30s → 429。返回 `{attemptId, deadlineAt, serverNow, submitToken}` |
| `POST /api/attempts`（改） | `bodySchema` 增 `attemptId: z.string().min(1)`；事务内 `updateMany({ where: { id: attemptId, userId, status: "STARTED" }, data: { status:"SUBMITTED", ... } })`——只改得动自己的 STARTED 记录，天然幂等 + 防重放；`count===0` → 409「本次作答已结束」。`durationSec` **不再取前端值**：服务端算 `Math.min(now - startedAt, timeLimit*60 + 30)`。`now > deadlineAt` → 置 `ABANDONED` 并返回 409「已超时，本次作废」 |
| `GET /api/attempts/active?paperId=`（新增） | 返回未提交的 STARTED 记录（含 `deadlineAt`、已存答案），供刷新/换设备续答 |
| `components/do-paper.tsx` | mount 时先打 `/api/attempts/start` 拿 `deadlineAt` + `serverNow`，用 `serverNow - Date.now()` 做时钟偏移校正；`SavedState` **删除 `deadline` 字段**（L13/L37/L55-58/L73-75），localStorage 只缓存 answers/flagged/cur；倒计时以 `deadlineAt - (Date.now()+offset)` 为准；到时自动交卷（L165-169）保留 |

频控叠加：`lib/ratelimit.ts` 增 `submit:u:${userId}` 规则 `{windowMs: 60_000, max: 5}`。

---

## 二、MVP 补全路线（RICE，Reach 以"初中生备考 GESP"实际频次估）

| 序 | 缺口 | R | I | C | E | RICE | 价值 | 改动量 | 依赖 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 题目解析 `explanation` | 1.0 | 3 | 0.9 | 2 | **1.35** | 错了不知道为什么 = 错题本形同虚设，教师最痛 | `Question.explanation String?` + 管理端编辑 + 成绩单/错题卡展示；导入脚本补字段 | 需人工/LLM 补内容 |
| 2 | 错题专项组卷重练 | 0.9 | 3 | 0.9 | 2.5 | **0.97** | "只进不出"的另一半：把错题当卷子再做一遍 | `prepareExam` 已支持任意 `QRow[]`，可复用；新页 `/wrong/quiz` + 复用 do-paper；提交需支持 `paperId=null` | **依赖 P0-3/P0-4** |
| 3 | 成绩趋势对比 | 0.8 | 2 | 0.9 | 1.5 | **0.96** | 教师要看"这学生这周进步没" | 纯读，me 页加折线；无迁移 | **依赖 P0-6**（否则曲线被刷子污染） |
| 4 | 知识点标签 | 0.7 | 2 | 0.5 | 4 | 0.18 | 有价值但 4432 题打标成本高、置信度低 | `QuestionTag` 多对多 | 依赖 1 |
| 5 | 站内判题 | 0.3 | 3 | 0.4 | 8 | 0.05 | 沙箱是另一套技术栈（Docker runner）；GESP 1-4 级编程占比低 | — | 建议降级为"洛谷提交后回填链接" |

**我补充的两条更致命缺口（总监未列）**：

| 缺口 | 为什么 | 改动量 |
|---|---|---|
| A. 班级 + 教师看板 | 用户是"要拿给学生用的教师"。现在只有个人账号，教师看不到学生做了什么，此站对他就只是个题库。Reach 直接 ×40 | 中：`Class`/`ClassMember` 两表 + 邀请码 + 看板页；不动现有主流程 |
| B. 首次进入路径断裂 | 选题→开考→401 才跳登录，学生第一体验即断；且 `do-paper.tsx` L145 的 `next` 回跳丢 `/do` 后缀 | 小 |

**排序结论**：P0 六项 → A → 1 → 2 → 3 → B。知识点标签、站内判题本轮不做。

---

## 三、Out of Scope

不换技术栈、不引入 Redis、不做站内判题沙箱、不做知识点标签、不重构 `lib/md` 管线、不改 admin 既有功能（仅补 `explanation` 编辑框）。

## 四、端到端验证（开发完成后逐条执行，curl 一律 `--noproxy '*'`）

1. 非错题本 `questionId` POST `/api/practice` → 404；答对时响应体无 `answer`。
2. 账号 A 连错 9 次 → 429；同 IP 换账号 B 登录 → 成功（不再被连坐）。
3. 造 `masteredAt` 非空的错题 → 故意答错 → `SELECT "masteredAt" FROM "WrongQuestion"` → `null`。
4. 整卷路径：连续 2 次答对同一错题 → `masteredAt` 非空（验证整卷也走状态机）。
5. 提交 `durationSec=21600` → 落库 ≤ `timeLimit*60+30`。
6. 同一 `attemptId` 连发两次提交 → 第二次 409，`PaperAttempt` 只 1 条。
7. `SELECT count(*) FROM "PaperAttempt" WHERE status='STARTED' AND "deadlineAt" < now()` → 超时清理后为 0。
8. 断网刷新 do 页 → 答案恢复，倒计时按服务端 `deadlineAt` 继续（不因改本机时间延长）。
