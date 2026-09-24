-- P1-4/5 存量迁移：Question.explanation + PaperAttempt.questionIds + 隐藏错题组卷卷
-- 可重复执行（IF NOT EXISTS / ON CONFLICT 幂等）。

ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "PaperAttempt" ADD COLUMN IF NOT EXISTS "questionIds" JSONB;

-- 错题组卷的隐藏宿主卷（published=false，前台不可见；判分按 attempt.questionIds）
INSERT INTO "Paper" (id, slug, title, category, "timeLimit", "totalScore", published, "createdAt")
SELECT gen_random_uuid()::text, 'wrong-quiz', '错题专项重练', 'OTHER', 45, 100, false, now()
WHERE NOT EXISTS (SELECT 1 FROM "Paper" WHERE slug = 'wrong-quiz');
