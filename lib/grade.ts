// 判分纯函数（服务端专用）
// 约定见 schema.prisma 顶部：answer 字段任何读接口不得下发；判分只在提交/重练服务端进行。

export type QTypeLike = "CHOICE" | "MULTI_CHOICE" | "JUDGE" | "FILL" | "PROGRAM";

/** 判断题归一：任意常见写法 → True/False */
export function normalizeJudge(v: string): string {
  const s = v.trim().toLowerCase();
  if (["true", "t", "对", "正确", "√", "yes", "y", "1"].includes(s)) return "True";
  if (["false", "f", "错", "错误", "×", "no", "n", "0"].includes(s)) return "False";
  return v.trim();
}

/** 全角 → 半角（含全角空格）：填空/单选输入常见中文输入法全角字符，归一后判分避免误伤 */
export function toHalfWidth(v: string): string {
  return v
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

/** 填空归一：去首尾空白 + 全角转半角 + 忽略大小写 */
export function normFill(v: string): string {
  return toHalfWidth(v).trim().toLowerCase();
}

/** 多选归一：去非字母、大写、排序 → "BD"（容忍乱序与全半角） */
export function normalizeMulti(v: string): string {
  return v
    .trim()
    .toUpperCase()
    .replace(/[Ａ-Ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .split("")
    .filter((c) => /[A-Z]/.test(c))
    .sort()
    .join("");
}

export type GradeResult = {
  correct: boolean | null; // null = 不计分（大题/缺答案）
  reason: "ok" | "wrong" | "empty" | "missing" | "program";
};

export function gradeQuestion(
  q: { type: QTypeLike; answer: string | null; answersMissing: boolean },
  given: string | null | undefined,
): GradeResult {
  if (q.type === "PROGRAM") return { correct: null, reason: "program" };
  if (q.answersMissing || !q.answer) return { correct: null, reason: "missing" };
  const g = (given ?? "").trim();
  if (!g) return { correct: false, reason: "empty" };
  const ans = q.answer;
  let ok = false;
  switch (q.type) {
    case "CHOICE":
      ok = toHalfWidth(g).toUpperCase() === toHalfWidth(ans).toUpperCase();
      break;
    case "MULTI_CHOICE":
      ok = normalizeMulti(g) === normalizeMulti(ans);
      break;
    case "JUDGE":
      ok = normalizeJudge(g) === normalizeJudge(ans);
      break;
    case "FILL":
      ok = normFill(g) === normFill(ans);
      break;
    default:
      return { correct: null, reason: "missing" };
  }
  return ok ? { correct: true, reason: "ok" } : { correct: false, reason: "wrong" };
}
