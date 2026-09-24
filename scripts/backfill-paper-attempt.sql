-- P0-5/6 存量数据回填：为 PaperAttempt 增加 attemptNo / deadlineAt / submitToken，
-- 并按 (userId, paperId) 顺序回填 attemptNo，再创建唯一索引。
-- 可重复执行（IF NOT EXISTS / WHERE ... IS NULL 幂等）。

ALTER TABLE "PaperAttempt" ADD COLUMN IF NOT EXISTS "attemptNo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PaperAttempt" ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMPTZ;
ALTER TABLE "PaperAttempt" ADD COLUMN IF NOT EXISTS "submitToken" TEXT;

-- 同一用户同一卷多次作答：按开考时间排序回填 attemptNo（1,2,3...）
WITH r AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId", "paperId" ORDER BY "startedAt") AS rn
  FROM "PaperAttempt"
)
UPDATE "PaperAttempt" p SET "attemptNo" = r.rn FROM r WHERE p.id = r.id;

-- 存量记录的截止时间 = 开考时间 + 该卷时限（分钟）；新记录由代码写入
UPDATE "PaperAttempt" p
SET "deadlineAt" = p."startedAt" + (pp."timeLimit"::text || ' minutes')::interval
FROM "Paper" pp
WHERE pp.id = p."paperId" AND p."deadlineAt" IS NULL;

-- 唯一索引（与 schema 中 @@unique / @unique 命名一致）
CREATE UNIQUE INDEX IF NOT EXISTS "PaperAttempt_userId_paperId_attemptNo_key"
  ON "PaperAttempt"("userId", "paperId", "attemptNo");
CREATE UNIQUE INDEX IF NOT EXISTS "PaperAttempt_submitToken_key"
  ON "PaperAttempt"("submitToken");
